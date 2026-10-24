// ============================================
// Report Samjhao — on-phone photo reader
// ============================================
// Reads a photo of a printed lab report INSIDE the browser with Tesseract.js
// (open source). Nothing is uploaded: the reader's files are self-hosted at
// /tesseract/<version>/ (copied by scripts/copy-tesseract.mjs) and the image
// never leaves the page. This module (and Tesseract) loads only when the user
// picks a photo, so it never weighs down the rest of the site.

import { parseReportLines, linesFromTesseract } from './reportParse';

/* global __TESSERACT_VERSION__ */
const BASE = `/tesseract/${__TESSERACT_VERSION__}`;

// The reader drops small decimal points on low-resolution images, so we
// enlarge to ~2400 px on the long side (capped for memory) and use greyscale.
const TARGET_LONG_SIDE = 2400;
const MAX_LONG_SIDE = 3200;

async function prepareImage(file) {
  const bitmap = await createImageBitmap(file);
  const long = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(MAX_LONG_SIDE / long, Math.max(1, TARGET_LONG_SIDE / long));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.filter = 'grayscale(1) contrast(1.15)';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas;
}

// Returns { values } from parseReportLines. onProgress(0..1, stage) is called
// while loading ('load') and reading ('read').
export async function readReportPhoto(file, onProgress = () => {}) {
  const { createWorker } = await import('tesseract.js');
  const canvas = await prepareImage(file);
  const worker = await createWorker('eng', 1, {
    workerPath: `${BASE}/worker.min.js`,
    corePath: BASE,
    langPath: BASE,
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress(m.progress, 'read');
      else if (typeof m.progress === 'number') onProgress(m.progress, 'load');
    },
  });
  try {
    const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
    return { values: parseReportLines(linesFromTesseract(data)) };
  } finally {
    await worker.terminate();
    canvas.width = 0; canvas.height = 0; // free the image memory
  }
}
