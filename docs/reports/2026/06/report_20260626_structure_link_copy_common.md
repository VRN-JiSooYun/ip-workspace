# 2026-06-26 Structure Link Copy Commonization

## 변경 내용
- `CompoundStructureView`에 `linkedImageCopy` prop을 추가했다.
- `linkedImageCopy`가 전달되고 렌더링 가능한 SVG가 있으면 공통 액션으로 `PPT 링크 복사` 버튼을 표시한다.
- 기존 특허 분석 리스트의 Key Scaffold 컬럼은 직접 `actions`를 만드는 대신 `linkedImageCopy` prop을 사용하도록 변경했다.
- `DataCardItem`과 `CompoundCard`도 `linkedImageCopy`를 전달할 수 있게 확장했다.
- 특허 분석 리스트의 AI Key Compound 컬럼에도 `linkedImageCopy`를 연결했다.
- 특허 분석 상세 페이지의 SVG 구조 렌더링 헬퍼와 SVG 기반 `DataCardItem` 구조 카드에도 `linkedImageCopy`를 연결했다.
- `CompoundStructureView`가 명시적인 `linkedImageCopy`를 받지 않은 경우 현재 페이지 URL과 구조 title을 기본 링크로 사용하도록 했다.
- 따라서 MyBoard, SAR Table, Synthesis Board, Universal Search 등 `CompoundStructureView`를 쓰는 다른 페이지의 SVG 구조에도 PPT 링크 복사 버튼이 표시된다.
- SAR Table은 hover 시 우측 하단 overlay에 크게 보기, 구조 복사, PPT 링크 복사 버튼이 표시되도록 별도 미리보기 모달 연결을 추가했다.
- Reaction Predictor는 아직 PPT 링크 동작을 구현하지 않기로 해서 `showLinkedImageCopyAction={false}`로 숨겼다.

## 확인 결과
- 일반 구조 SVG 렌더링은 대부분 이미 `CompoundStructureView`를 사용하고 있다.
- `DataCardItem` 기반 카드 구조는 내부에서 `CompoundStructureView`를 사용하므로 이번 prop 확장으로 링크 복사 액션을 재사용할 수 있다.
- 남은 비공통 구조 렌더링은 주로 다음 케이스다.
  - `StructurePreviewModal`의 큰 미리보기 SVG host: 모달 전용 확대/복사 UI가 있어 즉시 치환 대상은 아님.
  - `DataCardItem`의 `base64`/`img` 이미지: SVG 구조 원문이 아니라 일반 이미지 렌더링이다.
  - `UniversalSearch`의 특허 reference scaffold 이미지: API 이미지 URL/base64를 `<img>`로 보여주는 영역이다.

## 참고
- 특허 분석 리스트의 PPT 링크는 `/patents/analysis?publicationNumber={patentNumber}&focus={focus}` 계약을 사용한다.
- 특허 분석 상세의 PPT 링크는 현재 특허 상세 URL(`/patents/analysis/{patentNumber}?focus={focus}`)을 사용한다.
- 명시 링크가 없는 구조는 현재 페이지 URL로 링크가 생성된다. 예를 들어 구조 검색 결과의 단일 compound row는 특정 특허 상세 구조가 아니므로 현재 검색 화면 URL을 링크로 사용한다.
