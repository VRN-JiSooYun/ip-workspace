import React, { useMemo, useState } from 'react';
import { Popover, Segmented, Tag, Tooltip, Typography } from 'antd';
import {
  Archive,
  Award,
  ChevronRight,
  CircleDashed,
  ClipboardList,
  FileCheck,
  Gavel,
  GitBranch,
  Reply,
  Send,
} from 'lucide-react';
import {
  UNMAPPED_STAGE_GROUP,
  type PatentStageSummary,
} from '../../services/patentRecordApi';
import { formatNumberWithComma } from '../../utils/displayFormat';
import '../../styles/filter-system.css';
import './PatentProgressPipeline.css';

const { Text } = Typography;

/**
 * 단계 대분류(patent_stage_group.code)별 아이콘. 라벨·순서·건수는 DB가 정본이고
 * 아이콘만 화면이 갖는다. 새 group이 생기면 여기에 없더라도 기본 아이콘으로 그린다.
 */
const STAGE_GROUP_ICONS: Record<string, React.ReactNode> = {
  PREP: <ClipboardList size={18} />,
  FILED: <Send size={18} />,
  EXAM: <Gavel size={18} />,
  RESPONSE: <Reply size={18} />,
  REG: <Award size={18} />,
  CLOSED: <Archive size={18} />,
  ETC: <FileCheck size={18} />,
};

const stageGroupIcon = (code: string): React.ReactNode =>
  STAGE_GROUP_ICONS[code] ?? <CircleDashed size={18} />;

/** popover 한 줄. 눌러서 상세 검색에 조건으로 넣을 수 있으면 filter가 채워진다. */
export type StageTileRow = {
  key: string;
  label: string;
  scope: string | null;
  count: number;
  /** 이 줄이 뜻하는 상세 검색 조건. null이면 걸 수 있는 조건이 없다(예: Status 없음). */
  filter: { stageCode: string } | { legalStatusId: number } | null;
};

export type StageTile = {
  code: string;
  label: string;
  count: number;
  icon: React.ReactNode;
  /** 미분류처럼 목록 위에 설명이 필요한 경우에만 채운다. */
  note?: string;
  rows: StageTileRow[];
};

/**
 * 파이프라인에 그릴 타일. 상세 14단계는 한 줄에 안 들어가므로 대분류만 그리고
 * 상세 단계는 hover popover로 보여 준다. 미분류는 건수가 있을 때만 맨 뒤에 붙인다.
 *
 * 목록 헤더의 단계 필터 태그도 같은 라벨을 써야 해서 부모가 이 함수를 직접 부른다.
 */
export const buildStageTiles = (
  summary: PatentStageSummary | null,
): StageTile[] => {
  if (!summary) return [];

  const tiles: StageTile[] = summary.groups.map((group) => ({
    code: group.code,
    label: group.label,
    count: group.count,
    icon: stageGroupIcon(group.code),
    rows: group.stages
      // 비활성 단계는 건수가 남아 있을 때만 보여 준다(집계에서 빠지면 합계가 어긋난다).
      .filter((stage) => stage.active || stage.count > 0)
      .map((stage) => ({
        key: stage.code,
        label: stage.label,
        scope: stage.scope,
        count: stage.count,
        filter: { stageCode: stage.code },
      })),
  }));

  if (summary.unmapped.count > 0) {
    tiles.push({
      code: UNMAPPED_STAGE_GROUP,
      label: '미분류',
      count: summary.unmapped.count,
      icon: stageGroupIcon(UNMAPPED_STAGE_GROUP),
      note: '진행 단계에 연결되지 않은 현재 Status입니다.',
      rows: summary.unmapped.statuses.map((row) => ({
        key: String(row.legalStatusId ?? 'none'),
        label: row.status ?? '(Status 없음)',
        scope: null,
        count: row.count,
        // Status가 없는 건은 걸 수 있는 코드가 없다. 대분류 '미분류'가 이미 그 집합이다.
        filter: row.legalStatusId !== null ? { legalStatusId: row.legalStatusId } : null,
      })),
    });
  }

  return tiles;
};

/** '전체' 보기의 한 칸. 그룹을 풀어 세부 단계를 그대로 늘어놓는다. */
export type FlatStage = {
  code: string;
  label: string;
  scope: string | null;
  description: string | null;
  count: number;
  /** 어느 대분류에서 왔는지. 툴팁에만 쓴다. */
  groupLabel: string;
};

/**
 * 그룹을 풀어 세부 단계를 순서대로 나열한다. 순서는 그룹 순서 → 그룹 내 단계 순서라
 * '간이' 보기의 파이프라인을 그대로 펼친 모양이 된다.
 *
 * 미분류는 단계 코드가 없어(연결이 안 된 status들이다) 여기에 넣지 않는다.
 * 그건 '간이' 보기의 미분류 타일과 그 popover에서 다룬다.
 */
export const buildFlatStages = (
  summary: PatentStageSummary | null,
): FlatStage[] => {
  if (!summary) return [];
  return summary.groups.flatMap((group) =>
    group.stages
      // 비활성 단계는 건수가 남아 있을 때만 보여 준다('간이' 보기와 같은 규칙).
      .filter((stage) => stage.active || stage.count > 0)
      .map((stage) => ({
        code: stage.code,
        label: stage.label,
        scope: stage.scope,
        description: stage.description,
        count: stage.count,
        groupLabel: group.label,
      })),
  );
};

/**
 * 단계 타일 hover 내용. 줄바꿈 문자열 tooltip은 정렬이 안 맞아 읽기 어려워서
 * 라벨·국가·건수를 grid로 세운다.
 */
const renderStageDetail = (
  tile: StageTile,
  onPickRow: (row: StageTileRow) => void,
  isRowActive: (row: StageTileRow) => boolean,
): React.ReactNode => (
  <div className="pm-stage-detail">
    <div className="pm-stage-detail-head">
      <span className="pm-stage-detail-title">{tile.label}</span>
      <span
        className={`pm-stage-detail-total${tile.count === 0 ? ' pm-stage-detail-total-empty' : ''}`}
      >
        {formatNumberWithComma(tile.count)}건
      </span>
    </div>

    {tile.note && <p className="pm-stage-detail-note">{tile.note}</p>}

    {tile.rows.length > 0 ? (
      <ul className="pm-stage-detail-list">
        {tile.rows.map((row) => {
          const active = isRowActive(row);
          const classNames = ['pm-stage-detail-row'];
          if (row.count === 0) classNames.push('pm-stage-detail-row-empty');
          if (row.filter) classNames.push('pm-stage-detail-row-pickable');
          if (active) classNames.push('pm-stage-detail-row-active');
          const body = (
            <>
              <span className="pm-stage-detail-label">{row.label}</span>
              {row.scope && <span className="pm-stage-detail-scope">{row.scope}</span>}
              <span className="pm-stage-detail-count">{formatNumberWithComma(row.count)}</span>
            </>
          );
          return (
            <li key={row.key} className="pm-stage-detail-item">
              {row.filter ? (
                <button
                  type="button"
                  className={classNames.join(' ')}
                  aria-pressed={active}
                  title={active ? '상세 검색에서 이 조건을 뺍니다' : '상세 검색에 이 조건을 넣습니다'}
                  onClick={() => onPickRow(row)}
                >
                  {body}
                </button>
              ) : (
                <span className={classNames.join(' ')}>{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    ) : (
      <p className="pm-stage-detail-note">세부 단계가 없습니다.</p>
    )}

  </div>
);

type Props = {
  summary: PatentStageSummary | null;
  loading: boolean;
  error: string;
  /** null이면 단계 필터 없이 전체를 본다. */
  activeGroup: string | null;
  onToggleGroup: (code: string) => void;
  /** popover 줄을 눌렀을 때. 이미 걸린 조건이면 해제한다. */
  onPickRow: (row: StageTileRow) => void;
  isRowActive: (row: StageTileRow) => boolean;
};

/** '간이'는 대분류 타일, '전체'는 세부 단계를 모두 펼친 목록. */
type ViewMode = 'SIMPLE' | 'FULL';

/**
 * 진행 단계 파이프라인. '필터' 카드 안에 들어가는 블록이라 카드 껍데기와 제목이 없다.
 * 타일을 누르면 부모의 목록·집계에 단계 필터를 건다.
 *
 * 조회(loadStages)와 activeGroup state는 부모가 갖는다. 같은 필터를 특허 목록도
 * 쓰기 때문에, 여기서 소유하면 두 곳이 어긋난다.
 */
const PatentProgressPipeline: React.FC<Props> = ({
  summary,
  loading,
  error,
  activeGroup,
  onToggleGroup,
  onPickRow,
  isRowActive,
}) => {
  const tiles = useMemo(() => buildStageTiles(summary), [summary]);
  const flatStages = useMemo(() => buildFlatStages(summary), [summary]);
  const [view, setView] = useState<ViewMode>('SIMPLE');

  return (
    <section className="filter-subpanel pm-progress-pipeline">
      <div className="pm-progress-pipeline-head">
        <span className="filter-subpanel-header">
          <span className="filter-subpanel-header-icon">
            <GitBranch size={16} />
          </span>
          <span className="filter-subpanel-title">진행 현황</span>
          {activeGroup !== null && (
            <Tag className="filter-count-tag">단계 필터</Tag>
          )}
        </span>
        <Segmented<ViewMode>
          size="small"
          value={view}
          onChange={setView}
          options={[
            { value: 'SIMPLE', label: '간이' },
            { value: 'FULL', label: '전체' },
          ]}
          aria-label="진행 현황 보기 모드"
        />
      </div>

      {error ? (
        <Text type="danger" className="pm-schedule-status">
          진행 현황을 불러오지 못했습니다: {error}
        </Text>
      ) : !summary ? (
        <Text type="secondary" className="pm-schedule-status">
          {loading ? '진행 현황을 불러오는 중입니다.' : '진행 현황이 없습니다.'}
        </Text>
      ) : view === 'SIMPLE' ? (
        <div className="pm-pipeline">
          {tiles.map((tile, index) => (
            <React.Fragment key={tile.code}>
              {index > 0 && (
                <span className="pm-stage-separator" aria-hidden>
                  <ChevronRight size={18} />
                </span>
              )}
              <Popover
                placement="bottom"
                mouseEnterDelay={0.2}
                classNames={{ body: 'pm-stage-popover-body' }}
                content={renderStageDetail(tile, onPickRow, isRowActive)}
              >
                <button
                  type="button"
                  onClick={() => onToggleGroup(tile.code)}
                  aria-pressed={activeGroup === tile.code}
                  className={`pm-stage${activeGroup === tile.code ? ' pm-stage-active' : ''}`}
                >
                  <span style={{ opacity: 0.85 }}>{tile.icon}</span>
                  <span className="pm-stage-label">{tile.label}</span>
                  <span className="pm-stage-count">{formatNumberWithComma(tile.count)}</span>
                </button>
              </Popover>
            </React.Fragment>
          ))}
        </div>
      ) : flatStages.length === 0 ? (
        <Text type="secondary" className="pm-schedule-status">세부 단계가 없습니다.</Text>
      ) : (
        /* 전체 보기: 세부 단계를 모두 펼친다. 칸이 잘아지므로 아이콘 없이 이름·건수만 쓰고,
           화살표(chevron) 표현은 그대로 둔다. */
        <div className="pm-pipeline pm-pipeline-full">
          {flatStages.map((stage, index) => {
            const row: StageTileRow = {
              key: stage.code,
              label: stage.label,
              scope: stage.scope,
              count: stage.count,
              filter: { stageCode: stage.code },
            };
            const active = isRowActive(row);
            return (
              <React.Fragment key={stage.code}>
                {index > 0 && (
                  <span className="pm-stage-separator" aria-hidden>
                    <ChevronRight size={14} />
                  </span>
                )}
                <Tooltip
                  mouseEnterDelay={0.3}
                  title={
                    <>
                      <div>{`${stage.groupLabel} · ${stage.label}`}</div>
                      {stage.scope && <div>{`적용: ${stage.scope}`}</div>}
                      {stage.description && <div>{stage.description}</div>}
                    </>
                  }
                >
                  <button
                    type="button"
                    onClick={() => onPickRow(row)}
                    aria-pressed={active}
                    className={`pm-stage pm-stage-slim${active ? ' pm-stage-active' : ''}`}
                  >
                    <span className="pm-stage-label">{stage.label}</span>
                    <span className="pm-stage-count">{formatNumberWithComma(stage.count)}</span>
                  </button>
                </Tooltip>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default PatentProgressPipeline;
