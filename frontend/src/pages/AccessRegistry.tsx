import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Alert,
  App as AntApp,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import type { TableColumnsType } from 'antd';
import { RefreshCw, Search, ShieldCheck } from 'lucide-react';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import { useAuthSession } from '../contexts/AuthSessionContext';
import {
  adminAccessApi,
  type AdminUser,
  type AdminUserRole,
  type AdminUserStatus,
  type UpdateAdminUserAccess,
} from '../services/adminAccessApi';
import { AUTH_REQUIRED_EVENT } from '../services/authApi';
import { useUIStore } from '../store/useUIStore';
import { formatDisplayDate } from '../utils/displayFormat';

const { Text, Title } = Typography;

type AccessFormValues = UpdateAdminUserAccess;

const getErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) return '사용자 정보를 처리하지 못했습니다.';
  const messages: Record<string, string> = {
    LAST_ACTIVE_ADMIN: '마지막 활성 관리자의 권한이나 상태는 변경할 수 없습니다.',
    FRESH_SESSION_REQUIRED: '관리 작업을 위해 Groupware 인증을 다시 확인해야 합니다.',
    USER_NOT_FOUND: '변경할 사용자를 찾지 못했습니다.',
  };
  return messages[error.message] ?? error.message;
};

const AccessRegistry: React.FC = () => {
  const session = useAuthSession();
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const { setHeaderContent } = useUIStore();
  const [form] = Form.useForm<AccessFormValues>();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const isAdmin = session.user.role === 'ADMIN';

  useEffect(() => {
    setHeaderContent(
      <PageHeaderBreadcrumb items={[{ label: 'Workspace' }, { label: 'Access registry' }]} />,
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      setUsers(await adminAccessApi.listUsers());
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return users;
    return users.filter((user) =>
      user.email.toLowerCase().includes(normalizedQuery) ||
      user.name.toLowerCase().includes(normalizedQuery),
    );
  }, [query, users]);

  const openAccessModal = (user: AdminUser) => {
    setEditingUser(user);
    form.setFieldsValue({
      role: user.role,
      status: user.status,
      reason: '',
    });
  };

  const closeAccessModal = () => {
    if (saving) return;
    setEditingUser(null);
    form.resetFields();
  };

  const saveAccess = async () => {
    if (!editingUser) return;
    let values: AccessFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    if (values.role === editingUser.role && values.status === editingUser.status) {
      void message.info('변경된 권한이나 상태가 없습니다.');
      return;
    }

    setSaving(true);
    try {
      const updated = await adminAccessApi.updateUserAccess(editingUser.id, {
        ...values,
        reason: values.reason.trim(),
      });
      setUsers((current) => current.map((user) => user.id === updated.id ? updated : user));
      setEditingUser(null);
      form.resetFields();
      void message.success('사용자 접근 권한을 변경했습니다.');
      if (updated.id === session.user.id) {
        window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
      }
    } catch (saveError) {
      void message.error(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumnsType<AdminUser> = [
    {
      title: '사용자',
      key: 'user',
      width: 260,
      onHeaderCell: () => ({ className: 'access-registry-user-column' }),
      render: (_, user) => (
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Text strong ellipsis={{ tooltip: user.email }}>{user.email}</Text>
          <Text type="secondary" ellipsis={{ tooltip: user.name }}>{user.name}</Text>
        </div>
      ),
    },
    {
      title: '역할',
      dataIndex: 'role',
      width: 110,
      align: 'center',
      render: (role: AdminUserRole) => (
        <Tag color={role === 'ADMIN' ? 'orange' : 'default'}>{role}</Tag>
      ),
    },
    {
      title: '상태',
      dataIndex: 'status',
      width: 110,
      align: 'center',
      render: (status: AdminUserStatus) => (
        <Tag color={status === 'ACTIVE' ? 'success' : 'default'}>{status}</Tag>
      ),
    },
    {
      title: '등록일',
      dataIndex: 'createdAt',
      width: 150,
      align: 'center',
      render: formatDisplayDate,
    },
    {
      title: '수정일',
      dataIndex: 'updatedAt',
      width: 150,
      align: 'center',
      render: formatDisplayDate,
    },
    {
      title: '관리',
      key: 'action',
      width: 110,
      fixed: 'right',
      align: 'center',
      render: (_, user) => (
        <Button size="small" onClick={() => openAccessModal(user)}>
          권한 변경
        </Button>
      ),
    },
  ];

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 1280,
        margin: '0 auto',
        padding: '0 12px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minHeight: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <Space size={8} align="center">
            <ShieldCheck size={20} color={token.colorPrimary} />
            <Title level={4} style={{ margin: 0 }}>사용자 접근 관리</Title>
          </Space>
          <div>
            <Text type="secondary">사용자 역할과 서비스 접근 상태를 관리합니다.</Text>
          </div>
        </div>
        <Button icon={<RefreshCw size={15} />} onClick={() => void loadUsers()} loading={loading}>
          새로고침
        </Button>
      </div>

      {error && <Alert type="error" showIcon message={error} closable onClose={() => setError('')} />}

      <div
        className="v-table-card"
        style={{
          background: token.colorBgContainer,
          padding: 16,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <Input
          allowClear
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPagination((current) => ({ ...current, current: 1 }));
          }}
          prefix={<Search size={16} color={token.colorTextPlaceholder} />}
          placeholder="이메일 또는 이름 검색"
          style={{ width: 'min(360px, 100%)' }}
        />
        <Table<AdminUser>
          className="access-registry-table"
          rowKey="id"
          columns={columns}
          dataSource={filteredUsers}
          loading={loading}
          size="small"
          scroll={{ x: 900 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            pageSizeOptions: [10, 30, 50, 100],
            showSizeChanger: true,
            position: ['bottomRight'],
            onChange: (current, pageSize) => setPagination({ current, pageSize }),
          }}
        />
      </div>

      <Modal
        title="사용자 접근 권한 변경"
        open={Boolean(editingUser)}
        onCancel={closeAccessModal}
        onOk={() => void saveAccess()}
        okText="변경"
        cancelText="취소"
        confirmLoading={saving}
        maskClosable={!saving}
      >
        {editingUser && (
          <Alert
            type="info"
            showIcon
            message={editingUser.email}
            description="권한 또는 상태가 변경되면 해당 사용자의 기존 로그인 세션이 종료됩니다."
            style={{ marginBottom: 16 }}
          />
        )}
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="role" label="역할" rules={[{ required: true, message: '역할을 선택해주세요.' }]}>
            <Select
              options={[
                { value: 'USER', label: 'USER' },
                { value: 'ADMIN', label: 'ADMIN' },
              ]}
            />
          </Form.Item>
          <Form.Item name="status" label="상태" rules={[{ required: true, message: '상태를 선택해주세요.' }]}>
            <Select
              options={[
                { value: 'ACTIVE', label: 'ACTIVE' },
                { value: 'INACTIVE', label: 'INACTIVE' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="변경 사유"
            rules={[
              { required: true, whitespace: true, message: '변경 사유를 입력해주세요.' },
              { max: 500, message: '변경 사유는 500자 이내로 입력해주세요.' },
            ]}
          >
            <Input.TextArea rows={4} maxLength={500} showCount placeholder="감사 로그에 기록할 변경 사유" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AccessRegistry;
