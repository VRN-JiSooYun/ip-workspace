import React from 'react';
import { Tooltip } from 'antd';
import { GripVertical, X } from 'lucide-react';
import type { PanelNode } from '../../lib/layoutTree';
import AddPanelMenu from './AddPanelMenu';

export type TabDescriptor = {
  title: string;
  closable: boolean;
};

type Props = {
  panel: PanelNode;
  describeTab: (tabId: string) => TabDescriptor;
  renderTab: (tabId: string) => React.ReactNode;
  allTabs: readonly string[];
  mountedTabs: string[];
  onActivate: (panelId: string, tabId: string) => void;
  onClose: (panelId: string, tabId: string) => void;
  onAdd: (panelId: string, tabId: string) => void;
  /** 탭 하나를 끌기 시작할 때. 실제 드래그 추적은 그리드가 한다. */
  onTabPointerDown: (panelId: string, tabId: string, event: React.PointerEvent) => void;
  /** 패널을 통째로 끌기 시작할 때(좌측 그립). 탭 드래그와 별개의 동작이다. */
  onPanelPointerDown: (panelId: string, event: React.PointerEvent) => void;
  /** 지금 끌고 있는 탭. 반투명하게 표시한다. */
  draggingTab: string | null;
  /** 이 패널을 통째로 끌고 있는 중. */
  draggingPanel: boolean;
  /** 좁은 화면(stacked)에서는 드래그·추가를 잠근다. */
  interactive: boolean;
};

/**
 * 패널 한 칸. 위에 헤더(그립 + 탭 + 추가), 아래에 활성 탭의 내용이 들어간다.
 *
 * 헤더에 드래그 손잡이가 두 개 있고 서로 다른 것을 옮긴다.
 *   좌측 그립  → 패널 전체(탭 전부를 데리고) 이동
 *   탭 자체    → 그 탭 하나만 이동(다른 패널로 옮기거나 떼어내 새 패널로)
 * 본문은 손잡이가 아니다. 본문을 핸들로 두면 목록 스크롤이나 캘린더 클릭이
 * 전부 드래그로 오해받는다.
 *
 * 비활성 탭은 언마운트하지 않고 display:none으로 숨긴다. 목록의 스크롤 위치나
 * PDF 뷰어의 렌더 상태가 탭을 전환할 때마다 날아가지 않게 하려는 것이다.
 */
const PanelFrame: React.FC<Props> = ({
  panel,
  describeTab,
  renderTab,
  allTabs,
  mountedTabs,
  onActivate,
  onClose,
  onAdd,
  onTabPointerDown,
  onPanelPointerDown,
  draggingTab,
  draggingPanel,
  interactive,
}) => (
  <section
    className={`lt-panel${draggingPanel ? ' lt-panel-dragging' : ''}`}
    data-panel-id={panel.id}
  >
    <div className="lt-tabstrip">
      {interactive && (
        <Tooltip title="패널 이동" mouseEnterDelay={0.4}>
          <div
            role="button"
            tabIndex={-1}
            aria-label="패널 이동 손잡이"
            className="lt-panel-grip"
            onPointerDown={(event) => onPanelPointerDown(panel.id, event)}
          >
            <GripVertical size={14} />
          </div>
        </Tooltip>
      )}

      {/* 탭과 '+'가 한 줄에서 함께 흐른다. '+'가 마지막 탭 바로 오른쪽에 붙어야 하므로
          스트립 오른쪽 끝으로 밀지 않고 이 스크롤 컨테이너 안에 둔다.
          그래서 탭이 많아지면 '+'가 넘쳐 보이지 않게 되는데, 스크롤바를 감춰 두었으므로
          세로 휠을 가로 스크롤로 돌려 준다. 이것이 없으면 좁은 패널에서 '+'에 닿을 방법이
          트랙패드 가로 스와이프뿐이다. */}
      <div
        className="lt-tabstrip-tabs"
        role="tablist"
        aria-label="패널 탭"
        onWheel={(event) => {
          const strip = event.currentTarget;
          if (strip.scrollWidth <= strip.clientWidth) return;
          // 가로 휠(트랙패드)은 브라우저에 맡기고 세로 휠만 돌린다.
          if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
          event.preventDefault();
          strip.scrollLeft += event.deltaY;
        }}
      >
        {panel.tabs.map((tabId, index) => {
          const descriptor = describeTab(tabId);
          const active = tabId === panel.activeTab;
          return (
            <div
              key={tabId}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              data-tab-id={tabId}
              data-tab-index={index}
              className={[
                'lt-tab',
                active ? 'lt-tab-active' : '',
                draggingTab === tabId ? 'lt-tab-dragging' : '',
                interactive ? 'lt-tab-draggable' : '',
              ].filter(Boolean).join(' ')}
              onPointerDown={(event) => {
                onActivate(panel.id, tabId);
                if (interactive) onTabPointerDown(panel.id, tabId, event);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onActivate(panel.id, tabId);
                }
              }}
            >
              <span className="lt-tab-title">{descriptor.title}</span>
              {descriptor.closable && (
                <button
                  type="button"
                  className="lt-tab-close"
                  aria-label={`${descriptor.title} 닫기`}
                  // 탭 드래그가 시작되지 않게 포인터 이벤트를 여기서 끊는다.
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose(panel.id, tabId);
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}

        <AddPanelMenu
          allTabs={allTabs}
          mountedTabs={mountedTabs}
          titleOf={(tabId) => describeTab(tabId).title}
          onPick={(tabId) => onAdd(panel.id, tabId)}
          disabled={!interactive}
        />
      </div>
    </div>

    <div className="lt-panel-body">
      {panel.tabs.map((tabId) => (
        <div
          key={tabId}
          role="tabpanel"
          className="lt-panel-pane"
          hidden={tabId !== panel.activeTab}
        >
          {renderTab(tabId)}
        </div>
      ))}
    </div>
  </section>
);

export default PanelFrame;
