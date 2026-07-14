# MyBoard 그룹 상세 Toolbar 구분 간격 변경

## 작업 내용

- 그룹 상세 목록 Toolbar 우측의 `Scale`, 테이블 컬럼 설정, 보기 탭 영역 사이 간격을 축소했다.
- Ant Design `Space` 기본 간격과 `Divider` 자체 margin이 중첩되던 구조를 전용 inline flex 컨테이너로 변경했다.
- 영역 사이 간격은 `10px`로 적용했다.
- 구분자는 Ant Design vertical Divider를 사용한다.
- Divider 자체 margin을 `0`으로 제거해 전용 flex의 `10px` 간격만 적용되도록 했다.
- Divider는 `18px` 높이와 `colorBorder` 색상을 사용해 라이트/다크 테마에서 잘 보이도록 했다.
- 테이블 컬럼 설정을 여는 Settings 아이콘과 각 영역의 기존 동작은 유지했다.

## 실행 여부

- 프로젝트 지침에 따라 빌드 및 실행은 수행하지 않았다.
