# Patent Analysis Helper API Documentation

이 문서는 `sample/patent_analysis_helper_api` 프로젝트에 구현된 API들의 구조와 사용법을 정리한 문서입니다.

## 1. 개요
프로젝트는 크게 두 개의 Flask 애플리케이션으로 구성되어 있습니다.
- `daehun_app.py`: PDF 업로드 및 새로운 특허 등록/분석을 담당 (Port: 8000)
- `patent_analysis_helper_main.py`: 특허 데이터 조회, 타겟 관리, 폴더 관리 등 비즈니스 로직을 담당 (Port: 10130)

---

## 2. daehun_app.py (Port: 8000)
이 애플리케이션은 주로 파일 업로드와 관련된 RESTful 스타일의 API를 제공합니다.

### 2.1 PDF 메타데이터 추출
- **Endpoint**: `POST /upload_pdf/`
- **Description**: 업로드된 PDF 파일에서 특허 메타데이터(출원번호, 공고번호 등)를 추출합니다.
- **Parameters (Multipart/Form-Data)**:
  - `file`: PDF 파일
- **Response**:
  ```json
  {
    "message": "파일이 성공적으로 업로드되었습니다.",
    "metadata": { ... }
  }
  ```

### 2.2 신규 특허 등록 및 분석 요청
- **Endpoint**: `POST /upload_new_patent/`
- **Description**: 로컬 경로의 PDF를 특허 DB에 등록하고 비동기 분석을 시작합니다.
- **Parameters (JSON)**:
  - `source_path`: 로컬 PDF 파일 경로
  - `target`: 관련 단백질 타겟 이름
- **Response**:
  ```json
  {
    "data": "success",
    "result": true,
    "save_path": "...",
    "groupware_url": "..."
  }
  ```

---

## 3. patent_analysis_helper_main.py (Port: 10130)
이 애플리케이션은 단일 엔드포인트 `/api`를 통해 `operation` 파라미터로 기능을 구분하는 RPC(Remote Procedure Call) 스타일의 구조를 가지고 있습니다.

### 3.1 공통 구조
- **Endpoint**: `POST /api`
- **Common Parameters (Form-Data)**:
  - `operation`: 수행할 작업 이름 (필수)

### 3.2 주요 Operations

#### 특허 및 화합물 조회 관련
| Operation | 설명 | 주요 파라미터 |
| :--- | :--- | :--- |
| `GET-PATENT-DATA` | 특정 특허의 상세 데이터 및 화합물 목록 조회 | `publication_number`, `owner_id` |
| `GET-PATENT-LIST` | 필터 및 정렬 조건에 따른 특허 목록 조회 | `filter_dict`, `order_dict`, `owner_id`, `num-rows-per-page`, `page-no` |
| `GET-PATENT-LIST-BY-COMPOUND-ID` | 특정 화합물이 포함된 특허 목록 조회 | `compound_id` |
| `GET-PATENT-LIST-BY-COMPOUND-IDS` | 여러 화합물이 포함된 특허 목록 일괄 조회 | `compound_ids` (comma-separated string) |
| `GET-EMBODIMENT-LIST` | 특정 특허 내의 실시예(화합물) 목록 조회 | `publication_number`, `filter_dict`, `order_dict`, `num-rows-per-page`, `page-no` |
| `GET-COMPOUND-SEARCH-HISTORY` | 유저의 화합물 검색 기록 조회 | `owner_id` |
| `GET-ELASTIC-COMPOUND-LIST` | Elasticsearch를 이용한 화합물 검색 (유사도, 부분구조 등) | `smiles`, `type`, `sim`, `page`, `size` |

#### 타겟 및 알람 관리
| Operation | 설명 | 주요 파라미터 |
| :--- | :--- | :--- |
| `GET-TARGET-LIST` | 타겟 목록 및 알람 설정 상태 조회 | `owner_id` |
| `ADD-NEW-TARGET` | 새로운 관심 타겟 추가 | `target_name`, `owner_id` |
| `ENABLE-EMAIL-ALARM` | 특정 타겟에 대한 이메일 알림 활성화 | `owner_id`, `target_name` |
| `DISABLE-EMAIL-ALARM` | 특정 타겟에 대한 이메일 알림 비활성화 | `owner_id`, `target_name` |

#### 폴더 및 즐겨찾기 관리
| Operation | 설명 | 주요 파라미터 |
| :--- | :--- | :--- |
| `ADD-FOLDER` | 새로운 보관함 폴더 생성 | `folder_name`, `parent_id`, `owner_id` |
| `ADD-PATENTS-TO-FOLDER` | 폴더에 특허 추가 | `folder_id`, `selected_patent_list` (JSON array) |
| `ADD-FAVORITE` | 즐겨찾기(특허 또는 화합물) 추가 | `owner_id`, `publication_number` or `patent_compound_id` |
| `REMOVE-FAVORITE` | 즐겨찾기 해제 | `owner_id`, `id` |

#### 데이터 수정 및 파일 다운로드
| Operation | 설명 | 주요 파라미터 |
| :--- | :--- | :--- |
| `MODIFY-EMBODIMENT` | 화합물 구조(SMILES) 또는 데이터 수정 | `patent_compound_id`, `smiles`, `mol_block` |
| `UPLOAD-PATENT-FILE` | 특허 PDF 파일 업로드 | `file` |
| `DOWNLOAD-FILE` | 특정 파일 다운로드 | `path` |
| `DOWNLOAD-PDF-FILES` | 여러 특허 PDF를 ZIP으로 다운로드 | `publication_numbers` |
| `DOWNLOAD-EMBODIMENTS-EXCEL` | 실시예 목록을 엑셀로 다운로드 | `publication_number` |

---

## 4. 데이터 모델 요약 (PostgreSQL)
주요 테이블 정보:
- `patent`: 특허 메타데이터 (제목, 초록, 출원인, 공고일 등)
- `compound`: 화합물 기본 정보 (Canonical SMILES, Fingerprint 등)
- `patent_compound`: 특허와 화합물의 매핑 정보 (실시예 번호, 활성 데이터, 이미지 등)
- `patent_table`: 특허 내에서 추출된 테이블 데이터
- `folder`: 유저별 폴더 구조
- `target_to_alarm`: 모니터링 대상 타겟 정보

---

## 5. 참고 사항
- `functions.py`: `patent_analysis_helper_main.py`에서 호출하는 모든 비즈니스 로직 함수가 정의되어 있습니다.
- `daehun_functions.py`: 데이터베이스 직접 연동 및 화합물 구조 수정, 병합 등의 복잡한 처리를 담당합니다.
- API 호출 시 `owner_id`는 현재 로그인한 사용자의 ID를 의미하며, 내부 시스템과의 연동을 위해 자주 사용됩니다.
