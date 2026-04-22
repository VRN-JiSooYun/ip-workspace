# 프론트엔드 기술 스택 및 UI/UX 설계 사양서

본 문서는 `MyWorkspace` 프로젝트의 프론트엔드 프로토타입 구현을 위한 기술 스택과 UI/UX 디자인 방향성을 정의합니다.

## 1. 기술 스택 (Technology Stack)

제공된 `AGENTS.md`와 `README.md`의 요구사항을 반영하여, 현대적이고 확장성 있는 기술 스택을 제안합니다.

| 분류 | 기술 | 비고 |
| :--- | :--- | :--- |
| **Core** | **React 18 + TypeScript** | `AGENTS.md` 기준 준수 |
| **Build Tool** | **Vite** | 빠른 개발 경험 (HMR) 제공 |
| **UI Component** | **Ant Design (antd)** | 전문적인 데이터 테이블 및 폼 라이브러리 제공 (기업용 대시보드에 적합) |
| **Styling** | **Emotion (CSS-in-JS)** | 동적인 스타일링 및 테마 관리 |
| **Icons** | **Lucide React** | 깔끔하고 모던한 아이콘 세트 |
| **State Management** | **Zustand** | 가볍고 직관적인 전역 상태 관리 (그룹/디자인 선택 상태 등) |
| **Data Fetching** | **React Query (TanStack Query)** | API 캐싱 및 결과값 표시 관리 |
| **Chemical Drawing** | **Ketcher** | ChemDraw 호환 오픈소스 라이브러리 |

---

## 2. UI/UX 디자인 테마 (Design Theme)

전문적인 과학 연구 도구로서의 신뢰성과 사용성을 극대화하기 위해 **"Modern Scientific Professional"** 테마를 적용합니다.

### 2.1 컬러 팔레트 (Color Palette)
- **Primary**: Deep Blue (`#1677ff`) - 전문성과 신뢰성 상징 (Ant Design 기본값 기반 커스텀)
- **Secondary**: Slate Gray (`#64748b`) - 차분한 인터페이스 구성
- **Background**: Light Gray / White (`#f8fafc`) - 긴 시간 작업에도 눈이 편안한 배경
- **Accent**: Emerald Green (`#10b981`) - 합성 보드나 긍정적 지표 강조용

### 2.2 주요 디자인 요소
- **Glassmorphism**: 팝업 및 모달에 은은한 블러 효과 적용하여 깊이감 부여
- **Micro-interactions**: 버튼 호버, 리스트 아이템 클릭 시 부드러운 전환 효과
- **Density Control**: 대량의 화합물 데이터를 다루므로, 테이블의 행 간격을 조절 가능한 상단 제어바 제공 (Compact/Comfortable)

---

## 3. 주요 화면 설계 방향

### 3.1 Dashboard
- **카드형 레이아웃**: 각 메뉴를 직관적인 카드 형태로 배치
- **Timeline View**: 주 단위 업데이트 내역을 시각적으로 표현

### 3.2 My Board (Compounds)
- **분할 뷰 (Split View)**: 왼쪽 그룹 리스트(Master)와 오른쪽 상세 내용(Detail)의 효율적인 화면 분할
- **동적 테이블 (Dynamic Table)**: 사용자가 컬럼 순서 및 가시성을 직접 편집할 수 있는 컬럼 설정 팝업 구현

### 3.3 SAR Table
- **Sticky Header**: Smiles 이미지 리스트가 상단에 고정되어 스크롤 중에도 대조 가능
- **Heatmap Coloration**: C 버튼 활성화 시 데이터 값에 따른 배경색 그라데이션 적용 (예: IC50 값에 따른 농도 표현)

---

## 4. 향후 구현 계획 (Next Steps)

1. **Docker 환경 구성**: `docker-compose.yml` 기반으로 `frontend` 컨테이너 초기화
2. **Base UI Scaffold**: Ant Design 및 기본 레이아웃 구성
3. **Mock Data 생성**: `AGENTS.md` 가이드에 따라 백엔드 연동 전까지 사용할 화합물 데이터셋 구축
4. **Key Features 구현**: 그룹 생성, 디자인 등록(Chemdraw UI), SAR Table 변환 로직 우선 구현
