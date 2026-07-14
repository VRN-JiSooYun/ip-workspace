# RDKit highlight 색상 palette 제한

## 작업 내용

- RDKit API 코드를 확인해 지원 키 중 `red`, `orange`, `yellow`, `green`, `blue`, `naby`, `purple` 7개만 프론트엔드에서 사용하도록 했다.
- SAR scaffold 색상 선택 UI를 해당 7개 swatch로 축소하고, swatch 색상을 RDKit API의 RGB 값에 맞췄다.
- 이전 localStorage에 더 이상 지원하지 않는 색상이 남아 있어도 프론트엔드가 유효한 fallback 색상만 API로 전송하도록 보정했다.

## 비고

- API에 기존부터 정의된 남색 키 `naby`를 서버 계약과 프론트엔드 payload에 동일하게 사용한다.
- RDKit API 서브모듈은 수정하지 않았다.
- 프로젝트 지침에 따라 빌드 및 실행은 수행하지 않았다.
