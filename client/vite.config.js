// ============================================
// Vite Configuration
// ============================================
// Vite = a modern build tool that serves your code during development
// and bundles it for production.
//
// WHY VITE over older tools (Webpack)?
// - Instant server start (no bundling needed during development)
// - Lightning-fast hot reload (changes appear in milliseconds)
// - Simple configuration (this file is tiny!)

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // ^ Tells Vite: "This is a React project, handle JSX files"

  server: {
    port: 5173,
    // ^ The port for the development server
    // You'll access the frontend at http://localhost:5173

    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
      // ^ PROXY: When the frontend requests /api/anything,
      // Vite forwards it to the backend (localhost:5000).
      //
      // WHY? During development, frontend runs on port 5173
      // and backend on port 5000. Without a proxy, you'd get
      // CORS issues or need to hardcode the full URL everywhere.
      //
      // With proxy: axios.get('/api/doctors') → forwarded to localhost:5000/api/doctors
    }
  }
});
