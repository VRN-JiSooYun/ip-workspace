# RDKit cluster_v1 R-group 프론트엔드 연동

## API 확인

- 실행 중인 RDKit API의 `POST /cluster_v1`을 직접 호출해 응답을 확인했습니다.
- 각 화합물 결과에 동적 `Core`, `R1...Rn` SMILES와 `Core_svg`, `R1_svg...Rn_svg`가 추가됩니다.

## 작업 내용

- 프론트엔드 cluster 응답 타입에 R-group 결과 모델을 추가했습니다.
- `Core`를 먼저, 이후 `R1...Rn`을 숫자 순서로 정규화해 기존 cluster 캐시에 포함했습니다.
- SAR Table 화합물 카드 하단에 Core/R-group 구조 미리보기 스트립을 추가했습니다.
- R-group 미리보기는 3열 자동 줄바꿈 그리드로 표시해 `R1...Rn` 결과가 가로 영역 밖에 숨지 않고 전부 노출됩니다.
- 각 R-group 구조를 클릭하면 기존 구조 미리보기 모달에서 확대해 볼 수 있습니다.
- R-group 결과가 없거나 Highlight가 꺼져 있으면 기존 카드 레이아웃을 유지합니다.
- 수정된 API가 `substructure_color_dict` 키를 R-group scaffold SMILES로 파싱하므로, 사용자 scaffold 요청 키를 `custom-scaffold` 식별자에서 실제 저장된 SMILES로 변경했습니다.
- 사용자 scaffold의 SMILES 또는 molblock이 누락된 경우 불완전한 custom scaffold payload를 보내지 않아 SMILES 파싱 오류를 방지합니다.
- Cluster API 에러는 toolbar 인라인 문구 대신 Ant Design error notification으로 표시합니다.
- 알림은 우측 상단에 `RDKit API 호출 실패` 제목과 서버 오류 상세를 표시하며, 동일 key로 중복 누적을 방지하고 10초 후 자동으로 닫힙니다.
- `rdkit/` 및 `compound_search/` API 구현은 수정하지 않았습니다.

## 확인 사항

- 로컬 API 실응답에서 `Core`, `R1`, `Core_svg`, `R1_svg` 파싱 기준을 검증했습니다.
- 저장소 지침에 따라 프론트엔드 빌드 및 실행은 수행하지 않았습니다.
