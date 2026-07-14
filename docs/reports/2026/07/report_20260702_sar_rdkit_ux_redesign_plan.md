# SAR Table RDKit UX 재설계 계획 및 패치 기록

## 작업 범위
- 대상 페이지: `frontend/src/pages/SarTable.tsx`
- 대상 영역: SAR Table 화합물 카드 상단 RDKit 제어 영역
- 참고 이미지:
  - `sample/sar-table-rdkit/sample1.png`
  - `sample/sar-table-rdkit/sample2.png`
- ChemDraw 요구사항: 화합물 editor는 공통 컴포넌트인 `ChemDrawModal`을 재사용

## 현재 구조
- 기존 SAR 화합물 카드 영역은 `Com / Diff / Off` 단일 segmented control로 RDKit cluster highlighting을 제어했다.
- 상태는 `groupStructureViewSettings[groupId].sarHighlightMode`에 저장된다.
- `com`, `diff`는 `frontend/src/services/structureRendering.ts`의 `renderRdkitClusterSvgs()`를 통해 `/cluster_v1` API를 호출한다.
- 기존 cluster payload는 `abbrev_option: 1`로 고정되어 있었고, atom color 및 사용자 지정 scaffold 옵션은 없었다.

## 변경 UX

### 1. RDKit 제어 영역 분리
기존 `Com / Diff / Off` 단일 제어를 아래 3개 그룹으로 분리한다.

- `Atom`
  - `Black`
  - `Color`
  - API 전달값: `atomLabelBlock`

- `Abbreviation`
  - `Keep`
  - `All`
  - `Off`
  - API 전달값: `abbrev_option`
  - 매핑: `Keep = 1`, `All = 2`, `Off = 0`

- `Highlight`
  - `Comm`
  - `Diff`
  - `Off`
  - `Scaffold`
  - `Comm / Diff / Off`는 기존 highlight 동작을 유지한다.
  - `Scaffold`는 사용자 지정 scaffold 입력 모달을 여는 별도 액션으로 둔다.

### 2. 사용자 지정 Scaffold
- `Scaffold` 버튼을 누르면 공통 `ChemDrawModal`을 사용한 사용자 지정 모달을 연다.
- 사용자가 구조를 그리고 `적용`하면 ChemDraw 결과에서 scaffold를 추출한다.
- 화합물 카드 컨트롤의 `Scaffold` 버튼 좌측에 색상 버튼을 배치하고, 버튼 클릭 시 RDKit `color_dict` key 기반 색상 팔레트를 선택할 수 있다.
- 이미 지정된 scaffold를 다시 열 때는 CDXML을 우선 사용해 ChemDraw에 로드한다.
- CDXML이 없는 과거 데이터에 한해 SMILES를 fallback으로 사용한다.
- 재적용 시에는 ChemDraw에서 현재 구조의 molblock을 새로 추출해 API에 전달한다.
- 단, 기존 scaffold를 다시 열고 에디터 영역에서 사용자 상호작용 없이 바로 적용하면 ChemDraw가 재-export한 molblock을 버리고 기존 저장 molblock을 유지한다.
  - ChemDraw 재로드/재저장 과정에서 header와 atom ordering이 바뀌어 동일 scaffold가 다른 molblock처럼 전달되는 문제를 막기 위함이다.
- 에디터 영역에서 pointer/key/paste 입력이 감지된 뒤 적용하면 새로 export된 molblock을 저장한다.
- SMILES를 ChemDraw API로 로드하는 방식과 사용자가 클립보드로 붙여넣는 방식은 ChemDraw 내부 import 경로가 달라 molblock header, 좌표, atom ordering, aromatic bond 표현이 달라질 수 있다.
- 따라서 재편집용 저장값은 SMILES가 아니라 ChemDraw native 정보인 CDXML을 우선 사용한다.
- `/cluster_v1` 요청에는 ChemDraw에서 추출한 `molV2000`, `molfile`, `molV3000` 중 사용 가능한 molblock 값을 `substructure_color_dict.*.molblock`으로 전달한다.
- `substructure_color_dict`의 outer key는 `custom-scaffold` 고정값을 사용한다.
- 적용된 사용자 지정 scaffold는 group별 SAR 설정에 저장한다.
- 사용자 지정 scaffold가 적용된 상태에서는 `Scaffold` 버튼을 primary 색상으로 표시한다.
- 해제 버튼을 누르면 scaffold 설정을 auto/none 상태로 되돌린다.

## RDKit API 반영 사항
- 사용자 지정 scaffold는 `/cluster_v1` 요청의 `request.substructure_color_dict`에 전달한다.
- `substructure_color_dict`의 key는 `custom-scaffold`를 사용한다.
- `substructure_color_dict`의 value는 `{ color, molblock }` 객체를 사용한다.
- `molblock`에는 공통 `ChemDrawModal`에서 추출한 사용자 지정 scaffold molblock 값을 전달한다.
- `color`에는 RDKit API에 정의된 color key 문자열을 사용한다.
- 현재 패치에서는 `color` 값으로 `red`를 전달한다.
- 사용자가 팔레트에서 다른 색상을 선택하면 해당 color key를 전달한다.
- 허용 color key 예: `blue`, `red`, `green`, `yellow`, `gray`, `orange`, `purple`, `cyan`, `pink`, `lime`, `teal`, `magenta`, `sky`, `salmon`, `mint`, `lavender`, `gold`, `brown`, `navy`, `olive`

예시:

```json
{
  "substructure_color_dict": {
    "custom-scaffold": {
      "color": "red",
      "molblock": "ChemDraw에서 추출한 사용자 지정 scaffold molblock"
    }
  }
}
```

## 상태 변경
`frontend/src/store/useBoardStore.ts`에 다음 설정을 추가했다.

- `sarAtomColorMode: 'black' | 'color'`
- `sarAbbreviationMode: 'keep' | 'all' | 'off'`
- `sarScaffold`
  - `mode: 'auto' | 'custom'`
  - `source: 'none' | 'auto' | 'custom'`
  - `smiles`
  - `molBlock`
  - `cdxml`
  - `color`
  - `svg`
  - `updatedAt`

기본값:
- Atom: `black`
- Abbreviation: `off`
- Highlight: `off`
- Scaffold: `auto / none`

## 서비스 변경
`frontend/src/services/structureRendering.ts`의 `renderRdkitClusterSvgs()`에 아래 옵션을 추가했다.

- `atomLabelBlock`
- `abbrevOption`
- `substructureColorDict`
  - 형태: `Record<string, { color: string; molblock: string }>`

cluster cache key에도 위 옵션들을 포함해, 옵션 변경 시 이전 SVG가 잘못 재사용되지 않도록 했다.

`renderRdkitSvg()`에도 아래 옵션을 추가했다.

- `atomLabelBlock`
- `abbrevOption`

따라서 `Highlight`가 `Off`인 일반 구조 렌더링에서도 `Atom`, `Abbreviation` 버튼 변경이 즉시 `/draw` 요청에 반영된다. 일반 RDKit SVG cache key에도 두 옵션을 포함했다.

## UX 스타일 변경
- `Atom`, `Abbreviation`, `Highlight` 제어 그룹을 우측 `Scale`, `Rotate`, `Overlap`과 같은 설정 그룹 스타일로 맞췄다.
- 각 제어 그룹은 동일한 높이, 테두리, 배경, 라벨 스타일을 사용한다.

## 좌측 화합물 구조 컬럼
- 좌측 그룹 구조 테이블의 `화합물 구조` 컬럼은 상단 RDKit 제어 상태와 독립적으로 표시한다.
- 해당 컬럼은 기본 상태로 고정한다.
  - Highlight: `off`
  - Abbreviation: `off`
  - Atom: `black`
- 회전과 스케일도 기본값을 사용한다.

## 후속 구현 후보
- Auto scaffold 계산 API가 확정되면 `get_common_substructure` 호출을 추가한다.
- `Scaffold` hover 시 현재 scaffold 구조 preview를 표시한다.
- `Off` 상태에서도 Atom/Abbreviation 옵션을 일반 `/draw` 렌더링에 반영할지 결정한다.
- API가 `atomLabelBlock`이 아닌 snake case를 요구하면 필드명을 맞춘다.

## 확인 필요 사항
- `atomLabelBlock`의 boolean 의미가 `Black = true`인지 최종 확인이 필요하다.
- 사용자 지정 scaffold가 `Comm/Diff` 양쪽에 모두 modifier로 적용되는 방식이 맞는지 확인이 필요하다.
