import React from 'react';
import { Button } from 'antd';
import { ExternalLink, X } from 'lucide-react';
import type { PatentScheduleEvent } from '../../../services/patentRecordApi';
import { formatDisplayDateTime } from '../../../utils/displayFormat';
import {
  PATENT_EVENT_TONES,
  patentEventHeadline,
  patentEventRef,
} from '../../../utils/scheduleEntries';

type Props = {
  event: PatentScheduleEvent;
  onOpen: () => void;
  onClose: () => void;
};

/**
 * 특허 일정을 눌렀을 때 뜨는 팝업.
 *
 * 줄 순서(기간 → 시간 → 제목)는 사용자 일정 팝업과 같게 두고, 아래에 어느 특허의 일이었는지를
 * 덧붙인다. 고치기·지우기는 없다 — 서버가 가진 사실이지 이 달력이 만든 값이 아니다.
 * 대신 그 특허를 목록에서 열 수 있게 한다(이 화면에서 할 수 있는 다음 행동이 그것이다).
 */
const PatentSchedulePopover: React.FC<Props> = ({ event, onOpen, onClose }) => (
  <div className="db-cal-pop">
    <span className="db-cal-pop-tag">특허 일정 · 읽기 전용</span>

    <dl className="db-cal-pop-rows">
      <dt>기간</dt>
      <dd>{formatDisplayDateTime(event.date)}</dd>
      <dt>시간</dt>
      <dd>종일</dd>
      <dt>제목</dt>
      <dd className="db-cal-pop-title">
        <span
          className={`db-cal-dot db-cal-tone-${PATENT_EVENT_TONES[event.type]}`}
          aria-hidden="true"
        />
        {patentEventHeadline(event)}
      </dd>
      <dt>특허</dt>
      <dd>{patentEventRef(event)}</dd>
      <dt>출원번호</dt>
      <dd>{event.applicationNumber}</dd>
    </dl>

    {/* To-do는 title이 To-do 제목이라 특허 이름이 없다. 있을 때만 보여 준다. */}
    {event.type !== 'TODO' && event.title ? (
      <p className="db-cal-pop-memo">{event.title}</p>
    ) : null}

    <div className="db-cal-pop-actions">
      <Button size="small" icon={<ExternalLink size={13} />} onClick={onOpen}>
        특허 열기
      </Button>
      <Button size="small" type="text" icon={<X size={13} />} onClick={onClose}>
        닫기
      </Button>
    </div>
  </div>
);

export default PatentSchedulePopover;
