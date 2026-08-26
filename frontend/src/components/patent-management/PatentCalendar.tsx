import React from 'react';
import { Button, Tooltip } from 'antd';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { formatDisplayDateTime } from '../../utils/displayFormat';
import { WEEKDAYS, type MonthGridCell } from '../../utils/patentCalendar';
import type { PatentScheduleEvent } from '../../services/patentRecordApi';
import '../../styles/calendar.css';

type Props = {
  year: number;
  month: number;
  cells: MonthGridCell[];
  /** 날짜별 일정. key는 `YYYY-MM-DD`. */
  eventsByDate: Map<string, PatentScheduleEvent[]>;
  /** 오늘. 부모가 넘기는 이유는 harness에서 고정할 수 있어야 하기 때문이다. */
  todayKey: string;
  selectedDate: string;
  getHolidayName: (dateKey: string) => string | undefined;
  /** 홑화살표는 ±1, 겹화살표는 ±12를 넘긴다. */
  onMoveMonth: (offset: number) => void;
  onSelectDate: (dateKey: string) => void;
  /** 좌우가 좁은 자리(우측 레일)에서 셀을 줄인다. */
  compact?: boolean;
};

/**
 * 특허 일정 달력.
 *
 * 특허 라이프사이클 날짜(출원·공개·등록·국제출원·국제공개·심사·존속기간만료)와 To-do
 * 마감일을 월 격자에 찍는다. 대시보드의 기한 보드와 역할이 다르다 — 이쪽은 "언제 무슨
 * 일이 있(었)나"를, 기한 보드는 "무엇이 급한가"를 답한다. 그래서 둘 다 있어도 겹치지 않는다.
 *
 * props만 받는 프레젠테이션 컴포넌트다. 조회와 월 상태는 놓이는 자리가 갖는다
 * (`PatentProgressPipeline`과 같은 방식).
 */
const PatentCalendar: React.FC<Props> = ({
  year,
  month,
  cells,
  eventsByDate,
  todayKey,
  selectedDate,
  getHolidayName,
  onMoveMonth,
  onSelectDate,
  compact,
}) => (
  <div className={compact ? 'pm-calendar-compact' : undefined}>
    {/* << < 2026년 8월 > >> — 홑화살표는 월, 겹화살표는 연 단위로 움직인다. */}
    <div className="pm-calendar-nav">
      <Button
        type="text"
        size="small"
        aria-label="이전 해"
        icon={<ChevronsLeft size={14} />}
        onClick={() => onMoveMonth(-12)}
      />
      <Button
        type="text"
        size="small"
        aria-label="이전 달"
        icon={<ChevronLeft size={14} />}
        onClick={() => onMoveMonth(-1)}
      />
      <span className="pm-calendar-nav-label">{`${year}년 ${month}월`}</span>
      <Button
        type="text"
        size="small"
        aria-label="다음 달"
        icon={<ChevronRight size={14} />}
        onClick={() => onMoveMonth(1)}
      />
      <Button
        type="text"
        size="small"
        aria-label="다음 해"
        icon={<ChevronsRight size={14} />}
        onClick={() => onMoveMonth(12)}
      />
    </div>

    <div className="pm-calendar-grid">
      {WEEKDAYS.map((weekday, index) => (
        <div
          key={weekday}
          className={`pm-calendar-weekday${
            index === 0
              ? ' pm-calendar-weekday-sun'
              : index === 6 ? ' pm-calendar-weekday-sat' : ''
          }`}
        >
          {weekday}
        </div>
      ))}
      {cells.map((cell, index) => {
        const classNames = ['pm-calendar-day'];
        const dayEvents = eventsByDate.get(cell.date) ?? [];
        const weekday = index % 7;
        const holidayName = getHolidayName(cell.date);
        // 일요일과 공휴일은 빨간색, 토요일은 하늘색으로 칠한다.
        if (weekday === 0 || holidayName) classNames.push('pm-calendar-day-holiday');
        else if (weekday === 6) classNames.push('pm-calendar-day-saturday');
        if (!cell.inMonth) classNames.push('pm-calendar-day-muted');
        if (dayEvents.length > 0) classNames.push('pm-calendar-day-due');
        if (cell.date === todayKey) classNames.push('pm-calendar-day-today');
        if (cell.date === selectedDate) classNames.push('pm-calendar-day-selected');

        const labelParts = [formatDisplayDateTime(cell.date)];
        if (holidayName) labelParts.push(holidayName);
        if (dayEvents.length > 0) labelParts.push(`일정 ${dayEvents.length}건`);
        const tooltipLines = [
          ...(holidayName ? [holidayName] : []),
          ...dayEvents.map(
            (event) => `${event.label} · ${event.internalRef ?? event.applicationNumber}`,
          ),
        ];

        const day = (
          <button
            type="button"
            key={`${cell.date}-${index}`}
            className={classNames.join(' ')}
            disabled={!cell.inMonth}
            aria-label={labelParts.join(', ')}
            onClick={() => cell.inMonth && onSelectDate(cell.date)}
          >
            <span className="pm-calendar-day-mark">{cell.day}</span>
          </button>
        );

        return tooltipLines.length > 0 ? (
          <Tooltip key={`${cell.date}-${index}`} title={tooltipLines.join('\n')}>
            {day}
          </Tooltip>
        ) : day;
      })}
    </div>
  </div>
);

export default PatentCalendar;
