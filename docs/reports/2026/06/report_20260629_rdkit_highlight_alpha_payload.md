# RDKit highlight_alpha 요청 제거

## 변경 내용
- 프론트엔드 RDKit cluster 요청 payload에서 `highlight_alpha` 필드를 제거했다.
- `reverse_highlighting`과 기타 렌더링 옵션은 기존대로 유지했다.

## 대상 파일
- `frontend/src/services/structureRendering.ts`

## 비고
- RDKit API 서버의 `highlight_alpha` 기본값 처리는 그대로 사용한다.
- AGENTS.md 지침에 따라 빌드 및 실행은 수행하지 않았다.
