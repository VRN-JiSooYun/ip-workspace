# My Board Whiteboard RDKit Preview Flow

## 요청 요약

My Board 캔버스에서 구조 추가 버튼을 클릭해 ChemDraw로 구조를 그리고, 캔버스에 추가하기 전에 `rdkit_draw` API가 생성한 SVG 이미지를 preview로 확인한 뒤 부모 캔버스에 로드한다. 부모 캔버스에서 구조를 더블 클릭하면 기존처럼 ChemDraw로 다시 불러와 편집할 수 있어야 한다.

## 구현 내용

### RDKit API Proxy

파일: `frontend/vite.config.ts`

- `/rdkit-api` proxy를 추가했다.
- 프론트 브라우저에서 직접 `localhost:8000`을 호출하지 않고 Vite dev server를 통해 RDKit API로 프록시한다.
- Docker compose 내부에서는 `http://local-myworkspace-rdkit-api:8000`로 전달된다.

파일: `docker-compose.yml`

- frontend 환경변수 `VITE_RDKIT_API_URL`을 `/rdkit-api`로 변경했다.

파일: `frontend/src/types/external-modules.d.ts`

- `VITE_RDKIT_API_URL` 타입을 추가했다.

### 구조 데이터 확장

파일: `frontend/src/components/common/ChemDrawModal.tsx`

- `ChemDrawStructureData`에 다음 필드를 추가했다.
  - `sourceSvg`
  - `rdkitSvg`

### Whiteboard Flow

파일: `frontend/src/components/board/WhiteboardEditor.tsx`

- 기존 `ChemDrawModal -> 바로 캔버스 추가` 흐름을 변경했다.
- 새 흐름:
  1. 구조 추가 버튼 클릭
  2. ChemDraw에서 구조 작성
  3. `Preview 생성` 클릭
  4. ChemDraw 구조 데이터에서 MOL block 추출
  5. `/rdkit-api/draw` 호출
  6. RDKit SVG preview modal 표시
  7. `캔버스에 추가` 클릭 시 RDKit SVG를 fabric canvas에 추가

### 더블클릭 편집 유지

- canvas object에는 RDKit SVG뿐 아니라 ChemDraw 원본 구조 데이터도 함께 저장한다.
- 더블클릭 시 기존 로직처럼 `cdxml`, `molV2000`, `molfile`, `molV3000`, `smiles` 중 사용 가능한 데이터를 ChemDraw로 다시 로드한다.
- 수정 후 다시 `Preview 생성`을 거쳐 RDKit SVG로 기존 canvas object를 교체한다.

### Fallback

- RDKit API 호출 실패 시 preview modal에 경고를 표시한다.
- RDKit SVG가 없더라도 ChemDraw SVG가 있으면 fallback으로 캔버스에 추가할 수 있다.

## UX 효과

- 사용자는 캔버스에 추가하기 전에 RDKit 렌더링 결과를 확인할 수 있다.
- 캔버스에는 일관된 RDKit 스타일의 SVG가 표시된다.
- 편집 원본은 유지되므로 더블클릭 ChemDraw 재편집 UX가 유지된다.
