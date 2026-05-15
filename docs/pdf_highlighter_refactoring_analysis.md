# React PDF Highlighter Plus 리팩토링 분석 보고서

본 문서는 `react-pdf-highlighter-plus` 공식 예제 소스 분석을 바탕으로, 현재 프로젝트의 PDF 뷰어 및 하이라이터 컴포넌트를 리팩토링하기 위한 가이드를 제공합니다.

## 1. 공식 예제 구조 분석 (GitHub example)

공식 예제는 관심사 분리(Separation of Concerns)를 위해 다음과 같은 컴포넌트 구조를 권장합니다.

| 컴포넌트 | 역할 | 주요 특징 |
| :--- | :--- | :--- |
| **App (Container)** | 상태 관리 및 레이아웃 | `highlights` 상태 관리, 하이라이트 CRUD 로직, 사이드바와 뷰어 배치 |
| **Sidebar** | 네비게이션 및 목록 | 하이라이트 목록 표시, 클릭 시 특정 위치로 이동(`scrollTo`), 삭제 기능 |
| **PdfHighlighter** | 핵심 뷰어 엔진 | PDF 렌더링, 하이라이트 레이어 관리, 선택(Selection) 이벤트 처리 |
| **Tip** | 인터랙션 UI | 텍스트 선택 시 나타나는 하이라이트 추가/메모 입력 팝업 |
| **HighlightPopup** | 정보 표시 UI | 이미 생성된 하이라이트 클릭 시 상세 정보나 수정/삭제 메뉴 표시 |

## 2. 현재 프로젝트 현황 및 개선점

### 2.1 현황 분석
- **`usePatentPdfViewer.ts`**: PDF 로딩, 검색(Search), 좌표 변환(BBox to Position) 등 너무 많은 로직이 하나의 훅에 집중되어 있음 (1,000라인 초과).
- **`PatentPdfViewer.tsx`**: `PdfLoader`와 `PdfHighlighter`를 포함하고 있으나, 사이드바 및 인터랙션 UI(Tip 등)가 예제만큼 세분화되어 있지 않음.
- **인터랙션 부재**: 사용자가 직접 하이라이트를 추가하거나 편집하는 `Tip` 컴포넌트 연동 로직이 보이지 않음.

### 2.2 개선이 필요한 부분
1. **Hook 분리**: 검색 로직(`usePdfSearch`)과 하이라이트 관리 로직(`usePdfHighlights`)을 분리하여 유지보수성 향상.
2. **UI 컴포넌트화**: 예제와 같이 `Sidebar`, `Tip`, `HighlightPopup`을 독립된 컴포넌트로 추출.
3. **이벤트 핸들링**: `onSelectionFinished`와 `onScrollChange`를 통해 예제와 동일한 사용자 경험 제공.

## 3. 리팩토링 제안 구조 (Component-based)

공식 예제 스타일을 적용한 권장 디렉토리 구조입니다.

```text
src/components/patent-analysis/pdf/
├── index.tsx                // 최종 통합 컴포넌트 (PatentPdfViewer)
├── Layout.tsx               // Sidebar + Content 레이아웃
├── Sidebar/
│   ├── index.tsx            // 하이라이트 목록 및 제어
│   └── HighlightItem.tsx    // 개별 하이라이트 카드
├── Viewer/
│   ├── index.tsx            // PdfLoader + PdfHighlighter
│   └── HighlightContainer.tsx // 하이라이트 렌더링 커스텀 (Area/Text)
└── Interactions/
    ├── Tip.tsx              // 하이라이트 추가 팝업
    └── HighlightPopup.tsx   // 하이라이트 클릭 팝업
```

## 4. 단계별 리팩토링 계획

### Step 1: 하이라이트 상태 관리 독립
- 하이라이트 CRUD 로직을 전용 훅 또는 Zustand 스토어로 분리합니다.
- `react-pdf-highlighter-plus`의 `IHighlight` 인터페이스를 준수하도록 데이터 구조를 정규화합니다.

### Step 2: Sidebar 컴포넌트 분리
- 현재 뷰어 내부에 섞여 있거나 외부에 있는 하이라이트 목록을 독립된 `Sidebar` 컴포넌트로 구성합니다.
- `highlighterUtils`의 `scrollTo` 기능을 사용하여 목록 클릭 시 PDF의 해당 위치로 이동하는 기능을 구현합니다.

### Step 3: 인터랙션 컴포넌트(Tip, Popup) 구현
- `onSelectionFinished` 콜백을 사용하여 선택된 영역에 `Tip` 컴포넌트를 렌더링합니다.
- 예제와 동일하게 하이라이트 생성 시 색상 선택이나 메모 입력이 가능하도록 합니다.

### Step 4: 메인 뷰어 최적화
- `PatentPdfViewer.tsx`는 레이아웃과 데이터 흐름만 담당하도록 경량화합니다.
- 검색 결과 하이라이트와 사용자 추가 하이라이트를 구분하여 렌더링 로직을 정돈합니다.
 