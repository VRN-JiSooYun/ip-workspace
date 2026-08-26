import React from 'react';
import KpiStrip from '../widgets/KpiStrip';
import { useDashboard } from '../DashboardContext';

/** 요약 패널. 타일 정의와 이동은 useDashboardState가 갖는다. */
const KpiPanel: React.FC = () => {
  const { kpiTiles, summaryLoading, summaryError, navigateTo, focusDeadlineBucket } = useDashboard();

  return (
    <KpiStrip
      tiles={kpiTiles}
      loading={summaryLoading}
      error={summaryError || null}
      onNavigate={navigateTo}
      onFocusBucket={focusDeadlineBucket}
    />
  );
};

export default KpiPanel;
