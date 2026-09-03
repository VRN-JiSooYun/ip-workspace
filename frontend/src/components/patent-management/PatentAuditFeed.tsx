import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button, Tooltip, Typography } from 'antd';
import { patentRecordApi, type PatentAuditEntry } from '../../services/patentRecordApi';

const { Text } = Typography;

/** 한 번에 받아 오는 이력 수. */
const PAGE_SIZE = 30;

/**
 * 한 사람이 이어서 고친 것으로 볼 시간. 이 안에서 나온 필드 변경은 한 덩이로 그린다.
 *
 * 요청 단위(requestId)만으로 묶기에는 이 화면의 저장이 너무 잘게 나간다 — 필드마다 따로
 * PATCH가 나가므로 한 번 앉아서 다섯 칸을 고치면 덩이가 다섯 개다. 사람이 기억하는
 * 단위는 "아까 한 번 손봤다"이지 "PATCH 다섯 번"이 아니다.
 */
const BURST_WINDOW_MS = 5 * 60 * 1000;

const EVENT_LABEL: Record<PatentAuditEntry['eventType'], string> = {
  PATENT_CREATED: '특허를 추가했습니다',
  PATENT_FIELD_CHANGED: '',
  PATENT_IMPORTED: 'CSV 임포트로 갱신되었습니다',
  PATENT_DELETED: '특허를 삭제했습니다',
  PATENT_DOCUMENTS_LINKED: 'OA DB에서 문서를 연결했습니다',
};

/** 문서 연결이 무엇을 가져왔는지. 서버가 metadata에 담아 준다. */
const linkedDocumentSummary = (metadata: unknown): string | null => {
  if (!metadata || typeof metadata !== 'object') return null;
  const data = metadata as {
    linkedOfficeActions?: unknown;
    linkedResponses?: unknown;
    linkedPatentDocument?: unknown;
  };
  const parts: string[] = [];
  if (typeof data.linkedOfficeActions === 'number' && data.linkedOfficeActions > 0) {
    parts.push(`통지서 ${data.linkedOfficeActions}건`);
  }
  if (typeof data.linkedResponses === 'number' && data.linkedResponses > 0) {
    parts.push(`제출 서류 ${data.linkedResponses}건`);
  }
  if (data.linkedPatentDocument === true) parts.push('특허 문서');
  return parts.length > 0 ? parts.join(' · ') : null;
};

/** `2026-08-26T04:12:00.000Z` → `2026.08.26 13:12`. 이력은 시각까지 필요하다. */
const formatStamp = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`
    + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** 임포트 요약의 바뀐 필드 이름. 서버가 컬럼 이름만 담아 준다. */
const importedFields = (metadata: unknown): string[] => {
  if (!metadata || typeof metadata !== 'object') return [];
  const value = (metadata as { changedFields?: unknown }).changedFields;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
};

/** 한 덩이. 같은 사람이 이어서 한 일이다. */
type AuditGroup = {
  key: string;
  actorName: string;
  /** 덩이에서 가장 최근 시각. 목록이 최신순이라 첫 행의 시각이다. */
  createdAt: string;
  entries: PatentAuditEntry[];
};

const actorKey = (entry: PatentAuditEntry) => entry.actor?.id ?? 'unknown';

const withinWindow = (newer: string, older: string) => {
  const gap = new Date(newer).getTime() - new Date(older).getTime();
  return Number.isFinite(gap) && gap >= 0 && gap <= BURST_WINDOW_MS;
};

/**
 * 앞 덩이에 이어 붙일 행인가.
 *
 * 두 가지 경우다. (1) requestId가 같다 — 한 번의 저장에서 나온 행들. (2) 같은 사람이
 * 5분 안에 이어서 고친 **필드 변경**이다. 생성·삭제·임포트는 묶지 않는다. 성격이 다른
 * 사건을 한 덩이에 넣으면 "무슨 일이 있었나"가 흐려진다.
 *
 * 창은 바로 앞 행이 아니라 **덩이의 시작**에서 잰다. 앞 행에서 재면 4분 간격으로 이어진
 * 편집이 끝없이 한 덩이가 되어, 몇 시간짜리 작업이 시각 하나로 뭉개진다.
 */
const continuesGroup = (group: AuditGroup, entry: PatentAuditEntry): boolean => {
  const previous = group.entries[group.entries.length - 1];
  if (entry.requestId !== null && previous.requestId === entry.requestId) return true;
  return previous.eventType === 'PATENT_FIELD_CHANGED'
    && entry.eventType === 'PATENT_FIELD_CHANGED'
    && actorKey(previous) === actorKey(entry)
    && withinWindow(group.createdAt, entry.createdAt);
};

/**
 * 한 덩이 안에서 **같은 필드는 한 줄로** 접는다.
 *
 * 목록은 최신순이라 처음 만나는 행이 그 필드의 마지막 값이고, 뒤에 나오는 같은 필드의
 * 행은 더 옛날이다. 그래서 시작값(beforeValue)만 계속 앞으로 당긴다. 결과는 "이 덩이
 * 동안 이 필드가 A에서 Z가 됐다" 한 줄이다 — A→B, B→C, C→Z 세 줄이 아니라.
 *
 * 접고 나서 시작값과 끝값이 같아지면(고쳤다가 되돌린 경우) 아예 내지 않는다.
 */
const collapseGroup = (group: AuditGroup): PatentAuditEntry[] => {
  const byField = new Map<string, PatentAuditEntry>();
  const lines: PatentAuditEntry[] = [];

  for (const entry of group.entries) {
    if (entry.eventType !== 'PATENT_FIELD_CHANGED' || !entry.field) {
      lines.push(entry);
      continue;
    }
    const seen = byField.get(entry.field);
    if (seen) {
      seen.beforeValue = entry.beforeValue;
      continue;
    }
    const merged = { ...entry };
    byField.set(entry.field, merged);
    lines.push(merged);
  }

  return lines.filter((entry) => (
    entry.eventType !== 'PATENT_FIELD_CHANGED' || entry.beforeValue !== entry.afterValue
  ));
};

type CollapsedGroup = AuditGroup & { lines: PatentAuditEntry[] };

const groupEntries = (entries: PatentAuditEntry[]): CollapsedGroup[] => {
  const groups: AuditGroup[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && continuesGroup(last, entry)) {
      last.entries.push(entry);
      continue;
    }
    groups.push({
      key: entry.id,
      actorName: entry.actor?.name ?? '알 수 없는 사용자',
      createdAt: entry.createdAt,
      entries: [entry],
    });
  }

  return groups
    .map((group) => ({ ...group, lines: collapseGroup(group) }))
    // 덩이 전체가 되돌린 변경뿐이면 덩이째 사라진다.
    .filter((group) => group.lines.length > 0);
};

/**
 * 설명은 `A → B`로 그리지 않는다.
 *
 * 서버가 요약(앞 60자)만 남기므로 두 요약이 같은 문단일 수 있고, 서식만 바꾼 저장은
 * 아예 앞뒤가 같은 글이 된다. JIRA도 설명 변경은 "수정했습니다" 한 줄로만 말한다.
 */
const describeNote = (entry: PatentAuditEntry): string => {
  if (entry.beforeValue === null) return '설명을 작성했습니다';
  if (entry.afterValue === null) return '설명을 지웠습니다';
  return '설명을 수정했습니다';
};

type AuditValueProps = {
  value: string;
  tone: 'before' | 'after';
};

/** 요약 배치는 유지하되 실제로 잘린 감사 값은 hover 또는 focus로 전부 보여 준다. */
const AuditValue: React.FC<AuditValueProps> = ({ value, tone }) => {
  const valueRef = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  const measureOverflow = useCallback(() => {
    const element = valueRef.current;
    if (!element) return;
    setTruncated(element.scrollWidth > element.clientWidth + 1);
  }, []);

  useLayoutEffect(() => {
    measureOverflow();
    const element = valueRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(measureOverflow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measureOverflow, value]);

  return (
    <Tooltip
      title={truncated ? value : undefined}
      placement="topLeft"
      overlayClassName="pm-audit-value-tooltip"
    >
      <span
        ref={valueRef}
        className={`pm-audit-value pm-audit-value-${tone}`}
        tabIndex={truncated ? 0 : undefined}
        onMouseEnter={measureOverflow}
      >
        {value}
      </span>
    </Tooltip>
  );
};

type Props = {
  patentId: number;
  /**
   * 이 값이 바뀌면 다시 조회한다. 필드를 저장한 뒤 피드를 최신으로 만드는 데 쓴다
   * (저장이 어떤 로그를 남겼는지는 서버만 알아서, 프런트가 낙관적으로 끼워 넣을 수 없다).
   */
  revision?: number;
};

/**
 * 관리 특허 변경 이력.
 *
 * JIRA 이슈 상세의 `활동`에 해당한다. 감사 로그가 없던 시절에는 이 자리에 넣을 것이
 * 아예 없었다(테이블도 updatedAt도 없었다).
 *
 * 값은 서버가 사람이 읽는 문자열로 굳혀서 준다 — 코드 id를 프런트가 다시 라벨로 옮기면
 * 코드 표가 바뀔 때 과거 이력의 뜻이 흔들린다.
 *
 * **접는 일은 여기서 한다.** 서버는 일어난 일을 하나도 빠뜨리지 않고 적고(감사 로그의
 * 존재 이유가 그것이다), 화면이 사람이 읽을 단위로 묶는다. 반대로 서버가 미리 접어
 * 버리면 "정말 무슨 일이 있었나"를 되짚을 방법이 없어진다.
 */
const PatentAuditFeed: React.FC<Props> = ({ patentId, revision = 0 }) => {
  const [entries, setEntries] = useState<PatentAuditEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (options: { append?: boolean } = {}) => {
    setLoading(true);
    setError('');
    try {
      const result = await patentRecordApi.auditLogs(patentId, {
        limit: PAGE_SIZE,
        ...(options.append && cursor ? { cursor } : {}),
      });
      setEntries((current) => (options.append ? [...current, ...result.items] : result.items));
      setCursor(result.nextCursor);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '이력을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [patentId, cursor]);

  // 특허가 바뀌거나 저장이 일어나면 처음부터 다시 받는다.
  useEffect(() => {
    setEntries([]);
    setCursor(null);
    void patentRecordApi.auditLogs(patentId, { limit: PAGE_SIZE })
      .then((result) => {
        setEntries(result.items);
        setCursor(result.nextCursor);
        setError('');
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : '이력을 불러오지 못했습니다.');
      });
  }, [patentId, revision]);

  const groups = useMemo(() => groupEntries(entries), [entries]);

  if (error) {
    return (
      <Text type="danger" style={{ fontSize: 12 }}>
        {`이력을 불러오지 못했습니다: ${error}`}
      </Text>
    );
  }

  if (groups.length === 0) {
    return (
      <Text type="secondary" style={{ fontSize: 12 }}>
        아직 기록된 변경이 없습니다.
      </Text>
    );
  }

  return (
    <div className="pm-audit-feed">
      {groups.map((group) => (
        <div key={group.key} className="pm-audit-group">
          <div className="pm-audit-head">
            <span className="pm-audit-actor">{group.actorName}</span>
            <span className="pm-audit-stamp">{formatStamp(group.createdAt)}</span>
          </div>

          <ul className="pm-audit-lines">
            {group.lines.map((entry) => {
              if (entry.eventType === 'PATENT_FIELD_CHANGED') {
                // 설명만 값 대신 한 문장으로 말한다.
                if (entry.field === 'note') {
                  return (
                    <li key={entry.id} className="pm-audit-line">
                      <span className="pm-audit-event">{describeNote(entry)}</span>
                      {entry.afterValue && (
                        <AuditValue value={entry.afterValue} tone="after" />
                      )}
                    </li>
                  );
                }
                return (
                  <li key={entry.id} className="pm-audit-line">
                    <span className="pm-audit-field">
                      {entry.fieldLabel ?? entry.field ?? '알 수 없는 필드'}
                    </span>
                    <AuditValue value={entry.beforeValue ?? '없음'} tone="before" />
                    <span className="pm-audit-arrow" aria-hidden="true">→</span>
                    <AuditValue value={entry.afterValue ?? '없음'} tone="after" />
                  </li>
                );
              }

              const fields = entry.eventType === 'PATENT_IMPORTED'
                ? importedFields(entry.metadata)
                : [];
              const linked = entry.eventType === 'PATENT_DOCUMENTS_LINKED'
                ? linkedDocumentSummary(entry.metadata)
                : null;
              return (
                <li key={entry.id} className="pm-audit-line">
                  <span className="pm-audit-event">{EVENT_LABEL[entry.eventType]}</span>
                  {linked && (
                    <AuditValue value={linked} tone="after" />
                  )}
                  {/* 임포트는 값 단위로 남기지 않는다(500건 × 20필드면 로그가 만 단위가
                      된다). 어떤 필드가 대상이었는지만 밝힌다. */}
                  {fields.length > 0 && (
                    <span className="pm-audit-imported-fields">
                      {`대상 필드 ${fields.length}개`}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {cursor && (
        <Button
          size="small"
          type="text"
          loading={loading}
          onClick={() => void load({ append: true })}
        >
          이전 이력 더 보기
        </Button>
      )}
    </div>
  );
};

export default PatentAuditFeed;
