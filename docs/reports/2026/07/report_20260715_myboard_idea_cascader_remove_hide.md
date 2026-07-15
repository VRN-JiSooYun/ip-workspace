# My Board 아이디어 선택 태그 취소 버튼 제거

## 작업 목적

My Board 아이디어 화합물 등록·수정 팝업의 합성 목적과 합성 확장필요 정도 필드에서 선택된 항목마다 표시되는 `×` 취소 버튼을 숨긴다.

## 변경 내용

- 두 Cascader에 `allowClear={false}`를 적용해 필드 전체 초기화 `×` 버튼을 제거했다.
- Ant Design Cascader의 공식 `removeIcon` API에 `null`을 전달해 선택 태그별 `×` 아이콘을 제거했다.
- 팝업 목록에서 항목을 선택하거나 해제하는 기존 동작은 유지했다.

## 검증 결과

- 두 Cascader의 `allowClear`가 비활성화된 것을 확인했다.
- 두 Cascader의 `removeIcon`이 `null`로 설정된 것을 확인했다.
- 컴포넌트 속성으로 두 필드에만 적용되어 다른 Select 및 Cascader에는 영향을 주지 않는다.

## 미실행 항목

- 프로젝트 지침에 따라 빌드 및 실행은 수행하지 않았다.
