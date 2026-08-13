import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const monitoringTarget = {
  target: 'http://172.16.1.200:2026',
  changeOrigin: true,
};

// 앞단 nginx가 `/ip-workspace/`로 path 기반 라우팅을 하므로 앱은 그 prefix 아래에서
// 서빙된다. 환경별로 다르게 두거나 prefix 없이 배포하려면 BASE_PATH를 지정한다.
// (`BASE_PATH=/`이면 기존처럼 루트 배포)
const normalizeBasePath = (value: string): string => {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 컨테이너 hostname이 기본값이므로 docker compose 동작은 그대로 유지된다.
  // 호스트에서 직접 `bun run dev`로 띄울 때는 .env.local에서 published port로 덮어쓴다.
  const env = loadEnv(mode, process.cwd(), '');
  const rdkitApiTarget =
    env.RDKIT_API_PROXY_TARGET || 'http://local-ipworkspace-rdkit-api:8000';
  const compoundSearchApiTarget =
    env.COMPOUND_SEARCH_API_PROXY_TARGET ||
    'http://local-ipworkspace-compound-search-api:8080';

  const basePath = normalizeBasePath(env.BASE_PATH ?? '/ip-workspace/');
  // dev 서버는 앞단 nginx 없이 직접 요청을 받으므로, 앱이 붙이는 prefix를
  // proxy 규칙에서도 그대로 매칭하고 target으로 넘길 때 벗겨준다.
  const prefix = basePath.replace(/\/$/, '');
  const stripPrefix = (path: string) => path.slice(prefix.length) || '/';
  const monitoringProxy = {
    ...monitoringTarget,
    rewrite: stripPrefix,
  };

  return {
  base: basePath,
  plugins: [react()],
  define: {
    'process.env.DRAGGABLE_DEBUG': 'false',
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      [`${prefix}/rdkit-api`]: {
        target: rdkitApiTarget,
        changeOrigin: true,
        rewrite: (path) => stripPrefix(path).replace(/^\/rdkit-api/, ''),
      },
      [`${prefix}/compound-search-api`]: {
        target: compoundSearchApiTarget,
        changeOrigin: true,
        rewrite: (path) => stripPrefix(path).replace(/^\/compound-search-api/, ''),
      },
      [`${prefix}/monitoring/`]: {
        ...monitoringTarget,
        ws: true,
        rewrite: (path) => stripPrefix(path).replace(/^\/monitoring/, ''),
      },
      [`${prefix}/api/servers`]: monitoringProxy,
      [`${prefix}/api/status`]: monitoringProxy,
      [`${prefix}/api/notices`]: monitoringProxy,
      [`${prefix}/api/monitor-errors`]: monitoringProxy,
      [`${prefix}/api/register`]: monitoringProxy,
      [`${prefix}/api/reservations`]: monitoringProxy,
      [`${prefix}/api/cancel`]: monitoringProxy,
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
