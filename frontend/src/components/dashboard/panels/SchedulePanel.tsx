import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ScheduleCalendar from '../widgets/ScheduleCalendar';
import { useDashboard } from '../DashboardContext';
import { useCalendarEvents } from '../../../hooks/useCalendarEvents';
import { usePatentScheduleEvents } from '../../../hooks/usePatentScheduleEvents';
import { toLocalDateKey } from '../../../utils/patentCalendar';
import type { PatentScheduleEvent } from '../../../services/patentRecordApi';
import type { CalendarEvent } from '../../../utils/calendarEvents';

type VisibleRange = { from: string; to: string; patentMonths: string[] };

const EMPTY_RANGE: VisibleRange = { from: '', to: '', patentMonths: [] };

/**
 * 일정 패널.
 *
 * 달력에는 성격이 다른 두 가지가 함께 놓인다.
 *   - 내 일정   : 사용자가 만든다. 서버에 저장된다(hooks/useCalendarEvents)
 *   - 특허 일정 : 서버가 준다. 읽기 전용이다(hooks/usePatentScheduleEvents)
 *
 * 조회 범위는 달력이 알려 준다(`onRangeChange`). 내 일정은 임의 구간으로, 특허 일정은
 * 달 단위로 묻기 때문에 구간과 달 목록을 함께 받는다.
 *
 * Target 필터는 대시보드 머리글의 값을 그대로 쓴다(특허 일정에만 걸린다 — 내 일정은
 * 특허에 매이지 않는다).
 */
const SchedulePanel: React.FC = () => {
  const {
    getHolidayName,
    selectedTargets,
    openPatentList,
    loadPatentScheduleEvents,
    searchPatentOptions,
    calendarGateway,
    teams,
    refreshToken,
  } = useDashboard();
  const [range, setRange] = useState<VisibleRange>(EMPTY_RANGE);

  const events = useCalendarEvents(calendarGateway, range.from, range.to);

  // Target이 바뀌면 이미 받아 둔 달을 버리고 다시 부른다(모집단이 달라졌다).
  const patents = usePatentScheduleEvents(
    loadPatentScheduleEvents,
    range.patentMonths,
    selectedTargets.join(','),
  );

  /** 머리글의 새로고침. 첫 렌더에서는 이미 부르고 있으므로 두 번 부르지 않는다. */
  const seenRefresh = useRef(refreshToken);
  useEffect(() => {
    if (seenRefresh.current === refreshToken) return;
    seenRefresh.current = refreshToken;
    events.reload();
  }, [events, refreshToken]);

  // 하루가 바뀌어도 다시 계산되지 않는다. 자정을 넘겨 열어 둔 화면은 새로고침이 필요하다
  // (다른 위젯의 D-day 계산도 같은 전제다).
  const todayKey = useMemo(() => toLocalDateKey(new Date()), []);

  /** 특허 일정 팝업의 '특허 열기'. 그 한 건으로 좁혀 목록을 연다(기한 보드와 같은 방식). */
  const openPatent = useCallback((event: PatentScheduleEvent) => {
    openPatentList({ applicationNumber: event.applicationNumber, targets: [] });
  }, [openPatentList]);

  /**
   * 내 일정에 연결한 특허로 목록을 연다. 내부관리번호가 있으면 그것으로 좁힌다 —
   * 사용자가 고른 값이 그대로 상세 검색 칸에 보여야 어디서 온 조건인지 알 수 있다.
   */
  const openPatentRecord = useCallback((patent: NonNullable<CalendarEvent['patent']>) => {
    openPatentList(
      patent.internalRef
        ? { internalRef: patent.internalRef, targets: [] }
        : { applicationNumber: patent.applicationNumber, targets: [] },
    );
  }, [openPatentList]);

  return (
    <div className="db-panel-fill">
      <ScheduleCalendar
        events={events.events}
        eventsLoading={events.loading}
        eventsError={events.error || null}
        patentEvents={patents.events}
        patentLoading={patents.loading}
        patentError={patents.error || null}
        teams={teams}
        onRangeChange={setRange}
        onOpenPatent={openPatent}
        onOpenPatentRecord={openPatentRecord}
        searchPatents={searchPatentOptions}
        todayKey={todayKey}
        getHolidayName={getHolidayName}
        onCreate={events.createEvent}
        onUpdate={events.updateEvent}
        onDelete={events.removeEvent}
      />
    </div>
  );
};

export default SchedulePanel;
