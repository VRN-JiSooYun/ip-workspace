import React from 'react';
import { Button } from 'antd';
import { Pencil, Trash2, X } from 'lucide-react';
import {
  formatEventPeriod,
  formatEventTime,
  type CalendarEvent,
} from '../../../utils/calendarEvents';

type Props = {
  event: CalendarEvent;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
};

/**
 * 일정 하나를 눌렀을 때 뜨는 작은 팝업의 내용.
 *
 * 줄 순서는 '기간 → 시간 → 제목'이다. 달력에서 이미 대략의 날짜를 보고 누른 것이므로,
 * 먼저 확인하고 싶은 값이 "정확히 언제부터 언제까지인가"이기 때문이다.
 *
 * 팀에 공개된 일정은 팀원 모두에게 보이지만 고치고 지우는 것은 만든 사람만 한다. 그래서
 * 남의 일정에는 수정·삭제 버튼을 아예 그리지 않고, 대신 누가 만든 것인지를 보여 준다
 * (`canEdit`은 서버가 준다).
 *
 * 위치 계산과 바깥 클릭 처리는 antd Popover가 한다. 여기서는 내용만 그린다.
 */
const ScheduleEventPopover: React.FC<Props> = ({ event, onEdit, onDelete, onClose }) => (
  <div className="db-cal-pop">
    {event.canEdit ? null : (
      <span className="db-cal-pop-tag">{`${event.owner.name} 님의 일정 · 읽기 전용`}</span>
    )}

    <dl className="db-cal-pop-rows">
      <dt>기간</dt>
      <dd>{formatEventPeriod(event)}</dd>
      <dt>시간</dt>
      <dd>{formatEventTime(event)}</dd>
      <dt>제목</dt>
      <dd className="db-cal-pop-title">
        <span className={`db-cal-dot db-cal-tone-${event.color}`} aria-hidden="true" />
        {event.title}
      </dd>
      <dt>공개</dt>
      <dd>
        {event.visibility === 'TEAM'
          ? `${event.teamName ?? '팀'} 팀 공개`
          : '비공개 (나만 보기)'}
      </dd>
    </dl>

    {event.memo ? <p className="db-cal-pop-memo">{event.memo}</p> : null}

    <div className="db-cal-pop-actions">
      {event.canEdit ? (
        <>
          <Button size="small" icon={<Pencil size={13} />} onClick={onEdit}>수정</Button>
          <Button size="small" danger icon={<Trash2 size={13} />} onClick={onDelete}>삭제</Button>
        </>
      ) : null}
      <Button size="small" type="text" icon={<X size={13} />} onClick={onClose}>닫기</Button>
    </div>
  </div>
);

export default ScheduleEventPopover;
