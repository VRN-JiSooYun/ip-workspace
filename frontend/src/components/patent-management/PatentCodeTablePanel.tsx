import React, { useCallback, useEffect, useState } from 'react';
import {
  App as AntApp,
  Button,
  Empty,
  Input,
  InputNumber,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { TableColumnsType } from 'antd';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  patentCodeApi,
  type PatentCodeItem,
  type PatentCodeType,
} from '../../services/patentRecordApi';
import { CountryFlag } from '../common/CountryTag';
import { getCountryLabel } from '../../utils/countryLabel';

const { Text } = Typography;

export type PatentCodeTabConfig = {
  type: PatentCodeType;
  label: string;
  /** 표시값 컬럼의 제목. */
  valueLabel: string;
  valuePlaceholder: string;
  /** attorney만 PK를 직접 입력받는다. */
  manualId: boolean;
  idLabel: string;
};

export const PATENT_CODE_TABS: PatentCodeTabConfig[] = [
  {
    type: 'countries',
    label: '국가',
    valueLabel: '국가',
    valuePlaceholder: 'KR',
    manualId: false,
    idLabel: 'ID',
  },
  {
    type: 'attorneys',
    label: '대리인',
    valueLabel: '대리인명',
    valuePlaceholder: '홍길동 특허법인',
    manualId: true,
    idLabel: '대리인번호',
  },
  {
    type: 'legal-statuses',
    label: '법적 상태',
    valueLabel: '상태',
    valuePlaceholder: '등록',
    manualId: false,
    idLabel: 'ID',
  },
  {
    type: 'targets',
    label: 'Target',
    valueLabel: 'Target',
    valuePlaceholder: 'EGFR',
    manualId: false,
    idLabel: 'ID',
  },
  {
    type: 'applicants',
    label: '출원인',
    valueLabel: '출원인',
    valuePlaceholder: '보로노이 주식회사',
    manualId: false,
    idLabel: 'ID',
  },
  {
    type: 'inventors',
    label: '발명자',
    valueLabel: '발명자',
    valuePlaceholder: '홍길동',
    manualId: false,
    idLabel: 'ID',
  },
];

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

/** `PATENT_CODE_IN_USE:12` 형태의 코드를 사람이 읽을 문장으로 바꾼다. */
const describeError = (error: unknown): string => {
  const raw = getErrorMessage(error);
  const inUse = /^PATENT_CODE_IN_USE:(\d+)$/.exec(raw);
  if (inUse) {
    return `특허 ${inUse[1]}건이 사용 중이라 삭제할 수 없습니다. 해당 특허의 값을 먼저 바꿔주세요.`;
  }
  if (raw === 'PATENT_COUNTRY_DUPLICATED') return '이미 등록된 국가입니다.';
  if (raw === 'PATENT_TARGET_DUPLICATED') return '이미 등록된 Target입니다.';
  if (raw === 'PATENT_APPLICANT_DUPLICATED') return '이미 등록된 출원인입니다.';
  if (raw === 'PATENT_INVENTOR_DUPLICATED') return '이미 등록된 발명자입니다.';
  if (raw === 'PATENT_INVENTOR_MULTIPLE_VALUES') {
    return '발명자는 사람 한 명씩 등록해 주세요.';
  }
  if (raw === 'PATENT_ATTORNEY_NUMBER_DUPLICATED') {
    return '이미 등록된 대리인번호입니다.';
  }
  if (raw === 'PATENT_ATTORNEY_NUMBER_REQUIRED') {
    return '대리인번호를 입력해 주세요.';
  }
  if (raw === 'PATENT_CODE_VALUE_REQUIRED') return '값을 입력해 주세요.';
  return raw;
};

type Props = {
  config: PatentCodeTabConfig;
  canManage: boolean;
  /** 세로 스크롤 높이. 페이지와 모달에서 다르게 준다. */
  scrollY?: number;
  /** 코드가 바뀌었을 때. 부모가 캐시한 select 옵션을 버리는 데 쓴다. */
  onChanged?: () => void;
};

const PatentCodeTablePanel: React.FC<Props> = ({
  config,
  canManage,
  scrollY = 420,
  onChanged,
}) => {
  const { message, modal } = AntApp.useApp();
  const [items, setItems] = useState<PatentCodeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newId, setNewId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await patentCodeApi.list(config.type));
    } catch (loadError) {
      setItems([]);
      setError(describeError(loadError));
    } finally {
      setLoading(false);
    }
  }, [config.type]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    const value = newValue.trim();
    if (!value) {
      void message.warning('값을 입력해 주세요.');
      return;
    }
    if (config.manualId && newId === null) {
      void message.warning(`${config.idLabel}를 입력해 주세요.`);
      return;
    }
    setBusy(true);
    try {
      await patentCodeApi.create(config.type, {
        value,
        ...(config.manualId && newId !== null ? { id: newId } : {}),
      });
      setNewValue('');
      setNewId(null);
      void message.success('추가했습니다.');
      onChanged?.();
      await load();
    } catch (createError) {
      void message.error(describeError(createError));
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (item: PatentCodeItem) => {
    const value = editingValue.trim();
    if (!value) {
      void message.warning('값을 입력해 주세요.');
      return;
    }
    if (value === item.value) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    try {
      await patentCodeApi.update(config.type, item.id, { value });
      setEditingId(null);
      void message.success('변경했습니다.');
      onChanged?.();
      await load();
    } catch (updateError) {
      void message.error(describeError(updateError));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (item: PatentCodeItem) => {
    if (item.usageCount > 0) {
      void message.warning(
        `특허 ${item.usageCount}건이 사용 중이라 삭제할 수 없습니다.`,
      );
      return;
    }
    modal.confirm({
      title: '코드를 삭제할까요?',
      content: `${config.valueLabel} "${item.value}"`,
      okText: '삭제',
      okButtonProps: { danger: true },
      cancelText: '취소',
      onOk: async () => {
        try {
          await patentCodeApi.remove(config.type, item.id);
          void message.success('삭제했습니다.');
          onChanged?.();
          await load();
        } catch (deleteError) {
          void message.error(describeError(deleteError));
          throw deleteError;
        }
      },
    });
  };

  /** 코드만으로는 어느 나라인지 알기 어려우므로 아는 코드에 한해 국기와 이름을 붙인다. */
  const countryHint = (code: string) => {
    const country = getCountryLabel(code);
    if (!country.known) return null;
    return (
      <span className="pm-code-country-hint">
        <CountryFlag code={country.code} />
        <Text type="secondary">{country.name}</Text>
      </span>
    );
  };

  const columns: TableColumnsType<PatentCodeItem> = [
    { title: config.idLabel, dataIndex: 'id', key: 'id', width: 110 },
    {
      title: config.valueLabel,
      key: 'value',
      render: (_, item) =>
        editingId === item.id ? (
          <Input
            autoFocus
            size="small"
            value={editingValue}
            disabled={busy}
            onChange={(event) => setEditingValue(event.target.value)}
            onPressEnter={() => void handleUpdate(item)}
          />
        ) : (
          // 국가 탭은 코드가 원본이므로 코드를 그대로 두고 한국어 이름만 덧붙인다.
          item.value
            ? (
              <span className="pm-code-value">
                {item.value}
                {config.type === 'countries' && countryHint(item.value)}
              </span>
            )
            : <Text type="secondary">(비어 있음)</Text>
        ),
    },
    {
      title: '사용 중',
      dataIndex: 'usageCount',
      key: 'usageCount',
      width: 96,
      align: 'center',
      render: (usageCount: number) =>
        usageCount > 0 ? <Tag color="blue">{usageCount}건</Tag> : <Text type="secondary">-</Text>,
    },
    ...(canManage
      ? [
          {
            title: '',
            key: 'actions',
            width: 88,
            align: 'center' as const,
            render: (_: unknown, item: PatentCodeItem) =>
              editingId === item.id ? (
                <span style={{ display: 'inline-flex', gap: 2 }}>
                  <Tooltip title="저장">
                    <Button
                      type="text"
                      size="small"
                      aria-label="저장"
                      loading={busy}
                      icon={<Check size={15} />}
                      onClick={() => void handleUpdate(item)}
                    />
                  </Tooltip>
                  <Tooltip title="취소">
                    <Button
                      type="text"
                      size="small"
                      aria-label="취소"
                      icon={<X size={15} />}
                      onClick={() => setEditingId(null)}
                    />
                  </Tooltip>
                </span>
              ) : (
                <span style={{ display: 'inline-flex', gap: 2 }}>
                  <Tooltip title="변경">
                    <Button
                      type="text"
                      size="small"
                      aria-label={`${item.value} 변경`}
                      icon={<Pencil size={15} />}
                      onClick={() => {
                        setEditingId(item.id);
                        setEditingValue(item.value);
                      }}
                    />
                  </Tooltip>
                  <Tooltip title={item.usageCount > 0 ? '사용 중이라 삭제할 수 없습니다' : '삭제'}>
                    <Button
                      type="text"
                      size="small"
                      danger
                      aria-label={`${item.value} 삭제`}
                      disabled={item.usageCount > 0}
                      icon={<Trash2 size={15} />}
                      onClick={() => handleDelete(item)}
                    />
                  </Tooltip>
                </span>
              ),
          },
        ]
      : []),
  ];

  return (
    <div>
      {canManage && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, maxWidth: 640 }}>
          {config.manualId && (
            <InputNumber
              placeholder={config.idLabel}
              value={newId}
              onChange={setNewId}
              disabled={busy}
              style={{ width: 140 }}
            />
          )}
          <Input
            placeholder={config.valuePlaceholder}
            value={newValue}
            disabled={busy}
            onChange={(event) => setNewValue(event.target.value)}
            onPressEnter={() => void handleCreate()}
          />
          <Button
            type="primary"
            icon={<Plus size={14} />}
            loading={busy}
            onClick={() => void handleCreate()}
          >
            추가
          </Button>
        </div>
      )}

      <Table<PatentCodeItem>
        columns={columns}
        dataSource={items}
        rowKey="id"
        size="small"
        loading={loading}
        pagination={false}
        scroll={{ y: scrollY }}
        locale={{
          emptyText: error ? (
            <Empty description={`불러오지 못했습니다: ${error}`} />
          ) : (
            <Empty description="등록된 코드가 없습니다." />
          ),
        }}
      />
    </div>
  );
};

export default PatentCodeTablePanel;
