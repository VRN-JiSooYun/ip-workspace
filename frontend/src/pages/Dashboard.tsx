import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Empty, Select, Tooltip } from 'antd';
import { RefreshCw, RotateCcw } from 'lucide-react';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import { DashboardProvider } from '../components/dashboard/DashboardContext';
import { DASHBOARD_PANEL_COMPONENTS } from '../components/dashboard/panels';
import MovableGrid from '../components/workspace/MovableGrid';
import {
  DASHBOARD_PANEL_META,
  DASHBOARD_PANEL_TYPES,
  DASHBOARD_STACK_BREAKPOINT,
  buildDefaultDashboardLayout,
  isDashboardPanelTypeId,
  readDashboardLayout,
  removeDashboardLayout,
  writeDashboardLayout,
} from '../config/dashboardLayout';
import { useAuthSession } from '../contexts/AuthSessionContext';
import { useDashboardState } from '../hooks/useDashboardState';
import type { LayoutNode } from '../lib/layoutTree';
import { useUIStore } from '../store/useUIStore';
import { formatNumberWithComma } from '../utils/displayFormat';
import '../styles/dday.css';
import '../components/dashboard/dashboard.css';
import './Dashboard.css';

/** 배치를 바꿀 때마다 localStorage에 쓰면 분할선 드래그 한 번에 수십 번 쓴다. */
const LAYOUT_SAVE_DELAY = 300;

/**
 * IP 대시보드.
 *
 * 이 화면이 답하는 질문은 하나다 — **지금 놓치면 안 되는 게 무엇인가.** 통계는 Insight가,
 * 탐색은 특허 관리가 담당하므로 여기서는 마감·진행 현황·데이터 품질만 본다.
 *
 * 배치는 특허 관리와 같은 이진 트리 엔진(lib/layoutTree + components/workspace)을 쓴다.
 * 팀마다 보고 싶은 게 달라서, 어떤 배치가 옳은지를 설계로 정하지 않고 사용자가 옮길 수
 * 있게 두었다. 위젯 정의와 저장 규칙은 config/dashboardLayout에 있다.
 *
 * 권한은 라우트가 아니라 **위젯 단위**로 막는다. `/` 가 여기로 리다이렉트되므로 라우트에
 * 권한을 걸면 권한 없는 사용자가 로그인 직후 튕긴다(routes.tsx 참고).
 */
const Dashboard: React.FC = () => {
  const { setHeaderContent } = useUIStore();
  const session = useAuthSession();
  const userId = session.user.id;
  const state = useDashboardState();

  const [root, setRoot] = useState<LayoutNode>(() => readDashboardLayout(userId));
  const saveTimer = useRef<number | null>(null);

  /** 트리가 비면(마지막 위젯까지 닫으면) 기본 배치로 되돌린다. */
  const applyLayout = useCallback((next: LayoutNode | null) => {
    setRoot(next ?? buildDefaultDashboardLayout());
  }, []);

  const resetLayout = useCallback(() => {
    removeDashboardLayout(userId);
    setRoot(buildDefaultDashboardLayout());
  }, [userId]);

  /** 사용자를 바꿔 로그인하면 그 사용자의 배치를 읽는다. */
  useEffect(() => {
    setRoot(readDashboardLayout(userId));
  }, [userId]);

  useEffect(() => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      writeDashboardLayout(userId, root);
      saveTimer.current = null;
    }, LAYOUT_SAVE_DELAY);

    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [root, userId]);

  const { canRead, targets, selectedTargets, setSelectedTargets, refresh } = state;

  useEffect(() => {
    setHeaderContent(
      <div className="db-header-row">
        <PageHeaderBreadcrumb items={[{ label: 'Dashboard' }]} />
        {canRead ? (
          <>
            {/* Target은 위젯 전체에 같은 조건으로 걸린다. 화면 안에서 숫자가 갈리지 않게. */}
            <Select
              mode="multiple"
              allowClear
              maxTagCount="responsive"
              placeholder="Target 전체"
              aria-label="Target으로 거르기"
              className="db-header-target"
              value={selectedTargets}
              onChange={setSelectedTargets}
              options={targets.map((item) => ({
                value: item.target,
                label: `${item.target} (${formatNumberWithComma(item.count)})`,
              }))}
            />
            <Tooltip title="집계를 다시 불러옵니다">
              <Button
                type="text"
                size="small"
                aria-label="대시보드 새로고침"
                icon={<RefreshCw size={15} />}
                onClick={refresh}
              />
            </Tooltip>
            <Tooltip title="위젯 배치를 기본값으로 되돌립니다">
              <Button
                type="text"
                size="small"
                aria-label="위젯 배치 초기화"
                icon={<RotateCcw size={15} />}
                onClick={resetLayout}
              />
            </Tooltip>
          </>
        ) : null}
      </div>,
    );
    return () => setHeaderContent(null);
  }, [canRead, refresh, resetLayout, selectedTargets, setHeaderContent, setSelectedTargets, targets]);

  const renderTab = useCallback((tabId: string) => {
    if (!isDashboardPanelTypeId(tabId)) return null;
    const Panel = DASHBOARD_PANEL_COMPONENTS[tabId];
    return <Panel />;
  }, []);

  const describeTab = useCallback((tabId: string) => (
    isDashboardPanelTypeId(tabId)
      ? DASHBOARD_PANEL_META[tabId]
      : { title: tabId, closable: true, minWidth: 200, minHeight: 120 }
  ), []);

  // 위젯 전부가 특허 데이터를 본다. 읽을 권한이 없으면 빈 패널을 늘어놓는 대신 그렇다고 말한다.
  if (!canRead) {
    return (
      <div className="db-page db-page-empty">
        <Empty description="접근 가능한 모듈이 없습니다. 워크스페이스 관리자에게 권한을 요청하세요." />
      </div>
    );
  }

  return (
    // 값이 매 렌더 새 객체지만, 위젯들은 어차피 이 상태가 바뀔 때 다시 그려져야 한다.
    <DashboardProvider value={state}>
      <div className="db-page">
        <MovableGrid
          root={root}
          onChange={applyLayout}
          allTabs={DASHBOARD_PANEL_TYPES}
          describeTab={describeTab}
          renderTab={renderTab}
          stackBreakpoint={DASHBOARD_STACK_BREAKPOINT}
        />
      </div>
    </DashboardProvider>
  );
};

export default Dashboard;
