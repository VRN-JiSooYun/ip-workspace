import React from 'react';
import { App as AntApp, Checkbox, Tooltip, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAccessContext } from '../../../contexts/AccessContext';
import {
  patentRecordApi,
  patentTodoApi,
  type PatentDeadlineItem,
} from '../../../services/patentRecordApi';
import { useRightSidebarStore } from '../../../store/useRightSidebarStore';
import { formatDisplayDateTime, formatNumberWithComma } from '../../../utils/displayFormat';
import {
  calendarDayDifference,
  ddayClassName,
  ddayLabel,
  shiftDateKey,
  toLocalDateKey,
} from '../../../utils/patentCalendar';
import { buildPatentListQuery } from '../../../utils/patentListQueryParams';

const { Text } = Typography;

/** 지연 건은 아무리 오래된 것도 보여야 하고, 예정은 1년까지 본다. */
const PAST_DAYS = 3_650;
const FUTURE_DAYS = 365;
const LIMIT = 200;

/**
 * 우측 레일의 To-do 관리 패널.
 *
 * 대시보드 기한 보드와 역할이 다르다. 저기는 **조망**(오늘 기준 4버킷, 눌러서 이동)이고
 * 여기는 **관리**(완료 처리, 전체 목록)다. 그래서 둘 다 있어도 겹치지 않는다.
 *
 * 데이터는 `/patent-records/deadlines`를 쓰고 TODO만 남긴다. 예전 특허 관리의 To-do
 * 패널은 `schedule` 응답을 썼는데 그쪽 `todos`는 **지연 3건 + 예정 7건으로 상한이 박혀**
 * 있어서 관리 화면으로 쓸 수 없었다(8번째 To-do는 아예 보이지 않았다).
 */
const TodoRailPanel: React.FC = () => {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const { hasPermission } = useAccessContext();
  const canRead = hasPermission('patentAnalysis.read');
  const canManage = hasPermission('patentAnalysis.manage');

  const [items, setItems] = React.useState<PatentDeadlineItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  /** 완료 처리 중인 todoId. 같은 줄을 두 번 누르는 것을 막는다. */
  const [pending, setPending] = React.useState<Set<number>>(new Set());
  /** 이 패널 안에서 누른 '다시 불러오기'. */
  const [revision, setRevision] = React.useState(0);
  /** 다른 화면(특허 관리 To-do 모달)이 To-do를 바꿨다는 신호. */
  const externalRevision = useRightSidebarStore((state) => state.todoRevision);

  React.useEffect(() => {
    if (!canRead) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    const today = toLocalDateKey(new Date());
    patentRecordApi
      .deadlines({
        from: shiftDateKey(today, -PAST_DAYS),
        to: shiftDateKey(today, FUTURE_DAYS),
        limit: LIMIT,
      })
      .then((result) => {
        if (!active) return;
        const todos = result.items.filter((item) => item.type === 'TODO');
        setItems(todos);
        // total은 예상 만료일까지 센 값이라 그대로 쓸 수 없다. 잘렸는지만 판단한다.
        setTotal(result.total > result.items.length ? result.total : todos.length);
      })
      .catch(() => {
        if (!active) return;
        setItems([]);
        setError('To-do를 불러오지 못했습니다.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canRead, externalRevision, revision]);

  const complete = React.useCallback(async (item: PatentDeadlineItem) => {
    if (item.todoId === null) return;
    const todoId = item.todoId;
    setPending((current) => new Set(current).add(todoId));
    try {
      await patentTodoApi.update(todoId, { completed: true });
      // 낙관적으로 지우지 않고 목록에서 바로 뺀다. 완료된 To-do는 이 패널의 관심이 아니다.
      setItems((current) => current.filter((row) => row.todoId !== todoId));
      message.success('완료 처리했습니다.');
    } catch {
      message.error('완료 처리에 실패했습니다.');
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(todoId);
        return next;
      });
    }
  }, [message]);

  const openPatent = React.useCallback((item: PatentDeadlineItem) => {
    navigate(`/patent-management${buildPatentListQuery({ q: item.applicationNumber })}`);
  }, [navigate]);

  if (!canRead) {
    return <Text type="secondary" className="rs-status">To-do를 볼 권한이 없습니다.</Text>;
  }

  if (loading) {
    return <Text type="secondary" className="rs-status">To-do를 불러오는 중입니다.</Text>;
  }

  if (error) {
    return <Text type="danger" className="rs-status">{error}</Text>;
  }

  const rows = items.map((item) => ({
    item,
    daysLeft: calendarDayDifference(item.date),
  }));
  const overdue = rows.filter((row) => row.daysLeft < 0);
  const upcoming = rows.filter((row) => row.daysLeft >= 0);

  if (rows.length === 0) {
    return <Text type="secondary" className="rs-status">마감일이 있는 To-do가 없습니다.</Text>;
  }

  const section = (label: string, group: typeof rows) => (group.length === 0 ? null : (
    <section className="rs-todo-section" key={label}>
      <header className="rs-todo-section-head">
        <span>{label}</span>
        <span className="rs-todo-section-count">{formatNumberWithComma(group.length)}건</span>
      </header>
      {group.map(({ item, daysLeft }) => (
        <div className="rs-todo-row" key={item.todoId ?? `${item.patentId}-${item.date}`}>
          {/* 완료는 관리 권한이 있을 때만. 없으면 읽기 전용 목록이다. */}
          <Checkbox
            checked={false}
            disabled={!canManage || item.todoId === null || pending.has(item.todoId)}
            onChange={() => void complete(item)}
            aria-label={`${item.todoTitle ?? 'To-do'} 완료 처리`}
          />
          <span className={ddayClassName(daysLeft)}>{ddayLabel(daysLeft)}</span>
          <Tooltip
            title={[
              item.patentTitle,
              item.target ? `Target ${item.target}` : null,
              `${item.country} · ${item.applicationNumber}`,
            ].filter(Boolean).join(' · ')}
          >
            <button
              type="button"
              className="rs-todo-label"
              onClick={() => openPatent(item)}
            >
              {item.todoTitle ?? 'To-do'}
              <span className="rs-todo-ref">
                {item.internalRef ?? item.applicationNumber}
              </span>
            </button>
          </Tooltip>
          <span className="rs-todo-date">{formatDisplayDateTime(item.date)}</span>
        </div>
      ))}
    </section>
  ));

  return (
    <>
      {section('지연', overdue)}
      {section('예정', upcoming)}
      {/* 조용한 절단 금지. limit에 걸렸으면 그 사실을 알린다. */}
      {total > items.length ? (
        <div className="rs-status">
          목록이 {formatNumberWithComma(LIMIT)}건에서 잘렸습니다. 특허 관리에서 확인하세요.
        </div>
      ) : null}
      {/* 새로 만들기·수정은 특허 관리의 To-do 모달이 갖는다. 여기서는 훑고 끝내는 것만. */}
      <button type="button" className="rs-todo-refresh" onClick={() => setRevision((n) => n + 1)}>
        다시 불러오기
      </button>
    </>
  );
};

export default TodoRailPanel;
