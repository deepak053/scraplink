import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: true, // Enable network access
    proxy: {
      '/predict': 'http://127.0.0.1:5001',
      '/retrain': 'http://127.0.0.1:5001',
      '/health': 'http://127.0.0.1:5001',
      '/auth': 'http://127.0.0.1:5001'
    }
  }
});
