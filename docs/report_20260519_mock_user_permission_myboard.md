# Mock 사용자 권한 및 My Board 컬럼 구성

## 요청 요약

- 백엔드가 없는 현재 상태에서 mock 데이터 기반 사용자 3명을 추가한다.
  - 설계팀: 박창인
  - 합성팀: 문태훈, 윤지수
- Header 영역에서 현재 사용자를 변경할 수 있는 UI를 제공한다.
- 사용자 변경 시 권한이 변경되고, My Board의 그룹 상세 목록 테이블 컬럼이 권한별로 달라지도록 한다.
- `.my board` 화면의 그룹 상세 목록 컬럼을 공통 항목과 권한별 항목으로 재구성한다.

## 구성 가능 여부

현재 프론트엔드는 Mock 데이터, Zustand, React Context 기반이므로 백엔드 없이도 다음 범위는 구성 가능하다.

- mock 사용자 목록 정의
- 전역 현재 사용자 상태 관리
- Header 사용자 전환 UI
- 현재 사용자 권한에 따른 My Board 테이블 컬럼 표시
- 권한별 컬럼 ON/OFF 프리셋의 프론트엔드 상태 관리

다만 실제 운영 권한 제어는 아직 불가능하다. 현재 구현은 UI 표시 권한을 시뮬레이션하는 수준이며, 백엔드 연동 시 사용자 인증, 세션, API 응답 필터링, 서버 권한 검증이 추가되어야 한다.

## 구현 내용

### 사용자 mock 데이터

파일: `frontend/src/mocks/users.ts`

- `UserRole` 타입 추가
  - `design`
  - `synthesis`
- `mockUsers` 추가
  - 박창인: 설계팀, `design`
  - 문태훈: 합성팀, `synthesis`
  - 윤지수: 합성팀, `synthesis`

### 사용자 전역 상태

파일: `frontend/src/store/useUserStore.ts`

- Zustand store 추가
- 보유 상태
  - `users`
  - `currentUserId`
  - `currentUser`
- 액션
  - `setCurrentUserId(userId)`

### Header 사용자 변경 UI

파일: `frontend/src/components/layout/MainLayout.tsx`

- Header 우측에 사용자 선택 `Select` 추가
- 사용자 옵션에 이름과 팀 표시
- 현재 선택 사용자 Avatar 표시
- 사용자 변경 시 `useUserStore`의 현재 사용자와 권한이 변경됨

### My Board 권한별 컬럼

파일: `frontend/src/pages/MyBoard.tsx`

기본으로 표시되는 공통 컬럼:

- 순번
- 그룹
- 프로젝트
- 물질 번호 (VRN)
- 화합물 구조
- 출처
- 디자인 비고
- Mol.Properties1
- Mol.Properties2

설계팀 권한에서 표시되는 컬럼:

- 디자인 번호
- 필요량 (mg)
- 목적 (개선하고자 하는 assay)
- 기대 개선 효과
- 의뢰일자
- 합성 확장 필요 정도
- 의뢰 비고

합성팀 권한에서 표시되는 컬럼:

- 합성 담당자
- 합성 스터디 그룹 수락일자
- 합성 목표일
- 진행사항 비고
- 완료 여부
- 등록일
- 연구노트
- 리포트 자료
- 합성 종료 이유

권한별 컬럼은 사용자 변경 시 자동으로 초기화된다. 컬럼 설정 모달에서는 공통 항목과 권한별 항목을 모두 사용자가 원하는 대로 ON/OFF 할 수 있도록 했다.

### Compound mock 데이터 확장

파일: `frontend/src/mocks/compounds.ts`

기존 compound mock에 설계/합성 권한별 컬럼에서 사용할 필드를 추가했다.

- 설계 관련 필드: `designNo`, `designMemo`, `requiredAmountMg`, `assayPurpose`, `expectedEffect`, `requestDate`, `synthesisExpansionLevel`, `requestMemo`
- 합성 관련 필드: `synthesisOwner`, `synthesisAcceptedDate`, `synthesisTargetDate`, `progressMemo`, `isCompleted`, `registeredDate`, `researchNote`, `reportData`, `synthesisEndReason`

## 향후 백엔드 연동 시 고려사항

- 사용자/권한은 API와 인증 세션에서 받아와야 한다.
- 화면 컬럼 제어뿐 아니라 API 응답 데이터 자체도 권한별로 제한해야 한다.
- 설계팀/합성팀 이외의 관리자 권한이 필요하면 role enum을 확장해야 한다.
- 컬럼 프리셋은 현재 메모리 상태이므로 사용자별 저장이 필요하면 DB 또는 localStorage 저장 정책이 필요하다.
