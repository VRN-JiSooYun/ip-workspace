# PATENT_DATA.json과 portal.html 매핑 분석 상세

이 문서는 `WO2026090333A1_PATENT_DATA.json`의 데이터 구조가 기존 `portal.html`에서 어떻게 파싱되고 렌더링되는지(UI 매핑) 상세하게 분석한 자료입니다. 향후 VORA 플랫폼에서 특허 분석 상세 페이지를 개발할 때 참조할 수 있습니다.

---

## 1. 특허 메타데이터 및 Scaffold 요약 (Summary 탭)

`portal.html`에서는 응답받은 데이터의 첫 번째 요소(또는 메타데이터 객체)를 `current_data` 변수에 담아 사용합니다. 이 안의 `frequency_analysis_result_json` 객체가 Summary 화면을 그리는 데 핵심적으로 사용됩니다.

### 1.1. Parent Scaffold (부모 골격)
- **JSON 필드**: `current_data.frequency_analysis_result_json.parent_scaffold._svg`
- **UI 매핑**: 
  - `$('.parent_scaffold').html(...)`를 통해 부모 골격의 구조식(SVG)을 화면에 렌더링합니다.

### 1.2. Scaffold Ranking (스캐폴드 랭킹)
- **JSON 필드**: `current_data.frequency_analysis_result_json.rank1`, `rank2`, `rank3` 객체 내부의 `_svg`, `frequency`, `smiles`
- **UI 매핑**:
  - **1위**: `$('.scaffold_1').html(rank1._svg)` / `$('.scaffold_1_freq').html('Frequency: ' + rank1.frequency)`
  - **2위, 3위**: 각각 `.scaffold_2`, `.scaffold_3` 클래스와 `.scaffold_2_freq`, `.scaffold_3_freq` 클래스에 매핑되어 상위 스캐폴드의 구조와 빈도수를 렌더링합니다.

### 1.3. Functional Group (치환기/R-Group 분석)
- **JSON 필드**: `current_data.frequency_analysis_result_json.r_groups`
  - 각 R-Group(예: "R1", "R2") 별로 배열을 가지고 있으며, 각 배열 요소는 `_svg`, `frequency`, `smiles`를 포함합니다.
- **UI 매핑**:
  - `Object.keys(r_groups)`를 통해 `sorted_r_group_no` 배열을 만들고 이를 순회합니다.
  - HTML 태그 속성 매핑: 
    - SVG 이미지: `$(`.r-svg[r_group_no=${r_group_no}][r_bucket_no=${r_bucket_no}]`).html(r_groups[...]._svg)`
    - 빈도수 표시: `$(`.r-freq[...]`).html('Frequency: ' + r_groups[...].frequency)`
  - R-group을 좌우 화살표 버튼을 클릭해 페이징할 수 있도록 `r_group_paginate` 클래스의 속성(`r_idx_to_start`)을 업데이트하는 로직이 포함되어 있습니다.

### 1.4. 추천 Key Compound (빈도수/중요도 기반)
- **JSON 필드**: API 응답의 `patent_compound` (즉, `result.data`) 배열의 상위 10개 화합물 요소
- **UI 매핑**:
  - `portal.html`에서는 기존에 알려진 별도의 탑 10 전용 필드를 사용하지 않고, 전체 실시예 리스트인 `patent_compound` 배열의 **상위 10개 요소(`i < 10`)만 순회**하여 화면에 그립니다.
  - 각 화합물을 `Ranking 1`부터 `Ranking 10`까지 레이블링하여 가로 형태로 배치(`.key-compound-list`)합니다.
  - **구성 요소**:
    - **순위 배지**: `Ranking ${i+1}` (예: Ranking 1)
    - **구조식 이미지**: `v.compound_svg`
    - **실시예 번호**: `v.example_number` (값이 없으면 'N/A', 배열로 파싱된 값이면 조인하여 표시)
    - **기타 버튼들**: 키 화합물 지정(🔑), 클립보드 복사(📋), 그리고 PDF 페이지 탐색(`highlightCompound`) 컨트롤이 함께 제공됩니다.

---

## 2. 실시예(Embodiments) 목록 렌더링 (Raw Data 및 Tables 탭)

Raw Data(테이블 뷰)와 Tables(카드 뷰) 화면은 단순히 `PATENT_DATA.json`의 전체 데이터를 그대로 렌더링하는 것이 아니라, **`EMBODIMENT_LIST.json` (혹은 관련 검색 API) 응답 결과와 연동하여 리스트화**됩니다.

### 2.1. Embodiment List 연동 (페이지네이션 및 필터링)
- **JSON 필드 (`EMBODIMENT_LIST.json`)**: 
  - `result.partial_rows`: 현재 페이지에서 보여줄 화합물 객체들의 배열 (각 객체는 고유 `id`를 가짐)
  - `result.total_rows`: 전체 검색/필터 결과 화합물 객체 배열
- **JSON 필드 (`PATENT_DATA.json`)**:
  - `result.data` (UI 변수명 `patent_compound`): 화합물의 상세 정보(`compound_svg`, `r_groups`, `example_number` 등)가 담긴 전체 원본 배열
- **UI 매핑 프로세스**:
  1. 검색 또는 페이지 이동 시, API를 통해 `partial_rows`에 해당하는 화합물 `id` 목록을 가져옵니다. (예: `10237500`, `10237501`)
  2. `portal.html`의 `display_embodiments_table_view` 혹은 `display_embodiments_card_view` 함수에서 `partial_rows` 배열을 순회(`$.each(partial_rows, ... )`)합니다.
  3. 순회 중인 각 `id` 값을 이용해 `patent_compound.find(item => item.id === id)`를 호출하여, 원본 데이터에서 상세 화합물 정보(`v`)를 매핑해 가져옵니다.
  4. 이렇게 찾은 상세 객체 `v`를 기반으로 테이블의 각 행(Row)이나 카드 UI를 렌더링합니다.
  - 이 방식을 통해 큰 용량의 SVG나 구조 정보를 매번 다시 불러오지 않고도 페이지네이션과 필터링을 효율적으로 수행합니다.

### 2.2. 실시예 화합물 상세 렌더링 매핑
- **JSON 필드**: `patent_compound.find()` 로 찾은 객체 `v` 내부 항목들
  - `id`: 고유 ID
  - `compound_svg`: 개별 화합물의 2D 구조식 SVG 텍스트
  - `is_human_key_compound`: 사용자가 지정한 핵심 화합물 여부 (boolean)
  - `r_groups`: 해당 화합물이 가지는 구체적인 치환기 텍스트들 (예: `{"R1": "F[*:1]", "R2": "C[*:2]"}`)
- **UI 매핑**:
  - 화합물 이미지: `<div class="patent_compound_svg" ...>${v.compound_svg}</div>` 로 렌더링됩니다.
  - 키 화합물 아이콘: `v.is_human_key_compound` 가 `true`일 경우 열쇠 모양 이모지(🔑)를 하이라이트 상태로 렌더링합니다. (CSS `filter: grayscale(100%)` 해제).

### 2.2. PDF 하이라이팅 연동 (PDF Page Interaction)
- **JSON 필드**: 
  - `page`: 해당 화합물이 언급된 특허 내 페이지 번호 목록 (예: `[76, 77, 78, 87]`)
- **UI 매핑**:
  - 카드 하단에 화합물이 존재하는 페이지를 탐색할 수 있는 화살표 버튼(◀, ▶)과 입력창이 렌더링됩니다.
  - `<input type="number" ... value="0"> / ${v.page.length}` 형태로 총 출현 페이지 수를 표시합니다.
  - `highlightCompound(patent_compound_idx, move_to, max_idx)` 자바스크립트 함수가 호출되며, 버튼을 클릭할 때마다 PDF 뷰어 플러그인(`goToPdfBBoxByIndex` 등)으로 페이지를 이동시키고 텍스트/구조 영역을 하이라이팅하는 연동 로직이 작동합니다.

### 2.3. 표 데이터 정보 (Table CSV)
- **JSON 필드**: `table_csv`, `table_group`, `table_num`
- **UI 매핑**:
  - 특허 본문 내 표에서 파싱된 정보를 나타냅니다.
  - 특정 화합물이 원본 특허의 어떤 표 그룹(`table_group_id`)에 속하는지를 바탕으로, HTML 데이터 속성(`table_group_id="${v.table_group}"`)에 바인딩하여 필터링 및 분류에 사용합니다.

---

## 3. 요약 및 신규 플랫폼 적용 가이드

- myWorkspace 프론트엔드 (React + Zustand) 환경으로 마이그레이션 할 때, 위에서 분석된 **JSON 데이터 구조체**를 Zustand의 Store(예: `usePatentStore`)에서 전역으로 관리하는 것이 좋습니다.
- **Summary**: `frequency_analysis_result_json` 객체는 React의 메인 대시보드 형태의 컴포넌트로 분리하여 `ScaffoldRanking` 및 `FunctionalGroup` 컴포넌트로 전달합니다.
- **Raw Data / Tables**: `patent_compound` 배열 정보는 Ant Design의 Table 컴포넌트(Raw Data)와 커스텀 Card 컴포넌트 리스트(Tables)로 매핑합니다.
- 특히 **PDF 인터랙션(`page`, `highlight_bbox_indices`)** 기능은 기존 jQuery 기반의 DOM 조작 함수(`goToPdfBBoxByIndex`)를 어떻게 React의 상태 혹은 Ref로 제어할 수 있을지에 대한 아키텍처 고민이 필요합니다.
