# UI/UX 구현 계획서: My 특허 분석 (My Patent Analysis)

이 문서는 `sample/patent_analysis_helper_html`의 기능을 기존 `myWorkspace`의 디자인 시스템(React + Ant Design)에 맞춰 재설계하기 위한 계획서입니다.

## 1. 디자인 목표
- **디자인 일관성**: 기존 `My Board` 페이지와 유사한 검색 UI 및 레이아웃을 채택하여 사용자 경험의 연속성을 유지합니다.
- **다크 모드 지원**: `ThemeContext`를 활용하여 완벽한 다크/라이트 테마를 지원합니다.
- **반응형 레이아웃**: Ant Design의 Grid 시스템을 활용하여 다양한 해상도에 최적화합니다.
- **통합 검색 경험**: 일반 텍스트 검색과 구조 검색(ChemDraw)을 통합된 헤더 영역에서 제공합니다.

## 2. 주요 레이아웃 구조 (Layout)
기존 `MyBoard.tsx`의 2단 레이아웃(Side-by-Side) 구성을 변형하여 적용합니다.

### 2.1 검색 헤더 (Search Header)
- **통합 검색바**: 특허 제목, 초록, 출원인, SMILES 등을 한 번에 검색할 수 있는 입력창.
- **상세 필터 버튼**: 클릭 시 하단에 드롭다운 형태로 상세 조건 설정 영역 표시.
    - 필터 항목: 출판일 범위, 특허청(WIPO, USPTO 등), 타겟 단백질, 소유자.
- **구조 검색 버튼**: `ChemDrawModal`을 호출하여 분자 구조 기반 검색 기능 제공.
- **신규 등록 버튼**: 새로운 특허 PDF를 업로드하고 분석을 요청하는 버튼 (`daehun_app.py` 연동용).

### 2.2 메인 콘텐츠: 단일 통합 테이블 (Unified Patent Table)
- **전체 너비 활용**: 좌우 분할 없이 화면 전체 너비를 활용하여 대량의 특허 데이터를 한눈에 파악.
- **컬럼 구성 및 필터링**:
    - 각 컬럼별 필터링/소팅 기능을 강화하여 사이드바 없이도 타겟별, 프로젝트별 데이터 필터링 가능.
    - 주요 정보(타겟, 상태, 출원인 등)를 인라인 컬럼으로 배치.
- **즐겨찾기 및 폴더 관리**: 테이블 내에서 즉시 즐겨찾기(Star) 설정 및 폴더 이동 기능 제공.

### 2.3 뷰 전환 및 상세 분석 (View Transition)
- **목록 보기 (List View)**: 기본 상태로, 검색 결과와 특허 목록을 테이블 형태로 표시.
- **상세 분석 (Detail View)**: 테이블 행 클릭 시 해당 특허의 상세 분석 화면(`portal.html` 기능)으로 전체 화면 전환.
    - 브레드크럼(Breadcrumb)을 제공하여 목록으로 쉽고 빠르게 복귀 가능.

## 3. 상세 컴포넌트 설계

### 3.1 Patent List Table
- **주요 컬럼**:
    - 특허 번호, 제목, 출원인, 출판일, 타겟, 상태(분석중/완료), 즐겨찾기(별 아이콘).
    - 대표 화합물(Key Compound) 이미지 (SVG 렌더링).
- **인터랙션**: 행 클릭 시 상세 페이지로 이동하거나 우측 패널에 상세 정보 표시.

### 3.2 Patent Analysis Portal (상세 분석 화면)
- `portal.html`의 복잡한 구조를 Ant Design의 `Tabs`와 `Resizable` 패널로 현대화.
- **PDF 뷰어**: 텍스트 하이라이트 및 검색 기능 포함. 특허 내 언급된 타겟/화합물 자동 마킹.
- **PDB 시퀀스 및 잔기 분석 패널 (Residue Mapping)**: 특허 분석 결과와 연계된 단백질의 시퀀스 및 핵심 잔기 데이터 매핑. (※ 3D 시각화는 제외)
    - PDF 내 특정 타겟 클릭 시 관련 PDB 시퀀스를 로드하고, 특허에서 언급된 특정 잔기(Residue) 번호와 위치를 시각적으로 강조.
- **화합물 목록**: 특허 내에서 추출된 모든 화합물을 카드 또는 테이블 형태로 표시.
- **Bioactivity 시각화**: `RadarChart` 컴포넌트를 재사용하여 활성 데이터를 직관적으로 표시.

## 4. UI/UX 개선 포인트
- **Micro-interactions**: 데이터 로딩 시 Skeleton UI 적용, 버튼 호버 효과, 테마 전환 시 부드러운 트랜지션.
- **에러 핸들링**: 검색 결과가 없을 때의 Empty State 디자인, API 오류 시 Toast 메시지 알림.
- **접근성**: 키보드 내비게이션 지원 및 웹 접근성 표준 준수.

## 5. 향후 작업 단계
1. **기초 UI 구현**: `src/pages/PatentAnalysis.tsx` 파일 생성 및 기본 레이아웃 구성.
2. **Mock 데이터 연결**: `src/mocks/patents.ts` 등을 생성하여 UI 렌더링 테스트.
3. **컴포넌트 개발**: 상세 필터, PDF 뷰어 연동 컴포넌트 개발.
4. **API 연동**: 기존에 분석된 `patent_analysis_api_docs.md`의 엔드포인트와 연결.

### 5.1 수정사항
특허 분석 상세 페이지에서 우측 데이터 분석 영역 UI 수정 요청, 
- 우선 탭 영역은 
  - Summary / Raw Data / Clean Data / Tables 영역으로 
  - 상세 내역
    - Summary
        - Scaffold Ranking
        - Functional Group
        - 추천 Key Compound (빈도수 기반)
    - Raw Data
        - Table(| pin | rank | Scaffold Group |  Example Number |  Structure |  R1 | R2 | R3 | ... |)
    - Clean Data
        - empty
    - Tables
        - 아래 두개의 파일을 토대로 portal.html의 display_tables_card_view 와 동일한 카드형태로 랜더링
        - sample/script/WO2026090333A1_EMBODIMENT_LIST.json
        - sample/script/WO2026090333A1.json

---
**보고서 요약**: 이 계획은 기존 `My Board`의 친숙한 검색 UI를 특허 분석 도구에 이식하여, 사용자가 이질감 없이 대량의 특허 데이터를 탐색하고 상세 분석할 수 있는 환경을 구축하는 것을 목표로 합니다.
