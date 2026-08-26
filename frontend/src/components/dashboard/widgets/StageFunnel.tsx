import React from 'react';
import PatentProgressPipeline, {
  type StageTileRow,
} from '../../patent-management/PatentProgressPipeline';
import {
  UNMAPPED_STAGE_GROUP,
  type PatentStageSummary,
} from '../../../services/patentRecordApi';
import '../dashboard.css';

type Props = {
  summary: PatentStageSummary | null;
  loading: boolean;
  error: string;
  /** 목록으로 넘어갈 조건. 대분류·세부 단계·Status 중 하나다. */
  onPick: (filter: { stageGroup?: string; stageCode?: string; legalStatusId?: number }) => void;
};

/**
 * 진행 현황 퍼널.
 *
 * `PatentProgressPipeline`은 props만 받는 프레젠테이션 컴포넌트라 그대로 재사용한다.
 * 특허 관리의 `StagePipelinePanel`과 다른 점은 선택 상태의 의미다: 저기서는 같은 화면의
 * 목록에 필터를 거는 것이고, 여기서는 **다른 화면으로 넘어가는 링크**다. 그래서
 * activeGroup은 이 위젯 로컬 state이고 특허 관리와 공유하지 않는다(공유하면 대시보드에서
 * 접었다 편 것이 특허 관리 목록 필터를 바꿔 버린다).
 */
const StageFunnel: React.FC<Props> = ({ summary, loading, error, onPick }) => {
  const [activeGroup, setActiveGroup] = React.useState<string | null>(null);

  const toggleGroup = React.useCallback((code: string) => {
    setActiveGroup((current) => (current === code ? null : code));
  }, []);

  const pickRow = React.useCallback((row: StageTileRow) => {
    if (!row.filter) return;
    if ('stageCode' in row.filter) onPick({ stageCode: row.filter.stageCode });
    else onPick({ legalStatusId: row.filter.legalStatusId });
  }, [onPick]);

  return (
    <div className="db-panel-scroll">
      <PatentProgressPipeline
        summary={summary}
        loading={loading}
        error={error}
        activeGroup={activeGroup}
        onToggleGroup={toggleGroup}
        onPickRow={pickRow}
        // 대시보드에서는 "지금 걸린 조건"이 없다. 여기 타일은 필터가 아니라 링크다.
        isRowActive={() => false}
      />
      {/* 미분류는 파이프라인 안에 타일로 그려지지만, 눌러서 목록까지 가는 길을 따로 둔다. */}
      {summary && summary.unmapped.count > 0 ? (
        <button
          type="button"
          className="db-deadline-more"
          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          onClick={() => onPick({ stageGroup: UNMAPPED_STAGE_GROUP })}
        >
          미분류 {summary.unmapped.count}건 목록 보기
        </button>
      ) : null}
    </div>
  );
};

export default StageFunnel;
