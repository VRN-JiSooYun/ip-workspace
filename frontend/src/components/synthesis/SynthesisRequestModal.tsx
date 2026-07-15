import React from 'react';
import {
  App as AntApp,
  Cascader,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Typography,
  theme,
} from 'antd';
import CompoundStructureView from '../common/CompoundStructureView';
import PlainMemoEditor from '../common/PlainMemoEditor';
import { formatDisplayDate } from '../../utils/displayFormat';

const { Text } = Typography;
const SYNTHESIS_REQUEST_COUNTER_STORAGE_PREFIX = 'my-board:synthesis-request-counter';
const SYNTHESIS_REQUEST_PREFIX = 'LYH';
const SYNTHESIS_SITE_OPTIONS = ['In-house', 'Wuxi'] as const;
const designPurposeOptions = [
  {
    value: '신규 컨셉 탐색',
    label: '신규 컨셉 탐색',
    children: ['신규 코어', '포켓 확장', '공유 결합'].map((label) => ({ value: label, label })),
  },
  {
    value: '활성/물성 최적화',
    label: '활성/물성 최적화',
    children: ['활성', '선택성', '뇌투과', '용해도', 'PPB', 'MS', 'CYP', 'hERG', 'PK', 'Salt formation/charge']
      .map((label) => ({ value: label, label })),
  },
  { value: '레퍼런스', label: '레퍼런스' },
  { value: 'in vivo', label: 'in vivo' },
  { value: '특허 대응', label: '특허 대응' },
];
const designExpansionOptions = [
  { value: '컨셉 확인 (5종 이하)', label: '컨셉 확인 (5종 이하)' },
  { value: '컨셉 확장 (10종 이상)', label: '컨셉 확장 (10종 이상)' },
  { value: '컨셉 집중 (50종 이상)', label: '컨셉 집중 (50종 이상)' },
  {
    value: '기타',
    label: '기타',
    children: ['PK', 'in vivo', '재합성', '레퍼런스', '스케일업'].map((label) => ({ value: label, label })),
  },
];

type CascaderValue = (string | number)[];

export type SynthesisRequestTarget = {
  id: string;
  groupId: string;
  compoundId?: string;
  designNo?: string;
  name: string;
  smiles?: string;
  structureSvg?: string;
  project?: string;
  designMemo?: string;
  assayPurpose?: string;
  synthesisStep?: string;
  synthesisExpansionLevel?: string;
  expectedEffect?: string;
  requestMemo?: string;
  progressMemo?: string;
  requiredAmountMg?: number;
  synthesisRequestStatus?: 'requested' | 'accepted' | 'synthesizing' | 'vnaIssued';
  synthesisRequestType?: string;
  synthesisSite?: string;
};

export type SynthesisRequestUpdate = Partial<SynthesisRequestTarget> & {
  requestDate: string;
  synthesisOwner: string;
};

type SynthesisRequestFormValues = {
  synthesisRequestNo?: string;
  requiredAmountMg?: number;
  synthesisReferenceName?: string;
  expectedEffect?: string;
  requestMemo?: string;
  synthesisRequestType?: string;
};

type SynthesisRequestModalProps = {
  open: boolean;
  target: SynthesisRequestTarget | null;
  groupName: string;
  groupTarget?: string;
  requesterName?: string;
  onClose: () => void;
  onSubmit: (targetId: string, update: SynthesisRequestUpdate) => void;
  onCancelRequest: (targetId: string) => void;
};

const getCurrentYearSuffix = () => String(new Date().getFullYear()).slice(-2);
const getCounterStorageKey = (year: string) => (
  `${SYNTHESIS_REQUEST_COUNTER_STORAGE_PREFIX}:${SYNTHESIS_REQUEST_PREFIX}:${year}`
);
const readCounter = (year: string) => {
  if (typeof window === 'undefined') return 0;
  const value = Number(window.localStorage.getItem(getCounterStorageKey(year)) || '0');
  return Number.isFinite(value) ? value : 0;
};
const formatRequestNumber = (year: string, sequence: number) => (
  `${SYNTHESIS_REQUEST_PREFIX}-${year}-${String(sequence).padStart(4, '0')}`
);
const isRequestNumber = (value?: string) => (
  new RegExp(`^${SYNTHESIS_REQUEST_PREFIX}-\\d{2}-\\d{4}$`).test(String(value || '').trim())
);
const peekNextRequestNumber = () => {
  const year = getCurrentYearSuffix();
  return formatRequestNumber(year, readCounter(year) + 1);
};
const reserveNextRequestNumber = () => {
  const year = getCurrentYearSuffix();
  const sequence = readCounter(year) + 1;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(getCounterStorageKey(year), String(sequence));
  }
  return formatRequestNumber(year, sequence);
};
const normalizeMemo = (value: unknown) => {
  const html = String(value ?? '').trim();
  if (!html || html === '<p><br></p>') return '-';
  const plainText = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return plainText ? html : '-';
};
const getLeafLabel = (path: CascaderValue) => String(path[path.length - 1] ?? '');
const parseCascaderText = (
  value: string | undefined,
  options: Array<{ value: string; children?: Array<{ value: string }> }>,
) => {
  const resolvePath = (label: string): CascaderValue => {
    const root = options.find((option) => option.value === label);
    if (root) return [root.value];
    for (const option of options) {
      const child = option.children?.find((item) => item.value === label);
      if (child) return [option.value, child.value];
    }
    return [label];
  };

  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item && item !== '-' && !item.startsWith('레퍼런스:'))
    .map(resolvePath);
};

const SynthesisRequestModal: React.FC<SynthesisRequestModalProps> = ({
  open,
  target,
  groupName,
  groupTarget,
  requesterName = '문태훈',
  onClose,
  onSubmit,
  onCancelRequest,
}) => {
  const { token } = theme.useToken();
  const { modal } = AntApp.useApp();
  const [form] = Form.useForm<SynthesisRequestFormValues>();
  const formValues = Form.useWatch([], form) as SynthesisRequestFormValues | undefined;
  const referenceName = Form.useWatch('synthesisReferenceName', form) as string | undefined;
  const [purposePaths, setPurposePaths] = React.useState<CascaderValue[]>([]);
  const [stepPaths, setStepPaths] = React.useState<CascaderValue[]>([]);
  const isReadOnly = target?.synthesisRequestStatus === 'requested';
  const isReferenceSelected = purposePaths.some((path) => path.includes('레퍼런스'));
  const isSubmitEnabled = Boolean(
    String(formValues?.synthesisRequestNo ?? '').trim()
    && Number(formValues?.requiredAmountMg) > 0
    && purposePaths.length > 0
    && stepPaths.length > 0
    && normalizeMemo(formValues?.expectedEffect) !== '-'
    && String(formValues?.synthesisRequestType ?? '').trim()
  );

  React.useEffect(() => {
    if (!open || !target) return;
    const parsedReferenceName = String(target.assayPurpose || '').match(/레퍼런스:\s*([^,]+)/)?.[1]?.trim();
    const parsedPurposes = parseCascaderText(target.assayPurpose, designPurposeOptions);
    setPurposePaths(parsedReferenceName ? [...parsedPurposes, ['레퍼런스']] : parsedPurposes);
    setStepPaths(parseCascaderText(target.synthesisStep || target.synthesisExpansionLevel, designExpansionOptions));
    form.setFieldsValue({
      synthesisRequestNo: isRequestNumber(target.progressMemo) ? target.progressMemo : peekNextRequestNumber(),
      requiredAmountMg: target.requiredAmountMg && target.requiredAmountMg > 0 ? target.requiredAmountMg : undefined,
      synthesisReferenceName: parsedReferenceName,
      expectedEffect: target.expectedEffect === '-' ? '' : target.expectedEffect,
      requestMemo: target.requestMemo === '-' ? '' : target.requestMemo,
      synthesisRequestType: target.synthesisSite || target.synthesisRequestType,
    });
  }, [form, open, target]);

  const closeModal = () => {
    setPurposePaths([]);
    setStepPaths([]);
    form.resetFields();
    onClose();
  };

  const submitRequest = async () => {
    if (!target) return;
    const values = await form.validateFields();
    const requestNumber = isRequestNumber(target.progressMemo)
      ? String(values.synthesisRequestNo || target.progressMemo).trim()
      : reserveNextRequestNumber();
    const normalizedReferenceName = values.synthesisReferenceName?.trim();
    const purposeText = [
      ...purposePaths.map(getLeafLabel).filter((label) => label && label !== '레퍼런스'),
      normalizedReferenceName ? `레퍼런스: ${normalizedReferenceName}` : '',
      !normalizedReferenceName && isReferenceSelected ? '레퍼런스' : '',
    ].filter(Boolean).join(', ');

    onSubmit(target.id, {
      requiredAmountMg: Number(values.requiredAmountMg) || 0,
      assayPurpose: purposeText || '-',
      expectedEffect: normalizeMemo(values.expectedEffect),
      requestMemo: normalizeMemo(values.requestMemo),
      progressMemo: requestNumber,
      requestDate: formatDisplayDate(new Date().toISOString()),
      synthesisOwner: requesterName,
      synthesisRequestStatus: 'requested',
      synthesisRequestType: String(values.synthesisRequestType || '').trim(),
      synthesisSite: String(values.synthesisRequestType || '').trim(),
      synthesisStep: stepPaths.map(getLeafLabel).filter(Boolean).join(', ') || '-',
    });
    closeModal();
  };

  const cancelRequest = () => {
    if (!target) return;
    modal.confirm({
      title: '합성 요청을 취소할까요?',
      content: `${target.designNo || target.name} 요청 완료 상태를 취소합니다.`,
      okText: '요청 취소',
      cancelText: '닫기',
      okButtonProps: { danger: true },
      onOk: () => {
        onCancelRequest(target.id);
        closeModal();
      },
    });
  };

  const memoPreview = (value?: string) => (
    <div className="synthesis-request-readonly-memo-preview">
      {value && value !== '-' ? value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim() : '-'}
    </div>
  );

  return (
    <>
      <Modal
        title="화합물 합성 요청"
        open={open}
        onCancel={closeModal}
        onOk={() => {
          if (isReadOnly) {
            cancelRequest();
            return;
          }
          void submitRequest();
        }}
        okText={isReadOnly ? '요청 취소' : '요청'}
        cancelText="닫기"
        width={880}
        className="synthesis-request-modal"
        okButtonProps={{ danger: isReadOnly, disabled: isReadOnly ? !target : !isSubmitEnabled }}
      >
        <Form form={form} layout="vertical" className="synthesis-request-form">
          <div className="synthesis-request-summary">
            <div>
              <Text strong className="synthesis-request-section-label">화합물 구조</Text>
              <div className="synthesis-request-structure-frame">
                {target ? (
                  <CompoundStructureView
                    className="synthesis-request-structure-view"
                    svg={target.structureSvg}
                    title={target.designNo || target.name || 'Structure'}
                    smiles={target.smiles}
                    width={332}
                    height={236}
                    iconSize={36}
                    gap={0}
                    actionPlacement="overlay"
                    actionOverlayAnchor="frame"
                    actionOverlayPlacement="bottom-right"
                    frameless
                    preferRdkitSvg
                  />
                ) : null}
              </div>
            </div>
            <div className="synthesis-request-readonly">
              <Form.Item label="타겟" className="synthesis-request-inline-item">
                <Input disabled value={groupTarget || target?.project || '-'} />
              </Form.Item>
              <Form.Item label="그룹" className="synthesis-request-inline-item">
                <Input disabled value={groupName || '-'} />
              </Form.Item>
              <Form.Item label="아이디어 번호" className="synthesis-request-inline-item">
                <Input disabled value={target?.designNo || target?.name || '-'} />
              </Form.Item>
              <Form.Item label="디자인 비고" className="synthesis-request-inline-item synthesis-request-design-memo-item">
                {memoPreview(target?.designMemo)}
              </Form.Item>
            </div>
          </div>

          <Divider />

          <Row gutter={[20, 8]}>
            <Col span={8}>
              <Form.Item name="synthesisRequestNo" label="합성 의뢰 번호" className="synthesis-request-inline-item" rules={[{ required: true }]}>
                <Input disabled />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item label="합성 목적" className="synthesis-request-inline-item" required>
                <Form.Item name="synthesisReferenceName" hidden noStyle><Input /></Form.Item>
                <Cascader
                  multiple
                  disabled={isReadOnly}
                  options={designPurposeOptions}
                  showCheckedStrategy={Cascader.SHOW_CHILD}
                  value={purposePaths.map((path) => path.map(String))}
                  onChange={(value) => {
                    const next = value as CascaderValue[];
                    setPurposePaths(next);
                    if (!next.some((path) => path.includes('레퍼런스'))) {
                      form.setFieldValue('synthesisReferenceName', undefined);
                    }
                  }}
                  displayRender={(labels) => {
                    const label = String(labels[labels.length - 1] ?? '');
                    return label === '레퍼런스' && referenceName?.trim() ? `레퍼런스: ${referenceName.trim()}` : label;
                  }}
                  placeholder="합성 목적 선택"
                  popupRender={(menus) => (
                    <div>
                      {menus}
                      {isReferenceSelected ? (
                        <div className="synthesis-request-reference-panel" onMouseDown={(event) => event.stopPropagation()}>
                          <Text strong>레퍼런스 이름</Text>
                          <Input
                            size="small"
                            disabled={isReadOnly}
                            value={referenceName ?? ''}
                            onChange={(event) => form.setFieldValue('synthesisReferenceName', event.target.value)}
                          />
                        </div>
                      ) : null}
                    </div>
                  )}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="requiredAmountMg" label="필요량(mg)" className="synthesis-request-inline-item" rules={[{ required: true }]}>
                <InputNumber disabled={isReadOnly} min={1} step={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item label="단계" className="synthesis-request-inline-item" required>
                <Cascader
                  multiple
                  disabled={isReadOnly}
                  options={designExpansionOptions}
                  showCheckedStrategy={Cascader.SHOW_CHILD}
                  value={stepPaths.map((path) => path.map(String))}
                  onChange={(value) => setStepPaths(value as CascaderValue[])}
                  displayRender={(labels) => labels[labels.length - 1]}
                  placeholder="단계 선택"
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="expectedEffect" label="기대 개선 효과" className="synthesis-request-inline-item" required>
                {isReadOnly ? memoPreview(target?.expectedEffect) : <PlainMemoEditor className="synthesis-request-memo-editor" placeholder="기대 개선 효과" />}
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="requestMemo" label="비고" className="synthesis-request-inline-item">
                {isReadOnly ? memoPreview(target?.requestMemo) : <PlainMemoEditor className="synthesis-request-memo-editor" placeholder="비고" />}
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <Row gutter={[20, 8]}>
            <Col span={8}>
              <Form.Item name="synthesisRequestType" label="합성 요청 구분" className="synthesis-request-inline-item" rules={[{ required: true }]}>
                <Select disabled={isReadOnly} placeholder="합성 요청 구분 선택" options={SYNTHESIS_SITE_OPTIONS.map((value) => ({ value, label: value }))} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <style>{`
        .synthesis-request-modal { --synthesis-request-control-radius: ${token.borderRadius}px; }
        .synthesis-request-form { padding-top: 4px; }
        .synthesis-request-summary { display: grid; grid-template-columns: 348px minmax(0, 1fr); gap: 28px; align-items: start; }
        .synthesis-request-section-label { display: block; margin-bottom: 6px; font-size: 13px; }
        .synthesis-request-structure-frame { display: flex; align-items: center; justify-content: center; width: 348px; height: 327px; border: 1px solid ${token.colorBorder}; border-radius: var(--synthesis-request-control-radius); background: ${token.colorBgContainer}; overflow: hidden; }
        .synthesis-request-readonly { display: flex; flex-direction: column; gap: 8px; padding-top: 25px; }
        .synthesis-request-inline-item { margin-bottom: 8px; }
        .synthesis-request-inline-item .ant-form-item-row { display: grid !important; grid-template-columns: 96px minmax(0, 1fr); column-gap: 8px; align-items: center; }
        .synthesis-request-inline-item .ant-form-item-label { grid-column: 1; max-width: none !important; padding: 0; text-align: right; white-space: nowrap; }
        .synthesis-request-inline-item .ant-form-item-label > label { height: 28px; color: ${token.colorTextSecondary}; font-size: 12px; font-weight: 700; }
        .synthesis-request-inline-item .ant-form-item-control { grid-column: 2; min-width: 0; }
        .synthesis-request-form .ant-input, .synthesis-request-form .ant-input-number, .synthesis-request-form .ant-select-selector, .synthesis-request-form .synthesis-request-memo-editor .ql-container { border-radius: var(--synthesis-request-control-radius) !important; }
        .synthesis-request-design-memo-item .ant-form-item-row, .synthesis-request-inline-item:has(.synthesis-request-memo-editor) .ant-form-item-row, .synthesis-request-inline-item:has(.synthesis-request-readonly-memo-preview) .ant-form-item-row { align-items: start; }
        .synthesis-request-readonly-memo-preview { min-height: 54px; padding: 6px 8px; border: 1px solid ${token.colorBorder}; border-radius: var(--synthesis-request-control-radius); background: ${token.colorBgContainerDisabled}; color: ${token.colorText}; overflow: auto; white-space: pre-wrap; }
        .synthesis-request-design-memo-item .synthesis-request-readonly-memo-preview { height: 161px; }
        .synthesis-request-memo-editor { width: 100%; min-height: 54px; }
        .synthesis-request-reference-panel { display: grid; gap: 6px; padding: 8px; border-top: 1px solid ${token.colorBorderSecondary}; }
      `}</style>
    </>
  );
};

export default SynthesisRequestModal;
