# 대시보드 리뉴얼 계획 (이미지 기반 재구성)

제공된 `dashboard.png` 이미지의 레이아웃과 컨텐츠를 기반으로 대시보드를 전면 재구축합니다. 8개의 독립적인 섹션과 상단 날짜 범위, 'What's New' 버튼 등을 포함합니다.

## User Review Required

> [!IMPORTANT]
> **레이아웃 구조**: 상단 4개(세로형 카드), 하단 4개(가로형 카드)의 그리드 시스템으로 구성됩니다. 이미지의 구성을 최대한 충실히 재현합니다.

> [!NOTE]
> **컨텐츠 구성**: Compounds(Synthesis, Assay 등), Documents(Patent, Paper 등), PDBs, Calculations 등 실제 연구 업무에 필요한 구체적인 항목들을 섹션별로 배치합니다.

---

## Proposed Changes

### [Dashboard Page]

#### [MODIFY] [Dashboard.tsx](file:///Users/moon/Documents/voronoi/myWorkspace/frontend/src/pages/Dashboard.tsx)
- **전체 레이아웃**: `antd`의 `Row`, `Col`을 사용하여 4:4/4:4 그리드 구축.
- **상단부**: `2025.04.14. ~ 2025.04.21.` 날짜 텍스트와 주황색 Gradation의 `What's New` 버튼 추가.
- **섹션별 카드 구현**:
    1. **Compounds**: Synthesis, Thermoshift assay, Kinase profiling 등 리스트.
    2. **Documents**: Patent, Paper, Conference 항목.
    3. **PDBs**: in-house, RCSB, Docking pose 항목.
    4. **Calculations**: 날짜별 작업 완료 내역 리스트.
    5. **ELN**: 간략한 요약 영역.
    6. **서버 모니터링**: B200, A100 등 장비 상태(정상/의심/고장) 배지 표현.
    7. **1층 식당 메뉴**: 메뉴 텍스트.
    8. **우리 연구소 소식**: 뉴스 및 링크.

### [Styling]

#### [MODIFY] [index.css](file:///Users/moon/Documents/voronoi/myWorkspace/frontend/src/index.css)
- 이미지 특유의 **연한 블루 톤 배경**과 **둥근 테두리 카드** 스타일링 추가.
- 카드 상단 좌측의 **아이콘 박스 스타일** 구현.

---

## Open Questions

- **아이콘**: 이미지의 각 섹션 헤더에 있는 아이콘들을 최대한 유사한 Lucide 아이콘으로 대체해도 괜찮을까요?
- **상태 배지**: '서버 모니터링' 섹션의 상태값(정상, 의심, 고장) 컬러를 이미지와 동일하게(녹색, 노랑, 빨강) 적용하겠습니다.

---

## Verification Plan

### Manual Verification
- 브라우저를 통해 `dashboard.png` 이미지와 각 카드 섹션의 위치 및 컨텐츠가 동일한지 대조 확인.
- 'What's New' 버튼의 그라데이션과 날짜 텍스트 렌더링 확인.
- 전체적인 레이아웃의 반응형 동작(카드 겹침 방지) 확인.
