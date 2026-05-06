# 특허 분석 상세 페이지 데이터 및 UI 구조 분석

## 1. 개요
특허 분석 상세 페이지 구현을 위해 기존 브라우저 소스와 API 응답 데이터를 분석한 결과입니다.

**분석 대상 파일:**
- 기존 화면 브라우저 소스: `sample/patent_analysis_helper_html/portal.html`
- 특허 원본 뷰어용 예제 PDF: `sample/pdf/WO2026090333A1.pdf`
- 예제 API 응답 데이터 1: `sample/script/WO2026090333A1_PATENT_DATA.json`
- 예제 API 응답 데이터 2: `sample/script/WO2026090333A1_EMBODIMENT_LIST.json`

---

## 2. 화면 구성 분석 (`portal.html`)
페이지는 크게 두 개의 패널로 나뉘며, 사용자가 드래그하여 영역 크기를 조절할 수 있는 Resizable 컨테이너 구조를 가집니다.

- **전체 레이아웃 (`.resizable-container`)**: 좌우 분할 구조
- **좌측 패널 (`.left-panel`)**: PDF 뷰어 영역
  - 특허 원본(`WO2026090333A1.pdf` 등)을 렌더링하는 뷰어(`pdf-container`) 존재.
  - 상단에 페이지 이동, 검색 등을 위한 컨트롤(`pdf-controls`, `search-controls`) 포함.
- **우측 패널 (`.right-panel`)**: 분석 데이터 및 표출 영역
  - 자바스크립트 변수 `current_tab`을 통해 여러 뷰 모드(`report`, `embodiment`, `modified_bioactivity`)를 제공.
  - `dataTable` 형태의 그리드를 통해 실시예 화합물 목록이나 분석 데이터를 표 형태로 표시하도록 구성됨.

---

## 3. 데이터 구조 분석 (API Response)

### 3.1. 메타데이터 및 빈도 분석 결과 (`WO2026090333A1_PATENT_DATA.json`)
해당 API 응답은 특허의 기본 서지 정보와 AI를 통해 추출된 스캐폴드(Scaffold) 및 치환기(R-Group) 분석 결과를 담고 있습니다.

- **기본 메타데이터**
  - `applicant`: 출원인 (예: "INCYTE CORPORATION")
  - `abstract`: 초록 텍스트
  - `filling_date`, `filling_language`: 출원일 및 출원 언어
- **핵심 화합물 (Key Compound)**
  - `ai_key_compound`: 핵심 화합물의 SMILES
  - `ai_key_compound_img`: 구조식을 시각화한 SVG 데이터
- **빈도 분석 결과 (`frequency_analysis_result_json`)**
  - `parent_scaffold`: 공통 골격에 대한 구조식 SVG (`_svg`) 및 `mol_block`
  - `important_r_groups`: 주요 변동이 일어나는 치환기 위치 목록 (예: `["R1", "R6", "R7"]`)
  - `r_groups`: `R1`부터 `R7` 등 각 위치별로 발견된 치환기 그룹 정보
    - 세부 속성: `_svg` (렌더링용), `smiles` (구조식), `frequency` (특허 내 출현 빈도수), `img_path`

### 3.2. 실시예 목록 데이터 (`WO2026090333A1_EMBODIMENT_LIST.json`)
이 API는 특허에 명시된 개별 실시예(Embodiment) 화합물들의 리스트 정보를 반환합니다.

- **응답 구조**
  - `result_code`: 응답 상태 코드 (정상: "0000")
  - `result`: 페이징 및 필터링 처리를 위한 배열 정보
    - `total_rows`: 전체 실시예의 고유 ID 목록 (예: `{"id": 10237515}`)
    - `partial_rows`: 현재 페이지 또는 화면에 표시할 실시예 고유 ID 목록
    - (참고) 각 ID를 사용하여 개별 화합물의 상세 구조(SMILES, 속성 등)를 추가로 조회하거나, 프론트엔드에서 Table/List 형태로 구성할 때 사용됨.

---

## 4. 프론트엔드 연동 계획
1. **Layout**: 기존 `portal.html`과 같이 좌측에는 PDF Viewer Component, 우측에는 Data Viewer(Tab 구성) Component 배치.
2. **Data Fetching**:
   - `PATENT_DATA.json`을 호출하여 우측 패널 상단에 특허 정보(출원인, Abstract) 및 공통 Scaffold 구조 표시.
   - 빈도 분석 데이터(`frequency_analysis_result_json`)를 통해 주요 R-Group 테이블(또는 차트) 렌더링.
   - `EMBODIMENT_LIST.json`을 통해 ID 리스트를 가져온 뒤, 테이블(`dataTable` 역할)에 실시예들을 리스팅하고 렌더링.
