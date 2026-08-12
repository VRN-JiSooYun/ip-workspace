import React, { useCallback, useEffect, useState } from 'react';
import {
  App as AntApp,
  Button,
  Checkbox,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import type { TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  patentTodoApi,
  type PatentRecord,
  type PatentTodo,
} from '../../services/patentRecordApi';
import { formatDisplayDateOnly } from '../../utils/displayFormat';

const { Text } = Typography;
const { TextArea } = Input;

type TodoFormValues = {
  title: string;
  description?: string;
  dueDate?: dayjs.Dayjs;
};

type Props = {
  open: boolean;
  patent: PatentRecord | null;
  onClose: () => void;
  onChanged: () => void;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

const PatentTodoModal: React.FC<Props> = ({
  open,
  patent,
  onClose,
  onChanged,
}) => {
  const { message, modal } = AntApp.useApp();
  const [form] = Form.useForm<TodoFormValues>();
  const [items, setItems] = useState<PatentTodo[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!patent) return;
    setLoading(true);
    try {
      setItems(await patentTodoApi.list(patent.id));
    } catch (error) {
      setItems([]);
      void message.error(`To-do 목록을 불러오지 못했습니다: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, [message, patent]);

  useEffect(() => {
    if (!open || !patent) return;
    setEditingId(null);
    form.resetFields();
    void load();
  }, [form, load, open, patent]);

  const cancelEditing = () => {
    setEditingId(null);
    form.resetFields();
  };

  const startEditing = (todo: PatentTodo) => {
    setEditingId(todo.id);
    form.setFieldsValue({
      title: todo.title,
      description: todo.description ?? undefined,
      dueDate: todo.dueDate ? dayjs(todo.dueDate) : undefined,
    });
  };

  const save = async () => {
    if (!patent) return;
    const values = await form.validateFields();
    const input = {
      title: values.title.trim(),
      description: values.description?.trim() || null,
      dueDate: values.dueDate?.format('YYYY-MM-DD') ?? null,
    };
    setBusy(true);
    try {
      if (editingId !== null) {
        await patentTodoApi.update(editingId, input);
        void message.success('To-do를 변경했습니다.');
      } else {
        await patentTodoApi.create({ patentId: patent.id, ...input });
        void message.success('To-do를 추가했습니다.');
      }
      cancelEditing();
      await load();
      onChanged();
    } catch (error) {
      void message.error(`To-do 저장에 실패했습니다: ${getErrorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const toggleCompleted = async (todo: PatentTodo, completed: boolean) => {
    setBusy(true);
    try {
      await patentTodoApi.update(todo.id, { completed });
      await load();
      onChanged();
    } catch (error) {
      void message.error(`완료 상태 변경에 실패했습니다: ${getErrorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = (todo: PatentTodo) => {
    modal.confirm({
      title: 'To-do를 삭제할까요?',
      content: todo.title,
      okText: '삭제',
      okButtonProps: { danger: true },
      cancelText: '취소',
      onOk: async () => {
        try {
          await patentTodoApi.remove(todo.id);
          if (editingId === todo.id) cancelEditing();
          await load();
          onChanged();
          void message.success('To-do를 삭제했습니다.');
        } catch (error) {
          void message.error(`To-do 삭제에 실패했습니다: ${getErrorMessage(error)}`);
          throw error;
        }
      },
    });
  };

  const columns: TableColumnsType<PatentTodo> = [
    {
      title: '완료',
      dataIndex: 'completed',
      key: 'completed',
      width: 64,
      align: 'center',
      render: (completed: boolean, todo) => (
        <Checkbox
          checked={completed}
          disabled={busy}
          aria-label={`${todo.title} 완료 여부`}
          onChange={(event) => void toggleCompleted(todo, event.target.checked)}
        />
      ),
    },
    {
      title: 'To-do',
      key: 'title',
      render: (_, todo) => (
        <div style={{ minWidth: 0 }}>
          <Text delete={todo.completed}>{todo.title}</Text>
          {todo.description && (
            <Text
              type="secondary"
              style={{ display: 'block', fontSize: 12, whiteSpace: 'pre-wrap' }}
            >
              {todo.description}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: '마감일',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 116,
      render: (value: string | null) => formatDisplayDateOnly(value),
    },
    {
      title: '',
      key: 'actions',
      width: 84,
      align: 'center',
      render: (_, todo) => (
        <Space size={2}>
          <Tooltip title="변경">
            <Button
              type="text"
              size="small"
              aria-label={`${todo.title} 변경`}
              disabled={busy}
              icon={<Pencil size={14} />}
              onClick={() => startEditing(todo)}
            />
          </Tooltip>
          <Tooltip title="삭제">
            <Button
              type="text"
              size="small"
              danger
              aria-label={`${todo.title} 삭제`}
              disabled={busy}
              icon={<Trash2 size={14} />}
              onClick={() => remove(todo)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      title={`To-do 관리 · ${patent?.internalRef ?? patent?.applicationNumber ?? ''}`}
      width={760}
      footer={null}
      destroyOnClose
      maskClosable={!busy}
      onCancel={onClose}
    >
      <Form form={form} layout="vertical" disabled={busy} preserve={false}>
        <div className="pm-todo-editor">
          <Form.Item
            name="title"
            label="할 일"
            rules={[
              { required: true, whitespace: true, message: '할 일을 입력해 주세요.' },
              { max: 200, message: '200자 이내로 입력해 주세요.' },
            ]}
          >
            <Input placeholder="예: OA 대응 의견서 검토" />
          </Form.Item>
          <Form.Item name="dueDate" label="마감일">
            <DatePicker style={{ width: '100%' }} format="YYYY.MM.DD" />
          </Form.Item>
        </div>
        <Form.Item name="description" label="설명" rules={[{ max: 2000 }]}>
          <TextArea rows={2} placeholder="필요한 메모를 입력하세요." />
        </Form.Item>
        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={editingId === null ? <Plus size={14} /> : <Check size={14} />}
            loading={busy}
            onClick={() => void save()}
          >
            {editingId === null ? 'To-do 추가' : '변경 저장'}
          </Button>
          {editingId !== null && (
            <Button icon={<X size={14} />} onClick={cancelEditing}>변경 취소</Button>
          )}
        </Space>
      </Form>

      <Table<PatentTodo>
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={false}
        scroll={{ y: 360 }}
        locale={{ emptyText: <Empty description="등록된 To-do가 없습니다." /> }}
      />
    </Modal>
  );
};

export default PatentTodoModal;
