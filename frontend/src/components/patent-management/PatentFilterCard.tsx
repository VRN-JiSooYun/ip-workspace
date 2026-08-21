import React, { useMemo, useState } from 'react';
import { Tabs, Typography } from 'antd';
import type {
  PatentRecordLookups,
  PatentStageSummary,
} from '../../services/patentRecordApi';
import { formatNumberWithComma } from '../../utils/displayFormat';
import PatentListFilters, {
  type PatentListFilterValues,
} from './PatentListFilters';
import PatentProgressPipeline, {
  buildStageTiles,
  type StageTileRow,
} from './PatentProgressPipeline';
import './PatentFilterCard.css';

const { Text } = Typography;

/** 지금은 '특허'만 동작한다. '상표'는 자리만 잡아 둔다. */
type FilterScope = 'PATENT' | 'TRADEMARK';

type Props = {
  lookups: PatentRecordLookups | null;
  filters: PatentListFilterValues;
  onFiltersChange: (next: PatentListFilterValues) => void;
  selectedTargets: string[];
  onResetTargets: () => void;

  summary: PatentStageSummary | null;
  stagesLoading: boolean;
  stagesError: string;
  activeStageGroup: string | null;
  onToggleStageGroup: (code: string) => void;
};

/**
 * 특허 관리 상단의 '필터' 카드.
 *
 * 카드 제목은 일부러 그리지 않는다. 맨 위 '특허 / 상표' 탭이 곧 이 카드의 머리라서
 * 제목까지 두면 줄만 하나 더 먹는다.
 *
 * 안에는 세로로 (1) 상세 검색 필터 (2) 진행 단계 파이프라인이 들어간다. 둘 다 목록의
 * 모집단을 좁히는 수단이라 한 카드에 모았다.
 */
const PatentFilterCard: React.FC<Props> = ({
  lookups,
  filters,
  onFiltersChange,
  selectedTargets,
  onResetTargets,
  summary,
  stagesLoading,
  stagesError,
  activeStageGroup,
  onToggleStageGroup,
}) => {
  const [scope, setScope] = useState<FilterScope>('PATENT');

  /** stageCode는 코드만 들고 다니므로 칩에 쓸 라벨을 여기서 찾아 준다. */
  const stageCodeLabel = useMemo(() => {
    if (!filters.stageCode) return undefined;
    for (const tile of buildStageTiles(summary)) {
      const hit = tile.rows.find(
        (row) => row.filter && 'stageCode' in row.filter && row.filter.stageCode === filters.stageCode,
      );
      if (hit) return hit.label;
    }
    return undefined;
  }, [filters.stageCode, summary]);

  /** popover 줄 = 상세 검색 조건 하나. 같은 값을 다시 누르면 뺀다. */
  const isRowActive = (row: StageTileRow): boolean => {
    if (!row.filter) return false;
    return 'stageCode' in row.filter
      ? filters.stageCode === row.filter.stageCode
      : filters.legalStatusId === row.filter.legalStatusId;
  };

  const pickRow = (row: StageTileRow) => {
    if (!row.filter) return;
    const active = isRowActive(row);
    onFiltersChange(
      'stageCode' in row.filter
        ? { ...filters, stageCode: active ? undefined : row.filter.stageCode }
        : { ...filters, legalStatusId: active ? undefined : row.filter.legalStatusId },
    );
  };

  const patentPane = (
    <div className="pm-filter-body">
      <PatentListFilters
        lookups={lookups}
        values={filters}
        onChange={onFiltersChange}
        selectedTargets={selectedTargets}
        onResetTargets={onResetTargets}
        stageCodeLabel={stageCodeLabel}
      />
      <PatentProgressPipeline
        summary={summary}
        loading={stagesLoading}
        error={stagesError}
        activeGroup={activeStageGroup}
        onToggleGroup={onToggleStageGroup}
        onPickRow={pickRow}
        isRowActive={isRowActive}
      />
    </div>
  );

  return (
    <section className="pm-card pm-toprow-card pm-filter-card">
      <Tabs
        className="pm-filter-tabs"
        size="small"
        activeKey={scope}
        onChange={(key) => setScope(key as FilterScope)}
        tabBarExtraContent={
          scope === 'PATENT' && summary ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              총 {formatNumberWithComma(summary.total)}건
              {activeStageGroup !== null && ' · 단계 필터 적용 중'}
            </Text>
          ) : null
        }
        items={[
          { key: 'PATENT', label: '특허', children: patentPane },
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
    </section>
  );
};

export default PatentFilterCard;
