#!/usr/bin/env node
// ============================================
// Restore a ProMedicoz backup (.pmzbak) — see HOW_IT_WORKS.md → Backups
// ============================================
// Needs BACKUP_KEY (the same value set on Render) in the environment.
//
//   Look inside (no database touched) — writes readable JSON:
//     BACKUP_KEY=... node scripts/restore-backup.js backup-20261028-0230.pmzbak --json out.json
//
//   Restore into a NEW database (safe default: "<original>_restore_<date>"):
//     BACKUP_KEY=... node scripts/restore-backup.js FILE --to "mongodb+srv://USER:PASS@cluster/..."
//
//   Choose the database name, and allow replacing what's there (careful!):
//     ... --to URI --db docconnect --overwrite
//
// It never overwrites a database that already has data unless --overwrite
// is given, so a mistake can't wipe live data.

const fs = require('fs');
const mongoose = require('mongoose');
const { keyFrom, unpack } = require('../utils/backup');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const file = process.argv[2];
  if (!file || file.startsWith('--')) {
    console.log('Usage: BACKUP_KEY=... node scripts/restore-backup.js <file.pmzbak> [--json out.json] [--to <mongodb-uri>] [--db <name>] [--overwrite]');
    process.exit(1);
  }
  const key = keyFrom(process.env.BACKUP_KEY);
  if (!key) throw new Error('Set BACKUP_KEY (the same value as on Render).');

  const snap = unpack(fs.readFileSync(file), key);
  console.log(`Backup from ${new Date(snap.createdAt).toISOString()} of "${snap.database}":`);
  for (const [name, n] of Object.entries(snap.counts)) console.log(`  ${name.padEnd(20)} ${n}`);

  const jsonOut = arg('--json');
  if (jsonOut) {
    fs.writeFileSync(jsonOut, mongoose.mongo.BSON.EJSON.stringify(snap, null, 2, { relaxed: true }));
    console.log(`\nWrote readable JSON to ${jsonOut} (contains health data — keep it safe and delete it when done).`);
    return;
  }

  const uri = arg('--to') || process.env.RESTORE_MONGODB_URI;
  if (!uri) throw new Error('Give --to <mongodb-uri> (or RESTORE_MONGODB_URI), or use --json to just look inside.');
  const dbName = arg('--db') || `${snap.database}_restore_${new Date(snap.createdAt).toISOString().slice(0, 10).replace(/-/g, '')}`;
  const overwrite = process.argv.includes('--overwrite');

  const conn = await mongoose.createConnection(uri, { dbName }).asPromise();
  const db = conn.db;
  const existing = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
  let hasData = false;
  for (const n of existing) if (await db.collection(n).estimatedDocumentCount()) { hasData = true; break; }
  if (hasData && !overwrite) {
    await conn.close();
    throw new Error(`Database "${dbName}" already has data. Pick another --db, or add --overwrite if you really mean to replace it.`);
  }

  for (const [name, docs] of Object.entries(snap.collections)) {
    if (overwrite) await db.collection(name).deleteMany({});
    if (docs.length) await db.collection(name).insertMany(docs, { ordered: false });
    console.log(`  restored ${name}: ${docs.length}`);
  }
  await conn.close();
  console.log(`\nDone. Restored into database "${dbName}".`);
  console.log('Indexes are rebuilt by the app on start; point MONGODB_URI at this database only when you are sure.');
}

main().catch((e) => {
  console.error('Restore failed:', e.message);
  process.exit(1);
});
