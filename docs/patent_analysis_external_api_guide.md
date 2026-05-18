# Patent Analysis External API Guide

이 문서는 `sample/patent_analysis_helper_api` 소스를 기준으로 특허 분석 페이지에서 사용하는 외부 API를 정리한 문서입니다.

기준 소스:
- `sample/patent_analysis_helper_api/patent_analysis_helper_main.py`
- `sample/patent_analysis_helper_api/functions.py`
- `sample/patent_analysis_helper_api/daehun_app.py`
- `sample/script/*.sh`

## 1. 서버 정보

### 메인 조회/수정 API
- Base URL: `http://172.16.1.210:10130`
- Endpoint: `POST /api`
- Content-Type: `multipart/form-data`

### 보조 업로드 API
- Base URL: `http://172.16.1.210:8000`
- Endpoint:
  - `POST /upload_pdf/`
  - `POST /upload_new_patent/`

## 2. 가장 중요한 구조

`10130` 서버는 REST 스타일이 아니라, 단일 `/api` 엔드포인트에 `operation` 값을 넣어 기능을 분기하는 RPC 스타일입니다.

Postman 테스트 시 공통 규칙:
- Method: `POST`
- URL: `http://172.16.1.210:10130/api`
- Body: `form-data`
- `operation` 필드는 항상 필요
- `filter_dict`, `order_dict`, `ligand_filter_dict`, `filter_group_conjunction_list`, `selected_patent_list`, `target_list` 는 JSON 객체/배열처럼 보여도 실제로는 문자열로 전송해야 함
- 일부 화면에서는 `actionType`도 함께 보내지만, 대부분 `operation`만으로도 동작함
- 응답 기본 형태:

```json
{
  "result_code": "0000",
  "result": {}
}
```

에러 시:

```json
{
  "result_code": "9999",
  "result": "error message"
}
```

파일 다운로드 계열은 JSON 대신 파일 바이너리가 직접 내려옵니다.

## 3. Postman 공통 샘플 값

문서 예시는 아래 샘플 값을 기준으로 작성했습니다.

- `owner_id`: `171`
- `publication_number`: `WO2026090333A1`
- `compound_id`: `12345`
- `folder_id`: `1`
- `target_name`: `EGFR`
- `smiles`: `C1=CC=CC=C1`

## 4. 특허 분석 페이지 기준 핵심 API

### 4.1 특허 상세 조회
- Operation: `GET-PATENT-DATA`
- 용도: 특허 기본 정보, 실시예 목록, 수정된 bioactivity 목록, 표 OCR 결과 조회

필수 form-data:
- `operation`: `GET-PATENT-DATA`
- `publication_number`: `WO2026090333A1`
- `owner_id`: `171`

Postman 예시:

```text
operation=GET-PATENT-DATA
publication_number=WO2026090333A1
owner_id=171
```

예상 응답 주요 키:
- `result.data`
- `result.patent_compound`
- `result.modified_patent_compound`
- `result.tables`

curl 예시:

```bash
curl -X POST "http://172.16.1.210:10130/api" \
  -F "operation=GET-PATENT-DATA" \
  -F "publication_number=WO2026090333A1" \
  -F "owner_id=171"
```

### 4.2 특허 목록 조회
- Operation: `GET-PATENT-LIST`
- 용도: 대시보드/목록 화면의 특허 페이징 조회

필수 form-data:
- `operation`: `GET-PATENT-LIST`
- `owner_id`: `171`
- `filter_dict`: `{}`
- `order_dict`: `[]`
- `filter_group_conjunction_list`: `[]`
- `num-rows-per-page`: `10`
- `page-no`: `1`

선택 form-data:
- `whose`: `my`
- `folder_id`: `1`

Postman 최소 예시:

```text
operation=GET-PATENT-LIST
owner_id=171
filter_dict={}
order_dict=[]
filter_group_conjunction_list=[]
num-rows-per-page=10
page-no=1
whose=my
folder_id=
```

예상 응답 주요 키:
- `result.partial_rows`
- `result.total_count`

정렬 샘플:

```text
order_dict=[{"column_name":"publication_date","order":"DESC"}]
```

간단 필터 샘플:

```text
filter_dict={"group_1":[{"filter_column":"str#status","filter_condition":"%s='%s'","filter_value":"complete","filter_conjunction":"AND"}]}
filter_group_conjunction_list=[]
```

### 4.3 실시예 목록 조회
- Operation: `GET-EMBODIMENT-LIST`
- 용도: 특허 상세 페이지의 embodiment 리스트/필터/정렬

필수 form-data:
- `operation`: `GET-EMBODIMENT-LIST`
- `publication_number`: `WO2026090333A1`
- `owner_id`: `171`
- `filter_dict`: `{}`
- `ligand_filter_dict`: `[]`
- `order_dict`: `[]`
- `filter_group_conjunction_list`: `[]`
- `num-rows-per-page`: `10`
- `page-no`: `1`

선택 form-data:
- `whose`: `my`

Postman 최소 예시:

```text
operation=GET-EMBODIMENT-LIST
publication_number=WO2026090333A1
owner_id=171
filter_dict={}
ligand_filter_dict=[]
order_dict=[]
filter_group_conjunction_list=[]
num-rows-per-page=10
page-no=1
whose=my
```

예상 응답 주요 키:
- `result.partial_rows`
- `result.total_rows`
- `result.modified_partial_rows`
- `result.modified_total_rows`

실시예 정렬 샘플:

```text
order_dict=[{"column_name":"ranking","order":"ASC"}]
```

리간드 필터 샘플:

```text
ligand_filter_dict={"group_1":[{"filter_condition":"substructure#0#1","filter_value":"C1=CC=CC=C1","filter_conjunction":"AND"}]}
```

### 4.4 화합물 검색
- Operation: `GET-ELASTIC-COMPOUND-LIST`
- 용도: SMILES 기반 identical/substructure/similarity/pattern/bm/csk 검색

필수 form-data:
- `operation`: `GET-ELASTIC-COMPOUND-LIST`
- `owner_id`: `171`
- `smiles`: `C1=CC=CC=C1`
- `type`: `substructure`

선택 form-data:
- `sim`: `70`
- `page`: `1`
- `size`: `10`
- `order_by`: `molecular_weight#desc`
- `molecular_weight`: `gte#100`
- `log_p`: `lte#5`
- `tpsa`: `gte#50`

Postman 예시:

```text
operation=GET-ELASTIC-COMPOUND-LIST
owner_id=171
smiles=C1=CC=CC=C1
type=substructure
sim=70
page=1
size=10
order_by=molecular_weight#desc
```

예상 응답 주요 키:
- `result.query_svg`
- `result.identical`
- `result.substructure`
- `result.similarity`
- `result.pattern`
- `result.bm`
- `result.csk`

주의:
- `type` 값은 최소 `identical`, `substructure`, `similarity`, `pattern`, `bm`, `csk` 중 하나로 넣는 것이 안전
- `sim`은 퍼센트 값이며 내부에서 `70 -> 0.7`로 변환됨

### 4.5 화합물 검색 페이지네이션
- Operation: `GET-ELASTIC-COMPOUND-LIST-BY-PAGE`
- 용도: 특정 검색 타입의 다음 페이지 조회

Postman 예시:

```text
operation=GET-ELASTIC-COMPOUND-LIST-BY-PAGE
owner_id=171
smiles=C1=CC=CC=C1
type=similarity
sim=70
page=2
size=10
order_by=molecular_weight#desc
```

### 4.6 타겟/알람 목록 조회
- Operation: `GET-TARGET-LIST`
- 용도: 타겟 목록, 사용자 알람 상태, 폴더 트리 조회

필수 form-data:
- `operation`: `GET-TARGET-LIST`
- `owner_id`: `171`

Postman 예시:

```text
operation=GET-TARGET-LIST
owner_id=171
```

예상 응답 주요 키:
- `result.rows`
- `result.selected_rows`
- `result.user_to_alarm`
- `result.folders`

### 4.7 특허가 포함된 화합물 기반 특허 목록 조회
- Operation: `GET-PATENT-LIST-BY-COMPOUND-ID`
- 용도: compound 상세에서 관련 특허 목록 조회

Postman 예시:

```text
operation=GET-PATENT-LIST-BY-COMPOUND-ID
compound_id=12345
```

### 4.8 사용자 화합물 검색 히스토리
- Operation: `GET-COMPOUND-SEARCH-HISTORY`

Postman 예시:

```text
operation=GET-COMPOUND-SEARCH-HISTORY
owner_id=171
```

## 5. 수정/액션 계열 API

### 5.1 특허 메타데이터 수정
- Operation: `MODIFY-PATENT-DATA`

필수 form-data:
- `operation`: `MODIFY-PATENT-DATA`
- `owner_id`: `171`
- `publication_number`: `WO2026090333A1`
- `publication_date`: `08.05.2025`
- `protein_target`: `EGFR,HER2`
- `applicant`: `Sample Applicant`
- `status`: `complete`
- `comment`: `checked by postman`

Postman 예시:

```text
operation=MODIFY-PATENT-DATA
owner_id=171
publication_number=WO2026090333A1
publication_date=08.05.2025
protein_target=EGFR,HER2
applicant=Sample Applicant
status=complete
comment=checked by postman
```

### 5.2 실시예 수정
- Operation: `MODIFY-EMBODIMENT`
- 용도: 구조식, smiles, bioactivity 값 수정

필수 form-data:
- `operation`: `MODIFY-EMBODIMENT`
- `patent_compound_id`: `1001`
- `owner_id`: `171`
- `publication_number`: `WO2026090333A1`
- `smiles`: `CCO`
- `mol_block`: `...mol block text...`
- `bioactivity_list`: `IC50@_@Ki`
- `IC50`: `12.3,15.1`
- `Ki`: `4.5`

주의:
- `bioactivity_list`는 `@_@` 구분자를 사용
- 각 bioactivity key와 같은 이름의 form-data 키를 추가로 넣어야 함

### 5.3 사람이 지정한 Key Compound 조건 조회
- Operation: `GET-HUMAN-KEY-COMPOUND-CONDITION`

Postman 예시:

```text
operation=GET-HUMAN-KEY-COMPOUND-CONDITION
patent_compound_id=1001
```

### 5.4 Key Compound 지정
- Operation: `DESIGNATE-KEY-COMPOUND`

Postman 예시:

```text
operation=DESIGNATE-KEY-COMPOUND
patent_compound_id=1001
owner_id=171
bioactive=true
common_struct=
prodrug=
public_struct=
other=
```

주의:
- 소스상 `bool(request.form.get(...))` 방식이라 문자열 `"false"` 도 `true`처럼 처리될 수 있음
- Postman 테스트 시 체크 해제 항목은 `false` 대신 빈 값으로 보내는 것이 더 안전함

### 5.5 전체 bioactivity 수정 요청
- Operation: `REQUEST-MODIFY-ALL-BIOACTIVITY`

Postman 예시:

```text
operation=REQUEST-MODIFY-ALL-BIOACTIVITY
owner_id=171
quality=5
publication_number=WO2026090333A1
```

### 5.6 즐겨찾기 추가/해제
- Operation:
  - `ADD-FAVORITE`
  - `REMOVE-FAVORITE`

필수 form-data:
- `operation`
- `owner_id`
- `table`
- `target_list`

특허 즐겨찾기 예시:

```text
operation=ADD-FAVORITE
owner_id=171
table=patent_user
target_list=["WO2026090333A1"]
```

실시예 즐겨찾기 예시:

```text
operation=ADD-FAVORITE
owner_id=171
table=embodiment_user
target_list=[1001,1002]
```

주의:
- 코드상 `table == 'patent_user'` 이면 `publication_number`, 그 외에는 `patent_compound_id`로 처리함

## 6. 폴더/타겟 관리 API

이 그룹은 `operation` 뿐 아니라 `actionType` 값도 같이 맞춰서 보내는 편이 안전합니다.

### 6.1 폴더 생성
- Operation: `ADD-FOLDER`

```text
operation=ADD-FOLDER
actionType=ADD-FOLDER
owner_id=171
folder_name=Important Patents
parent_id=-1
```

### 6.2 폴더 이름 변경
- Operation: `RENAME-FOLDER`

```text
operation=RENAME-FOLDER
actionType=RENAME-FOLDER
owner_id=171
folder_id=1
folder_name=Renamed Folder
```

### 6.3 폴더 삭제
- Operation: `DELETE-FOLDER`

```text
operation=DELETE-FOLDER
actionType=DELETE-FOLDER
owner_id=171
folder_id=1
```

### 6.4 폴더에 특허 추가
- Operation: `ADD-PATENTS-TO-FOLDER`

```text
operation=ADD-PATENTS-TO-FOLDER
actionType=ADD-PATENTS-TO-FOLDER
owner_id=171
folder_id=1
selected_patent_list=["WO2026090333A1","WO2026087635A1"]
```

### 6.5 폴더에서 특허 제거
- Operation: `DELETE-PATENTS-FROM-FOLDER`

```text
operation=DELETE-PATENTS-FROM-FOLDER
actionType=DELETE-PATENTS-FROM-FOLDER
owner_id=171
folder_id=1
selected_patent_list=["WO2026090333A1"]
```

### 6.6 폴더 공유
- Operation: `SHARE-FOLDER`

```text
operation=SHARE-FOLDER
actionType=SHARE-FOLDER
owner_id=171
folder_id=1
cc=root-171,user-172
```

주의:
- `cc`는 문자열이며 내부에서 `-` 뒤 숫자만 추출함

### 6.7 이메일 알람 활성화/비활성화

활성화:

```text
operation=ENABLE-EMAIL-ALARM
owner_id=171
email=test@example.com
```

비활성화:

```text
operation=DISABLE-EMAIL-ALARM
owner_id=171
```

### 6.8 타겟 추가/확정/삭제

신규 타겟 추가:

```text
operation=ADD-NEW-TARGET
actionType=ADD-NEW-TARGET
owner_id=171
email=test@example.com
origin_target_name=EGFR
```

신규 타겟 확정:

```text
operation=CONFIRM-NEW-TARGET
actionType=CONFIRM-NEW-TARGET
owner_id=171
origin_target_name=EGFR
new_target_name=EGFR
keyword=epidermal growth factor receptor,erbb1
```

신규 타겟 삭제:

```text
operation=DELETE-NEW-TARGET
actionType=DELETE-NEW-TARGET
owner_id=171
origin_target_name=EGFR
```

타겟 사용자 추가:

```text
operation=ADD-TARGET-USER
owner_id=171
target_name=EGFR
email=test@example.com
```

타겟 사용자 제거:

```text
operation=REMOVE-TARGET-USER
owner_id=171
target_name=EGFR
```

## 7. 파일 업로드/다운로드 API

### 7.1 PDF 메타데이터 추출
- Server: `8000`
- Endpoint: `POST http://172.16.1.210:8000/upload_pdf/`
- Body: `form-data`
- 필수 키:
  - `file`: PDF 파일

응답 예시:

```json
{
  "message": "파일이 성공적으로 업로드되었습니다.",
  "metadata": {
    "protein_target": "EGFR",
    "publication_number": "2026090333",
    "publication_date": "08.05.2025",
    "filling_date": "01.11.2024",
    "filling_language": "EN",
    "applicant": "Sample Applicant",
    "title": "Sample Patent Title",
    "abstract": "Sample abstract",
    "kind_code": "A1",
    "patent_office_code": "WO",
    "patent_office": "WIPO"
  }
}
```

### 7.2 특허 파일 업로드 및 분석 시작
- Operation: `UPLOAD-PATENT-FILE`
- Server: `10130`
- Endpoint: `POST /api`
- Body: `form-data`

필수 키:
- `operation`: `UPLOAD-PATENT-FILE`
- `file`: PDF 파일
- `protein_target`
- `publication_number`
- `publication_date`
- `filling_date`
- `filling_language`
- `applicant`
- `title`
- `abstract`
- `kind_code`
- `patent_office_code`
- `patent_office`

Postman form-data 예시:

```text
operation=UPLOAD-PATENT-FILE
protein_target=EGFR
publication_number=2026090333
publication_date=08.05.2025
filling_date=01.11.2024
filling_language=EN
applicant=Sample Applicant
title=Sample Patent Title
abstract=Sample abstract text
kind_code=A1
patent_office_code=WO
patent_office=WIPO
file=(select file)
```

주의:
- 최종 특허 번호는 내부에서 `patent_office_code + publication_number + kind_code` 로 조합됨
- 이미 등록된 특허면 `result.msg`에 중복 메시지가 반환됨

### 7.3 생물활성 CSV/XLSX 업로드
- Operation: `UPLOAD-BIOACTIVITY-FILE`

Postman 예시:

```text
operation=UPLOAD-BIOACTIVITY-FILE
publication_number=WO2026090333A1
file=(select csv or xlsx)
```

### 7.4 메타데이터만 먼저 추출
- Operation: `GET-META-DATA`

Postman 예시:

```text
operation=GET-META-DATA
file=(select pdf)
```

### 7.5 단일 파일 다운로드
- Operation:
  - `DOWNLOAD-FILE`
  - `DOWNLOAD-OCR-PDF`

Postman 예시:

```text
operation=DOWNLOAD-FILE
file_path=/raid/patent_hot/WO/2025-05/WO2026090333A1/WO2026090333A1.pdf
```

주의:
- 서버 파일 시스템 경로를 직접 넘기는 구조

### 7.6 여러 PDF ZIP 다운로드
- Operation: `DOWNLOAD-PDF-FILES`

```text
operation=DOWNLOAD-PDF-FILES
selected_patent_list=["WO2026090333A1","WO2026087635A1"]
```

### 7.7 실시예 Excel 다운로드
- Operation: `DOWNLOAD-EMBODIMENTS-EXCEL`

최소 예시:

```text
operation=DOWNLOAD-EMBODIMENTS-EXCEL
publication_number=WO2026090333A1
owner_id=171
bioactivity_type=bioactivity
filter_dict={}
ligand_filter_dict=[]
order_dict=[]
filter_group_conjunction_list=[]
```

가능한 `bioactivity_type` 예시:
- `bioactivity`
- `modified_bioactivity`

## 8. 8000 포트의 별도 특허 등록 API

### 8.1 로컬 경로 기반 신규 특허 등록
- Endpoint: `POST http://172.16.1.210:8000/upload_new_patent/`
- Content-Type: `application/json`

Request Body 예시:

```json
{
  "source_path": "/raid/inbox/sample.pdf",
  "target": "EGFR"
}
```

응답 예시:

```json
{
  "data": "success",
  "result": true,
  "save_path": "/raid/patent_hot/WO/2025-05/WO2026090333A1/WO2026090333A1.pdf",
  "groupware_url": "https://voronoi.app/ai/patent_analysis/portal?wasm=1&publication_number=WO2026090333A1"
}
```

## 9. Postman 테스트 팁

### 9.1 `/api` 테스트 템플릿
- URL: `http://172.16.1.210:10130/api`
- Body 타입: `form-data`
- 가장 먼저 `operation` 추가
- JSON 값은 raw JSON이 아니라 문자열로 넣기

### 9.2 자주 쓰는 JSON 문자열 샘플

빈 객체:

```json
{}
```

빈 배열:

```json
[]
```

특허 번호 배열:

```json
["WO2026090333A1","WO2026087635A1"]
```

정렬 배열:

```json
[{"column_name":"publication_date","order":"DESC"}]
```

### 9.3 테스트 우선순위 추천
1. `GET-PATENT-LIST`
2. `GET-PATENT-DATA`
3. `GET-EMBODIMENT-LIST`
4. `GET-ELASTIC-COMPOUND-LIST`
5. `GET-TARGET-LIST`

## 10. 소스 기준 특이사항

- `GET-PATENT-LIST`, `GET-EMBODIMENT-LIST` 는 필터 구조가 자유도가 높아 프론트 없이 수동 테스트할 때는 우선 빈 JSON으로 시작하는 것이 가장 안전합니다.
- `DESIGNATE-KEY-COMPOUND` 는 boolean 처리 방식이 엄격하지 않아 `false` 문자열 사용 시 오동작 가능성이 있습니다.
- 다운로드 API는 일반 JSON 응답이 아니라 파일 응답입니다.
- 업로드 API 일부는 실제 서버 파일 경로, DB 상태, 비동기 분석 파이프라인에 의존합니다.

