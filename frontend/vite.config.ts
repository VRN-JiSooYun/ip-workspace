import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const monitoringProxy = {
  target: 'http://172.16.1.200:2026',
  changeOrigin: true,
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.DRAGGABLE_DEBUG': 'false',
  },
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
      '/monitoring': {
        ...monitoringProxy,
        ws: true,
        rewrite: (path) => path.replace(/^\/monitoring/, ''),
      },
      '/api/servers': monitoringProxy,
      '/api/status': monitoringProxy,
      '/api/notices': monitoringProxy,
      '/api/monitor-errors': monitoringProxy,
      '/api/register': monitoringProxy,
      '/api/reservations': monitoringProxy,
      '/api/cancel': monitoringProxy,
    },
  },
  resolve: {
    alias: {
    },
  },
  optimizeDeps: {
    include: [
      'react-pdf-highlighter-plus',
      'fabric',
      'pdfjs-dist',
      'react-grid-layout',
      'react-draggable',
    ],
  },
  build: {
    commonjsOptions: {
      include: [/pdfjs-dist/, /node_modules/],
    },
  },
});
