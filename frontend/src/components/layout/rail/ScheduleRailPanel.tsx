import React from 'react';
import { Typography } from 'antd';
import PatentCalendar from '../../patent-management/PatentCalendar';
import { useAccessContext } from '../../../contexts/AccessContext';
import { useHolidayName } from '../../../hooks/useHolidayName';
import {
  patentRecordApi,
  type PatentScheduleEvent,
  type PatentScheduleResult,
} from '../../../services/patentRecordApi';
import { formatDisplayDateTime } from '../../../utils/displayFormat';
import { buildMonthGrid, toLocalDateKey } from '../../../utils/patentCalendar';

const { Text } = Typography;

/**
 * 우측 레일의 일정 패널.
 *
 * 조회를 스스로 갖는다. 레일은 모든 화면 밖에 있어 특허 관리의 컨텍스트를 쓸 수 없고,
 * 써서도 안 된다 — 대시보드나 OA 분석 화면에서도 같은 달력이 보여야 한다.
 *
 * 이 컴포넌트는 패널이 펼쳐질 때만 마운트되므로 조회도 그때만 나간다(접혀 있으면 요청 없음).
 */
const ScheduleRailPanel: React.FC = () => {
  const { hasPermission } = useAccessContext();
  const canRead = hasPermission('patentAnalysis.read');

  const today = React.useMemo(() => new Date(), []);
  const todayKey = React.useMemo(() => toLocalDateKey(today), [today]);

  const [month, setMonth] = React.useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  }));
  const [selectedDate, setSelectedDate] = React.useState(todayKey);
  const [schedule, setSchedule] = React.useState<PatentScheduleResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!canRead) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    patentRecordApi
      .schedule({ year: month.year, month: month.month })
      .then((result) => { if (active) setSchedule(result); })
      .catch(() => {
        if (!active) return;
        setSchedule(null);
        setError('일정을 불러오지 못했습니다.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canRead, month.month, month.year]);

  const cells = React.useMemo(
    () => buildMonthGrid(month.year, month.month),
    [month.month, month.year],
  );

  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, PatentScheduleEvent[]>();
    (schedule?.events ?? []).forEach((event) => {
      const list = map.get(event.date);
      if (list) list.push(event);
      else map.set(event.date, [event]);
    });
    return map;
  }, [schedule]);

  /** 달력이 걸치는 연도. 앞뒤 달이 섞이므로 두 해가 될 수 있다. */
  const years = React.useMemo(() => {
    const set = new Set(cells.map((cell) => Number(cell.date.slice(0, 4))));
    return [...set].sort();
  }, [cells]);
  const getHolidayName = useHolidayName(years);

  const moveMonth = React.useCallback((offset: number) => {
    setMonth((current) => {
      const next = new Date(current.year, current.month - 1 + offset, 1);
      return { year: next.getFullYear(), month: next.getMonth() + 1 };
    });
  }, []);

  if (!canRead) {
    return (
      <Text type="secondary" className="rs-status">일정을 볼 권한이 없습니다.</Text>
    );
  }

  const selectedEvents = eventsByDate.get(selectedDate) ?? [];

  return (
    <>
      <PatentCalendar
        compact
        year={month.year}
        month={month.month}
        cells={cells}
        eventsByDate={eventsByDate}
        todayKey={todayKey}
        selectedDate={selectedDate}
        getHolidayName={getHolidayName}
        onMoveMonth={moveMonth}
        onSelectDate={setSelectedDate}
      />

      {/* 고른 날의 일정. 달력은 점만 찍으므로 무엇인지는 여기서 읽는다.
          특허 관리에서는 이 목록이 없어 tooltip으로만 볼 수 있었다. */}
      <div className="rs-schedule-day">
        <div className="rs-schedule-day-head">
          {formatDisplayDateTime(selectedDate)}
          {getHolidayName(selectedDate) ? ` · ${getHolidayName(selectedDate)}` : ''}
        </div>
        {loading ? (
          <Text type="secondary" className="rs-status">불러오는 중입니다.</Text>
        ) : error ? (
          <Text type="danger" className="rs-status">{error}</Text>
        ) : selectedEvents.length === 0 ? (
          <Text type="secondary" className="rs-status">이 날에는 일정이 없습니다.</Text>
        ) : (
          selectedEvents.map((event) => (
            <div
              key={`${event.type}-${event.todoId ?? event.patentId}-${event.date}`}
              className="rs-schedule-event"
            >
              <span className="rs-schedule-event-label">{event.label}</span>
              <span className="rs-schedule-event-ref">
                {event.internalRef ?? event.applicationNumber}
              </span>
              <span className="rs-schedule-event-country">{event.country}</span>
            </div>
          ))
        )}
      </div>
    </>
  );
};

export default ScheduleRailPanel;
