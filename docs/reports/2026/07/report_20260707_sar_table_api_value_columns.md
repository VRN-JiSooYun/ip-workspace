# SAR Table API Value Column Mapping

## 요청
- `get_compound_sar_data` API 응답을 SAR Table expand 영역이 아니라 mock 데이터처럼 메인 table 수치 셀로 표시한다.
- SAR Table 헤더를 다음 구조로 변경한다.
  - `VNA Code`
  - `TSA(Tm)`
  - `CYP`: `1A2`, `2C9`, `2C19`, `2D6`, `3A(M)`, `3A(T)`
  - `Cell(GI50uM)`: `EBC1`, `Hs746T`, `SNU16`
  - `MS(remain %)`: `H`, `M`
  - `PPB(bound %)`: `H`, `M`
  - `PK ng/ml (T/P ratio)`: `Pe`, `salt form`, `Dose`, `Plasma[4 h]`, `Brain[4 h]`
- mock 데이터도 변경된 헤더 기준으로 맞춘다.

## 적용 가능성
- 적용 가능하다.
- 기존 구현은 API 응답을 compound code 기준으로 `sarApiRows`에 붙인 뒤 Ant Table expand row에서 원문 key/value 목록으로 렌더링하고 있었다.
- 따라서 expand row를 제거하고, `sarApiRows`의 key를 메인 table column render 함수에서 직접 매핑하면 기존 데이터 흐름을 유지하면서 UI만 변경할 수 있다.

## API Key Mapping
- `VNA Code`: `compound_code`, fallback `compoundId`
- `TSA(Tm)`: `Thermal Shift#_#<project assay>` 중 현재 `project_name`과 매칭되는 첫 값, 없으면 첫 non-empty thermal shift 값
- `CYP 1A2`: `CYP#_#Inhibition#_#CYP1A2`
- `CYP 2C9`: `CYP#_#Inhibition#_#CYP2C9`
- `CYP 2C19`: `CYP#_#Inhibition#_#CYP2C19`
- `CYP 2D6`: `CYP#_#Inhibition#_#CYP2D6`
- `CYP 3A(M)`: `CYP#_#Inhibition#_#CYP3A4`
- `CYP 3A(T)`: `CYP#_#Inhibition#_#CYP3A_T`
- `Cell EBC1`: `Cell#_#EBC-1CEL0034`
- `Cell Hs746T`: `Cell#_#Hs746TCEL0043`
- `Cell SNU16`: `Cell#_#SNU-16CEL0060`
- `MS H/M`: `MS#_#human`, `MS#_#mouse`
- `PPB H/M`: `PPB#_#human`, `PPB#_#mouse`
- `PK salt form`: `PK#_#salt_form`
- `PK Dose`: `PK#_#dose`
- `PK Plasma[4 h]`: `PK#_#plasma_4hr`
- `PK Brain[4 h]`: `PK#_#brain_4hr`
- `PK Pe`: API sample에 직접 key가 없어 `PK#_#pe` 계열 key를 우선 탐색하고, 없으면 `brain_4hr / plasma_4hr` 계산값을 사용한다.

## 구현
- `frontend/src/pages/SarTable.tsx`
  - SAR Table 기본 컬럼/설정 preset을 새 헤더 기준으로 변경했다.
  - API row expand 렌더링을 제거했다.
  - API response key와 mock fallback 값을 공통으로 읽는 helper를 추가했다.
  - 화면 숫자 표시에는 `formatNumberWithComma`를 적용했다.
- `frontend/src/mocks/compounds.ts`
  - `SARData`에 새 헤더 대응 field를 추가했다.
  - `createSarData`가 `tsa_tm`, `cell.ebc1/hs746t/snu16`, `cyp.3a_m/3a_t`, `pk.pe/salt_form` 값을 생성하도록 보강했다.

## 남은 확인 사항
- `PK Pe`의 정확한 API key가 확정되면 현재 계산 fallback 대신 해당 key를 1순위로 고정한다.
- compound당 여러 SAR row가 내려오는 경우 현재는 컬럼별 첫 non-empty 값을 사용한다. row별 PK timepoint 구분이 별도 의미를 갖는다면 backend 또는 store 단계에서 대표값 산정 규칙을 확정해야 한다.
