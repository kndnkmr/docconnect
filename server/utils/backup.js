// ============================================
// Database backups — nightly, encrypted, private, last 14 kept
// ============================================
// MongoDB Atlas M0 (free) has no backups, so the server makes its own:
//
//   1. Read every collection (patients, doctors, appointments, prescriptions,
//      reports, …) and serialise it as Extended JSON (keeps ObjectIds and
//      Dates exact, so a restore is faithful).
//   2. gzip it (≈ 1 MB of data today → a few hundred KB).
//   3. Encrypt with AES-256-GCM using BACKUP_KEY (set only on Render). The
//      file is useless without that key — including to Cloudinary.
//   4. Upload to Cloudinary as a PRIVATE raw file (no public URL; downloads
//      need a short-lived signed link, given only to admins).
//   5. Keep the newest 14, delete older ones.
//
// Runs nightly at ~02:30 IST (checked every 10 min, so a restart catches up)
// and on demand from Admin → Overview → "Back up now".
// Restore: server/scripts/restore-backup.js (see HOW_IT_WORKS.md).
//
// File format (.pmzbak): "PMZBK1" (6 bytes) | IV (12) | GCM tag (16) | ciphertext

const crypto = require('crypto');
const zlib = require('zlib');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

const MAGIC = Buffer.from('PMZBK1');
const KEEP = 14;
const FOLDER = 'promedicoz/backups';
const RUNS = 'backupruns'; // small log collection (not itself backed up twice)
const EJSON = () => mongoose.mongo.BSON.EJSON;

// ---- Key + encryption (pure, unit-tested) ----

// BACKUP_KEY: 64 hex chars (from `openssl rand -hex 32`) is used directly;
// anything else (≥ 16 chars) is stretched with scrypt. Returns 32 bytes or null.
function keyFrom(secret) {
  const s = String(secret || '').trim();
  if (/^[0-9a-f]{64}$/i.test(s)) return Buffer.from(s, 'hex');
  if (s.length >= 16) return crypto.scryptSync(s, 'promedicoz-backup-v1', 32);
  return null;
}

function encrypt(plain, key) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), body]);
}

function decrypt(file, key) {
  if (!Buffer.isBuffer(file) || file.length < 34 || !file.subarray(0, 6).equals(MAGIC)) {
    throw new Error('Not a ProMedicoz backup file');
  }
  const iv = file.subarray(6, 18);
  const tag = file.subarray(18, 34);
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  try {
    return Buffer.concat([d.update(file.subarray(34)), d.final()]);
  } catch {
    throw new Error('Wrong BACKUP_KEY, or the file is damaged');
  }
}

// ---- Snapshot ----

// { version, createdAt, database, counts: {name: n}, collections: {name: [docs]} }
async function buildSnapshot(db) {
  const list = await db.listCollections({}, { nameOnly: true }).toArray();
  const names = list.map((c) => c.name).filter((n) => !n.startsWith('system.') && n !== RUNS).sort();
  const collections = {};
  const counts = {};
  for (const name of names) {
    const docs = await db.collection(name).find({}).toArray();
    collections[name] = docs;
    counts[name] = docs.length;
  }
  return { version: 1, createdAt: new Date(), database: db.databaseName, counts, collections };
}

const pack = (snapshot, key) => encrypt(zlib.gzipSync(Buffer.from(EJSON().stringify(snapshot, { relaxed: false }))), key);
const unpack = (file, key) => EJSON().parse(zlib.gunzipSync(decrypt(file, key)).toString('utf8'), { relaxed: false });

// ---- Scheduling + retention (pure, unit-tested) ----

const istParts = (ms) => {
  const d = new Date(ms + 330 * 60000);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
};

// Nightly run due? After 02:30 IST, and no successful backup yet today (IST).
function nightlyDue(now, lastOkAt) {
  const n = istParts(now);
  if (n.minutes < 2 * 60 + 30) return false;
  return !lastOkAt || istParts(new Date(lastOkAt).getTime()).date !== n.date;
}

// Which stored backups to delete (keep the newest KEEP).
function toPrune(resources, keep = KEEP) {
  return [...resources]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(keep)
    .map((r) => r.public_id);
}

// ---- Cloudinary ----

function cloudReady() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return false;
  cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
  return true;
}

const uploadPrivate = (buf, publicId) => new Promise((resolve, reject) => {
  const s = cloudinary.uploader.upload_stream(
    { resource_type: 'raw', type: 'private', folder: FOLDER, public_id: publicId, overwrite: false, use_filename: false },
    (err, res) => (err ? reject(err) : resolve(res))
  );
  s.end(buf);
});

async function listStored() {
  const r = await cloudinary.api.resources({ resource_type: 'raw', type: 'private', prefix: `${FOLDER}/`, max_results: 100 });
  return (r.resources || []).map((x) => ({ public_id: x.public_id, bytes: x.bytes, created_at: x.created_at }));
}

// ---- Status ----

function config() {
  if (!keyFrom(process.env.BACKUP_KEY)) return { ready: false, reason: 'BACKUP_KEY is not set on the server' };
  if (!cloudReady()) return { ready: false, reason: 'Cloudinary is not configured' };
  return { ready: true };
}

async function runs(db, limit = 5) {
  return db.collection(RUNS).find({}).sort({ at: -1 }).limit(limit).toArray();
}

let running = false;

// Make a backup now. Never throws; returns { ok, ... } and logs the run.
async function runBackup({ trigger = 'manual', db = mongoose.connection.db } = {}) {
  const cfg = config();
  if (!cfg.ready) return { ok: false, error: cfg.reason };
  if (!db) return { ok: false, error: 'Database not connected' };
  if (running) return { ok: false, error: 'A backup is already running' };
  running = true;
  const started = Date.now();
  const log = { at: new Date(), trigger, ok: false };
  try {
    const snap = await buildSnapshot(db);
    const file = pack(snap, keyFrom(process.env.BACKUP_KEY));
    const stamp = new Date(started + 330 * 60000).toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{4})$/, '$1-$2');
    const up = await uploadPrivate(file, `backup-${stamp}.pmzbak`);
    Object.assign(log, { ok: true, bytes: file.length, publicId: up.public_id, counts: snap.counts, ms: Date.now() - started });
    try {
      const doomed = toPrune(await listStored());
      if (doomed.length) await cloudinary.api.delete_resources(doomed, { resource_type: 'raw', type: 'private' });
      log.pruned = doomed.length;
    } catch (e) {
      log.pruneError = e.message;
    }
    console.log('[backup] ok:', JSON.stringify({ bytes: log.bytes, publicId: log.publicId, ms: log.ms, pruned: log.pruned }));
  } catch (e) {
    log.error = e.message;
    console.error('[backup] failed:', e.message);
  } finally {
    running = false;
    try { await db.collection(RUNS).insertOne(log); } catch { /* logging only */ }
  }
  return log;
}

// Every 10 min from server.js: run the nightly backup if it's due.
async function maybeRunNightly(now = Date.now(), db = mongoose.connection.db) {
  try {
    if (!db || !config().ready) return null;
    const lastOk = await db.collection(RUNS).find({ ok: true }).sort({ at: -1 }).limit(1).next();
    if (!nightlyDue(now, lastOk && lastOk.at)) return null;
    return await runBackup({ trigger: 'nightly', db });
  } catch (e) {
    console.error('[backup] schedule check failed:', e.message);
    return null;
  }
}

// For Admin → Overview.
async function backupStatus(db = mongoose.connection.db) {
  const cfg = config();
  const recentRuns = db ? await runs(db, 5) : [];
  let stored = [];
  if (cfg.ready) {
    try { stored = (await listStored()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); } catch (e) { cfg.listError = e.message; }
  }
  return { ...cfg, keep: KEEP, runs: recentRuns, stored };
}

// Short-lived (5 min) signed download link for one stored backup (admin only).
function downloadUrl(publicId) {
  if (!cloudReady()) throw new Error('Cloudinary is not configured');
  if (typeof publicId !== 'string' || !publicId.startsWith(`${FOLDER}/`) || !/\.pmzbak$/.test(publicId)) {
    throw new Error('Not a backup file');
  }
  return cloudinary.utils.private_download_url(publicId, '', {
    resource_type: 'raw', type: 'private', expires_at: Math.floor(Date.now() / 1000) + 300, attachment: true,
  });
}

module.exports = {
  keyFrom, encrypt, decrypt, buildSnapshot, pack, unpack, nightlyDue, toPrune,
  runBackup, maybeRunNightly, backupStatus, downloadUrl, KEEP, FOLDER,
};
