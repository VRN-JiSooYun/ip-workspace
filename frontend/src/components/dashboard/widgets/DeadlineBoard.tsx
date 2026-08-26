import React from 'react';
import { Tooltip, Typography } from 'antd';
import type { PatentDeadlineItem } from '../../../services/patentRecordApi';
import { formatDisplayDateTime, formatNumberWithComma } from '../../../utils/displayFormat';
import {
  calendarDayDifference,
  ddayClassName,
  ddayLabel,
  nextBusinessDay,
} from '../../../utils/patentCalendar';
import '../dashboard.css';

const { Text } = Typography;

/**
 * 버킷 정의. 서버의 `counts`와 경계가 같아야 한다(patent-record.service.ts의
 * countDeadlineBuckets 주석 참고). 겹치지 않으므로 한 건이 한 줄에만 그려진다.
 */
export const DEADLINE_BUCKETS = [
  { key: 'overdue', label: '지연', match: (days: number) => days < 0 },
  { key: 'today', label: '오늘', match: (days: number) => days === 0 },
  { key: 'within7', label: '7일 내', match: (days: number) => days >= 1 && days <= 7 },
  { key: 'within30', label: '30일 내', match: (days: number) => days >= 8 && days <= 30 },
] as const;

export type DeadlineBucketKey = typeof DEADLINE_BUCKETS[number]['key'];

type Props = {
  items: PatentDeadlineItem[];
  total: number;
  loading?: boolean;
  error?: string | null;
  /** 백엔드가 센 버킷별 전체 건수. items가 limit으로 잘려도 이 숫자는 정확하다. */
  counts?: Record<DeadlineBucketKey, number>;
  /** KPI 타일에서 넘어왔을 때 강조할 버킷. */
  focusedBucket?: DeadlineBucketKey | null;
  /** 공휴일 이름 resolver. useHolidayName이 준다. */
  getHolidayName: (dateKey: string) => string | undefined;
  onSelect: (item: PatentDeadlineItem) => void;
};

/**
 * 기한 보드 — 대시보드의 주인공.
 *
 * 캘린더가 아니라 리스트인 이유: 캘린더는 "언제"를 묻는 도구이고 이 화면은 "무엇이
 * 급한가"를 묻는다. 월 격자는 특허 관리의 일정 패널에 이미 있다.
 *
 * 영업일 보정은 국내(KR) 건에만 붙는다. 공휴일 표가 한국 기준뿐이라 해외 건에 같은
 * 보정을 하면 틀린 날짜를 자신 있게 보여 주게 된다.
 */
const DeadlineBoard: React.FC<Props> = ({
  items,
  total,
  loading,
  error,
  counts,
  focusedBucket,
  getHolidayName,
  onSelect,
}) => {
  const buckets = React.useMemo(() => (
    DEADLINE_BUCKETS.map((bucket) => ({
      ...bucket,
      rows: items
        .map((item) => ({ item, daysLeft: calendarDayDifference(item.date) }))
        .filter(({ daysLeft }) => bucket.match(daysLeft)),
    }))
  ), [items]);

  if (loading) {
    return (
      <div className="db-panel-scroll">
        <Text type="secondary" className="db-status">마감을 불러오는 중입니다.</Text>
      </div>
    );
  }

  if (error) {
    return (
      <div className="db-panel-scroll">
        <Text type="danger" className="db-status">마감을 불러오지 못했습니다.</Text>
      </div>
    );
  }

  const visible = buckets.filter((bucket) => bucket.rows.length > 0);

  if (visible.length === 0) {
    return (
      <div className="db-panel-scroll">
        <Text type="secondary" className="db-status">
          30일 안에 다가오는 마감이 없습니다.
        </Text>
      </div>
    );
  }

  return (
    <div className="db-panel-scroll">
      {visible.map((bucket) => (
        <section
          key={bucket.key}
          id={`db-deadline-bucket-${bucket.key}`}
          className={`db-deadline-bucket${
            focusedBucket === bucket.key ? ' db-deadline-bucket-focus' : ''
          }`}
        >
          <header className="db-deadline-bucket-head">
            <span>{bucket.label}</span>
            <span className="db-deadline-bucket-count">
              {formatNumberWithComma(counts?.[bucket.key] ?? bucket.rows.length)}건
            </span>
          </header>

          {bucket.rows.map(({ item, daysLeft }) => {
            // 국내 건만 영업일 보정. 해외 건은 역일 그대로 두고 국가 배지로 구분한다.
            const businessDay = item.country === 'KR'
              ? nextBusinessDay(item.date, (key) => Boolean(getHolidayName(key)))
              : null;
            const reason = item.todoTitle ?? item.label;

            return (
              <button
                key={`${item.type}-${item.todoId ?? item.patentId}-${item.date}`}
                type="button"
                className="db-deadline-row"
                onClick={() => onSelect(item)}
              >
                <span className={ddayClassName(daysLeft)}>{ddayLabel(daysLeft)}</span>
                <span className="db-deadline-country">{item.country}</span>
                <Tooltip
                  title={[
                    item.patentTitle,
                    item.target ? `Target ${item.target}` : null,
                    businessDay
                      ? `마감일이 휴일입니다. 다음 영업일 ${formatDisplayDateTime(businessDay)}`
                      : null,
                  ].filter(Boolean).join(' · ') || item.applicationNumber}
                >
                  <span className="db-deadline-label">
                    {reason} · {item.internalRef ?? item.applicationNumber}
                  </span>
                </Tooltip>
                <span className="db-deadline-meta">
                  {formatDisplayDateTime(item.date)}
                  {businessDay ? ` → ${formatDisplayDateTime(businessDay)}` : ''}
                </span>
              </button>
            );
          })}
        </section>
      ))}

      {/* 조용한 절단 금지. limit으로 잘렸으면 그 사실을 그대로 알린다. */}
      {total > items.length ? (
        <div className="db-deadline-more">
          {formatNumberWithComma(total - items.length)}건이 더 있습니다. Target 필터로 좁혀 보세요.
        </div>
      ) : null}
    </div>
  );
};

export default DeadlineBoard;
