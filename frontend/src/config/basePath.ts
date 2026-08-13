// 앞단 nginx가 `/ip-workspace/`로 path 기반 라우팅을 하므로, 브라우저가 보는 모든
// 절대 경로에는 이 prefix가 붙어야 한다.
//
// prefix의 단일 출처는 Vite의 `base`(빌드 시 BASE_PATH env로 결정)이며,
// Vite가 그 값을 `import.meta.env.BASE_URL`로 주입한다. 항상 `/`로 시작하고
// 끝나는 형태다. (base path 없이 배포하면 `/`)
export const BASE_PATH = import.meta.env.BASE_URL || '/';

// react-router의 basename은 trailing slash가 없는 형태를 기대한다.
// base path가 없을 때는 빈 문자열이 되어 기존 동작 그대로다.
export const ROUTER_BASENAME = BASE_PATH.replace(/\/$/, '');

/**
 * 앱 기준 절대 경로에 배포 base path를 붙인다.
 * `withBasePath('/api')`, `withBasePath('api')` 모두 `/ip-workspace/api`가 된다.
 */
export const withBasePath = (path: string): string =>
  `${BASE_PATH}${path.replace(/^\//, '')}`;

// VITE_* 환경변수로 덮어쓰지 않았을 때 쓰는 기본 경로.
// 앞단 nginx가 prefix를 벗겨 컨테이너로 넘기므로, 브라우저가 보내는 쪽에만 prefix가 붙는다.
export const DEFAULT_API_BASE_PATH = withBasePath('api');
export const DEFAULT_RDKIT_API_BASE_PATH = withBasePath('rdkit-api');
export const DEFAULT_COMPOUND_SEARCH_API_BASE_PATH = withBasePath('compound-search-api');
