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
