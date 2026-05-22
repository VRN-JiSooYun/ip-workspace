# Table Header Scroll UX Report

## 요청
- 모든 페이지의 테이블에서 데이터 영역에 Y축 스크롤이 생길 때, 헤더 텍스트가 스크롤 영역 위까지 침범해 보이지 않도록 UX를 수정.
- 참고 이미지: `sample/ui/table_header.png`

## 구현 내용
- `frontend/src/index.css`의 Ant Design Table 공통 스타일을 보정.
- 테이블 body에 `scrollbar-gutter: stable`을 적용해 Y축 스크롤 영역을 안정적으로 예약.
- 테이블 header 셀과 header 텍스트 래퍼에 `overflow: hidden`을 적용해 텍스트가 셀 경계를 넘어 스크롤바 영역 위에 노출되지 않도록 처리.
- Y축 스크롤 테이블의 container 오른쪽 끝에 17px 배경 마스크를 추가해 X축 스크롤 이동 후에도 스크롤 트랙 위 영역에는 header 텍스트가 표시되지 않도록 처리.
- 기본 header, 2줄 header, SAR Table multi-level header의 마스크 높이를 분리해 body 영역을 불필요하게 덮지 않도록 보정.
- SAR Table에는 Ant Design Table wrapper에 `sar-table` className을 직접 부여하고, 2줄 header 공통 규칙보다 높은 우선순위로 132px 마스크 높이가 적용되도록 처리.
- Ant Design의 스크롤바 전용 header 셀(`.ant-table-cell-scrollbar`)은 padding/font/line-height를 제거해 빈 스크롤 영역으로 표시되도록 보정.
- My Board 그룹 리스트 테이블은 `Title` 컬럼만 패널 가용 폭에 따라 반응형으로 조정하고, 나머지 컬럼은 `width`와 `minWidth`를 동일하게 지정해 최소 폭을 고정.
- My Board 그룹 리스트의 `그룹 번호` 컬럼은 72px, `공유` 컬럼은 56px로 축소하고 고정 컬럼 합계는 컬럼 폭 설정에서 자동 계산하도록 변경.
- My Board 그룹 리스트에서 `Title` 컬럼은 패널 남은 폭을 흡수하는 반응형 컬럼으로 유지.
- My Board 그룹 리스트에서 `Title` 외 컬럼은 최소 폭 기준으로 `width/minWidth/maxWidth`를 동일하게 적용하고 header/body cell style을 고정 폭으로 지정해 Ant Design의 폭 재분배 영향을 줄임.
- My Board 그룹 리스트 카드의 실제 렌더 폭을 `ResizeObserver`로 측정해 `Title` 폭 계산에 사용하도록 변경. split 비율 추정 오차로 가로 스크롤이 남는 문제를 줄임.
- My Board 그룹 상세 목록은 순번, 그룹, 프로젝트, 물질 번호, 구조, 출처, Mol.Properties, 디자인 번호, 필요량, 날짜, 담당자, 완료 여부 등 짧은 값 중심 컬럼의 폭을 축소.
- 구조 미리보기와 Mol.Properties 차트는 컬럼 폭 축소에 맞춰 내부 렌더 크기도 함께 조정.
- `Mol.Properties1`, `Mol.Properties2` 헤더가 한 줄로 표시되도록 컬럼 폭을 128px로 재조정.
- 모든 Ant Design Table header 셀 사이에 `border-inline-end` 구분선을 추가하고 마지막 셀/스크롤바 전용 셀은 중복 선을 제거.
- 헤더 배경과 기존 border 색상이 가까워 구분선이 흐릿해지는 문제를 줄이기 위해 라이트/다크 테마별 `--table-header-divider` 색상과 inset shadow 구분선을 추가.
- `sample/ui/table_header.png` 기준에 맞춰 헤더 셀 구분선을 `::after` 기반의 1px blue-gray separator로 재구성해 그룹 헤더와 일반 헤더 모두에서 더 명확히 보이도록 조정.
- 2depth/3depth header의 계층 구분을 위해 다음 header row가 있는 상위 row에만 가로 divider를 추가.
- fixed column header의 `position: sticky`가 전역 separator 스타일에 의해 덮이지 않도록 sticky 위치를 복원.
- 3depth header 가로 divider가 더 명확히 보이도록 상위 header row에 inset shadow를 추가.
- 3depth header 구분선 시인성을 높이기 위해 divider 색상을 더 진하게 조정하고, 세로선은 `border-right`와 `::after`, 가로선은 `::before`로 직접 렌더링하도록 보강.
- 선 굵기 불균일 문제를 줄이기 위해 실제 `border-right`는 제거하고 세로선은 `::after` 하나로 통일.
- 3depth header bottom line은 `colspan`이 있는 group header 셀에만 `::before`로 직접 그리도록 변경.
- fixed-left 첫 컬럼이 별도 table의 마지막 셀로 인식되어 separator가 제거되는 문제를 막기 위해 fixed-left header 셀은 마지막 셀이어도 우측 세로선을 유지하도록 예외 처리.
- SAR Table의 fixed-left `Compound` header 경계가 스크롤 table 레이어에 가려지는 문제를 막기 위해 fixed-left header 셀에만 inset boundary shadow를 추가.
- Ant Design fixed-left shadow pseudo-element의 `translateX(100%)`가 separator에 남아 선이 끊겨 보이는 문제를 막기 위해 fixed-left header separator의 transform, width, height, shadow를 명시적으로 재설정.

## 영향 범위
- Ant Design `Table`을 사용하는 전체 프론트엔드 페이지 공통 적용.
- SAR Table의 wrapper class와 My Board 그룹 리스트 컬럼 폭 정의를 함께 조정.
- 데이터, pagination 설정은 변경하지 않음.

## 검증
- 로컬 의존성 및 빌드 도구는 프로젝트 지침상 Docker 컨테이너에서 사용하므로 빌드/실행은 수행하지 않음.
- 변경 범위는 CSS 전역 스타일, SAR Table className, My Board 그룹 리스트 컬럼 폭 정의, 작업 보고서 문서로 제한.
