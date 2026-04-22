# MyWorkspace 프론트엔드 프로토타입 구현 결과물

`MyWorkspace` 프로젝트의 프론트엔드 프로토타입 개발이 계획대로 완료되었습니다. 모든 화면은 Ant Design 기반의 전문적인 UI와 Bun+Docker 기반의 최신 개발 환경을 갖추고 있습니다.

## 1. 구현 결과 요약

### 🧬 Dashboard
- **카드형 요약**: 주간 요약 내역 및 최근 활동 리스트 제공
- **네비게이션**: 각 항목 클릭 시 상세 페이지로 이동 준비 완료

### 🧪 My Board (Compounds)
- **그룹 관리**: 왼쪽 패널에서 화합물 그룹 선택 및 다중 필터링
- **디자인 등록**: Ketcher 드로잉 에디터(플레이스홀더)를 포함한 상세 등록 모달
- **컬럼 설정**: 테이블 컬럼의 가시성을 조절할 수 있는 Settings 팝업

### ⚗️ Synthesis Board
- **합성 현황**: 합성 그룹별 담당자 현황 및 상세 화합물 리스트
- **담당자 할당**: 미할당 항목에 대한 담당자 선택 및 수정 UI 제공

### 📊 SAR Table
- **상호 강조**: 상단 Smiles 카드 리스트와 하단 데이터 행 간의 실시간 연동 (Row 클릭 시 카드 하이라이트)
- **Heatmap**: 'C' 버튼 활성화 시 데이터 값에 따른 농도 색상 자동 적용

---

## 2. 적용 기술 스택

- **Build**: Bun + Vite (Containerized)
- **UI Framework**: Ant Design 5.x (Modern 테마 적용)
- **State**: Zustand (전역 상태 관리)
- **Icons**: Lucide React
- **Container**: Docker + Docker Compose

---

## 3. 확인 방법

현재 `docker compose up` 명령어로 서버가 구동 중이라면 아래 주소로 접속 가능합니다.
- **URL**: `http://localhost:5174` (기존 5173 포트 충돌로 인해 5174로 자동 조정됨)

---

## 4. 향후 과제

- **Ketcher Standalone 통합**: 실제 드로잉 라이브러리 파일 배치 및 iframe 연결
- **Backend 연동**: 실제 API 호출 및 실시간 데이터 저장 로직 구현
- **Groupware SSO**: 추후 그룹웨어 서비스와의 로그인 연동 처리
