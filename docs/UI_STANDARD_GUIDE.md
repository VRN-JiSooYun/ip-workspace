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
*Last Updated: 2026-05-15 by Antigravity*
