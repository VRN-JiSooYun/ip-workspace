import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://local-myworkspace-backend:3000',
        changeOrigin: true,
      },
      '/rdkit-api': {
        target: 'http://local-myworkspace-rdkit-api:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rdkit-api/, ''),
      },
    },
  },
  resolve: {
    alias: {
    },
  },
  optimizeDeps: {
    include: ['react-pdf-highlighter-plus', 'fabric', 'pdfjs-dist'],
  },
  build: {
    commonjsOptions: {
      include: [/pdfjs-dist/, /node_modules/],
    },
  },
});
