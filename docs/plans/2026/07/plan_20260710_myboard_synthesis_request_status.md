# MyBoard 합성 요청 상태 표시 계획

## 요구사항
- 그룹 상세 목록에 새 컬럼을 추가하지 않는다.
- `물질 번호 (VRN)` 컬럼 안에서 물질 번호, 합성 요청 버튼, 요청 상태를 렌더링한다.
- Add로 추가한 물질처럼 `compoundId`가 없는 행은 합성 요청 대상이다.
- MyBoard에서는 `합성 요청`과 `요청 취소`까지만 실제 동작한다.
- `접수 완료 -> 합성 중 -> VNA코드` 전환은 향후 합성 보드 페이지에서 처리한다.
- 합성 요청 팝업은 `sample/compound_request/sample.png` 디자인을 기준으로 구성한다.
- 첨부 이미지의 빨간색 문구는 설명용이며 실제 UI에는 넣지 않는다.

## 데이터 모델
- `frontend/src/mocks/compounds.ts`의 `Compound`에 요청 상태 필드를 추가한다.
  - `synthesisRequestStatus?: 'requested' | 'accepted' | 'synthesizing' | 'vnaIssued'`
  - `synthesisRequestType?: string`
  - `synthesisStep?: string`
- `compoundId`가 있으면 VNA 코드가 발급된 실제 물질로 간주한다.
- `compoundId`가 없고 `synthesisRequestStatus`가 없으면 요청 전 상태로 간주한다.

## 물질 번호 컬럼 렌더링
- 기존 `물질 번호 (VRN)` 컬럼의 render 함수를 확장한다.
- 렌더링 규칙:
  - `compoundId` 있음: VNA 코드 텍스트를 primary 강조로 표시한다.
  - `compoundId` 없음 + 요청 전: `합성 요청` 버튼을 표시한다.
  - `requested`: `요청 완료` tag와 `취소` 버튼을 표시한다.
  - `accepted`: `접수 완료` tag를 표시한다.
  - `synthesizing`: `합성 중` tag를 표시한다.
  - `vnaIssued`: VNA 코드 상태 tag를 표시하되 실제 코드는 `compoundId` 연동 시 표시한다.
- 셀 안 버튼 클릭은 table row 선택과 충돌하지 않도록 `event.stopPropagation()`을 적용한다.
- 컬럼 폭은 버튼과 tag가 잘리지 않도록 기존 124px에서 필요한 만큼만 조정한다.

## 합성 요청 팝업
- `MyBoard.tsx`에 합성 요청 전용 Modal과 Form state를 추가한다.
- 상단 구성:
  - 제목: `화합물 합성 요청`
  - 좌측: 2D 구조 미리보기
  - 우측 read-only 정보: 타겟, 그룹, 아이디어 번호, 디자인 비고
- 하단 입력:
  - 합성 의뢰 번호: 기존 자동 번호 사용, read-only
  - 필요량(mg): 필수, 기존 `requiredAmountMg` 값이 있으면 채움
  - 합성 목적: 필수, 기존 `assayPurpose` 값이 있으면 채움
  - 단계: 필수
  - 기대 개선 효과: 선택, 기존 `expectedEffect` 값이 있으면 채움
  - 비고: 선택, 기존 `requestMemo` 값이 있으면 채움
  - 합성 요청 구분: 필수
- 요청 버튼은 필수 입력값이 모두 충족될 때 활성화한다.
- 내용 배치는 아이디어 화합물 등록 팝업과 같은 입력 밀도와 label alignment를 따른다.

## 동작 흐름
- `합성 요청` 클릭:
  - 해당 compound를 request target으로 저장한다.
  - 현재 row 값으로 Form initialValues를 구성한다.
  - 합성 요청 Modal을 연다.
- Modal `요청` 클릭:
  - 해당 compound의 요청 관련 필드를 갱신한다.
  - `synthesisRequestStatus`를 `requested`로 설정한다.
  - `requestDate`는 화면 표시 형식인 `YYYY.mm.dd`로 저장한다.
  - Modal을 닫는다.
- `취소` 클릭:
  - `synthesisRequestStatus`를 제거하거나 undefined로 되돌린다.
  - 입력해 둔 합성 요청 필드는 유지해 재요청 시 재사용 가능하게 한다.

## 검증 항목
- 물질 번호가 있는 행은 기존처럼 VNA 코드가 표시된다.
- 물질 번호가 없는 Add 행에는 `합성 요청` 버튼이 표시된다.
- 요청 전 필수값이 부족하면 Modal의 `요청` 버튼이 비활성화된다.
- 요청 완료 후 같은 셀에서 `요청 완료`와 `취소`가 표시된다.
- 취소 후 다시 `합성 요청` 버튼이 표시된다.
- row click/shift selection/context menu와 셀 안 버튼 클릭이 충돌하지 않는다.
