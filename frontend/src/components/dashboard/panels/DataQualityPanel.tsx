import React from 'react';
import DataQualityCard from '../widgets/DataQualityCard';
import { useDashboard } from '../DashboardContext';

const DataQualityPanel: React.FC = () => {
  const {
    summary,
    summaryLoading,
    summaryError,
    canManage,
    openQualityList,
    openCodeAdmin,
  } = useDashboard();

  return (
    <DataQualityCard
      counts={summary?.quality}
      loading={summaryLoading}
      error={summaryError || null}
      canManage={canManage}
      onOpenList={openQualityList}
      onOpenCodeAdmin={openCodeAdmin}
    />
  );
};

export default DataQualityPanel;
