import React from 'react';
import {
  Alert,
  App,
  Button,
  Empty,
  Modal,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import { Mail, Plus, RotateCcw } from 'lucide-react';
import {
  patentAnalysisApi,
  type PatentNotificationPreferences,
  type PatentNotificationTarget,
} from '../../services/patentAnalysisApi';

const { Text, Title } = Typography;

type PatentNotificationSettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

const normalizeTargetName = (value: string) => value.trim().toLowerCase();

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const targetSearchText = (target: PatentNotificationTarget) =>
  [target.targetName, ...target.keywords].join(' ').toLowerCase();

const PatentNotificationSettingsModal: React.FC<PatentNotificationSettingsModalProps> = ({
  open,
  onClose,
}) => {
  const { message, modal } = App.useApp();
  const { token } = theme.useToken();
  const [preferences, setPreferences] = React.useState<PatentNotificationPreferences | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [updatingEnabled, setUpdatingEnabled] = React.useState(false);
  const [mutatingTarget, setMutatingTarget] = React.useState<string | null>(null);
  const [requestingTarget, setRequestingTarget] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const targetMutationLockRef = React.useRef(false);

  const loadPreferences = React.useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await patentAnalysisApi.getNotificationPreferences({ signal });
      setPreferences(result);
    } catch (error) {
      if (signal?.aborted) return;
      setLoadError(errorMessage(error, '신규 특허 메일 설정을 불러오지 못했습니다.'));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setPreferences(null);
    setSearchValue('');
    void loadPreferences(controller.signal);
    return () => controller.abort();
  }, [loadPreferences, open]);

  const selectedTargetKeys = React.useMemo(
    () => new Set(
      (preferences?.selectedTargets ?? []).map((target) =>
        normalizeTargetName(target.targetName)),
    ),
    [preferences?.selectedTargets],
  );

  const availableOptions = React.useMemo(() => {
    const query = normalizeTargetName(searchValue);
    return (preferences?.availableTargets ?? [])
      .filter((target) => !selectedTargetKeys.has(normalizeTargetName(target.targetName)))
      .filter((target) => !query || targetSearchText(target).includes(query))
      .map((target) => ({
        value: target.targetName,
        label: (
          <div>
            <Text>{target.targetName}</Text>
            {target.keywords.length > 0 && (
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                {target.keywords.join(', ')}
              </Text>
            )}
          </div>
        ),
      }));
  }, [preferences?.availableTargets, searchValue, selectedTargetKeys]);

  const enterTarget = React.useMemo(() => {
    const query = normalizeTargetName(searchValue);
    if (!query || !preferences) return null;
    const selectableTargets = preferences.availableTargets.filter(
      (target) => !selectedTargetKeys.has(normalizeTargetName(target.targetName)),
    );
    const exactTarget = selectableTargets.find(
      (target) => normalizeTargetName(target.targetName) === query,
    );
    if (exactTarget) return exactTarget.targetName;
    return availableOptions.length === 1 ? availableOptions[0].value : null;
  }, [availableOptions, preferences, searchValue, selectedTargetKeys]);

  const canRequestNewTarget = React.useMemo(() => {
    const query = normalizeTargetName(searchValue);
    if (!query || !preferences) return false;
    return ![
      ...preferences.availableTargets,
      ...preferences.selectedTargets,
    ].some((target) => targetSearchText(target).includes(query));
  }, [preferences, searchValue]);

  const mutationDisabled = !preferences?.enabled
    || updatingEnabled
    || Boolean(mutatingTarget)
    || requestingTarget;

  const handleEnabledChange = async (enabled: boolean) => {
    if (!preferences || updatingEnabled) return;
    setUpdatingEnabled(true);
    try {
      const result = await patentAnalysisApi.updateNotificationPreference(enabled);
      setPreferences(result);
      void message.success(enabled
        ? '신규 특허 메일 수신을 시작합니다.'
        : '신규 특허 메일 수신을 중지했습니다.');
    } catch (error) {
      void message.error(errorMessage(error, '메일 수신 설정을 변경하지 못했습니다.'));
    } finally {
      setUpdatingEnabled(false);
    }
  };

  const handleAddTarget = async (targetName: string) => {
    if (!preferences?.enabled || targetMutationLockRef.current) return;
    targetMutationLockRef.current = true;
    setMutatingTarget(targetName);
    try {
      const result = await patentAnalysisApi.addNotificationTarget(targetName);
      setPreferences(result);
      setSearchValue('');
      void message.success(`${targetName} 타겟을 추가했습니다.`);
    } catch (error) {
      void message.error(errorMessage(error, '관심 타겟을 추가하지 못했습니다.'));
    } finally {
      targetMutationLockRef.current = false;
      setMutatingTarget(null);
    }
  };

  const handleRemoveTarget = async (target: PatentNotificationTarget) => {
    if (!preferences?.enabled || targetMutationLockRef.current) return;
    targetMutationLockRef.current = true;
    setMutatingTarget(target.targetName);
    try {
      const result = await patentAnalysisApi.removeNotificationTarget(target.targetName);
      setPreferences(result);
      void message.success(target.pending
        ? `${target.targetName} 신규 타겟 요청을 취소했습니다.`
        : `${target.targetName} 타겟을 제거했습니다.`);
    } catch (error) {
      void message.error(errorMessage(
        error,
        target.pending
          ? '신규 타겟 요청을 취소하지 못했습니다.'
          : '관심 타겟을 제거하지 못했습니다.',
      ));
    } finally {
      targetMutationLockRef.current = false;
      setMutatingTarget(null);
    }
  };

  const requestNewTarget = async (targetName: string, rethrowOnError = false) => {
    setRequestingTarget(true);
    try {
      const result = await patentAnalysisApi.requestNotificationTarget(targetName);
      setPreferences(result);
      setSearchValue('');
      void message.success(`${targetName} 타겟 승인을 요청했습니다.`);
    } catch (error) {
      void message.error(errorMessage(error, '신규 타겟을 요청하지 못했습니다.'));
      if (rethrowOnError) throw error;
    } finally {
      setRequestingTarget(false);
    }
  };

  const handleRequestNewTarget = () => {
    const targetName = searchValue.trim();
    if (!targetName || !canRequestNewTarget || requestingTarget) return;
    modal.confirm({
      title: '신규 타겟 요청',
      content: (
        <Text>
          <Text strong>{targetName}</Text> 타겟의 등록 승인을 요청하시겠습니까?
        </Text>
      ),
      okText: '요청',
      cancelText: '취소',
      onOk: () => requestNewTarget(targetName, true),
    });
  };

  const handleTargetInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || mutationDisabled) return;
    if (!enterTarget && !canRequestNewTarget) return;
    event.preventDefault();
    event.stopPropagation();
    if (enterTarget) {
      void handleAddTarget(enterTarget);
      return;
    }
    void requestNewTarget(searchValue.trim());
  };

  return (
    <Modal
      title={(
        <Space size={8} align="center">
          <Mail size={18} style={{ display: 'block', flexShrink: 0 }} />
          <span style={{ lineHeight: 1.2 }}>신규 특허 메일 받기</span>
        </Space>
      )}
      open={open}
      onCancel={onClose}
      width={680}
      destroyOnHidden
      footer={(
        <Button onClick={onClose}>
          닫기
        </Button>
      )}
    >
      {loading && !preferences ? (
        <div style={{ minHeight: 240, display: 'grid', placeItems: 'center' }}>
          <Space direction="vertical" size={10} align="center">
            <Spin />
            <Text type="secondary">메일 설정을 불러오는 중입니다.</Text>
          </Space>
        </div>
      ) : loadError && !preferences ? (
        <Alert
          type="error"
          showIcon
          message="메일 설정을 불러오지 못했습니다."
          description={loadError}
          action={(
            <Button
              size="small"
              icon={<RotateCcw size={14} />}
              onClick={() => void loadPreferences()}
            >
              다시 시도
            </Button>
          )}
        />
      ) : preferences ? (
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          {loadError && (
            <Alert
              type="warning"
              showIcon
              message={loadError}
              action={(
                <Button size="small" onClick={() => void loadPreferences()}>
                  다시 시도
                </Button>
              )}
            />
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 20,
              padding: '16px 18px',
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadiusLG,
              background: token.colorFillAlter,
            }}
          >
            <div>
              <Title level={5} style={{ margin: 0 }}>
                신규 특허 메일 받기
              </Title>
              <Text type="secondary">
                선택한 타겟의 신규 특허 알림을 메일로 받습니다.
              </Text>
            </div>
            <Switch
              checked={preferences.enabled}
              loading={updatingEnabled}
              disabled={Boolean(mutatingTarget) || requestingTarget}
              onChange={(checked) => void handleEnabledChange(checked)}
              aria-label="신규 특허 메일 수신"
            />
          </div>

          <div style={{ opacity: preferences.enabled ? 1 : 0.55 }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Text strong>관심 타겟 추가</Text>
              <Select
                showSearch
                allowClear
                value={undefined}
                searchValue={searchValue}
                onSearch={setSearchValue}
                onClear={() => setSearchValue('')}
                onChange={(value) => void handleAddTarget(value)}
                onInputKeyDown={handleTargetInputKeyDown}
                filterOption={false}
                options={availableOptions}
                disabled={mutationDisabled}
                loading={Boolean(mutatingTarget)}
                placeholder={preferences.enabled
                  ? '타겟 이름 또는 키워드 검색'
                  : '메일 수신을 켜면 타겟을 변경할 수 있습니다.'}
                notFoundContent={(
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="검색 결과가 없습니다."
                  />
                )}
                style={{ width: '100%' }}
              />
              {canRequestNewTarget && (
                <Button
                  type="link"
                  icon={<Plus size={15} />}
                  disabled={mutationDisabled}
                  loading={requestingTarget}
                  onClick={handleRequestNewTarget}
                  style={{ alignSelf: 'flex-start', paddingInline: 0 }}
                >
                  ‘{searchValue.trim()}’ 신규 타겟 요청
                </Button>
              )}
            </Space>
          </div>

          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Text strong>선택된 타겟</Text>
            <div
              style={{
                minHeight: 58,
                maxHeight: 100,
                overflowY: 'auto',
                padding: 12,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: token.borderRadius,
                background: token.colorBgContainer,
                opacity: preferences.enabled ? 1 : 0.55,
              }}
            >
              {preferences.selectedTargets.length > 0 ? (
                <Space size={[6, 8]} wrap>
                  {preferences.selectedTargets.map((target) => (
                    <Tooltip
                      key={normalizeTargetName(target.targetName)}
                      title={target.pending ? '신규 타겟 요청 취소' : '관심 타겟 제거'}
                    >
                      <Tag
                        color={target.pending ? 'gold' : 'blue'}
                        closable={!mutationDisabled}
                        onClose={(event) => {
                          event.preventDefault();
                          void handleRemoveTarget(target);
                        }}
                      >
                        {target.targetName}
                        {target.pending ? ' · 승인 대기' : ''}
                      </Tag>
                    </Tooltip>
                  ))}
                </Space>
              ) : (
                <Text type="secondary">선택된 관심 타겟이 없습니다.</Text>
              )}
            </div>
            {!preferences.enabled && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                메일 수신을 꺼도 선택한 타겟은 유지됩니다.
              </Text>
            )}
          </Space>
        </Space>
      ) : null}
    </Modal>
  );
};

export default PatentNotificationSettingsModal;
