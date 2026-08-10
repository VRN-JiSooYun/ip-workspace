import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const monitoringProxy = {
  target: 'http://172.16.1.200:2026',
  changeOrigin: true,
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 컨테이너 hostname이 기본값이므로 docker compose 동작은 그대로 유지된다.
  // 호스트에서 직접 `bun run dev`로 띄울 때는 .env.local에서 published port로 덮어쓴다.
  const env = loadEnv(mode, process.cwd(), '');
  const rdkitApiTarget =
    env.RDKIT_API_PROXY_TARGET || 'http://local-myworkspace-rdkit-api:8000';
  const compoundSearchApiTarget =
    env.COMPOUND_SEARCH_API_PROXY_TARGET ||
    'http://local-myworkspace-compound-search-api:8080';

  return {
  plugins: [react()],
  define: {
    'process.env.DRAGGABLE_DEBUG': 'false',
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/rdkit-api': {
        target: rdkitApiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rdkit-api/, ''),
      },
      '/compound-search-api': {
        target: compoundSearchApiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/compound-search-api/, ''),
      },
      '/monitoring/': {
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
  };
});
