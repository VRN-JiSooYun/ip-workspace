import React from 'react';
import type { DashboardPanelTypeId } from '../../../config/dashboardLayout';
import DataQualityPanel from './DataQualityPanel';
import DeadlinesPanel from './DeadlinesPanel';
import KpiPanel from './KpiPanel';
import SchedulePanel from './SchedulePanel';
import StageFunnelPanel from './StageFunnelPanel';

/**
 * 위젯 타입 → 컴포넌트. MovableGrid는 이 표만 알면 되고, 배치 트리는 문자열 id만
 * 들고 다닌다(그래서 저장·복원이 JSON 한 덩이로 끝난다).
 */
export const DASHBOARD_PANEL_COMPONENTS: Record<DashboardPanelTypeId, React.ComponentType> = {
  kpi: KpiPanel,
  schedule: SchedulePanel,
  deadlines: DeadlinesPanel,
  stageFunnel: StageFunnelPanel,
  dataQuality: DataQualityPanel,
};
