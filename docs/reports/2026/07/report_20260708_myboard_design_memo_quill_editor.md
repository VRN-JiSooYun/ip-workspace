# MyBoard 디자인 비고 Quill Editor 적용

## 작업 범위
- `frontend/src/pages/MyBoard.tsx`의 아이디어 화합물 등록/수정 팝업 디자인 비고 입력을 rich text editor로 교체했다.
- `frontend/src/components/common/PlainMemoEditor.tsx`를 추가했다.

## 구현 내용
- `react-quill` 설치로 함께 제공되는 Quill editor를 DOM ref에 직접 붙이고 toolbar를 비활성화했다.
- `react-quill` React 컴포넌트의 `findDOMNode` StrictMode 경고를 피하기 위해 wrapper 내부에서는 Quill 인스턴스를 직접 생성한다.
- paste 이벤트를 가로채 plain text와 clipboard image file만 허용한다.
- clipboard image는 data URL로 Quill image embed에 삽입한다.
- 디자인 비고 저장값은 Quill HTML로 저장하되, 빈 editor 값은 `-`로 정규화한다.
- MyBoard 그룹 상세 테이블의 디자인 비고 컬럼은 HTML 태그가 보이지 않도록 plain text preview로 표시하고, 저장된 Quill image embed는 썸네일로 함께 표시한다.
- editor 본문만 보이도록 `.idea-design-memo-editor` 스타일을 추가했다.
- SMILES 입력의 즉시 `designForm.setFieldValue` 호출과 modal-open effect 동기화를 제거하고, `designSmiles` state 기준 수동 검증으로 정리했다.
- `designMemo` Form.Item에 `getValueFromEvent`를 명시해 editor에서 문자열 HTML만 Form 값으로 저장되도록 보강했다.
- SMILES 검증 에러 표시를 `designForm.setFields` 호출 대신 `designSmilesError` state 기반 `validateStatus/help` 표시로 변경해 circular reference 경고 원인을 제거했다.
- 디자인 비고 테이블 preview는 Quill HTML의 block 순서를 파싱해 `text -> image -> text -> text`처럼 입력 순서를 유지해 렌더링한다.
- Docker build TypeScript 오류를 수정하기 위해 디자인 비고 preview block union type을 명시했다.
- Ant Design Cascader `value` prop 타입에 맞게 `(string | number)[][]` 상태값을 `string[][]`로 변환해 전달하도록 보강했다.
- 디자인 비고 테이블 preview에서 `<img src="...">`를 추출해 105px 썸네일로 렌더링하도록 보강했다.

## 확인 사항
- `react-quill`은 사용자가 Docker 컨테이너에서 `bun add react-quill`로 설치했다.
- 로컬 빌드 및 실행은 프로젝트 지침에 따라 수행하지 않았다.
