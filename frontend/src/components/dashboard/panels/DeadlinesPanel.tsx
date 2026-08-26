import React from 'react';
import DeadlineBoard from '../widgets/DeadlineBoard';
import { useDashboard } from '../DashboardContext';

/**
 * 기한 패널.
 *
 * 버킷 건수는 목록(items)이 아니라 서버가 센 `counts`를 쓴다. items는 limit으로 잘릴 수
 * 있어서, 잘린 목록의 길이를 건수로 쓰면 KPI 타일과 숫자가 어긋난다.
 */
const DeadlinesPanel: React.FC = () => {
  const {
    deadlines,
    deadlinesLoading,
    deadlinesError,
    focusedBucket,
    getHolidayName,
    openDeadline,
  } = useDashboard();

  return (
    <DeadlineBoard
      items={deadlines?.items ?? []}
      total={deadlines?.total ?? 0}
      counts={deadlines?.counts}
      loading={deadlinesLoading}
      error={deadlinesError || null}
      focusedBucket={focusedBucket}
      getHolidayName={getHolidayName}
      onSelect={openDeadline}
    />
  );
};

export default DeadlinesPanel;
