# React PDF Highlighter Plus 리팩토링 작업 보고서

본 보고서는 `react-pdf-highlighter-plus` 라이브러리를 사용한 PDF 뷰어 컴포넌트의 리팩토링 결과를 요약합니다. 공식 예제의 구조를 참고하여 관심사를 분리하고 확장성을 확보하였습니다.

## 1. 주요 변경 사항

### 1.1 컴포넌트 분리 및 구조화
기존의 비대한 `PatentPdfViewer.tsx`를 기능별로 세분화하여 독립된 컴포넌트로 재구성하였습니다.

- **`Sidebar/PdfSidebar.tsx`**: 하이라이트 목록을 표시하며, 클릭 시 해당 위치로 즉시 이동하는 기능을 제공합니다.
- **`Interactions/PdfTip.tsx`**: PDF 상에서 텍스트를 선택했을 때 나타나는 하이라이트 추가 UI를 구현하였습니다.
- **`Viewer/PatentPdfRenderer.tsx`**: `PdfHighlighter` 렌더링 엔진 로직을 독립시켜 뷰어 핵심 로직의 가독성을 높였습니다.

### 1.2 상태 관리 훅 (`usePatentPdfViewer`) 개선
- 하이라이트 데이터를 내부 상태(`highlights`)로 관리하여 CRUD(추가, 삭제, 이동) 기능을 직접 제공하도록 보강하였습니다.
- 검색 결과와 사용자 추가 하이라이트를 통합 관리하는 `dynamicHighlights` 로직을 정교화하였습니다.

### 1.3 레이아웃 및 UX 향상
- **가로 배치 레이아웃**: PDF 뷰어와 하이라이트 사이드바를 나란히 배치하여 전문적인 분석 도구의 형태를 갖추었습니다.
- **인터랙티브 하이라이팅**: 사용자가 직접 텍스트를 드래그하여 하이라이트를 생성하고 메모를 남길 수 있는 기능을 연동하였습니다.

## 2. 리팩토링 후 파일 구조

```text
src/components/patent-analysis/pdf/
├── PatentPdfViewer.tsx          // 메인 컨테이너 (레이아웃 관리)
├── PatentPdfHighlightContainer.tsx // 하이라이트 스타일 정의
├── Sidebar/
│   └── PdfSidebar.tsx           // 하이라이트 목록 사이드바
├── Viewer/
│   └── PatentPdfRenderer.tsx    // PDF 렌더링 및 인터랙션 엔진
└── Interactions/
    └── PdfTip.tsx               // 하이라이트 추가 팝업 (Tip)
```

## 3. 향후 확장 계획
- **HighlightPopup**: 생성된 하이라이트 클릭 시 상세 정보를 보여주는 팝업 추가 예정.
- **Persistence**: 현재 상태로만 관리되는 하이라이트를 백엔드 API와 연동하여 영구 저장 지원 예정.

---
> [!IMPORTANT]
> 리팩토링된 구조에서는 `onAddHighlight`, `onDeleteHighlight` 등의 핸들러를 통해 외부와의 데이터 연동이 매우 용이해졌습니다.
