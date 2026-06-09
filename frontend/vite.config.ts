import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/rdkit-api': {
        target: 'http://local-myworkspace-rdkit-api:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rdkit-api/, ''),
      },
      '/compound-search-api': {
        target: 'http://local-myworkspace-compound-search-api:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/compound-search-api/, ''),
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
