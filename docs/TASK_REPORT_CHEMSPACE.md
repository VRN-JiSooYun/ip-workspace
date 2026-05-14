# Chemical Space 분석 대시보드 구현 보고서

## 1. 개요
Apache ECharts를 사용하여 고차원 화합물 데이터(Chemical Space)를 시각화하는 새로운 메뉴를 VORA 플랫폼에 추가하였습니다. 사용자가 제공한 `filtered_descriptors.csv` 및 `kinase_ligand_smiles.csv` 데이터를 기반으로 인터랙티브한 2D 산점도를 구현하였습니다.

## 2. 구현 내용

### 2.1 데이터 처리
- **데이터 소스**: `sample/chem_space/` 내의 CSV 파일들.
- **샘플링**: 대규모 데이터를 프론트엔드에서 원활하게 처리하기 위해 주요 지표(MolWt, MolLogP, TPSA, EGFR 여부)를 추출하여 `src/mocks/chemSpaceData.ts`에 500개의 샘플 데이터를 구성하였습니다.
- **주요 지표**: 
  - `MolWt`: 분자량
  - `MolLogP`: 지질 친화성
  - `TPSA`: 토폴로지 표면적
  - `EGFR Presence`: 특정 타겟 존재 여부 (시각화 기준)

### 2.2 프론트엔드 개발
- **신규 페이지**: `src/pages/ChemSpace.tsx` 생성.
- **차트 라이브러리**: `echarts` 및 `echarts-for-react` 도입.
- **기능**:
  - **동적 축 변경**: X축과 Y축의 속성(MW, LogP, TPSA)을 사용자가 선택하여 즉시 반영.
  - **그룹별 색상 지정**: Kinase Group 또는 EGFR 타겟 여부에 따라 데이터 포인트 색상화.
  - **인터랙티브 툴팁**: 마우스 오버 시 화합물 이름, Kinase 정보, SMILES 및 주요 수치 표시.
  - **검색 및 필터링**: SMILES 또는 타겟 이름으로 데이터 필터링.
  - **풀스크린 모드**: 차트를 전체 화면으로 확대하여 상세 분석 가능.

### 2.3 UI/UX 디자인
- **프리미엄 디자인**: Ant Design의 카드 레이아웃과 Lucide 아이콘을 사용하여 현대적이고 세련된 인터페이스 구축.
- **다크 모드 지원**: 플랫폼의 테마 설정에 따라 차트 배경 및 툴팁 스타일 자동 전환.
- **반응형 제어**: 사이드바의 시각적 컨트롤을 통해 분석 자유도 극대화.

## 3. 설치 및 실행 방법
1. **의존성 설치**: 
   ```bash
   docker exec local-myworkspace-frontend bun add echarts echarts-for-react
   ```
2. **실행**: 
   프론트엔드 개발 서버가 실행 중이라면 자동으로 `Compounds > Chem Space` 메뉴가 나타납니다.

## 4. 향후 확장성
- **백엔드 연동**: 현재는 Mock 데이터를 사용 중이나, 향후 NestJS 백엔드 구현 시 전체 CSV 데이터를 API로 로드하여 실시간 계산 및 시각화 가능.
- **3D 시각화**: ECharts의 GL 기능을 사용하여 노트북에서 제안된 3D Chemical Space 시각화로 확장 가능.
