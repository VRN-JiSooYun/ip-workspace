# Clean Data 탭 테이블 구성 분석

## 목적
`PatentAnalysisDetail.tsx`의 `Clean Data` 탭(현재 Empty 상태)에 대해, 아래 샘플 소스를 기준으로 테이블 데이터가 어떻게 구성되어야 하는지 정리한다.

- HTML 동작 기준: `sample/patent_analysis_helper_html/portal_cleandata.html`
- 데이터 기준 1: `sample/script/WO2026087635A1_PATENT_DATA.json`
- 데이터 기준 2(페이지/결과셋): `sample/script/WO2026087635A1_EMBODIMENT_LIST.json`

---

## 1) 소스 구조 요약

### 1-1. API 응답 형태
샘플 JSON 2개 모두 아래 형태를 사용한다.

```json
[ true, true, { ...payload... } ]
```

즉 실제 payload는 인덱스 `2`에 있다.

- PATENT_DATA payload 키: `data`, `modified_patent_compound`, `patent_compound`, `tables`
- EMBODIMENT_LIST payload 키: `modified_partial_rows`, `modified_total_rows`, `partial_rows`, `total_rows`

### 1-2. Clean Data 컬럼 메타
`portal_cleandata.html`에서 Clean Data 탭(`.modified_bioactivity`)의 bioactivity 컬럼은
`current_data.modified_bioactivity_list`를 기준으로 동적 생성된다.

샘플 값:
- `MET D1228H TR-FRET biochemical assay, IC50(uM)`
- `MET D1228V EBC-1 CellTiter-GloR cell viability assay IC50(uM)`
- `MET EBC-1 CellTiter-GloR cell viability assay, IC50(uM)`

또한 R-group 컬럼은 `r_groups` 키(`R1...R10`)에 따라 동적 생성된다.

---

## 2) Clean Data 테이블의 실제 컬럼 구성(순서)
`display_embodiments_table_view(..., tab='.modified_bioactivity')` 기준

1. `checkbox` (다운로드 선택)
2. `pin`
3. `Rank` (`ranking`)
4. `Scaffold Group` (`scaffold_ranking`)
5. `Example Number` (`example_number`)
6. `Structure` (`compound_svg` + 페이지 이동)
7. `modified_bioactivity_list`의 동적 컬럼들 (N개)
8. `Scaffold` (`scaffold_svg`)
9. `R-group` 동적 컬럼 (`R1...Rn`, 각 셀에 SVG)
10. `관리`(수정 링크)

주의:
- HTML 소스상 Raw/Clean 공용 렌더 함수를 쓰기 때문에, Clean Data에서도 위 기본 컬럼 블록은 동일하게 유지된다.

---

## 3) 각 컬럼 데이터 매핑 규칙

### 3-1. 행 데이터 원천
- 목록/페이지/정렬 결과: `WO2026087635A1_EMBODIMENT_LIST.json`의 `modified_partial_rows`, `modified_total_rows`의 `id`
- 상세 row 데이터: `WO2026087635A1_PATENT_DATA.json`의 `modified_patent_compound` (id 매칭)

권장 구현:
1. `modified_partial_rows.map(x => x.id)`로 현재 페이지 row id 리스트 생성
2. `modified_patent_compound`를 id 기준 map으로 만든 뒤 row를 조립

### 3-2. bioactivity 값 표시
- 셀 값: `row.modified_bioactivity[bioKey]`
- 타입: 배열(예: `[0.045]`)
- 표시: 배열 원소를 `<br>` 기준으로 join
  - React에서는 `valueArray.join('\n')` 또는 태그 분리 렌더

### 3-3. Example Number 표시
- `null` -> `N/A`
- 배열 내 `'NaN'`만 존재하면 `Intermediate`
- 그 외는 `'NaN'` 제외 후 `<br>` join

### 3-4. Structure / Scaffold
- `Structure`: `compound_svg` 렌더
- `Scaffold`: `scaffold_svg` 렌더
- 클릭 시 미리보기/하이라이트 이동은 선택 기능

### 3-5. R-group 컬럼
- 각 row의 `r_groups` 키를 숫자순 정렬 (`R1, R2, ... R10`)
- 값은 smiles 문자열(예: `Cl[*:1]`)
- SVG는 `current_data.frequency_analysis_result_json.r_groups[rKey]`에서
  `smiles` 동일 항목을 찾아 `_svg` 사용

---

## 4) 샘플 데이터 특이사항(중요)

### 4-1. 중복 id 존재
샘플의 `modified_partial_rows`는 동일 id `10235121`이 4회 반복된다.
`modified_patent_compound`도 동일 id row가 중복으로 들어 있다.

권장 정책(프론트):
- 테이블 row는 `id` 단일 키만 쓰면 React key 충돌 가능
- `rowKey`를 `id-index` 형태로 구성하거나,
- clean data에서 의도적으로 중복을 보여줄지, id 기준 dedupe할지 정책 결정 필요

### 4-2. 결과 건수 불일치 가능
- `modified_total_rows`: 1건
- `modified_partial_rows`: 4건(중복 포함)

즉 총건수 표시와 실제 표시 row 수가 불일치할 수 있다.
UI 정책을 명시해야 한다.
- 불일치 허용 시: `modified_total_rows.length` 또는 dedupe 후 길이 표시
- 불일치 불허 시: `modified_total_rows` 기준으로 페이지네이션 및 row 구성 (중복 제거)
- 우선 불일치 허용 후 정책 재검토 권장 (중복 데이터의 의미와 사용자 기대에 따라 조정 가능)


### 4-3. mocks 폴더에 샘플 데이터를 활용한 mock API 구현
- 위 특이사항들을 반영하여 실제 API 응답과 동일한 형태로 데이터를 가공하는 것이 중요하다. 특히 중복 id와 결과 건수 불일치 문제는 프론트엔드 개발 및 테스트 단계에서 혼란을 줄 수 있으므로, mock API에서도 이를 명확히 처리해야 한다.

---

## 5) PatentAnalysisDetail.tsx 반영 권장안

`Clean Data` 탭 테이블은 `Raw Data` 테이블과 거의 동일한 UI를 재사용하고,
데이터 소스/동적 컬럼만 아래처럼 바꾸는 것이 가장 안전하다.

1. 데이터 소스
- `rows`: `modified_patent_compound`
- page ids: `modified_partial_rows`
- total count: `modified_total_rows.length` (또는 dedupe 정책 반영)

2. 동적 bioactivity 컬럼
- 기준 목록: `current_data.modified_bioactivity_list`
- 값 소스: `row.modified_bioactivity[bioKey]`

3. R-group 컬럼
- 기준: row.r_groups 키 집합
- SVG 매핑: `current_data.frequency_analysis_result_json.r_groups`

4. 포맷
- Example Number, bioactivity 배열, SVG fallback(no image 박스) 규칙은 Raw Data와 동일 적용

---

## 6) 구현 체크리스트

- [ ] payload 파싱 시 인덱스 `[2]` 사용
- [ ] clean tab에서 `modified_*` 데이터 소스 사용
- [ ] `modified_bioactivity_list` 기반 동적 컬럼 생성
- [ ] `modified_bioactivity[key]` 배열 포맷 처리
- [ ] R-group SVG smiles 매칭 처리
- [ ] 중복 id rowKey 전략 확정 (`id-index` 권장)
- [ ] total count 표시 정책 확정(원본/중복제거)

