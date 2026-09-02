import React, { useEffect, useRef } from 'react';
import { formatDisplayDateTime } from '../../utils/displayFormat';
import { dateGroupLeaders } from './patentDocumentNodes';
import type { PatentDocumentEntry } from './patentDocumentNodes';

export type TimelineSelection = {
  /** 통지 건. null이면 첫 건. */
  officeActionId: number | null;
  /** 그 건 안의 문서 노드 key. */
  nodeKey: string;
};

type Props = {
  /** 날짜 오름차순으로 펼쳐진 문서 전부. */
  entries: PatentDocumentEntry[];
  selection: TimelineSelection;
  onSelect: (next: TimelineSelection) => void;
  /** 선택 검색 결과에서 실제 검색 token이 발견된 문서 key. */
  matchedEntryKeys?: ReadonlySet<string>;
};



/**
 * 문서 뷰어의 가로 타임라인.
 *
 * 예전에는 통지 건 선택기(Segmented)와 문서 선택기(Tabs)가 위아래로 두 줄이었다. 둘은
 * 같은 축 위의 일이라(어느 통지 건의, 그 안 어느 문서인가) 하나의 가로 타임라인으로 합쳤다.
 *
 * 윗줄은 날짜 칩(시간축), 아랫줄은 문서를 고르는 **탭**이다. 아래 뷰어가 그 탭의 내용이라
 * 역할이 곧 탭이고, 그래서 `tablist`/`tab` 의미와 좌우 화살표 이동을 그대로 쓴다.
 *
 * 축의 한 점은 **문서 한 건**이다. 날짜는 통지서는 `admin.action_date`, 의견서·보정서는
 * `document_path` 파일명 끝의 `_YYYYMMDD`에서 읽는다(그쪽은 날짜 컬럼이 없다).
 * 파일명에서 읽은 값은 툴팁에 출처를 밝히고, 날짜를 못 읽은 문서는 축 끝에 모아 둔다 —
 * 없는 날짜를 지어내 시간축에 끼워 넣지 않는다.
 */
const PatentDocumentTimeline: React.FC<Props> = ({
  entries,
  selection,
  onSelect,
  matchedEntryKeys,
}) => {
  const activeRef = useRef<HTMLButtonElement>(null);
  const trackRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const active = activeRef.current;
    if (!active) return;
    // 고른 문서가 축 밖에 있으면 보이게 끌어온다(문서가 많으면 축이 가로로 넘친다).
    active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    /**
     * 키보드로 옮겼다면 포커스도 따라가야 화살표를 이어서 쓸 수 있다.
     *
     * 탭은 roving tabindex라 방금 누른 탭이 선택에서 빠지면 tabIndex=-1이 된다. 포커스를
     * 옮겨 주지 않으면 다음 화살표가 아무 데도 닿지 않는다. 축 밖에 포커스가 있을 때는
     * 건드리지 않는다 — 마우스로 고른 뒤 포커스를 훔쳐 오면 안 된다.
     */
    const track = trackRef.current;
    if (track && track.contains(document.activeElement) && document.activeElement !== active) {
      active.focus();
    }
  }, [selection.officeActionId, selection.nodeKey]);

  if (entries.length === 0) return null;

  const groupLeaderOf = dateGroupLeaders(entries);

  const activeIndex = entries.findIndex(({ item, node }) => (
    item.officeActionId === selection.officeActionId && node.key === selection.nodeKey
  ));
  /**
   * 활성 날짜 라벨은 **그룹 단위**로 정한다.
   *
   * 라벨은 구간의 첫 문서만 그리므로, 두 번째 이후 문서를 골랐을 때 그 문서 자리에
   * 활성 클래스를 붙이면 화면에는 아무 변화가 없다(그 자리 라벨은 숨겨져 있다).
   * 그래서 "고른 문서가 속한 구간의 라벨"을 활성으로 본다.
   */
  const activeGroupLeader = activeIndex >= 0 ? groupLeaderOf[activeIndex] : -1;

  /**
   * 같은 날짜의 문서를 한 묶음으로 모은다.
   *
   * 날짜 칩 하나 아래에 그 날짜의 문서 탭들이 붙는다 — 탭이 어느 날짜에 속하는지 보이려면
   * 마크업에서도 한 덩어리여야 한다. 예전에는 문서마다 칩을 두고 두 번째 이후는 감췄는데,
   * 그러면 뒤따르는 탭들이 빈 자리 밑에 떠 있는 것처럼 보였다.
   */
  const groups = entries.reduce<{ leader: number; items: { index: number }[] }[]>(
    (acc, _entry, index) => {
      const leader = groupLeaderOf[index];
      const last = acc[acc.length - 1];
      if (last && last.leader === leader) last.items.push({ index });
      else acc.push({ leader, items: [{ index }] });
      return acc;
    },
    [],
  );

  const selectAt = (index: number) => {
    const next = entries[index];
    if (!next) return;
    onSelect({ officeActionId: next.item.officeActionId, nodeKey: next.node.key });
  };

  /** 탭 사이 이동. 선택이 곧 표시 내용이라 이동과 동시에 열린다(automatic activation). */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLOListElement>) => {
    if (activeIndex < 0) return;
    const moves: Record<string, () => void> = {
      ArrowLeft: () => selectAt(activeIndex - 1),
      ArrowRight: () => selectAt(activeIndex + 1),
      Home: () => selectAt(0),
      End: () => selectAt(entries.length - 1),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    move();
  };

  return (
    <div className="pm-timeline">
      <ol
        ref={trackRef}
        className="pm-timeline-track"
        role="tablist"
        aria-label="문서 선택"
        aria-orientation="horizontal"
        onKeyDown={handleKeyDown}
      >
        {groups.map((group) => {
          const leader = entries[group.leader];
          const dateLabel = leader.node.date
            ? formatDisplayDateTime(leader.node.date)
            : '날짜 없음';
          const dateActive = group.leader === activeGroupLeader;

          return (
            // tablist의 자식은 tab이어야 한다. 자리만 잡는 요소는 의미에서 빼 둔다.
            <li
              key={`${leader.item.officeActionId ?? 'none'}-${leader.node.key}`}
              className="pm-timeline-stop"
              role="presentation"
            >
              {/* 날짜 칩 = 시간축의 한 점. 아래 탭들이 이 날짜에 속한다. */}
              <span
                className={`pm-timeline-chip${dateActive ? ' pm-timeline-chip-active' : ''}`}
              >
                {/**
                 * 시간축의 점. 모든 날짜가 같은 모양이고 고른 날짜만 브랜드 색이다.
                 *
                 * 예전에는 문서 종류로 채운 점/테두리 점을 갈랐는데, 통지서 자리만 채운 점이
                 * 되어 고르지 않았는데도 강조된 것처럼 보였다. 문서 종류는 탭 이름이 이미
                 * 말해 준다.
                 */}
                <span
                  className={`pm-timeline-dot${dateActive ? ' pm-timeline-dot-selected' : ''}`}
                  aria-hidden="true"
                />
                <span className="pm-timeline-chip-text">{dateLabel}</span>
                {leader.node.dateSource === 'fileName' && (
                  <span
                    className="pm-timeline-chip-derived"
                    title="이 날짜는 문서 파일명에서 읽었습니다(DB에 날짜 컬럼이 없습니다)"
                  >
                    ~
                  </span>
                )}
              </span>

              <div className="pm-timeline-tabs" role="presentation">
                {group.items.map(({ index }) => {
                  const { item, node } = entries[index];
                  const active = index === activeIndex;
                  const matched = matchedEntryKeys?.has(
                    `${item.officeActionId ?? 'none'}::${node.key}`,
                  ) ?? false;

                  const hint = [
                    dateLabel,
                    node.label,
                    node.dateSource === 'fileName' ? '날짜는 파일명에서 읽음' : null,
                    node.date === null ? '날짜를 알 수 없음' : null,
                    node.sources.length === 0 ? 'PDF 없음' : null,
                  ].filter(Boolean).join(' · ');

                  return (
                    <button
                      key={`${item.officeActionId ?? 'none'}-${node.key}`}
                      type="button"
                      ref={active ? activeRef : undefined}
                      role="tab"
                      aria-selected={active}
                      // 탭 묶음에서는 활성 탭 하나만 Tab 키로 들어온다. 그 안에서는 화살표로 옮긴다.
                      tabIndex={active ? 0 : -1}
                      title={hint}
                      // 검색어 일치는 탭 모양을 바꾸지 않고 안쪽 배지로만 알린다
                      // (PatentDocumentViewer.css의 주석 참고).
                      className={`pm-timeline-tab${active ? ' pm-timeline-tab-active' : ''}`}
                      onClick={() => onSelect({
                        officeActionId: item.officeActionId,
                        nodeKey: node.key,
                      })}
                    >
                      <span className="pm-timeline-tab-label">{node.label}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default PatentDocumentTimeline;
