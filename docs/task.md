# 프론트엔드 프로토타입 구현 - 완료 현황

- [x] Bun 기반 프로젝트 초기화 및 설정
    - [x] Bun 환경 확인 및 `package.json` 생성
    - [x] `bun add react react-dom antd @emotion/react @emotion/styled lucide-react zustand`
    - [x] `bun add -d typescript vite @types/react @types/react-dom`
- [x] 기초 인프라 파일 생성
    - [x] `vite.config.ts` 및 Docker 설정
    - [x] `tsconfig.json` 및 `index.html` 구성
- [x] UI/UX 테마 및 레이아웃 구현
    - [x] `src/styles/theme.ts` 테마 적용
    - [x] `src/components/layout/MainLayout.tsx` 구현 및 아이콘 에러 수정
- [x] 대시보드 기초 구현
    - [x] `src/pages/Dashboard.tsx` 구현 및 임포트 에러 수정

- [x] Phase 2: My Board (Compounds) 구현
    - [x] `src/mocks/compounds.ts` 화합물 및 그룹 Mock 데이터 생성
    - [x] `src/store/useBoardStore.ts` 그룹 선택 및 필터링 상태 관리
    - [x] `src/pages/MyBoard.tsx` 레이아웃 구성 (그룹 리스트 + 상세 테이블)
    - [x] 그룹 생성 및 디자인 등록 팝업(Modal) 구현 (Ketcher 프레임 포함)
    - [x] Ant Design Deprecation 경고 수정
- [x] Phase 3: SAR Table 구현
    - [x] `src/pages/SarTable.tsx` 구현
    - [x] 상단 Smiles 리스트 - 하단 테이블 상호강조 기능
    - [x] Heatmap Coloration (C 버튼) 기능
- [x] Phase 4: 폴리싱 및 추가 기능
    - [x] 합성 보드(Synthesis Board) 페이지 구현
    - [x] 테이블 컬럼 설정(Settings) 팝업 기능

- [x] Phase 5: Wieldy 스타일링 (UI/UX 고도화)
    - [x] `src/index.css` 전역 스타일(그림자, 배경색) 업데이트
    - [x] `main.tsx` 전역 테마(폰트, 컬러) 고도화
    - [x] `MainLayout.tsx` 헤더 및 사이드바 Wieldy 스타일로 재설계
    - [x] 각 페이지 컴포넌트(Dashboard, My Board 등) 위젯 스타일 적용

- [x] Phase 6: CORE UI Pro 스타일 적용 (Design Pivot)
    - [x] `main.tsx` 퍼플 포인트 컬러(`5856D6`) 및 테마 전환
    - [x] `MainLayout.tsx` 퍼플 헤더 + 화이트 사이드바 레이아웃으로 전면 개편
    - [x] 헤더 내 중앙 검색바 및 배지 시스템 구현
    - [x] 대시보드 및 각 페이지 수치 위젯 디자인 개선

- [/] Phase 7: 이미지 기반 대시보드 리뉴얼 (dashboard.png)
    - [ ] 대시보드용 섹션별 Mock 데이터 구성
    - [ ] Compounds, Documents, PDBs, Calculations 4개 메인 섹션 구현
    - [ ] ELN, 서버 모니터링, 식당 메뉴, 연구소 소식 4개 하단 섹션 구현
    - [ ] 'What's New' 버튼 및 상단 날짜 영역 구현
    - [ ] 이미지와 유사한 보더 및 블루톤 배경 스타일링 정교화
- [x] 최종 확인 및 검증
    - [x] 전체 메뉴 네비게이션 연동 확인
    - [x] Ant Design 테마 및 레이아웃 정합성 검토
