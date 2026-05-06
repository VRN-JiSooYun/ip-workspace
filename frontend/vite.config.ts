import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
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
