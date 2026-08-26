import React from 'react';
import StageFunnel from '../widgets/StageFunnel';
import { useDashboard } from '../DashboardContext';

const StageFunnelPanel: React.FC = () => {
  const { stageSummary, stagesLoading, stagesError, openPatentList } = useDashboard();

  return (
    <StageFunnel
      summary={stageSummary}
      loading={stagesLoading}
      error={stagesError}
      onPick={openPatentList}
    />
  );
};

export default StageFunnelPanel;
