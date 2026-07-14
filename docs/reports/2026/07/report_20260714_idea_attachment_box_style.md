# 아이디어 화합물 첨부파일 박스 스타일 조정

## 작업 내용

- 아이디어 화합물 등록 팝업의 첨부파일 박스 최소 높이를 `188px`에서 `112px`로 줄여 기존 대비 약 60% 크기로 조정했다.
- 내부 업로드 클릭 영역과 콘텐츠 높이 및 여백도 축소된 박스에 맞게 함께 조정했다.
- 테두리에 테마의 어두운 primary 색상인 `colorPrimaryActive`를 적용했다.
- 내부 배경은 disabled input과 유사한 음영의 테마 fill 색상인 `colorFillTertiary`를 적용했다.
- hover 및 drag hover 상태에는 `colorFillSecondary`를 적용해 상호작용 상태를 구분했다.
- 색상을 Ant Design theme token으로 지정해 라이트/다크 테마에 대응하도록 유지했다.
- 첨부파일 부모 grid에 남아 있던 두 번째 row의 `190px` 최소 높이를 제거하고 콘텐츠 높이를 사용하도록 변경했다.
- `align-content: start`를 적용해 첨부파일과 Calculations가 포함된 row에서 불필요한 하단 여백이 생기지 않도록 했다.

## 실행 여부

- 프로젝트 지침에 따라 빌드 및 실행은 수행하지 않았다.
