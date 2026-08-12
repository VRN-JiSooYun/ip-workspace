# VORA UI Standardization Guide

이 문서는 VORA 플랫폼의 시각적 일관성을 유지하기 위해 정의된 공통 CSS 클래스와 디자인 가이드라인을 설명합니다. 향후 새로운 페이지를 추가하거나 기존 UI를 수정할 때 이 표준을 반드시 준수해야 합니다.

## 1. 공통 CSS 클래스 (src/index.css)

모든 주요 컨테이너와 인터랙션 요소는 `src/index.css`에 정의된 다음 클래스들을 사용합니다.

| 클래스명 | 용도 | 주요 스타일 |
| :--- | :--- | :--- |
| `.v-table-card` | 테이블 또는 메인 콘텐츠를 감싸는 카드 | `border-radius: 12px`, `border: 1px solid var(--c-card-border)`, `overflow: hidden` |
| `.v-table-header` | 카드 내 상단 헤더 영역 | `padding: 12px 24px`, `background: var(--bg-color)`, `border-bottom: 1px solid var(--c-card-border)` |
| `.v-item-card` | 화합물, 프로젝트 등 개별 항목 카드 | `border-radius: 12px`, `transition: all 0.2s ease`, Hover/Selected 상태 효과 포함 |
| `.v-search-input` | 메인 검색 입력창 | `height: 44px`, `border-radius: 12px` |
| `.v-action-btn` | 주요 액션 버튼 (필터, 검색, 추가 등) | `height: 44px`, `border-radius: 12px` |

## 2. 디자인 원칙

### 테두리 및 곡률 (Border & Radius)
- 모든 카드와 버튼의 기본 곡률은 **12px**입니다. (Ant Design 기본값 6~8px 대신 사용)
- 테두리 두께는 **1px**을 원칙으로 하며, 색상은 테마 변수(`--c-card-border`)를 사용합니다.

### 인터랙션 (Interaction)
- **클릭 가능한 레이블**: `Switch` 컴포넌트와 함께 사용되는 텍스트(Label)는 반드시 `onClick` 핸들러를 추가하여 텍스트 클릭 시에도 토글이 동작하도록 합니다.
- **버튼 높이**: 사용자 경험 향상을 위해 주요 버튼과 입력창의 높이는 **44px**로 통일합니다.

### 테이블 (Table)
- `Table` 컴포넌트 사용 시 `bordered` 속성은 생략하여 세로 구분선 없는 깔끔한 스타일을 유지합니다.
- 데이터 양에 따라 Y축 스크롤을 동적으로 제어합니다 (예: 10개 이하일 경우 스크롤 숨김).
- Pagination은 MyBoard 그룹 상세 목록 UX를 기본값으로 사용합니다.
  - 기본 위치는 하단 우측입니다.
  - `ant-pagination-total-text`는 표시하지 않습니다.
  - 기본 page size 옵션은 `[10, 30, 50, 100]`입니다.
  - 선택된 page item은 primary 색상을 사용합니다. hex 를 직접 쓰지 말고 CSS 에서는 `var(--brand-primary)`, 리터럴 색상 값이 필요한 곳(antd token, SVG `fill`/`stroke`, canvas 차트)에서는 `useBrandPrimary()` / `getBrandPrimary()` 를 사용합니다. 단일 출처는 `frontend/src/theme/brandColor.ts` 의 `DEFAULT_BRAND_PRIMARY` 입니다.
  - page item은 24px 높이와 32px 최소 폭을 기본으로 사용하고, page size select는 24px 높이를 기본으로 사용합니다.
  - page item, 선택된 page item, prev/next control은 pill radius(`990px`)를 사용합니다.
  - page number는 셋 자리 comma를 적용하고, page item은 auto width와 충분한 좌우 여백을 유지합니다.

### 데이터 표시 포맷 (Number & Date)
- 숫자 표시: 화면에 표시되는 숫자는 기본적으로 정수부에 셋 자리 comma를 적용합니다.
  - 공통 유틸 `formatNumberWithComma`를 사용하며 소수점 이하에는 comma를 적용하지 않습니다.
  - 예: `1000` → `1,000`, `1234567.89` → `1,234,567.89`
  - 예외: 특허 번호, compound ID, model ID처럼 숫자처럼 보여도 식별자인 값은 comma를 적용하지 않습니다.
- 날짜 표시: 화면에 표시되는 날짜는 기본적으로 `YYYY.mm.dd`, 날짜+시간은 `YYYY.mm.dd HH:MM` 형식을 사용합니다.
  - 권장 변환: 공통 유틸 `formatDisplayDate`를 사용해 날짜 구분자를 `.`로 통일하고, 시간이 포함된 값은 분 단위까지만 표시합니다.
  - 예: `2026-06-02` → `2026.06.02`, `26.06.02 10:30` → `2026.06.02 10:30`, `2026-06-02T10:30:45Z` → `2026.06.02 10:30`
  - API 요청/응답 payload는 서버 계약 형식을 유지하고, 화면 표시 직전에만 변환합니다.

## 3. 반응형 디자인 표준 (Responsive Web)

VORA는 다양한 해상도(UHD, QHD, FHD 등)에서 최적의 경험을 제공하기 위해 반응형 표준을 따릅니다.

### 레이아웃 프리셋 (Layout Presets)
- 해상도별 `maxWidth`와 `sidePadding`은 `src/config/patentAnalysisLayout.ts`에 정의된 프리셋을 따릅니다.
- 페이지 레이아웃 구성 시 `useResponsiveLayout` 커스텀 훅을 사용하여 일관된 설정을 가져옵니다.

### 미디어 쿼리 (Media Queries)
- `index.css`에 정의된 반응형 오버라이드를 활용합니다.
- **1600px 이하**: 헤더 패딩 축소, 버튼/입력창 높이 조정 (44px -> 40px)
- **1200px 이하**: 검색창 너비 축소 및 폰트 크기 최적화

### 컨테이너 쿼리 (Container Queries)

**판단 기준: 이 컴포넌트가 좁아지는 이유가 무엇인가?**

| 좁아지는 이유 | 사용할 것 |
| --- | --- |
| 화면(브라우저) 자체가 좁다 | `@media` |
| 화면은 그대로인데 **옆 패널이 자리를 차지**했다 | `@container` |

사이드 패널·분할 화면·크기 조절 가능한 패널 안에 들어가는 컴포넌트는 **반드시
`@container`** 를 씁니다. viewport는 넓은데 컴포넌트만 좁아지는 상황을 `@media`로는
감지할 수 없어, 내부 입력 필드와 텍스트가 부모 카드 밖으로 삐져나옵니다.

> 실제 사례: 의견제출통지서 화면에서 문서 뷰어를 최대로 넓히면 viewport가 1500px인데도
> 좌측 검색 패널은 195px이 됩니다. `@media (max-width: 1100px)` 폴백이 있었지만
> viewport 기준이라 발동하지 않아 조·항·호 입력과 `추가` 버튼이 최대 411px까지 넘쳤습니다.

#### 적용 방법

```css
/* 1. 컴포넌트 루트에 컨테이너 컨텍스트를 선언한다. 이름을 붙여 의도를 드러낸다. */
.oa-filters {
  container-type: inline-size;
  container-name: oa-filters;
}

/* 2. 자손이 그 컨테이너 폭을 기준으로 반응한다. (자기 자신은 질의할 수 없다) */
@container oa-filters (max-width: 720px) {
  .oa-subpanel-grid-ipc {
    grid-template-columns: repeat(auto-fit, minmax(min(130px, 100%), 1fr));
  }
}
```

- `container-type: inline-size`는 가로 폭만 격리합니다. 높이는 내용에 따라 늘어납니다.
- 컨테이너 자신에는 `@container` 규칙이 적용되지 않습니다. 반드시 **자손**에 겁니다.
- antd의 dropdown·tooltip은 portal로 body에 렌더되므로 containment 영향을 받지 않습니다.
- 모든 모던 브라우저에서 지원됩니다(2023년 Baseline).

#### grid 하한은 반드시 접히게 (`min()`)

컨테이너 쿼리와 **함께** 지켜야 하는 규칙입니다. breakpoint 사이 구간을 메워 줍니다.

```css
/* 나쁨: 컨테이너가 150px보다 좁아지면 열이 150px을 유지해 그대로 넘친다 */
grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));

/* 좋음: 하한이 컨테이너 폭까지 접힌다 */
grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr));
```

고정 폭 열도 같습니다: `92px` → `min(92px, 40%)`.

#### 넘침을 만드는 습관 3가지

1. **고정 폭 인라인 스타일** — `style={{ width: 220 }}`. 폭은 CSS에 맡기고
   `flex: 1 1 auto; min-width: 0; max-width: 240px` 형태로 상한만 둡니다.
2. **`min-width: 0` 누락** — flex/grid 자식의 기본 `min-width: auto`는 콘텐츠보다 작아지지
   않습니다. 줄어들어야 하는 모든 flex/grid 자식에 `min-width: 0`을 답니다.
3. **라벨에 `white-space: nowrap`** — `심사진행상태` 같은 라벨이 열 폭을 밀어냅니다.
   줄바꿈을 허용하거나(`overflow-wrap: anywhere`), ellipsis로 자릅니다.

#### 가로 스크롤은 허용되는 탈출구

표(antd Table `scroll={{ x: 'max-content' }}`)나 단계 파이프라인처럼 폭을 줄일 수 없는
콘텐츠는 **자기 스크롤 컨테이너 안에서** 넘치게 둡니다(`overflow-x: auto`).
카드 밖으로 나가지만 않으면 됩니다. 페이지 본문(body)에 가로 스크롤이 생기면 안 됩니다.

#### 검증 방법

브라우저 콘솔에서 실제로 넘친 요소를 셉니다. **가로 스크롤 조상이 있는 요소는 제외**해야
정상 동작하는 표를 오탐하지 않습니다.

```js
const clips = (el) => ['auto','scroll','hidden','clip'].includes(getComputedStyle(el).overflowX);
const root = document.querySelector('.oa-filters');
const rr = root.getBoundingClientRect();
[...root.querySelectorAll('*')].filter((el) => {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.right - rr.right <= 1) return false;
  for (let p = el.parentElement; p && p !== root; p = p.parentElement) if (clips(p)) return false;
  return true;
});   // 길이가 0이어야 한다
```

패널 너비를 최소~최대까지 훑으면서 각 지점에서 0인지 확인합니다.

### 너비 조절 패널 (Resizable Side Panel)

우측 문서/상세 패널은 공용 컴포넌트 `components/common/ResizableSidePanel`을 씁니다.
직접 드래그 로직을 다시 구현하지 않습니다.

```tsx
<ResizableSidePanel label="문서 뷰어 너비 조절">
  <PatentDocumentViewer … />
</ResizableSidePanel>
```

- 기본값: 최소 380px / 기본 520px / 최대 1000px, 키보드 스텝 24px.
- **본문 최소 폭을 항상 남깁니다**(`minSiblingWidth`, 기본 320px). 최대치로 끌어도 좌측
  목록이 0px으로 사라지지 않습니다. 창을 줄이면 `ResizeObserver`가 폭을 다시 맞춥니다.
- 키보드 조작을 지원합니다: `←` 넓히기 / `→` 좁히기 / `Home` 최소 / `End` 최대 /
  `Enter`·`Space` 기본값. `role="separator"` + `aria-valuenow`를 노출합니다.
- 핸들과 패널을 형제로 렌더하므로 부모는 flex를 씁니다. 가로 간격은 `gap`이 아니라 각 열의
  `margin`으로 줍니다. 핸들 양옆에 `gap`이 겹치면 핸들이 본문에서 떠 보입니다.
- 화면이 좁아 세로로 쌓이는 구간에서는 핸들을 숨기고 인라인 너비를 무시합니다
  (`width: 100% !important`).

## 4. 적용 예시 (React/TSX)

```tsx
// 반응형 레이아웃 적용 예시
const { layoutPreset } = useResponsiveLayout();

return (
  <div style={{ maxWidth: layoutPreset.maxWidth, padding: `0 ${layoutPreset.sidePadding}px` }}>
    <div className="v-table-card">
      <div className="v-table-header">...</div>
    </div>
  </div>
);
```

---
*Last Updated: 2026-08-12 — 컨테이너 쿼리·너비 조절 패널 항목 추가*
