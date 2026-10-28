// ============================================
// Backups: encryption, snapshot, schedule, retention, run, restore --json
// ============================================
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const b = require('../utils/backup');

const KEY_HEX = 'a'.repeat(64);
const key = b.keyFrom(KEY_HEX);

// A tiny fake Mongo db: { users: [...], appointments: [...] }
function fakeDb(data) {
  const runs = [];
  return {
    databaseName: 'docconnect',
    listCollections: () => ({ toArray: async () => Object.keys(data).concat(['backupruns', 'system.views']).map((name) => ({ name })) }),
    collection: (name) => (name === 'backupruns'
      ? { insertOne: async (d) => runs.push(d), find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => runs, next: async () => runs.filter((r) => r.ok).slice(-1)[0] || null }) }) }) }
      : { find: () => ({ toArray: async () => data[name] }) }),
    runs,
  };
}

test('key: hex used directly, passphrase stretched, too short refused', () => {
  assert.strictEqual(key.length, 32);
  assert.strictEqual(b.keyFrom('correct horse battery staple').length, 32);
  assert.strictEqual(b.keyFrom('short'), null);
  assert.strictEqual(b.keyFrom(''), null);
});

test('encrypt → decrypt round trip; wrong key and tampering are refused', () => {
  const file = b.encrypt(Buffer.from('patient data'), key);
  assert.ok(file.subarray(0, 6).equals(Buffer.from('PMZBK1')));
  assert.ok(!file.includes(Buffer.from('patient data'))); // not readable
  assert.strictEqual(b.decrypt(file, key).toString(), 'patient data');
  assert.throws(() => b.decrypt(file, b.keyFrom('b'.repeat(64))), /Wrong BACKUP_KEY/);
  const bad = Buffer.from(file); bad[bad.length - 1] ^= 1;
  assert.throws(() => b.decrypt(bad, key), /Wrong BACKUP_KEY|damaged/);
  assert.throws(() => b.decrypt(Buffer.from('hello'), key), /Not a ProMedicoz backup/);
});

test('snapshot keeps ObjectIds and Dates exact; skips system + log collections', async () => {
  const id = new mongoose.Types.ObjectId();
  const when = new Date('2026-10-28T09:00:00Z');
  const db = fakeDb({ users: [{ _id: id, name: 'Bharti', createdAt: when }], appointments: [] });
  const snap = await b.buildSnapshot(db);
  assert.deepStrictEqual(Object.keys(snap.collections).sort(), ['appointments', 'users']);
  assert.deepStrictEqual(snap.counts, { appointments: 0, users: 1 });
  const back = b.unpack(b.pack(snap, key), key);
  assert.ok(back.collections.users[0]._id instanceof mongoose.mongo.ObjectId);
  assert.strictEqual(String(back.collections.users[0]._id), String(id));
  assert.ok(back.collections.users[0].createdAt instanceof Date);
  assert.strictEqual(back.collections.users[0].createdAt.toISOString(), when.toISOString());
});

test('nightly: after 02:30 IST, once per IST day', () => {
  const ist = (s) => new Date(`${s}+05:30`).getTime();
  assert.strictEqual(b.nightlyDue(ist('2026-10-29T02:00:00'), null), false);
  assert.strictEqual(b.nightlyDue(ist('2026-10-29T02:31:00'), null), true);
  assert.strictEqual(b.nightlyDue(ist('2026-10-29T02:31:00'), new Date(ist('2026-10-28T02:31:00'))), true);
  assert.strictEqual(b.nightlyDue(ist('2026-10-29T15:00:00'), new Date(ist('2026-10-29T02:31:00'))), false);
});

test('retention: keeps newest 14', () => {
  const res = Array.from({ length: 17 }, (_, i) => ({ public_id: `p${i}`, created_at: new Date(2026, 9, i + 1).toISOString() }));
  assert.deepStrictEqual(b.toPrune(res).sort(), ['p0', 'p1', 'p2']);
  assert.deepStrictEqual(b.toPrune(res.slice(0, 5)), []);
});

test('run: refused without BACKUP_KEY; full run uploads privately, prunes, logs', async () => {
  delete process.env.BACKUP_KEY;
  assert.match((await b.runBackup({ db: fakeDb({}) })).error, /BACKUP_KEY/);

  process.env.BACKUP_KEY = KEY_HEX;
  Object.assign(process.env, { CLOUDINARY_CLOUD_NAME: 'c', CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's' });
  let uploaded = null; let opts = null; let deleted = null;
  cloudinary.uploader.upload_stream = (o, cb) => ({ end: (buf) => { uploaded = buf; opts = o; cb(null, { public_id: `${o.folder}/${o.public_id}` }); } });
  cloudinary.api.resources = async () => ({ resources: Array.from({ length: 15 }, (_, i) => ({ public_id: `promedicoz/backups/x${i}.pmzbak`, bytes: 10, created_at: new Date(2026, 9, i + 1).toISOString() })) });
  cloudinary.api.delete_resources = async (ids) => { deleted = ids; };

  const db = fakeDb({ users: [{ _id: new mongoose.Types.ObjectId(), name: 'Bharti' }] });
  const r = await b.runBackup({ trigger: 'test', db });
  assert.strictEqual(r.ok, true, r.error);
  assert.strictEqual(opts.type, 'private');
  assert.strictEqual(opts.resource_type, 'raw');
  assert.match(opts.public_id, /^backup-\d{8}-\d{4}\.pmzbak$/);
  assert.ok(!uploaded.includes(Buffer.from('Bharti')));          // encrypted
  assert.strictEqual(b.unpack(uploaded, key).collections.users[0].name, 'Bharti');
  assert.deepStrictEqual(deleted, ['promedicoz/backups/x0.pmzbak']); // 15 stored → oldest 1 deleted
  assert.strictEqual(db.runs.length, 1);
  assert.strictEqual(db.runs[0].ok, true);
  assert.ok(!JSON.stringify(db.runs[0]).includes('Bharti'));      // log holds counts only

  // nightly: already done today → no second run
  assert.strictEqual(await b.maybeRunNightly(Date.now(), db), null);
});

test('download link only for backup files', () => {
  assert.throws(() => b.downloadUrl('promedicoz/profile/photo.jpg'), /Not a backup/);
  assert.match(b.downloadUrl('promedicoz/backups/backup-20261028-0230.pmzbak'), /^https:\/\//);
});

test('restore tool: --json shows what is inside (no database touched)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmz-'));
  const file = path.join(dir, 'b.pmzbak');
  const out = path.join(dir, 'out.json');
  fs.writeFileSync(file, b.pack({ version: 1, createdAt: new Date(), database: 'docconnect', counts: { users: 1 }, collections: { users: [{ name: 'Bharti' }] } }, key));
  const log = execFileSync(process.execPath, [path.join(__dirname, '../scripts/restore-backup.js'), file, '--json', out], { env: { ...process.env, BACKUP_KEY: KEY_HEX } }).toString();
  assert.match(log, /users\s+1/);
  assert.match(fs.readFileSync(out, 'utf8'), /Bharti/);
  assert.throws(() => execFileSync(process.execPath, [path.join(__dirname, '../scripts/restore-backup.js'), file, '--json', out], { env: { ...process.env, BACKUP_KEY: 'c'.repeat(64) }, stdio: 'pipe' }));
  fs.rmSync(dir, { recursive: true, force: true });
});
