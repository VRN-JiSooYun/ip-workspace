# 진행 현황 컴포넌트 스냅샷 (추출 전 원본)

- 기준 커밋: `df28aef`
- 원본 파일: `frontend/src/pages/PatentManagement.tsx`, `frontend/src/pages/PatentManagement.css`
- 목적: 별도 컴포넌트(`PatentProgressCard`)로 추출하기 직전의 상태를 그대로 보관한다.
  추출 결과가 마음에 들지 않으면 여기의 조각들을 다시 붙이면 된다.

> 이 파일은 빌드·타입체크 대상이 아니다(`frontend/src` 밖, `.md`).
> 시간이 지나면 원본과 벌어지므로 "추출 시점의 사진"으로만 쓴다.

## 걸쳐 있던 범위

`activeStageGroup`은 진행 현황 전용이 아니다. 특허 목록 조회(`loadPatents`)의 필터이자
'관리 특허 목록' 헤더의 필터 태그이기도 해서, 추출 후에도 부모(`PatentManagement`)에 남는다.

## TSX

### 아이콘 매핑 · StageTile 타입 · 단계 상세 popover

```tsx
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

type StageTile = {
  code: string;
  label: string;
  count: number;
  icon: React.ReactNode;
  /** 미분류처럼 목록 위에 설명이 필요한 경우에만 채운다. */
  note?: string;
  rows: { key: string; label: string; scope: string | null; count: number }[];
};

/**
 * 단계 타일 hover 내용. 줄바꿈 문자열 tooltip은 정렬이 안 맞아 읽기 어려워서
 * 라벨·국가·건수를 grid로 세운다.
 */
const renderStageDetail = (tile: StageTile, isActive: boolean): React.ReactNode => (
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
        {tile.rows.map((row) => (
          <li
            key={row.key}
            className={`pm-stage-detail-row${row.count === 0 ? ' pm-stage-detail-row-empty' : ''}`}
          >
            <span className="pm-stage-detail-label">{row.label}</span>
            {row.scope && <span className="pm-stage-detail-scope">{row.scope}</span>}
            <span className="pm-stage-detail-count">{formatNumberWithComma(row.count)}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="pm-stage-detail-note">세부 단계가 없습니다.</p>
    )}

    {/* <p className="pm-stage-detail-hint">
      {isActive ? '다시 누르면 필터를 해제합니다.' : '누르면 목록을 이 단계로 필터링합니다.'}
    </p> */}
  </div>
);
```

### state

```tsx
  const [activeStageGroup, setActiveStageGroup] = useState<string | null>(null);
  const [stageSummary, setStageSummary] = useState<PatentStageSummary | null>(null);
  const [stagesLoading, setStagesLoading] = useState(false);
  const [stagesError, setStagesError] = useState('');
```

### loadStages (조회)

```tsx
  /**
   * 진행 현황은 목록과 같은 검색·Target 필터를 쓴다. 단계 필터(activeStageGroup)는
   * 넘기지 않는다. 넘기면 선택한 단계만 건수가 남아 파이프라인이 무의미해진다.
   */
  const loadStages = useCallback(async () => {
    setStagesLoading(true);
    setStagesError('');
    try {
      setStageSummary(await patentRecordApi.stages({
        q: search || undefined,
        targets: selectedTargets.length > 0 ? selectedTargets : undefined,
      }));
    } catch (error) {
      setStageSummary(null);
      setStagesError(getErrorMessage(error));
    } finally {
      setStagesLoading(false);
    }
  }, [search, selectedTargets]);

  useEffect(() => {
    void loadStages();
  }, [loadStages]);
```

### toggleStageGroup

```tsx
  /** 같은 단계를 다시 누르면 필터를 해제한다. 목록은 1페이지부터 다시 본다. */
  const toggleStageGroup = (code: string) => {
    setPage(1);
    setActiveStageGroup((current) => (current === code ? null : code));
  };

```

### stageGroupTiles (타일 파생)

```tsx

  /**
   * 파이프라인에 그릴 타일. 상세 14단계는 한 줄에 안 들어가므로 대분류만 그리고
   * 상세 단계는 hover popover로 보여 준다. 미분류는 건수가 있을 때만 맨 뒤에 붙인다.
   */
  const stageGroupTiles = useMemo<StageTile[]>(() => {
    if (!stageSummary) return [];

    const tiles: StageTile[] = stageSummary.groups.map((group) => ({
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
        })),
    }));

    if (stageSummary.unmapped.count > 0) {
      tiles.push({
        code: UNMAPPED_STAGE_GROUP,
        label: '미분류',
        count: stageSummary.unmapped.count,
        icon: stageGroupIcon(UNMAPPED_STAGE_GROUP),
        note: '진행 단계에 연결되지 않은 현재 Status입니다.',
        rows: stageSummary.unmapped.statuses.map((row) => ({
          key: String(row.legalStatusId ?? 'none'),
          label: row.status ?? '(Status 없음)',
          scope: null,
          count: row.count,
        })),
      });
    }

    return tiles;
  }, [stageSummary]);
```

### activeStageLabel (목록 헤더 필터 표시용)

```tsx
  /** 목록 헤더에 붙는 단계 필터 표시. 타일 라벨과 같은 값을 쓴다. */
  const activeStageLabel = useMemo(() => {
    if (activeStageGroup === null) return '';
    return (
      stageGroupTiles.find((tile) => tile.code === activeStageGroup)?.label ??
      activeStageGroup
    );
  }, [activeStageGroup, stageGroupTiles]);
```

### 카드 JSX

```tsx
        <section className="pm-card pm-toprow-card pm-progress-card">
          <div className="pm-card-header">
            <span className="pm-progress-title">진행 현황</span>
            {stageSummary && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                총 {formatNumberWithComma(stageSummary.total)}건
                {activeStageGroup !== null && ' · 단계 필터 적용 중'}
              </Text>
            )}
          </div>

          <div className="pm-progress-tags">
            <div className="pm-progress-tag-list">
              {selectedTargets.map((target) => (
                <Tag key={target} closable onClose={() => toggleTarget(target)} style={{ margin: 0, padding: '4px 10px', borderRadius: 8 }}>
                  {target}
                </Tag>
              ))}
            </div>
          </div>

          {stagesError ? (
            <Text type="danger" className="pm-schedule-status">
              진행 현황을 불러오지 못했습니다: {stagesError}
            </Text>
          ) : !stageSummary ? (
            <Text type="secondary" className="pm-schedule-status">
              {stagesLoading ? '진행 현황을 불러오는 중입니다.' : '진행 현황이 없습니다.'}
            </Text>
          ) : (
            <div className="pm-pipeline">
              {stageGroupTiles.map((tile, index) => (
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
                    content={renderStageDetail(tile, activeStageGroup === tile.code)}
                  >
                    <button
                      type="button"
                      onClick={() => toggleStageGroup(tile.code)}
                      aria-pressed={activeStageGroup === tile.code}
                      className={`pm-stage${activeStageGroup === tile.code ? ' pm-stage-active' : ''}`}
                    >
                      <span style={{ opacity: 0.85 }}>{tile.icon}</span>
                      <span className="pm-stage-label">{tile.label}</span>
                      <span className="pm-stage-count">{formatNumberWithComma(tile.count)}</span>
                    </button>
                  </Popover>
                </React.Fragment>
              ))}
            </div>
          )}
        </section>
```

## CSS

### 단계 상세 popover

```css
/* 줄바꿈 문자열 tooltip은 정렬이 안 맞아 읽기 어렵다. 라벨·국가·건수를 grid로 세우고
   0건은 흐리게 죽여 눈이 실제 건수에 먼저 가게 한다. */
.pm-stage-popover-body {
  padding: 10px 12px;
  max-width: 300px;
}

.pm-stage-detail-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.pm-stage-detail-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.pm-stage-detail-total {
  font-size: 12px;
  font-weight: 700;
  color: var(--brand-primary);
  font-variant-numeric: tabular-nums;
}

/* 0건이면 브랜드색으로 강조할 이유가 없다. */
.pm-stage-detail-total-empty {
  color: var(--text-secondary);
  font-weight: 600;
}

.pm-stage-detail-note {
  margin: 8px 0 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.pm-stage-detail-list {
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

.pm-stage-detail-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  font-size: 12px;
  color: var(--text-primary);
}

.pm-stage-detail-row-empty {
  opacity: 0.45;
}

.pm-stage-detail-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 이 단계가 어느 청에만 있는지(EP, KR,JP ...). */
.pm-stage-detail-scope {
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--table-row-hover-bg);
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.pm-stage-detail-count {
  min-width: 28px;
  text-align: right;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.pm-stage-detail-hint {
  margin: 8px 0 0;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
  font-size: 11px;
  color: var(--text-secondary);
```

### 진행 현황 카드 · 상단행 보정

```css


.pm-progress-title {
  font-size: 19px;
  font-weight: 700;
  color: var(--text-primary);
  flex-shrink: 0;
}

/* 선택한 Target 태그가 늘어나도 카드 높이는 유지하고 이 영역만 스크롤한다. */
.pm-progress-tags {
  flex: 0 1 auto;
  min-height: 0;
  max-height: 40%;
  overflow-y: auto;
  margin-bottom: 14px;
}

.pm-progress-tag-list {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 8px;
}

/* 좁아진 폭에 맞춰 파이프라인 단계를 조금 촘촘하게 그린다.
   태그가 적을 때 파이프라인이 카드 가운데에 오도록 위아래 여백을 자동으로 둔다. */
.pm-toprow .pm-pipeline {
  flex: 0 0 auto;
  margin-block: auto;
}

.pm-toprow .pm-stage {
  min-width: 76px;
  padding: 10px 4px;
}

.pm-toprow .pm-stage-count {
  font-size: 17px;
}

.pm-toprow .pm-stage-separator > svg {
  width: 12px;
  height: 12px;
```

### 반응형 (@1440 / @1280)

```css
  .pm-toprow {
    grid-template-columns: minmax(0, 1fr) minmax(240px, 1fr);
  }

  /* 진행 현황이 첫 줄을 모두 쓰고, 일정·To-do가 그 아래 두 칸으로 간다. */
  .pm-progress-card {
    grid-column: 1 / -1;
    height: auto;
  }
}

/* 좁은 화면에서는 세로로 쌓고 너비 조절 UI를 숨긴다. */
@media (max-width: 1280px) {
  .pm-toprow {
    grid-template-columns: minmax(0, 1fr);
  }

  .pm-toprow-card {
    height: auto;
    max-height: var(--pm-toprow-height);
  }

  .pm-progress-card {
    max-height: none;
  }

  .pm-layout {
    flex-direction: column;
    gap: 8px;
```

### 파이프라인 본체

```css
/* ---- stage pipeline ----------------------------------------------------- */

.pm-pipeline {
  display: flex;
  align-items: stretch;
  gap: 2px;
  overflow-x: auto;
  padding: 4px;
}

.pm-stage {
  position: relative;
  flex: 1 1 0;
  min-width: 104px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 12px 18px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-family: inherit;
}

/* Only the active step is drawn as a filled chevron; the rest stay flat with a
   thin separator between them, matching the design. */
.pm-stage-active {
  background: var(--brand-primary);
  color: #fff;
  clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%);
}

.pm-stage:first-child.pm-stage-active {
  clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%);
}

.pm-stage:last-child.pm-stage-active {
  clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 14px 50%);
}

.pm-stage-separator {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  color: var(--border-color);
}

.pm-stage:not(.pm-stage-active):hover {
  background: rgba(var(--brand-primary-rgb), 0.1);
}

.pm-stage-label {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.pm-stage-count {
  font-size: 19px;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
```
