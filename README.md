# MyWorkspace
- myWorkspace는 합성연구원들이 나만의 아이디어로 화합물을 디자인 하고 관리하기 위한 공간
- groupware의 존재하는 내부 화합물을 myWorkspace로 가져와서 관리 - groupware와 연동 필요
- 우선 프론트엔드만 프로토타입을 만들고 UI/UX를 개선해 나감
- 최종 컨펌 받고 백엔드와 DB등 개발 예정
- 현재는 로그인 되어 있는걸로 가정하고 개발 진행(로그인 기능은 향후 groupware와 연동하여 사용 - groupware에서 로그인 후 myWorkspace로 이동시 자동 로그인 되도록 구현)
- 현재는 myWorkspace 바로 접근 가능 하도록 개발 진행(myWorkspace로 바로 접근 시 groupware main 페이지로 이동)
- 기획자의 UI디자인은 docs/prototype/* 경로 이미지 정리

## UI 기획서
- Dashboard
- ./docs/prototype/dashboard.png
- Dashboard는 logo를 클릭하면 이동
- 각 메뉴들을 List 형태로 보여줌(1주일 단위)
- 상세보기 클릭하거나 list 클릭 시 해당 화면으로 이동
- Compounds > My board
- ./docs/prototype/my_board.png
- 검색 조건은 왼쪽 테이블 '그룹 리스트' 조회 조건
- 그룹 리스트 테이블 row 클릭 시 오른쪽 '상세 내용' 테이블에 정보 표시
- 그룹 리스트 테이블 다중 선택 가능
- my designs, my compounds도 검색 조건(다중 선택 가능, 1개는 선택 되어 있어야 함)
- 그룹 생성 버튼
    - ./docs/prototype/my_board_create_group_button.png
    - 그룹 생성 버튼 클릭시 팝업창 띄워서 그룹 이름 입력
    - type은 'my designs', 'my compounds'로 구성
    - my compounds는 groupware에서 가져온 화합물만 선택 가능 - 추후 groupware와 연동하여 구현 예정
- 디자인 등록
    - ./docs/prototype/my_board_create_deesign_button.png
    - 디자인 등록 버튼 클릭시 팝업창 띄워서 디자인 이름 입력
    - 그룹 리스트 선택된 그룹 자동 선택
    - Name, source, smiles, draw는 필수 입력
    - draw는 chemdraw 라이브러리 사용
    - smiles는 입력 시 draw에 반영
    - draw는 smiles로 변환
    - calculation은 다중 선택 가능한 checkbox(3D TPSA QM,  Solubility QM, Solubility DL, E-Sol QM, Permeability MD, 특허성, 합성기능성)
    - calculation은 api 호출하여 결과값 표시
    - memo
    - attachment
- 상세 내용
    - 그룹 리스트 내용에 따라 상세 내용 테이블에 정보 표시
    - table, draw image list, tree 형태로 보여줌
    - table
    - ./docs/prototype/my_board_table_settings.png
    - 테이블 컬럼 설정 팝업
    - 테이블 feild를 추가 하거나 지울 수 있음
    - 테이블 field 순서 변경 가능
- Compounds > My board > 합성 보드
- ./docs/prototype/my_board_synthesis_board.png
- My Board의 합성 보드 클릭시 화면 이동
- '합성 그룹 리스트'는 My board 그룹 리스트에서 '담당자들'이 컬럼의 추가(담당자 추가하는 관리자 페이지 구현 예정)
- 합성 그룹 리스트 row 클릭 시 '상세 내용' 테이블에 정보 표시
- 상세 내용에는 합성 담당자 할당 버튼 표시
- 합성 담당자 할당 버튼 클릭 시 팝업창 띄워서 담당자 선택
    - 담당자 선택 후 최종 확인 팝업 호출
- 담당자 할당 완료 후 '상세 내용'의 테이블에 담당자 이름 표시
- 담당자 이름 클릭 시 담당자 정보 팝업 호출
    - 팝업창에 담당자 수정, 취소 버튼 표시
    - 수정 버튼 클릭 시 담당자 선택 팝업 호출
    - 취소 버튼 클릭 시 확인 팝업 호출
- 담당자 할당 되면 '합성 그룹 리스트'에 담당자 field 수치 증가
- 합성 그룹리스트의 row overlay했을때 간단한 Table popup 표시
    - ./docs/prototype/my_board_synthesis_board_popup.png
- Compounds > My board > SAR Table
- ./docs/prototype/my_bard_SAR_TABLE.png
- ./docs/prototype/my_bard_SAR_TABLE_C_active.png
- My board의 SAR Table 클릭 시 '상세 내용'의 테이블 데이터를 SAR Table 페이지로 이동
- SAR Table 페이지는 '상세 내용'의 테이블 데이터를 기반으로 생성
- 상단 Smiles 이미지 list 가로 방향으로 출력
- 하단 R-group을 기준으로 테이블 생성
- 테이블의 row 클릭 시 상단 Smiles 이미지 list에서 해당 row의 Smiles 이미지에 border 표시
- C버튼 활성화시 ./docs/prototype/my_bard_SAR_TABLE_C_active.png 처럼 특정 범위 색상 표현
  
### my board 검색조건 추가
검색조건
- Projects(checkbox)
    - FGFR, C797S DM, cMET, VRK1, HER2, WRN, WEE1, ALL
- Share(checkbox)
    - 내 물질, 공유함, 공유받음, ALL
- Design Source(checkbox)
    - 내 머리, 동료 머리, Patent, Paper, FBDD, ELN, ALL
- 기간(single select)
    - 3개월, 6개월, 12개월, 전체, 기간 24.04.20 ~ 25.04.21
- keyword
    - input
- structure
    - ketcher editor(추후에는 chemdraw.js)

### my board 페이지 폴더 리스트
- Table Title : date | type | target | title | 공유 | 개수
- Table Body : 26.04.20 | my designs | FGFR | Leucine focus | 공유함(공유취소 버튼) | 5
### my board 데이터 목록
- Table Ttile : Num | Grp. | Compound | Structure | Name | Source | Mol.Properties1(방사형 그래프) | Mol.Properties2(방사형 그래프) | 필요한 계산
- Table Body : 1 | g1 | VNA11111 | smiles image | chip_250203_comp1 | 내 머리 | [100, 20, 40, 50] | [100, 20, 40, 50] | ["calc1", "calc2"]
### my board 데이터 목록 Settings 버튼
- 테이블 컬럼 설정
- drag and drop으로 테이블 컬럼의 위치 지정 가능
  
    
    
    
  