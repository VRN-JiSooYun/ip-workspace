import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Checkbox, DatePicker, Input, Typography } from 'antd';
import type { InputRef } from 'antd';
import dayjs from 'dayjs';
import { Plus, Trash2 } from 'lucide-react';
import { patentTodoApi, type PatentTodo } from '../../services/patentRecordApi';
import { calendarDayDifference, ddayClassName, ddayLabel } from '../../utils/patentCalendar';

const { Text } = Typography;

type Props = {
  patentId: number;
  canManage: boolean;
  /** 목록·레일의 To-do 패널이 stale해지지 않게 알린다. */
  onChanged?: () => void;
};

/**
 * 관리 특허의 To-do — JIRA 이슈 상세의 `하위 작업`에 해당한다.
 *
 * **여기는 즉시 저장이다.** To-do는 `/patent-todos`라는 별개 리소스라 특허 필드처럼
 * 모아서 PATCH할 대상이 아니다. 같은 모달 안에 저장 규칙이 둘 있는 셈인데, JIRA도 하위
 * 작업은 즉시 저장이라 낯설지 않다. 그래도 헷갈리지 않게 머리줄에 밝혀 둔다.
 */
const PatentSubtaskList: React.FC<Props> = ({ patentId, canManage, onChanged }) => {
  const [todos, setTodos] = useState<PatentTodo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState<dayjs.Dayjs | null>(null);
  const [adding, setAdding] = useState(false);
  /**
   * 입력 줄을 펼쳤는가.
   *
   * 하나도 없을 때는 입력 줄 대신 '하위 작업을 추가하세요' 한 칸만 낸다. 빈 목록 밑에
   * 빈 입력 줄까지 놓으면 아무것도 없는 자리에 회색 칸만 둘 늘어서서, 여기가 뭘 하는
   * 곳인지가 오히려 흐려진다. '설명'이 같은 방식이다 — 비어 있으면 누를 것 하나.
   */
  const [addOpen, setAddOpen] = useState(false);
  const titleRef = useRef<InputRef>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setTodos(await patentTodoApi.list(patentId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'To-do를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [patentId]);

  useEffect(() => { void load(); }, [load]);

  /** 다른 특허로 옮기면 다시 접는다. 앞 특허에서 펼쳐 둔 상태가 따라오면 안 된다. */
  useEffect(() => { setAddOpen(false); }, [patentId]);

  // 눌러서 펼쳤으면 바로 칠 수 있어야 한다. 한 번 더 클릭하게 만들지 않는다.
  useEffect(() => {
    if (addOpen) titleRef.current?.focus();
  }, [addOpen]);

  const toggle = async (todo: PatentTodo) => {
    // 낙관적으로 먼저 칠한다. 체크박스는 반응이 늦으면 눌렸는지 알 수 없다.
    setTodos((current) => current.map((item) => (
      item.id === todo.id ? { ...item, completed: !item.completed } : item
    )));
    try {
      await patentTodoApi.update(todo.id, { completed: !todo.completed });
      onChanged?.();
    } catch (caught) {
      // 실패하면 되돌린다. 서버가 거절한 상태를 화면에 남겨 두면 안 된다.
      setTodos((current) => current.map((item) => (
        item.id === todo.id ? { ...item, completed: todo.completed } : item
      )));
      setError(caught instanceof Error ? caught.message : '변경하지 못했습니다.');
    }
  };

  const add = async () => {
    const trimmed = title.trim();
    if (trimmed.length === 0) return;
    setAdding(true);
    setError('');
    try {
      await patentTodoApi.create({
        patentId,
        title: trimmed,
        dueDate: dueDate ? dueDate.format('YYYY-MM-DD') : null,
      });
      setTitle('');
      setDueDate(null);
      await load();
      onChanged?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '추가하지 못했습니다.');
    } finally {
      setAdding(false);
    }
  };

  const remove = async (todo: PatentTodo) => {
    try {
      await patentTodoApi.remove(todo.id);
      setTodos((current) => current.filter((item) => item.id !== todo.id));
      onChanged?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '삭제하지 못했습니다.');
    }
  };

  const isEmpty = todos.length === 0 && !loading;
  /** 하나라도 있으면 입력 줄은 늘 열어 둔다. 이어서 적는 흐름을 끊지 않는다. */
  const showAddRow = canManage && (todos.length > 0 || addOpen);

  return (
    <div className="pm-subtasks">
      {isEmpty && !canManage && (
        <Text type="secondary" style={{ fontSize: 12 }}>등록된 하위 작업이 없습니다.</Text>
      )}
      {isEmpty && canManage && !addOpen && (
        <button
          type="button"
          className="pm-empty-action"
          onClick={() => setAddOpen(true)}
        >
          하위 작업을 추가하세요
        </button>
      )}

      <ul className="pm-subtask-list">
        {todos.map((todo) => {
          const daysLeft = todo.dueDate ? calendarDayDifference(todo.dueDate.slice(0, 10)) : null;
          return (
            <li key={todo.id} className={`pm-subtask${todo.completed ? ' pm-subtask-done' : ''}`}>
              <Checkbox
                checked={todo.completed}
                disabled={!canManage}
                onChange={() => void toggle(todo)}
              />
              <span className="pm-subtask-title">{todo.title}</span>
              {/* 완료된 항목에 D-day를 붙이면 지난 기한이 급한 일처럼 보인다. */}
              {daysLeft !== null && !todo.completed && (
                <span className={ddayClassName(daysLeft)}>{ddayLabel(daysLeft)}</span>
              )}
              {canManage && (
                <Button
                  type="text"
                  size="small"
                  aria-label={`${todo.title} 삭제`}
                  icon={<Trash2 size={13} />}
                  onClick={() => void remove(todo)}
                />
              )}
            </li>
          );
        })}
      </ul>

      {showAddRow && (
        <div className="pm-subtask-add">
          <Input
            ref={titleRef}
            size="small"
            placeholder="하위 작업 추가"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onPressEnter={() => void add()}
          />
          <DatePicker
            size="small"
            placeholder="기한"
            value={dueDate}
            onChange={setDueDate}
          />
          <Button
            size="small"
            type="text"
            icon={<Plus size={14} />}
            loading={adding}
            disabled={title.trim().length === 0}
            onClick={() => void add()}
          >
            추가
          </Button>
        </div>
      )}

      {error && <Text type="danger" style={{ fontSize: 12 }}>{error}</Text>}
    </div>
  );
};

export default PatentSubtaskList;
