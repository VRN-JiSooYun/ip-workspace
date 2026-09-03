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
 * 윗줄은 날짜(같은 날짜가 이어지면 첫 문서에만 적는다), 아랫줄은 문서를 고르는 **칩**이다.
 * 한때 아랫줄을 카드형 **탭**으로 만들고 점과 날짜를 윗줄 칩으로 묶어 봤지만(2ac2058),
 * 되돌렸다 — 칩 한 줄이 축 위의 점처럼 읽히고, 탭 모양은 아래 뷰어와 붙어 있어야 뜻이
 * 생기는데 사이에 검색어 트레이가 들어와 그 관계가 어차피 끊겼다.
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

  // 고른 문서가 축 밖에 있으면 보이게 끌어온다(문서가 많으면 축이 가로로 넘친다).
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
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

  return (
    <div className="pm-timeline" role="group" aria-label="문서 타임라인">
      <ol className="pm-timeline-track">
        {entries.map(({ item, node }, index) => {
          const active = index === activeIndex;
          const matched = matchedEntryKeys?.has(
            `${item.officeActionId ?? 'none'}::${node.key}`,
          ) ?? false;
          const dateLabel = node.date ? formatDisplayDateTime(node.date) : '날짜 없음';
          const showDate = groupLeaderOf[index] === index;
          const dateActive = index === activeGroupLeader;

          const hint = [
            dateLabel,
            node.label,
            node.dateSource === 'fileName' ? '날짜는 파일명에서 읽음' : null,
            node.date === null ? '날짜를 알 수 없음' : null,
            node.sources.length === 0 ? 'PDF 없음' : null,
          ].filter(Boolean).join(' · ');

          return (
            <li
              key={`${item.officeActionId ?? 'none'}-${node.key}`}
              className="pm-timeline-stop"
            >
              {/* 날짜 줄. 자리는 늘 차지해 칩들이 같은 높이에 놓이게 한다. */}
              <span className={`pm-timeline-date${showDate ? '' : ' pm-timeline-date-repeat'}`}>
                <span className={`pm-timeline-date-text${dateActive ? ' pm-timeline-date-active' : ''}`}>
                  {showDate ? dateLabel : ''}
                </span>
                {showDate && node.dateSource === 'fileName' && (
                  <span
                    className="pm-timeline-date-derived"
                    title="이 날짜는 문서 파일명에서 읽었습니다(DB에 날짜 컬럼이 없습니다)"
                  >
                    ~
                  </span>
                )}
              </span>

              <button
                type="button"
                ref={active ? activeRef : undefined}
                aria-current={active ? 'true' : undefined}
                title={hint}
                className={`pm-timeline-chip${active ? ' pm-timeline-chip-active' : ''}`}
                onClick={() => onSelect({
                  officeActionId: item.officeActionId,
                  nodeKey: node.key,
                })}
              >
                {/**
                 * 시간축의 점. 고르지 않은 문서는 모두 **비운 점**이고 고른 문서만 브랜드 색으로
                 * 채운다. 문서 종류로 채움/테두리를 가르던 때는 통지서 자리만 채운 점이 되어
                 * 고르지 않았는데도 강조돼 보였다 — 종류는 칩 이름이 이미 말해 준다.
                 */}
                <span
                  className={`pm-timeline-dot${active ? ' pm-timeline-dot-selected' : ''}`}
                  aria-hidden="true"
                />
                <span className="pm-timeline-chip-label">{node.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default PatentDocumentTimeline;
