import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Alert,
  App as AntApp,
  Button,
  Checkbox,
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
import { useAccessContext } from '../contexts/AccessContext';
import {
  adminAccessApi,
  type AdminUser,
  type AdminUserStatus,
  type WorkspaceAdminRole,
  type TeamAccessItem,
  type TeamModuleAccess,
  type WorkspaceModuleCode,
  type UpdateAdminUserAccess,
} from '../services/adminAccessApi';
import { AUTH_REQUIRED_EVENT } from '../services/authApi';
import { useUIStore } from '../store/useUIStore';
import { useViewportTableHeight } from '../hooks/useViewportTableHeight';
import { formatDisplayDate, formatNumberWithComma } from '../utils/displayFormat';

const { Text, Title } = Typography;

const moduleLabels: Record<WorkspaceModuleCode, string> = {
  CONFERENCE: 'Conference',
  PATENT_ANALYSIS: '특허 분석',
  SAR_TABLE: 'SAR Table',
  DESIGN: 'Design',
  SYNTHESIS: '합성 관리',
};
const moduleCodes = Object.keys(moduleLabels) as WorkspaceModuleCode[];

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
  const { hasPermission } = useAccessContext();
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
  const [teams, setTeams] = useState<TeamAccessItem[]>([]);
  const [teamAccessOpen, setTeamAccessOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>();
  const [teamAccessDraft, setTeamAccessDraft] =
    useState<Record<WorkspaceModuleCode, TeamModuleAccess> | null>(null);
  const [savingTeamAccess, setSavingTeamAccess] = useState(false);
  const [syncingTeams, setSyncingTeams] = useState(false);
  const { tableBodyHeight, tableRegionRef, tableRegionStyle } = useViewportTableHeight();
  const canManageUsers = hasPermission('userAccess.manage');

  useEffect(() => {
    setHeaderContent(
      <PageHeaderBreadcrumb items={[{ label: '사용자 접근 관리' }]} />,
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  const loadUsers = useCallback(async () => {
    if (!canManageUsers) return;
    setLoading(true);
    setError('');
    try {
      const [nextUsers, teamAccess] = await Promise.all([
        adminAccessApi.listUsers(),
        adminAccessApi.listTeamAccess(),
      ]);
      setUsers(nextUsers);
      setTeams(teamAccess.teams);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [canManageUsers]);

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
      adminRoles: user.adminRoles,
      status: user.status,
      reason: '',
    });
  };

  const closeAccessModal = () => {
    if (saving) return;
    setEditingUser(null);
    form.resetFields();
  };

  const selectTeamAccess = (teamId: string) => {
    const team = teams.find((candidate) => candidate.id === teamId);
    setSelectedTeamId(teamId);
    setTeamAccessDraft(team ? structuredClone(team.modules) : null);
  };

  const openTeamAccess = () => {
    const initialTeamId = selectedTeamId ?? teams[0]?.id;
    setTeamAccessOpen(true);
    if (initialTeamId) selectTeamAccess(initialTeamId);
  };

  const updateTeamAccessDraft = (
    module: WorkspaceModuleCode,
    field: keyof TeamModuleAccess,
    checked: boolean,
  ) => {
    setTeamAccessDraft((current) => {
      if (!current) return current;
      const nextAccess = { ...current[module], [field]: checked };
      if (field === 'canManage' && checked) {
        nextAccess.canRead = true;
        nextAccess.canWrite = true;
      }
      if (field === 'canWrite' && checked) nextAccess.canRead = true;
      if (field === 'canRead' && !checked) {
        nextAccess.canWrite = false;
        nextAccess.canManage = false;
      }
      if (field === 'canWrite' && !checked) nextAccess.canManage = false;
      return {
        ...current,
        [module]: nextAccess,
      };
    });
  };

  const saveTeamAccess = async () => {
    if (!selectedTeamId || !teamAccessDraft) return;
    setSavingTeamAccess(true);
    try {
      const updated = await adminAccessApi.updateTeamModules(
        selectedTeamId,
        teamAccessDraft,
      );
      setTeams((current) => current.map((team) =>
        team.id === updated.id ? { ...team, modules: updated.modules } : team));
      setTeamAccessOpen(false);
      void message.success('팀별 모듈 접근 권한을 변경했습니다.');
    } catch (saveError) {
      void message.error(getErrorMessage(saveError));
    } finally {
      setSavingTeamAccess(false);
    }
  };

  const reconcileTeams = async () => {
    setSyncingTeams(true);
    try {
      const result = await adminAccessApi.reconcileTeamAccess();
      setTeams(result.teams);
      if (selectedTeamId && !result.teams.some((team) => team.id === selectedTeamId)) {
        setSelectedTeamId(undefined);
        setTeamAccessDraft(null);
      }
      void message.success('Groupware 팀 정보를 동기화했습니다.');
    } catch (syncError) {
      void message.error(getErrorMessage(syncError));
    } finally {
      setSyncingTeams(false);
    }
  };

  const saveAccess = async () => {
    if (!editingUser) return;
    let values: AccessFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const currentRoles = [...editingUser.adminRoles].sort().join(',');
    const nextRoles = [...values.adminRoles].sort().join(',');
    if (nextRoles === currentRoles && values.status === editingUser.status) {
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
      title: '팀',
      dataIndex: 'team',
      width: 180,
      align: 'center',
      ellipsis: true,
      render: (team: string | null) => (
        team
          ? (
            <Text
              ellipsis={{ tooltip: team }}
              style={{ display: 'block', maxWidth: '100%' }}
            >
              {team}
            </Text>
          )
          : <Text type="secondary">-</Text>
      ),
    },
    {
      title: '역할',
      dataIndex: 'adminRoles',
      width: 260,
      align: 'center',
      render: (roles: WorkspaceAdminRole[], user) => roles.length > 0
        ? (
          <Space size={[4, 4]} wrap>
            {roles.map((role) => <Tag key={role} color="orange">{role}</Tag>)}
          </Space>
        )
        : <Tag>USER</Tag>,
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

  if (!canManageUsers) return <Navigate to="/dashboard" replace />;

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
        <Space>
          <Button onClick={() => void reconcileTeams()} loading={syncingTeams}>
            팀 동기화
          </Button>
          <Button onClick={openTeamAccess} disabled={teams.length === 0}>
            팀별 접근 설정
          </Button>
          <Button icon={<RefreshCw size={15} />} onClick={() => void loadUsers()} loading={loading}>
            새로고침
          </Button>
        </Space>
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
        <div ref={tableRegionRef} style={tableRegionStyle}>
          <Table<AdminUser>
            className="access-registry-table viewport-fill-table"
            rowKey="id"
            columns={columns}
            dataSource={filteredUsers}
            loading={loading}
            size="small"
            scroll={{ x: 1_220, y: tableBodyHeight }}
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
          <Form.Item name="adminRoles" label="관리 역할">
            <Select
              mode="multiple"
              allowClear
              placeholder="일반 사용자는 관리 역할을 선택하지 않습니다."
              options={[
                { value: 'SUPER_ADMIN', label: 'Super Admin' },
                { value: 'CONFERENCE_ADMIN', label: 'Conference 관리자' },
                { value: 'PATENT_ANALYSIS_ADMIN', label: '특허 분석 관리자' },
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

      <Modal
        title="팀별 모듈 접근 설정"
        open={teamAccessOpen}
        width={760}
        onCancel={() => !savingTeamAccess && setTeamAccessOpen(false)}
        onOk={() => void saveTeamAccess()}
        okText="저장"
        cancelText="취소"
        confirmLoading={savingTeamAccess}
        okButtonProps={{ disabled: !selectedTeamId || !teamAccessDraft }}
      >
        <Select
          value={selectedTeamId}
          onChange={selectTeamAccess}
          options={teams.map((team) => ({
            value: team.id,
            label: `${team.name} (${formatNumberWithComma(team.memberCount)}명)`,
          }))}
          placeholder="팀 선택"
          style={{ width: 'min(360px, 100%)', marginBottom: 16 }}
        />
        <Table
          rowKey="module"
          size="small"
          pagination={false}
          dataSource={moduleCodes.map((module) => ({ module }))}
          columns={[
            {
              title: '모듈',
              dataIndex: 'module',
              render: (module: WorkspaceModuleCode) => moduleLabels[module],
            },
            ...([
              ['canRead', '조회'],
              ['canWrite', '작성/수정'],
              ['canManage', '관리'],
            ] as const).map(([field, label]) => ({
              title: label,
              key: field,
              align: 'center' as const,
              width: 120,
              render: (_: unknown, row: { module: WorkspaceModuleCode }) => (
                <Checkbox
                  checked={teamAccessDraft?.[row.module][field] ?? false}
                  onChange={(event) =>
                    updateTeamAccessDraft(row.module, field, event.target.checked)}
                />
              ),
            })),
          ]}
        />
      </Modal>
    </div>
  );
};

export default AccessRegistry;
