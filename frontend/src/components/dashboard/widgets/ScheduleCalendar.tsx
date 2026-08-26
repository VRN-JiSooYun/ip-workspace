import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App as AntApp, Button, Checkbox, Popover, Segmented, Tooltip, Typography } from 'antd';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import {
  MINUTES_PER_DAY,
  buildMonthWeeks,
  buildWeekDates,
  countSegmentsAtColumn,
  eventIsBar,
  layoutBarSegments,
  layoutTimedBlocks,
  type CalendarBarSegment,
  type CalendarEvent,
  type CalendarEventInput,
} from '../../../utils/calendarEvents';
import {
  monthKeysOfDates,
  toPatentEntry,
  toUserEntry,
  type ScheduleEntry,
} from '../../../utils/scheduleEntries';
import { parseDateKey, shiftDateKey, toLocalDateKey } from '../../../utils/patentCalendar';
import type { PatentScheduleEvent } from '../../../services/patentRecordApi';
import { formatDisplayDateTime } from '../../../utils/displayFormat';
import PatentSchedulePopover from './PatentSchedulePopover';
import ScheduleEventModal, { type ScheduleEventDraft } from './ScheduleEventModal';
import ScheduleEventPopover from './ScheduleEventPopover';
import { useContainerSize } from '../../workspace/useContainerSize';
import '../dashboard.css';

const { Text } = Typography;

export type CalendarView = 'day' | 'week' | 'month';

const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: 'day', label: '일간' },
  { value: 'week', label: '주간' },
  { value: 'month', label: '월간' },
];

/**
 * 요일 머리글. 그룹웨어 캘린더와 같은 영문 약어를 쓴다(참고 화면과 나란히 놓고 보는
 * 사용자가 있어 표기를 맞췄다). 일요일 시작이라 utils/patentCalendar의 WEEKDAYS와 순서는 같다.
 */
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_LABELS_KO = ['일', '월', '화', '수', '목', '금', '토'];

/** 월 격자에서 막대 한 줄의 높이와 날짜 숫자가 차지하는 높이(px). CSS와 같은 값이어야 한다. */
const LANE_HEIGHT = 19;
const DAY_HEAD_HEIGHT = 24;
/** '+N' 칩이 들어갈 자리. 넘치는 줄이 있을 때만 쓰지만 계산은 항상 빼 둔다. */
const OVERFLOW_HEIGHT = 16;

/** 시간 격자 한 시간의 높이(px). CSS의 --db-cal-hour와 같아야 한다. */
const HOUR_HEIGHT = 44;
/** 시간 보기를 열면 이 시각이 먼저 보이게 스크롤한다. */
const SCROLL_TO_HOUR = 8;
/** 빈 시간대를 눌렀을 때 만들 일정의 기본 길이(분)와 스냅 간격(분). */
const SLOT_MINUTES = 30;
const DEFAULT_EVENT_MINUTES = 60;

type Props = {
  events: CalendarEvent[];
  /** 겹쳐 보여 줄 특허 일정. 조회는 패널이 한다(달 단위라 보이는 범위가 필요하다). */
  patentEvents: PatentScheduleEvent[];
  patentLoading?: boolean;
  patentError?: string | null;
  /**
   * 지금 보이는 범위. 내 일정은 이 구간을, 특허 일정은 `patentMonths`에 든 달을 부른다
   * (서버 조회 단위가 하나는 임의 구간, 하나는 달이라 둘 다 준다).
   */
  onRangeChange: (range: { from: string; to: string; patentMonths: string[] }) => void;
  onOpenPatent: (event: PatentScheduleEvent) => void;
  /** 오늘. 부모가 넘기는 이유는 harness에서 고정할 수 있어야 하기 때문이다. */
  todayKey: string;
  getHolidayName: (dateKey: string) => string | undefined;
  /** 내가 속한 팀. 등록 모달의 공개 범위 선택에 쓴다. */
  teams: { id: string; name: string }[];
  eventsLoading?: boolean;
  eventsError?: string | null;
  onCreate: (input: CalendarEventInput) => Promise<void>;
  onUpdate: (id: string, input: CalendarEventInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const minutesToTime = (minutes: number): string => {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.round(minutes)));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

/** 월 단위 이동. 말일에서 넘어갈 때 날짜가 흘러넘치지 않도록 1일로 맞춰 옮긴다. */
const shiftMonth = (dateKey: string, offset: number): string => {
  const date = parseDateKey(dateKey);
  return toLocalDateKey(new Date(date.getFullYear(), date.getMonth() + offset, 1));
};

/**
 * 일정 달력.
 *
 * 대시보드의 기한 보드가 "무엇이 급한가"를 답한다면 이쪽은 "언제 무슨 일이 있는가"를
 * 답한다. 일간·주간·월간 세 보기를 갖고, 일정을 누르면 작은 팝업(기간·시간·제목 + 수정·
 * 삭제·닫기)이, 빈 날짜/시간대를 누르면 등록 모달이 열린다.
 *
 * 데이터는 props로만 받는다. 어디에 저장하는지(지금은 브라우저)는 패널이 정한다
 * — 서버로 옮겨도 이 컴포넌트는 그대로다.
 *
 * 배치 계산(막대의 줄 번호, 겹친 시각 일정의 열)은 utils/calendarEvents의 순수 함수가
 * 하고, 여기서는 그 결과를 좌표로 옮기기만 한다.
 */
const ScheduleCalendar: React.FC<Props> = ({
  events,
  patentEvents,
  patentLoading,
  patentError,
  onRangeChange,
  onOpenPatent,
  teams,
  eventsLoading,
  eventsError,
  todayKey,
  getHolidayName,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const { message, modal } = AntApp.useApp();
  const [view, setView] = useState<CalendarView>('month');
  const [cursor, setCursor] = useState(todayKey);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [draft, setDraft] = useState<ScheduleEventDraft | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  /** 특허 일정 겹쳐 보기. 내 일정만 보고 싶은 날이 있어 끌 수 있게 둔다. */
  const [showPatents, setShowPatents] = useState(true);

  const { ref: weeksRef, size: weeksSize } = useContainerSize<HTMLDivElement>();
  const timeBodyRef = useRef<HTMLDivElement | null>(null);

  const cursorDate = useMemo(() => parseDateKey(cursor), [cursor]);
  const year = cursorDate.getFullYear();
  const month = cursorDate.getMonth() + 1;

  const weeks = useMemo(() => buildMonthWeeks(year, month), [year, month]);
  const viewDates = useMemo(() => (
    view === 'day' ? [cursor] : buildWeekDates(cursor)
  ), [cursor, view]);

  /**
   * 격자에 놓을 것 전부. 내 일정과 특허 일정이 여기서 한 종류가 된다
   * (출처는 entry.source로 남아 팝업과 스타일을 고르는 데 쓰인다).
   */
  const entries = useMemo<ScheduleEntry[]>(() => [
    ...events.map(toUserEntry),
    ...(showPatents ? patentEvents.map(toPatentEntry) : []),
  ], [events, patentEvents, showPatents]);

  /** 지금 보이는 날짜. 월 격자는 앞뒤 달의 며칠을 함께 보여 준다. */
  const visibleDates = useMemo(() => (
    view === 'month' ? weeks.flat().map((cell) => cell.date) : viewDates
  ), [view, viewDates, weeks]);

  useEffect(() => {
    if (visibleDates.length === 0) return;
    onRangeChange({
      from: visibleDates[0],
      to: visibleDates[visibleDates.length - 1],
      // 특허 일정을 끄면 달 목록을 비워, 보지도 않을 것을 부르지 않게 한다.
      patentMonths: showPatents ? monthKeysOfDates(visibleDates) : [],
    });
  }, [onRangeChange, showPatents, visibleDates]);

  /** 한 주에 몇 줄까지 막대를 보일 수 있는가. 패널 높이에 따라 달라진다. */
  const maxLanes = useMemo(() => {
    if (weeks.length === 0 || weeksSize.height === 0) return 2;
    const rowHeight = weeksSize.height / weeks.length;
    return Math.max(1, Math.floor((rowHeight - DAY_HEAD_HEIGHT - OVERFLOW_HEIGHT) / LANE_HEIGHT));
  }, [weeks.length, weeksSize.height]);

  /** 시간 보기로 들어오면 이른 새벽 대신 업무 시간이 먼저 보이게 한다. */
  useEffect(() => {
    if (view === 'month') return;
    const node = timeBodyRef.current;
    if (node) node.scrollTop = SCROLL_TO_HOUR * HOUR_HEIGHT;
  }, [view]);

  // ---- 이동 ---------------------------------------------------------------

  const moveBy = useCallback((direction: -1 | 1) => {
    setOpenEventId(null);
    setCursor((current) => {
      if (view === 'month') return shiftMonth(current, direction);
      return shiftDateKey(current, view === 'week' ? direction * 7 : direction);
    });
  }, [view]);

  const goToday = useCallback(() => {
    setOpenEventId(null);
    setCursor(todayKey);
    setSelectedDate(todayKey);
  }, [todayKey]);

  const changeView = useCallback((next: CalendarView) => {
    setOpenEventId(null);
    setView(next);
  }, []);

  const rangeLabel = useMemo(() => {
    if (view === 'month') return `${year}.${String(month).padStart(2, '0')}`;
    if (view === 'day') {
      return `${formatDisplayDateTime(cursor)} (${WEEKDAY_LABELS_KO[cursorDate.getDay()]})`;
    }
    const first = viewDates[0];
    const last = viewDates[viewDates.length - 1];
    // 끝 날짜는 연도를 반복하지 않는다. 좁은 패널에서 줄이 넘치기 때문이다.
    return `${formatDisplayDateTime(first)} ~ ${formatDisplayDateTime(last).slice(5)}`;
  }, [cursor, cursorDate, month, view, viewDates, year]);

  // ---- 등록·수정·삭제 -----------------------------------------------------

  const openCreate = useCallback((date: string, startTime?: string) => {
    setOpenEventId(null);
    setSelectedDate(date);
    setEditing(null);
    setDraft({
      date,
      startTime: startTime ?? null,
      endTime: startTime
        ? minutesToTime(
          Math.min(
            MINUTES_PER_DAY - 1,
            Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3))
              + DEFAULT_EVENT_MINUTES,
          ),
        )
        : null,
    });
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((event: CalendarEvent) => {
    setOpenEventId(null);
    setEditing(event);
    setDraft(null);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
    setDraft(null);
  }, []);

  const submitModal = useCallback(async (input: CalendarEventInput) => {
    try {
      if (editing) await onUpdate(editing.id, input);
      else await onCreate(input);
      closeModal();
    } catch (error) {
      // 모달은 열어 둔다. 방금 적은 내용을 잃지 않고 다시 시도할 수 있어야 한다.
      void message.error(
        `일정을 저장하지 못했습니다: ${
          error instanceof Error ? error.message : '알 수 없는 오류'
        }`,
      );
    }
  }, [closeModal, editing, message, onCreate, onUpdate]);

  const confirmDelete = useCallback((event: CalendarEvent) => {
    setOpenEventId(null);
    modal.confirm({
      title: '일정을 삭제할까요?',
      content: event.title,
      okText: '삭제',
      okButtonProps: { danger: true },
      cancelText: '취소',
      onOk: async () => {
        try {
          await onDelete(event.id);
        } catch (error) {
          void message.error(
            `일정을 삭제하지 못했습니다: ${
              error instanceof Error ? error.message : '알 수 없는 오류'
            }`,
          );
        }
      },
    });
  }, [message, modal, onDelete]);

  /**
   * 일정 막대·블록을 감싸는 팝업. 세 보기가 같은 팝업을 쓴다.
   *
   * 내 일정은 고치고 지울 수 있는 팝업을, 특허 일정은 읽기 전용 팝업을 연다. 눌렀을 때
   * 무엇을 할 수 있는지가 그 자리에서 갈리므로 팝업을 나눈다.
   */
  const withPopover = useCallback((entry: ScheduleEntry, node: React.ReactElement) => (
    <Popover
      key={entry.id}
      trigger="click"
      placement="bottom"
      open={openEventId === entry.id}
      onOpenChange={(next) => setOpenEventId(next ? entry.id : null)}
      content={entry.source === 'user' ? (
        <ScheduleEventPopover
          event={entry.event}
          onEdit={() => openEdit(entry.event)}
          onDelete={() => confirmDelete(entry.event)}
          onClose={() => setOpenEventId(null)}
        />
      ) : (
        <PatentSchedulePopover
          event={entry.patent}
          onOpen={() => {
            setOpenEventId(null);
            onOpenPatent(entry.patent);
          }}
          onClose={() => setOpenEventId(null)}
        />
      )}
    >
      {node}
    </Popover>
  ), [confirmDelete, onOpenPatent, openEdit, openEventId]);

  const renderBar = useCallback((
    segment: CalendarBarSegment<ScheduleEntry>,
    style: React.CSSProperties,
  ) => {
    const entry = segment.item;
    const timed = !eventIsBar(entry);
    const classNames = [
      'db-cal-bar',
      `db-cal-tone-${entry.color}`,
      // 특허 일정은 테두리만 칠한다. 고칠 수 없는 것과 고칠 수 있는 것을 눈으로 가른다.
      entry.source === 'patent' ? 'db-cal-bar-patent' : '',
      timed ? 'db-cal-bar-timed' : '',
      segment.continuesBefore ? 'db-cal-bar-open-start' : '',
      segment.continuesAfter ? 'db-cal-bar-open-end' : '',
    ].filter(Boolean).join(' ');

    return withPopover(entry, (
      <button
        type="button"
        className={classNames}
        style={style}
        aria-label={`${entry.title} ${entry.source === 'patent' ? '특허 일정' : '일정'} 열기`}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        {timed && entry.startTime ? (
          <span className="db-cal-bar-time">{entry.startTime}</span>
        ) : null}
        <span className="db-cal-bar-title">{entry.title}</span>
      </button>
    ));
  }, [withPopover]);

  // ---- 월간 --------------------------------------------------------------

  const renderMonth = () => (
    <div className="db-cal-month">
      <div className="db-cal-weekhead">
        {WEEKDAY_LABELS.map((label, index) => (
          <span
            key={label}
            className={`db-cal-weekhead-cell${
              index === 0 ? ' db-cal-sun' : index === 6 ? ' db-cal-sat' : ''
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      <div className="db-cal-weeks" ref={weeksRef}>
        {weeks.map((week) => {
          const dates = week.map((cell) => cell.date);
          const segments = layoutBarSegments(entries, dates);
          const visible = segments.filter((segment) => segment.lane < maxLanes);

          return (
            <div className="db-cal-week" key={dates[0]}>
              <div className="db-cal-week-cells">
                {week.map((cell, column) => {
                  const holidayName = getHolidayName(cell.date);
                  const weekday = column % 7;
                  const hidden = countSegmentsAtColumn(segments, column)
                    - countSegmentsAtColumn(visible, column);
                  const classNames = [
                    'db-cal-day',
                    cell.inMonth ? '' : 'db-cal-day-muted',
                    cell.date === selectedDate ? 'db-cal-day-selected' : '',
                    weekday === 0 || holidayName ? 'db-cal-day-sun' : '',
                    weekday === 6 && !holidayName ? 'db-cal-day-sat' : '',
                  ].filter(Boolean).join(' ');

                  return (
                    <div
                      key={cell.date}
                      className={classNames}
                      role="button"
                      tabIndex={0}
                      aria-label={`${formatDisplayDateTime(cell.date)}${
                        holidayName ? ` ${holidayName}` : ''
                      } 일정 추가`}
                      onClick={() => openCreate(cell.date)}
                      onKeyDown={(keyEvent) => {
                        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                          keyEvent.preventDefault();
                          openCreate(cell.date);
                        }
                      }}
                    >
                      <span className="db-cal-day-head">
                        {holidayName ? (
                          <Tooltip title={holidayName}>
                            <span className="db-cal-day-holiday">{holidayName}</span>
                          </Tooltip>
                        ) : null}
                        <span
                          className={`db-cal-day-num${
                            cell.date === todayKey ? ' db-cal-day-today' : ''
                          }`}
                        >
                          {cell.day}
                        </span>
                      </span>

                      {hidden > 0 ? (
                        <button
                          type="button"
                          className="db-cal-more"
                          aria-label={`${formatDisplayDateTime(cell.date)} 일정 ${hidden}건 더 보기`}
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            setSelectedDate(cell.date);
                            setCursor(cell.date);
                            setView('day');
                          }}
                        >
                          {`+${hidden}`}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="db-cal-week-bars">
                {visible.map((segment) => renderBar(segment, {
                  top: DAY_HEAD_HEIGHT + segment.lane * LANE_HEIGHT,
                  left: `${(segment.startCol / 7) * 100}%`,
                  width: `${((segment.endCol - segment.startCol + 1) / 7) * 100}%`,
                }))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ---- 일간·주간 ----------------------------------------------------------

  const renderTimeGrid = () => {
    const allDaySegments = layoutBarSegments(
      entries.filter(eventIsBar),
      viewDates,
    );
    const laneCount = allDaySegments.reduce(
      (max, segment) => Math.max(max, segment.lane + 1),
      0,
    );
    const columnStyle = {
      gridTemplateColumns: `var(--db-cal-gutter) repeat(${viewDates.length}, minmax(0, 1fr))`,
    } as React.CSSProperties;

    const handleSlotClick = (date: string, clickEvent: React.MouseEvent<HTMLDivElement>) => {
      const rect = clickEvent.currentTarget.getBoundingClientRect();
      const ratio = (clickEvent.clientY - rect.top) / rect.height;
      const minutes = Math.floor((ratio * MINUTES_PER_DAY) / SLOT_MINUTES) * SLOT_MINUTES;
      openCreate(date, minutesToTime(minutes));
    };

    return (
      <div className="db-cal-time">
        <div className="db-cal-time-head" style={columnStyle}>
          <span className="db-cal-time-gutter" />
          {viewDates.map((date, column) => {
            const day = parseDateKey(date);
            const holidayName = getHolidayName(date);
            return (
              <button
                key={date}
                type="button"
                className={`db-cal-time-day${
                  date === todayKey ? ' db-cal-time-day-today' : ''
                }${
                  column === 0 || holidayName
                    ? ' db-cal-sun'
                    : column === 6 ? ' db-cal-sat' : ''
                }`}
                aria-label={`${formatDisplayDateTime(date)} 일정 추가`}
                onClick={() => openCreate(date)}
              >
                <span className="db-cal-time-day-name">
                  {WEEKDAY_LABELS[day.getDay()]}
                </span>
                <span className="db-cal-time-day-num">{day.getDate()}</span>
              </button>
            );
          })}
        </div>

        <div className="db-cal-allday" style={columnStyle}>
          <span className="db-cal-time-gutter">종일</span>
          <div
            className="db-cal-allday-lanes"
            style={{
              gridColumn: `2 / span ${viewDates.length}`,
              height: Math.max(laneCount, 1) * LANE_HEIGHT,
            }}
          >
            {allDaySegments.map((segment) => renderBar(segment, {
              top: segment.lane * LANE_HEIGHT,
              left: `${(segment.startCol / viewDates.length) * 100}%`,
              width: `${((segment.endCol - segment.startCol + 1) / viewDates.length) * 100}%`,
            }))}
          </div>
        </div>

        <div className="db-cal-time-body" ref={timeBodyRef}>
          <div
            className="db-cal-time-grid"
            style={{ ...columnStyle, height: 24 * HOUR_HEIGHT }}
          >
            <div className="db-cal-time-hours">
              {Array.from({ length: 24 }, (_, hour) => (
                <span key={hour} className="db-cal-time-hour">
                  {`${String(hour).padStart(2, '0')}:00`}
                </span>
              ))}
            </div>

            {viewDates.map((date) => (
              <div
                key={date}
                className={`db-cal-time-col${
                  date === todayKey ? ' db-cal-time-col-today' : ''
                }`}
                role="button"
                tabIndex={-1}
                aria-label={`${formatDisplayDateTime(date)} 시간대에 일정 추가`}
                onClick={(clickEvent) => handleSlotClick(date, clickEvent)}
              >
                {layoutTimedBlocks(entries, date).map((block) => {
                  const width = 100 / block.columnCount;
                  return renderBar(
                    {
                      item: block.item,
                      lane: 0,
                      startCol: 0,
                      endCol: 0,
                      continuesBefore: false,
                      continuesAfter: false,
                    },
                    {
                      position: 'absolute',
                      top: (block.startMinutes / MINUTES_PER_DAY) * (24 * HOUR_HEIGHT),
                      height: ((block.endMinutes - block.startMinutes) / MINUTES_PER_DAY)
                        * (24 * HOUR_HEIGHT),
                      left: `${block.columnIndex * width}%`,
                      width: `${width}%`,
                    },
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="db-cal">
      <div className="db-cal-toolbar">
        <Segmented
          size="small"
          value={view}
          onChange={(value) => changeView(value as CalendarView)}
          options={VIEW_OPTIONS}
        />

        <div className="db-cal-nav">
          <Button
            type="text"
            size="small"
            aria-label="이전"
            icon={<ChevronLeft size={15} />}
            onClick={() => moveBy(-1)}
          />
          <span className="db-cal-nav-label">{rangeLabel}</span>
          <Button
            type="text"
            size="small"
            aria-label="다음"
            icon={<ChevronRight size={15} />}
            onClick={() => moveBy(1)}
          />
        </div>

        <div className="db-cal-toolbar-right">
          <Tooltip title="출원·공개·등록·심사·예상 만료일과 To-do 마감을 함께 보여 줍니다">
            <Checkbox
              checked={showPatents}
              onChange={(changeEvent) => setShowPatents(changeEvent.target.checked)}
            >
              <span className="db-cal-toggle-label">특허 일정</span>
            </Checkbox>
          </Tooltip>
          <Button size="small" shape="round" onClick={goToday}>오늘</Button>
          <Tooltip title="선택한 날짜에 일정을 추가합니다">
            <Button
              size="small"
              type="text"
              aria-label="일정 추가"
              icon={<Plus size={15} />}
              onClick={() => openCreate(selectedDate)}
            />
          </Tooltip>
        </div>
      </div>

      {/* 조회가 실패해도 달력은 지우지 않는다. 한 줄로만 알리고 나머지는 그대로 쓴다. */}
      {eventsError ? (
        <Text type="danger" className="db-cal-note">
          {`일정을 불러오지 못했습니다: ${eventsError}`}
        </Text>
      ) : null}
      {patentError ? (
        <Text type="danger" className="db-cal-note">
          특허 일정을 불러오지 못했습니다. 내 일정만 표시합니다.
        </Text>
      ) : patentLoading || eventsLoading ? (
        <Text type="secondary" className="db-cal-note">일정을 불러오는 중입니다.</Text>
      ) : null}

      {view === 'month' ? renderMonth() : renderTimeGrid()}

      <ScheduleEventModal
        open={modalOpen}
        event={editing}
        draft={draft}
        teams={teams}
        onSubmit={submitModal}
        onClose={closeModal}
      />
    </div>
  );
};

export default ScheduleCalendar;
