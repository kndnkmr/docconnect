// ============================================
// Vite Configuration
// ============================================
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

// Version of the on-phone report reader. scripts/copy-tesseract.mjs copies its
// files to public/tesseract/<version>/ — the app loads them from that path.
const TESSERACT_VERSION = JSON.parse(
  readFileSync(new URL('./node_modules/tesseract.js/package.json', import.meta.url), 'utf8'),
).version;

export default defineConfig({
  plugins: [react()],
  build: {
    // dist/.vite/manifest.json: which file each page's code ended up in.
    // scripts/prerender.mjs reads it to add <link rel="modulepreload"> for
    // the article page + that article's file to each pre-built article page
    // (so they download together with the main app instead of one after
    // another), then deletes it.
    manifest: true,
  },

  define: {
    __TESSERACT_VERSION__: JSON.stringify(TESSERACT_VERSION),
  },

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
});
