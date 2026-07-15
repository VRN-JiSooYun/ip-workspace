# RDKit atom label padding 기본값 변경

## 작업 목적

- 프론트엔드에서 RDKit API로 전달하는 `additionalAtomLabelPadding` 기본값을 API 기본값과 동일한 `0.09`로 맞춘다.

## 변경 내용

- `DEFAULT_RDKIT_DRAW_OPTIONS.additionalAtomLabelPadding`을 `0.05`에서 `0.09`로 변경했다.
- `/draw`, `/cluster_v1` 요청에서 global draw option을 사용하는 경우 `0.09`가 기본 payload 값으로 전달된다.
- 사용자가 localStorage에 직접 저장한 draw option은 사용자 설정을 보존하며, 설정 reset 이후에는 변경된 기본값 `0.09`가 적용된다.
- global draw option을 사용하지 않는 SAR Table 요청은 해당 필드를 생략하고 RDKit API의 기존 기본값 `0.09`를 계속 사용한다.

## 검증 결과

- 기본 draw option과 request payload 변환 경로에서 `additionalAtomLabelPadding` 참조를 확인했다.
- 프론트엔드와 RDKit API의 기본값이 모두 `0.09`인지 정적으로 확인했다.
- `git diff --check`로 변경 파일의 공백 오류를 확인했다.

## 미실행 항목

- 프로젝트 지침에 따라 빌드와 실행은 수행하지 않았다.
- 브라우저에서 draw option reset 후 `/draw` 요청 payload가 `0.09`인지 확인해야 한다.
