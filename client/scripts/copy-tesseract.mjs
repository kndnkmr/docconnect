// ============================================
// Self-host the on-phone report reader (Tesseract.js)
// ============================================
// Copies the Tesseract.js worker, the LSTM WebAssembly cores and the English
// language data from node_modules into public/tesseract/<version>/, so the
// Report Samjhao photo reader loads them from promedicoz.in itself — not from
// an outside CDN. Runs before every dev/build (see package.json); the output
// folder is gitignored, so ~14 MB of binaries never enter the repo.
//
// The version is part of the path, so the service worker's cache-first rule
// can never serve stale files after an upgrade.

import { copyFile, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NM = join(ROOT, 'node_modules');

const { version } = JSON.parse(await readFile(join(NM, 'tesseract.js', 'package.json'), 'utf8'));
const BASE = join(ROOT, 'public', 'tesseract');
const OUT = join(BASE, version);

// Only LSTM cores are needed (we always run with oem = LSTM_ONLY).
const files = [
  [join(NM, 'tesseract.js', 'dist', 'worker.min.js'), 'worker.min.js'],
  [join(NM, 'tesseract.js-core', 'tesseract-core-lstm.wasm.js'), 'tesseract-core-lstm.wasm.js'],
  [join(NM, 'tesseract.js-core', 'tesseract-core-simd-lstm.wasm.js'), 'tesseract-core-simd-lstm.wasm.js'],
  [join(NM, 'tesseract.js-core', 'tesseract-core-relaxedsimd-lstm.wasm.js'), 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  [join(NM, '@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz'), 'eng.traineddata.gz'],
];

// Remove folders from older versions.
if (existsSync(BASE)) {
  for (const d of await readdir(BASE)) if (d !== version) await rm(join(BASE, d), { recursive: true, force: true });
}
await mkdir(OUT, { recursive: true });
for (const [src, name] of files) await copyFile(src, join(OUT, name));
console.log(`[tesseract] Copied reader files to public/tesseract/${version}/`);
