import React from 'react';
// import { Tabs } from 'antd';
import { Typography } from 'antd';
import { formatNumberWithComma } from '../../../../utils/displayFormat';
import PatentListFilters from '../../PatentListFilters';
import { usePatentWorkspace } from '../PatentWorkspaceContext';
import './FiltersPanel.css';

const { Text } = Typography;

/** 지금은 '특허'만 동작한다. '상표'는 자리만 잡아 둔다. */
// type FilterScope = 'PATENT' | 'TRADEMARK';

/**
 * 상세 검색 패널.
 *
 * 이 화면의 모든 조회 조건이 여기 하나로 모인다 — Target·진행 단계도 예전에는 별도
 * 패널이었지만, 조건이 여러 자리에 흩어지면 "지금 몇 개가 걸렸는지"와 "한 번에
 * 초기화"가 갈린다. 카드 껍데기(테두리·배경)는 PatentManagement.css의 .pm-section이 갖는다.
 *
 * 탭(특허/상표)은 걷어냈다. '상표'가 준비 중이라 실제로는 탭이 하나뿐이었고, 한 칸짜리
 * tablist는 줄 하나를 먹으면서 고를 것을 주지 않는다. 상표 관리가 들어오면 아래 주석 처리한
 * Tabs를 되살리면 된다(그때 '총 N건'은 tabBarExtraContent로 돌아간다).
 */
const FiltersPanel: React.FC = () => {
  const {
    lookups,
    listFilters,
    applyListFilters,
    selectedTargets,
    applySelectedTargets,
    activeStageGroup,
    applyStageGroup,
    stageCodeLabel,
    stageSummary,
  } = usePatentWorkspace();
  // const [scope, setScope] = useState<FilterScope>('PATENT');

  return (
    <div className="pm-panel-scroll pm-filters-panel">
      {/* 탭 머리줄이 없어졌으니 총 건수는 필터 위 한 줄로 둔다. */}
      {stageSummary && (
        <div className="pm-filters-panel-head">
          <Text type="secondary" style={{ fontSize: 12 }}>
            총 {formatNumberWithComma(stageSummary.total)}건
          </Text>
        </div>
      )}

      <PatentListFilters
        lookups={lookups}
        values={listFilters}
        onChange={applyListFilters}
        selectedTargets={selectedTargets}
        onTargetsChange={applySelectedTargets}
        stageGroup={activeStageGroup}
        onStageGroupChange={applyStageGroup}
        stageSummary={stageSummary}
        stageCodeLabel={stageCodeLabel}
      />

      {/*
        상표 관리가 들어오면 되살릴 tablist. 지금은 탭이 '특허' 하나뿐이라 숨겼다.

        <Tabs
          className="pm-filter-tabs"
          size="small"
          activeKey={scope}
          onChange={(key) => setScope(key as FilterScope)}
          tabBarExtraContent={
            scope === 'PATENT' && stageSummary ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                총 {formatNumberWithComma(stageSummary.total)}건
              </Text>
            ) : null
          }
          items={[
            {
              key: 'PATENT',
              label: '특허',
              children: (
                <PatentListFilters
                  lookups={lookups}
                  values={listFilters}
                  onChange={applyListFilters}
                  selectedTargets={selectedTargets}
                  onTargetsChange={applySelectedTargets}
                  stageGroup={activeStageGroup}
                  onStageGroupChange={applyStageGroup}
                  stageSummary={stageSummary}
                  stageCodeLabel={stageCodeLabel}
                />
              ),
            },
            {
              key: 'TRADEMARK',
              label: '상표',
              children: (
                <div className="pm-filter-empty">
                  <Text type="secondary">상표 관리 기능은 준비 중입니다.</Text>
                </div>
              ),
            },
          ]}
        />
      */}
    </div>
  );
};

export default FiltersPanel;
