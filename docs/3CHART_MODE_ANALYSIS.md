# ChemSpace 3Chart 모드 도입 분석 보고서

## 1. 개요
현재 `ChemSpace` 분석 페이지는 한 번에 하나의 산점도(Scatter Plot)만 시각화합니다. 사용자는 화합물의 다양한 물성(MW, LogP, TPSA, EI) 간의 상관관계를 다각도에서 동시에 분석하기를 원하며, 이를 위해 '3Chart 모드' 도입 가능성을 검토합니다.

## 2. 기능 정의 (Proposal)
'3Chart 모드'가 활성화되면 메인 차트 영역이 3개의 독립적인 차트로 분할됩니다.

### 제안되는 차트 구성 (Default Preset)
*   **Chart 1**: MolLogP vs TPSA (가장 일반적인 화합물 분포)
*   **Chart 2**: Molecular Weight vs MolLogP (크기와 지질친화성 관계)
*   **Chart 3**: MaxAbsEStateIndex vs Molecular Weight (전자적 특성과 크기 관계)

### 주요 기능
*   **Global Highlight**: 한 차트에서 특정 데이터에 마우스를 올리면 다른 차트에서도 해당 점이 강조됨.
*   **Individual Controls**: 각 차트의 축을 개별적으로 변경할 수 있는 UI 제공.
*   **Sync Zoom/Pan**: 한 차트에서 확대/이동 시 다른 차트들도 동일한 영역으로 동기화 (옵션).

## 3. UI/UX 설계 방안

### 레이아웃 변화
*   **Normal Mode (OFF)**: 사이드바(6) + 메인 차트(18)
*   **3Chart Mode (ON)**: 
    *   **Option A (Vertical Stack)**: 메인 영역을 세로로 3분할 (각 h-1/3).
    *   **Option B (Grid)**: 상단 2개, 하단 1개 배치.
    *   **Option C (Wide)**: 가로로 3개 배치 (와이드 모니터용).

### 컨트롤 UI
*   Visual Controls 사이드바 상단에 "3Chart Mode" Toggle Switch 추가.
*   모드 활성화 시 각 차트 영역에 'Axis Selector'를 간단히 노출.

## 4. 기술적 구현 방안

### 컴포넌트 구조화
현재 `ChemSpace.tsx` 내의 차트 생성 로직을 `ChemSpaceChart`라는 별도 컴포넌트로 분리하여 재사용성을 높여야 합니다.
```typescript
interface ChemSpaceChartProps {
  xAxis: string;
  yAxis: string;
  data: any[];
  colorBy: string;
  isDarkMode: boolean;
}
```

### 상태 관리
*   Zustand 또는 로컬 state를 사용하여 `isThreeChartMode` 관리.
*   3개 차트의 개별 축 정보를 담는 객체 배열 관리.

## 5. 성능 및 제약 사항
*   **성능**: 22,000개 점을 가진 차트 3개를 동시 렌더링해도 ECharts의 `large: true` 최적화 덕분에 일반적인 환경에서 충분히 매끄럽게 동작합니다.
*   **메모리**: Canvas 인스턴스가 3배로 늘어나므로 저사양 기기에서는 메모리 부하가 있을 수 있습니다.

## 6. 결론
3Chart 모드 구현은 **매우 가능성이 높으며 효과적인 기능**입니다. 특히 현재 구현된 `zlevel` 분리와 JSON 기반 데이터 로딩 방식은 다중 차트 환경에서도 안정적인 성능을 보장할 것입니다.

**다음 단계:**
1.  차트 로직의 컴포넌트화 수행.
2.  레이아웃 전환 로직 구현.
3.  3Chart 모드 전용 UI 컨트롤 추가.
