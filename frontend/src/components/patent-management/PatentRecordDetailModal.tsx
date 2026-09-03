import React, { useEffect, useState } from 'react';
import { Button, Checkbox, Collapse, DatePicker, Input, Modal, Select, Tag, Typography } from 'antd';
import type { InputRef } from 'antd';
import dayjs from 'dayjs';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Link2,
  ListChecks,
} from 'lucide-react';
import {
  patentRecordApi,
  type CreatePatentRecordInput,
  type PatentDocumentLinkResult,
  type PatentRecord,
  type PatentRecordLookups,
  type UpdatePatentRecordInput,
} from '../../services/patentRecordApi';
import { buildCountryOption, filterCountryOption } from '../common/CountryTag';
import { formatDisplayDateTime } from '../../utils/displayFormat';
import RichTextField from '../common/RichTextField';
import PatentAuditFeed from './PatentAuditFeed';
import './PatentRecordDetailModal.css';

const { Text } = Typography;

const DEFAULT_SIDE_WIDTH = 370;
const MIN_SIDE_WIDTH = 300;
const MAX_SIDE_WIDTH = 560;
type PatentFieldKey = keyof UpdatePatentRecordInput;

type Props = {
  open: boolean;
  mode?: 'create' | 'edit';
  /** 수정 모드의 대상. 생성 모드에서는 null이며 컴포넌트가 빈 초안을 만든다. */
  record: PatentRecord | null;
  lookups: PatentRecordLookups | null;
  canManage: boolean;
  onClose: () => void;
  /** 변경사항이 적용되면 갱신된 행을 넘긴다. 목록 행 갱신에 쓴다. */
  onSaved: (next: PatentRecord) => void;
  /** 문서 뷰어를 레일에서 열어 달라는 요청. 뷰어를 여기 겹쳐 그리지 않는다. */
  onOpenDocuments: (record: PatentRecord) => void;
  /**
   * To-do 관리 창을 열어 달라는 요청.
   *
   * 하위 작업은 특허 필드가 아니라 별개 리소스(`/patent-todos`)라 다루는 규칙이 다르고,
   * 이미 전용 창(PatentTodoModal)이 있다 — 제목·설명·기한을 표로 고치는, 여기 있던 목록보다
   * 나은 화면이다. 상세에서는 그 창으로 가는 길만 둔다.
   */
  onOpenTodos?: (record: PatentRecord) => void;
  submitting?: boolean;
  onCreate?: (values: CreatePatentRecordInput) => void;
};

const EMPTY_RECORD: PatentRecord = {
  id: 0,
  countryId: 0,
  internalRef: null,
  refOrigin: null,
  refYear: null,
  refType: null,
  refSerial: null,
  refCountry: null,
  koreanTitle: null,
  englishTitle: null,
  applicationNumber: '',
  applicationDate: null,
  applicant: null,
  inventorLinks: [],
  attorneyNumber: null,
  registrationNumber: null,
  registrationDate: null,
  publicationNumber: null,
  publicationDate: null,
  intApplicationNumber: null,
  intApplicationDate: null,
  intPublicationNumber: null,
  intPublicationDate: null,
  parentApplicationNumber: null,
  legalStatusId: null,
  examStatusId: null,
  exam: null,
  examDate: null,
  target: null,
  country: { id: 0, country: '' },
  attorney: null,
  legalStatus: null,
  examStatus: null,
  note: null,
};

const nullableText = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const toCreateInput = (record: PatentRecord): CreatePatentRecordInput => ({
  countryId: record.countryId,
  applicationNumber: record.applicationNumber.trim(),
  internalRef: nullableText(record.internalRef),
  target: nullableText(record.target),
  koreanTitle: nullableText(record.koreanTitle),
  englishTitle: nullableText(record.englishTitle),
  applicationDate: record.applicationDate,
  applicant: nullableText(record.applicant),
  inventorIds: record.inventorLinks.map((link) => link.inventorId),
  attorneyNumber: record.attorneyNumber,
  registrationNumber: nullableText(record.registrationNumber),
  registrationDate: nullableText(record.registrationDate),
  publicationNumber: nullableText(record.publicationNumber),
  publicationDate: record.publicationDate,
  intApplicationNumber: nullableText(record.intApplicationNumber),
  intApplicationDate: record.intApplicationDate,
  intPublicationNumber: nullableText(record.intPublicationNumber),
  intPublicationDate: record.intPublicationDate,
  parentApplicationNumber: nullableText(record.parentApplicationNumber),
  legalStatusId: record.legalStatusId,
  examStatusId: record.examStatusId,
  exam: record.exam,
  examDate: record.examDate,
  note: nullableText(record.note),
});

/** 원본과 다른 편집 가능 필드만 PATCH payload로 만든다. */
const toChangedInput = (
  before: PatentRecord,
  after: PatentRecord,
): UpdatePatentRecordInput => {
  const previous = toCreateInput(before);
  const next = toCreateInput(after);
  return Object.fromEntries(
    Object.entries(next).filter(([key, value]) => (
      JSON.stringify(value) !== JSON.stringify(previous[key as keyof CreatePatentRecordInput])
    )),
  ) as UpdatePatentRecordInput;
};

/** 사이드바 한 줄. 라벨 왼쪽, 값 오른쪽. */
const Row: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div className="pm-detail-row">
    <span className="pm-detail-row-label">{label}</span>
    <span className="pm-detail-row-value">
      {children}
    </span>
  </div>
);

/** 값이 없으면 '없음'. JIRA와 같은 표기다. */
const ReadOnly: React.FC<{ value: string | null | undefined }> = ({ value }) => (
  <Text type={value ? undefined : 'secondary'} style={{ fontSize: 13 }}>
    {value && value.trim().length > 0 ? value : '없음'}
  </Text>
);

const toDayjs = (value: string | null | undefined) => (value ? dayjs(value) : null);

const noteImageUrls = (html: string | null | undefined): string[] => {
  if (!html || typeof DOMParser === 'undefined') return [];
  const documentNode = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(documentNode.querySelectorAll('img'))
    .map((image) => image.getAttribute('src'))
    .filter((source): source is string => Boolean(source));
};

/**
 * 문서 연결 결과 → 한 줄.
 */
const describeLinkResult = (result: PatentDocumentLinkResult): string => {
  if (!result.matched) {
    return '출원번호로 연결할 문서를 찾지 못했습니다.';
  }

  const { officeActions, responses } = result.created;
  const added = [
    officeActions > 0 ? `통지서 ${officeActions}건` : null,
    responses > 0 ? `제출 서류 ${responses}건` : null,
    result.patentDocumentLinked ? '특허 문서' : null,
  ].filter((part): part is string => part !== null);

  if (added.length === 0) {
    return `이미 연결된 문서입니다(${result.documentCount}건).`;
  }
  return `${added.join(' · ')}을 연결했습니다.`;
};

/**
 * 관리 특허 상세 — JIRA 이슈 상세와 같은 2단 배치.
 *
 * 생성·수정 모두 값을 로컬 초안에 모은다. 수정은 우측 하단 [적용]을 눌렀을 때 원본과
 * 달라진 필드만 PATCH 한 번으로 저장한다. select·날짜의 오클릭도 서버에 즉시 반영되지
 * 않으며, [취소]는 초안을 버린다. 여러 필드의 감사 로그는 같은 requestId로 묶인다.
 *
 * 읽기 전용 필드(권리 관계 등)는 DB·응답에는 있지만 갱신 DTO에 없어 편집할 수 없다.
 * 출원인·발명자는 코드 관리와 연결된 select로 편집한다. note('설명')도 편집 가능하며,
 * 옛 '상태 메모'(status_note)도 여기로 합쳐졌다 — 자유 서술은 '설명' 한 자리다.
 */
const PatentRecordDetailModal: React.FC<Props> = ({
  open,
  mode = 'edit',
  record,
  lookups,
  canManage,
  onClose,
  onSaved,
  onOpenDocuments,
  onOpenTodos,
  submitting = false,
  onCreate,
}) => {
  const isCreate = mode === 'create';
  const [createDraft, setCreateDraft] = useState<PatentRecord>(EMPTY_RECORD);
  const [editDraft, setEditDraft] = useState<PatentRecord | null>(null);
  const [createErrors, setCreateErrors] = useState({ country: false, applicationNumber: false });
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  /** [적용] 전 업로드된 설명 이미지는 취소 시 정리해야 하므로 따로 추적한다. */
  const draftNoteUploads = React.useRef(new Set<string>());
  const activeRecord = isCreate ? createDraft : (editDraft ?? record);
  const inputsDisabled = !canManage || submitting || applying;

  useEffect(() => {
    if (!open) return;
    if (isCreate) {
      setCreateDraft(EMPTY_RECORD);
      setCreateErrors({ country: false, applicationNumber: false });
    } else if (record) {
      // 같은 특허를 편집하는 동안 부모가 목록 행을 갱신해도 작성 중 초안을 덮지 않는다.
      setEditDraft((current) => current?.id === record.id
        ? current
        : { ...record, inventorLinks: [...record.inventorLinks] });
    }
    setApplyError('');
  }, [isCreate, open, record]);
  /** 저장이 일어나면 활동 피드를 다시 받는다(어떤 로그가 남았는지는 서버만 안다). */
  const [auditRevision, setAuditRevision] = useState(0);
  const [titleActive, setTitleActive] = useState(false);
  const titleRef = React.useRef<InputRef>(null);
  const [headerEditField, setHeaderEditField] = useState<
    'target' | 'internalRef' | 'applicationNumber' | null
  >(null);
  const headerEditInitialValue = React.useRef<string | null>(null);
  const [sideWidth, setSideWidth] = useState(DEFAULT_SIDE_WIDTH);
  const [isSideCollapsed, setIsSideCollapsed] = useState(false);
  const [isSideResizing, setIsSideResizing] = useState(false);
  const sideResizeStart = React.useRef({ pointerX: 0, width: DEFAULT_SIDE_WIDTH });
  /** 문서 연결이 도는 중인가. 상류 조회가 있어 몇 초 걸릴 수 있다. */
  const [linkingDocuments, setLinkingDocuments] = useState(false);
  /** 마지막 연결 결과를 사람 말로. 눌렀는데 아무 말이 없으면 눌린 줄 모른다. */
  const [linkMessage, setLinkMessage] = useState('');

  useEffect(() => {
    setHeaderEditField(null);
    setLinkMessage('');
  }, [activeRecord?.id, isCreate, open]);

  if (!activeRecord) return null;

  const updateDraft = (key: PatentFieldKey, value: unknown) => {
    const update = (current: PatentRecord) => (
      { ...current, [key]: value } as PatentRecord
    );
    if (isCreate) setCreateDraft(update);
    else setEditDraft((current) => (current ? update(current) : current));
    setApplyError('');
    if (key === 'countryId') {
      setCreateErrors((current) => ({ ...current, country: false }));
    }
    if (key === 'applicationNumber') {
      setCreateErrors((current) => ({ ...current, applicationNumber: false }));
    }
  };

  const beginHeaderEdit = (
    key: 'target' | 'internalRef' | 'applicationNumber',
    value: string | null | undefined,
  ) => {
    if (inputsDisabled) return;
    headerEditInitialValue.current = value ?? null;
    setHeaderEditField(key);
  };

  const cancelHeaderTextEdit = (key: 'internalRef' | 'applicationNumber') => {
    updateDraft(key, headerEditInitialValue.current);
    setHeaderEditField(null);
  };

  const activateWithKeyboard = (
    event: React.KeyboardEvent<HTMLElement>,
    action: () => void,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    action();
  };

  const beginSideResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isSideCollapsed || event.button !== 0) return;
    event.preventDefault();
    sideResizeStart.current = { pointerX: event.clientX, width: sideWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsSideResizing(true);
  };

  const resizeSide = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isSideResizing) return;
    const next = sideResizeStart.current.width
      + sideResizeStart.current.pointerX
      - event.clientX;
    setSideWidth(Math.min(MAX_SIDE_WIDTH, Math.max(MIN_SIDE_WIDTH, next)));
  };

  const finishSideResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isSideResizing) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsSideResizing(false);
  };

  const submitCreate = () => {
    const errors = {
      country: !activeRecord.countryId,
      applicationNumber: activeRecord.applicationNumber.trim().length === 0,
    };
    setCreateErrors(errors);
    if (errors.country || errors.applicationNumber) return;
    onCreate?.(toCreateInput(activeRecord));
  };

  const pendingUpdate = !isCreate && record && activeRecord
    ? toChangedInput(record, activeRecord)
    : {};
  const hasPendingChanges = Object.keys(pendingUpdate).length > 0;

  const removeNoteImages = (urls: Iterable<string>) => {
    if (!record) return;
    Array.from(new Set(urls)).forEach((url) => {
      void patentRecordApi.removeNoteImage(record.id, url).catch(() => undefined);
    });
  };

  const discardDraftUploads = () => {
    if (record) removeNoteImages(draftNoteUploads.current);
    draftNoteUploads.current.clear();
  };

  const closeAndDiscard = () => {
    discardDraftUploads();
    setEditDraft(null);
    setCreateErrors({ country: false, applicationNumber: false });
    setApplyError('');
    onClose();
  };

  const requestClose = () => {
    if (submitting || applying || noteBusy) return;
    if (isCreate || !hasPendingChanges) {
      closeAndDiscard();
      return;
    }
    Modal.confirm({
      title: '변경사항을 버릴까요?',
      content: '적용하지 않은 변경사항은 저장되지 않습니다.',
      okText: '변경사항 버리기',
      okButtonProps: { danger: true },
      cancelText: '계속 편집',
      onOk: closeAndDiscard,
    });
  };

  const submitEdit = async () => {
    if (isCreate || !record || !activeRecord || !hasPendingChanges || noteBusy) return;
    const errors = {
      country: !activeRecord.countryId,
      applicationNumber: activeRecord.applicationNumber.trim().length === 0,
    };
    setCreateErrors(errors);
    if (errors.country || errors.applicationNumber) return;

    setApplying(true);
    setApplyError('');
    try {
      const next = await patentRecordApi.update(
        record.id,
        pendingUpdate,
        globalThis.crypto?.randomUUID?.(),
      );
      const nextImageUrls = new Set(noteImageUrls(activeRecord.note));
      removeNoteImages([
        ...noteImageUrls(record.note).filter((url) => !nextImageUrls.has(url)),
        ...Array.from(draftNoteUploads.current).filter((url) => !nextImageUrls.has(url)),
      ]);
      draftNoteUploads.current.clear();
      onSaved(next);
      setAuditRevision((current) => current + 1);
      setEditDraft(null);
      onClose();
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : '변경사항을 적용하지 못했습니다.');
    } finally {
      setApplying(false);
    }
  };

  /**
   * OA DB에서 문서를 찾아 이어 붙인다.
   *
   * 결과를 한 줄로 옮겨 준다 — '없다'에도 종류가 있어서다. 찾을 수 없는 출원번호(KR이
   * 아님)와, 찾아봤지만 없는 것과, 특허는 있는데 PDF가 없는 것은 다음에 할 일이 다르다.
   */
  const linkDocuments = async () => {
    if (linkingDocuments) return;
    setLinkingDocuments(true);
    setLinkMessage('');
    try {
      const result = await patentRecordApi.linkDocuments(activeRecord.id);
      setLinkMessage(describeLinkResult(result));
      // 문서 건수가 바뀌었으면 이 행을 쓰는 곳(목록 배지·'문서 N건 열기')도 함께 고친다.
      if (result.documentCount !== (activeRecord.documentCount ?? 0)) {
        const persistedRecord = record ?? activeRecord;
        onSaved({ ...persistedRecord, documentCount: result.documentCount });
        setEditDraft((current) => current
          ? { ...current, documentCount: result.documentCount }
          : current);
      }
      setAuditRevision((current) => current + 1);
    } catch (error) {
      setLinkMessage(error instanceof Error ? error.message : '문서를 연결하지 못했습니다.');
    } finally {
      setLinkingDocuments(false);
    }
  };

  /** 제목 편집을 마치되 서버 저장은 하단 [적용]에서만 한다. */
  const applyTitle = () => {
    titleRef.current?.blur();
  };

  /** 제목 한 칸만 모달을 열었을 때 값으로 되돌린다. */
  const cancelTitle = () => {
    updateDraft('koreanTitle', isCreate ? null : record?.koreanTitle ?? null);
    titleRef.current?.blur();
  };

  /** 텍스트 입력 한 칸. 모든 입력은 모달의 로컬 초안만 바꾼다. */
  const textInput = (
    key: PatentFieldKey,
    serverValue: string | null | undefined,
    extra?: {
      ref?: React.Ref<InputRef>;
      onFocus?: () => void;
      onBlur?: () => void;
      onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
      onPressEnter?: () => void;
      placeholder?: string;
      autoFocus?: boolean;
    },
  ) => (
    <Input
      ref={extra?.ref}
      size="small"
      disabled={inputsDisabled}
      placeholder={extra?.placeholder}
      autoFocus={extra?.autoFocus}
      value={serverValue ?? ''}
      onChange={(event) => updateDraft(key, event.target.value)}
      onFocus={extra?.onFocus}
      onBlur={extra?.onBlur}
      onPressEnter={() => {
        extra?.onPressEnter?.();
      }}
      onKeyDown={extra?.onKeyDown}
      status={key === 'applicationNumber' && createErrors.applicationNumber
        ? 'error'
        : undefined}
    />
  );

  /** 날짜 한 칸. 선택값은 [적용] 전까지 로컬 초안에만 둔다. */
  const dateInput = (key: PatentFieldKey, serverValue: string | null | undefined) => (
    <DatePicker
      size="small"
      disabled={inputsDisabled}
      value={toDayjs(serverValue)}
      onChange={(next) => {
        const value = next ? next.format('YYYY-MM-DD') : null;
        updateDraft(key, value);
      }}
    />
  );

  const codeSelect = (
    key: PatentFieldKey,
    value: number | null | undefined,
    // 국가처럼 label이 ReactNode인 옵션은 검색 문자열을 따로 들고 온다.
    options: { value: number; label: React.ReactNode; search?: string }[],
  ) => (
    <Select
      size="small"
      allowClear
      showSearch
      filterOption={(input, option) => (
        option?.search !== undefined
          ? filterCountryOption(input, option)
          : String(option?.label ?? '').toLowerCase().includes(input.trim().toLowerCase())
      )}
      placeholder="없음"
      disabled={inputsDisabled || !lookups}
      value={isCreate && !value ? undefined : (value ?? undefined)}
      onChange={(next?: number) => {
        updateDraft(key, next ?? null);
      }}
      status={key === 'countryId' && createErrors.country ? 'error' : undefined}
      options={options}
    />
  );

  const documentCount = activeRecord.documentCount ?? 0;
  /** 값이 하나도 없으면 그룹째 숨긴다. 빈 항목만 늘어놓지 않는다. */
  const rightsValues = [activeRecord.licenseAgreement, activeRecord.rightsChange, activeRecord.shareAgreement];
  const hasRights = rightsValues.some((value) => value && value.trim().length > 0);

  return (
    <Modal
      open={open}
      onCancel={requestClose}
      footer={(
        <div className="pm-detail-footer">
          <Text
            type={applyError ? 'danger' : 'secondary'}
            className="pm-detail-apply-error"
          >
            {applyError || (noteBusy
              ? '설명 이미지 업로드가 끝날 때까지 기다려 주세요.'
              : !isCreate && hasPendingChanges
                ? '적용되지 않은 변경사항이 있습니다.'
                : '')}
          </Text>
          <div className="pm-detail-footer-actions">
            <Button disabled={submitting || applying || noteBusy} onClick={closeAndDiscard}>
              취소
            </Button>
            <Button
              type="primary"
              loading={isCreate ? submitting : applying}
              disabled={noteBusy || !canManage || (!isCreate && !hasPendingChanges)}
              onClick={() => {
                if (isCreate) submitCreate();
                else void submitEdit();
              }}
            >
              {isCreate ? '추가' : '적용'}
            </Button>
          </div>
        </div>
      )}
      width="min(1480px, calc(100vw - 40px))"
      style={{ top: '10vh', paddingBottom: 0 }}
      destroyOnClose
      className="pm-detail-modal"
      title={
        <div className="pm-detail-title-bar">
          {headerEditField === 'target' ? (
            <Select
              className="pm-detail-title-target-select"
              size="small"
              allowClear
              showSearch
              autoFocus
              defaultOpen
              optionFilterProp="label"
              placeholder="Target"
              disabled={inputsDisabled || !lookups}
              value={activeRecord.target ?? undefined}
              onChange={(next?: string) => {
                updateDraft('target', next ?? null);
                setHeaderEditField(null);
              }}
              onBlur={() => setHeaderEditField(null)}
              onOpenChange={(nextOpen) => {
                if (!nextOpen) setHeaderEditField(null);
              }}
              options={(lookups?.targets ?? []).map((item) => ({
                value: item.target,
                label: item.target,
              }))}
            />
          ) : (
            <Tag
              color="blue"
              className="pm-detail-title-edit-trigger"
              aria-disabled={inputsDisabled}
              tabIndex={inputsDisabled ? undefined : 0}
              onClick={() => beginHeaderEdit('target', activeRecord.target)}
              onKeyDown={(event) => activateWithKeyboard(
                event,
                () => beginHeaderEdit('target', activeRecord.target),
              )}
            >
              {activeRecord.target ?? '-'}
            </Tag>
          )}
          <span className="pm-detail-title-divider" aria-hidden="true">/</span>
          {headerEditField === 'internalRef' ? (
            <span className="pm-detail-ref pm-detail-title-input">
              {textInput('internalRef', activeRecord.internalRef, {
                placeholder: '내부관리번호',
                autoFocus: true,
                onBlur: () => setHeaderEditField(null),
                onPressEnter: () => setHeaderEditField(null),
                onKeyDown: (event) => {
                  if (event.key !== 'Escape') return;
                  event.stopPropagation();
                  cancelHeaderTextEdit('internalRef');
                },
              })}
            </span>
          ) : (
            <span
              className={`pm-detail-ref pm-detail-title-edit-trigger${
                isCreate && !activeRecord.internalRef ? ' is-placeholder' : ''
              }`}
              role="button"
              aria-disabled={inputsDisabled}
              tabIndex={inputsDisabled ? undefined : 0}
              onClick={() => beginHeaderEdit('internalRef', activeRecord.internalRef)}
              onKeyDown={(event) => activateWithKeyboard(
                event,
                () => beginHeaderEdit('internalRef', activeRecord.internalRef),
              )}
            >
              {activeRecord.internalRef ?? (isCreate ? '내부관리번호' : '관리번호 없음')}
            </span>
          )}
          <span className="pm-detail-title-divider" aria-hidden="true">/</span>
          {headerEditField === 'applicationNumber' ? (
            <span className="pm-detail-appno pm-detail-title-input">
              {textInput('applicationNumber', activeRecord.applicationNumber, {
                placeholder: '출원번호',
                autoFocus: true,
                onBlur: () => setHeaderEditField(null),
                onPressEnter: () => setHeaderEditField(null),
                onKeyDown: (event) => {
                  if (event.key !== 'Escape') return;
                  event.stopPropagation();
                  cancelHeaderTextEdit('applicationNumber');
                },
              })}
            </span>
          ) : (
            <span
              className="pm-detail-appno pm-detail-title-edit-trigger"
              role="button"
              aria-disabled={inputsDisabled}
              tabIndex={inputsDisabled ? undefined : 0}
              onClick={() => beginHeaderEdit('applicationNumber', activeRecord.applicationNumber)}
              onKeyDown={(event) => activateWithKeyboard(
                event,
                () => beginHeaderEdit('applicationNumber', activeRecord.applicationNumber),
              )}
            >
              {activeRecord.applicationNumber || (isCreate ? '출원번호' : '')}
            </span>
          )}
          <span className="pm-detail-title-spacer" />
        </div>
      }
    >
      <div className={`pm-detail-body${isSideResizing ? ' is-resizing' : ''}`}>
        {/* ---- 왼쪽: 사람이 읽는 것 ---- */}
        <div className="pm-detail-main">
          {/* JIRA처럼 제목·주요 액션·설명을 먼저 읽고, 활동 이력은 그 아래에서 이어 본다. */}
          <div className="pm-detail-primary">
            <section className="pm-detail-section">
              <div className={`pm-detail-heading-row${titleActive ? ' is-active' : ''}`}>
                {textInput('koreanTitle', activeRecord.koreanTitle, {
                  ref: titleRef,
                  placeholder: '특허 명칭',
                  onFocus: () => setTitleActive(true),
                  onBlur: () => setTitleActive(false),
                  onKeyDown: (event) => {
                    if (event.key === 'Escape') {
                      // 모달까지 올라가면 상세 창이 통째로 닫힌다.
                      event.stopPropagation();
                      cancelTitle();
                      return;
                    }
                    if (event.key === 'Enter') applyTitle();
                  },
                })}
              </div>
            </section>

            {!isCreate && (
              <div className="pm-detail-action-row">
                <Button
                  size="small"
                  icon={<FileText size={15} />}
                  disabled={documentCount === 0}
                  onClick={() => onOpenDocuments(activeRecord)}
                >
                  {documentCount > 0 ? `문서 ${documentCount}건` : '연결된 문서 없음'}
                </Button>
                {canManage && (
                  <Button
                    size="small"
                    icon={<Link2 size={15} />}
                    loading={linkingDocuments}
                    onClick={() => void linkDocuments()}
                  >
                    문서 연결
                  </Button>
                )}
                {onOpenTodos && (
                  <Button
                    size="small"
                    icon={<ListChecks size={15} />}
                    onClick={() => onOpenTodos(activeRecord)}
                  >
                    To-do
                  </Button>
                )}
              </div>
            )}
            {linkMessage && (
              <Text type="secondary" className="pm-detail-link-message">{linkMessage}</Text>
            )}

            <section className="pm-detail-section">
              <h4 className="pm-detail-section-title">설명</h4>
              {/* 기존 본문 이미지는 [적용] 성공 뒤에만 지운다. 즉시 지우면 [취소]로
                  원문을 되돌렸을 때 이미지 URL만 먼저 사라지는 데이터 손상이 생긴다. */}
              <RichTextField
                value={activeRecord.note}
                readOnly={inputsDisabled}
                saveText="저장"
                onSave={async (next) => {
                  updateDraft('note', next);
                }}
                onDraftChange={(next) => updateDraft('note', next)}
                onBusyChange={setNoteBusy}
                uploadImage={isCreate
                  ? undefined
                  : async (file) => {
                      const uploaded = await patentRecordApi.uploadNoteImage(activeRecord.id, file);
                      draftNoteUploads.current.add(uploaded.storageUrl);
                      return uploaded;
                    }}
                resolveImageUrl={isCreate ? undefined : patentRecordApi.noteImageDisplayUrl}
              />
            </section>
          </div>

          {/* 현재 내용과 과거 변경 이력을 구분하되 같은 왼쪽 스크롤 흐름 안에 둔다. */}
          {!isCreate && (
            <section className="pm-detail-section pm-detail-activity">
              <h4 className="pm-detail-section-title">활동</h4>
              <PatentAuditFeed patentId={activeRecord.id} revision={auditRevision} />
            </section>
          )}
        </div>

        <div
          className={`pm-detail-splitter${isSideResizing ? ' is-active' : ''}${
            isSideCollapsed ? ' is-collapsed' : ''
          }`}
          role="separator"
          aria-label="세부 정보 패널 너비 조절"
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={MAX_SIDE_WIDTH}
          aria-valuenow={isSideCollapsed ? 0 : sideWidth}
          tabIndex={0}
          onPointerDown={beginSideResize}
          onPointerMove={resizeSide}
          onPointerUp={finishSideResize}
          onPointerCancel={finishSideResize}
          onKeyDown={(event) => {
            if (isSideCollapsed) return;
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              setSideWidth((current) => Math.min(MAX_SIDE_WIDTH, current + 16));
            }
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              setSideWidth((current) => Math.max(MIN_SIDE_WIDTH, current - 16));
            }
          }}
        >
          <button
            type="button"
            className="pm-detail-splitter-toggle"
            aria-label={isSideCollapsed ? '세부 정보 패널 펼치기' : '세부 정보 패널 접기'}
            aria-expanded={!isSideCollapsed}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setIsSideCollapsed((current) => !current)}
          >
            {isSideCollapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        {/* ---- 오른쪽: 코드·날짜 ---- */}
        <aside
          className={`pm-detail-side${isSideCollapsed ? ' is-collapsed' : ''}`}
          style={{ flexBasis: isSideCollapsed ? 0 : sideWidth }}
          aria-hidden={isSideCollapsed}
        >
          <div className="pm-detail-side-status">
            <span className="pm-detail-side-status-label">법적 상태</span>
            <span className="pm-detail-status">
              {codeSelect(
                'legalStatusId',
                activeRecord.legalStatusId,
                (lookups?.legalStatuses ?? []).map((item) => ({
                  value: item.id,
                  label: item.status,
                })),
              )}
            </span>
          </div>
          <Collapse
            ghost
            size="small"
            defaultActiveKey={isCreate
              ? ['basic', 'numbers']
              : ['basic']}
            items={[
              {
                key: 'basic',
                label: '세부 사항',
                children: (
                  <>
                    <Row label="Target">
                      <Select
                        size="small"
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        placeholder="없음"
                        disabled={inputsDisabled || !lookups}
                        value={activeRecord.target ?? undefined}
                        onChange={(next?: string) => updateDraft('target', next ?? null)}
                        options={(lookups?.targets ?? []).map((item) => ({
                          value: item.target,
                          label: item.target,
                        }))}
                      />
                    </Row>
                    <Row label="국가">
                      <>
                        {codeSelect(
                          'countryId',
                          activeRecord.countryId,
                          (lookups?.countries ?? [])
                            .map((item) => buildCountryOption(item.id, item.country)),
                        )}
                        {createErrors.country && (
                          <Text type="danger" className="pm-detail-field-error">필수</Text>
                        )}
                      </>
                    </Row>
                    <Row label="출원인">
                      <Select
                        size="small"
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        placeholder="없음"
                        disabled={inputsDisabled || !lookups}
                        value={activeRecord.applicant ?? undefined}
                        onChange={(next?: string) => updateDraft('applicant', next ?? null)}
                        options={(lookups?.applicants ?? []).map((item) => ({
                          value: item.applicant,
                          label: item.applicant,
                        }))}
                      />
                    </Row>
                    <Row label="대리인">
                      {codeSelect(
                        'attorneyNumber',
                        activeRecord.attorneyNumber,
                        (lookups?.attorneys ?? []).map((item) => ({
                          value: item.attorneyNumber,
                          label: item.attorneyName ?? String(item.attorneyNumber),
                        })),
                      )}
                    </Row>
                    <Row label="발명자">
                      <Select
                        size="small"
                        mode="multiple"
                        allowClear
                        showSearch
                        maxTagCount="responsive"
                        optionFilterProp="label"
                        placeholder="발명자 선택"
                        disabled={inputsDisabled || !lookups}
                        value={activeRecord.inventorLinks.map((link) => link.inventorId)}
                        onChange={(next: number[]) => {
                          if (isCreate) {
                            const byId = new Map(
                              (lookups?.inventors ?? []).map((item) => [item.id, item]),
                            );
                            setCreateDraft((current) => ({
                              ...current,
                              inventorLinks: next.flatMap((inventorId, ordinal) => {
                                const inventor = byId.get(inventorId);
                                return inventor
                                  ? [{ inventorId, ordinal, inventor }]
                                  : [];
                              }),
                            }));
                          } else setEditDraft((current) => current
                            ? {
                                ...current,
                                inventorLinks: next.flatMap((inventorId, ordinal) => {
                                  const inventor = (lookups?.inventors ?? [])
                                    .find((item) => item.id === inventorId);
                                  return inventor
                                    ? [{ inventorId, ordinal, inventor }]
                                    : [];
                                }),
                              }
                            : current);
                          setApplyError('');
                        }}
                        options={(lookups?.inventors ?? []).map((item) => ({
                          value: item.id,
                          label: item.inventor,
                        }))}
                      />
                    </Row>
                  </>
                ),
              },
              /* 문서·To-do 액션은 제목 아래 툴바에 두고, 관계 필드만 이 그룹에 둔다. */
              {
                key: 'links',
                label: '연결',
                children: (
                  <>
                    <Row label="원출원번호">
                      {textInput('parentApplicationNumber', activeRecord.parentApplicationNumber)}
                    </Row>
                    <Row label="관계">
                      <ReadOnly value={activeRecord.relationType} />
                    </Row>
                  </>
                ),
              },
              {
                key: 'status',
                label: '상태',
                children: (
                  <>
                    <Row label="심사청구">
                      <Checkbox
                        disabled={inputsDisabled}
                        checked={activeRecord.exam === true}
                        onChange={(event) => updateDraft('exam', event.target.checked)}
                      />
                    </Row>
                    <Row label="심사일">
                      {dateInput('examDate', activeRecord.examDate)}
                    </Row>
                  </>
                ),
              },
              {
                key: 'dates',
                label: '일자',
                children: (
                  <>
                    <Row label="출원일">
                      {dateInput('applicationDate', activeRecord.applicationDate)}
                    </Row>
                    <Row label="공개일">
                      {dateInput('publicationDate', activeRecord.publicationDate)}
                    </Row>
                    {/* registration_date는 컬럼이 문자열이다(형식이 제각각인 운영 시트 값을
                        보존한다). DatePicker로 바꾸면 기존 값을 잃는다. */}
                    <Row label="등록일">
                      {textInput('registrationDate', activeRecord.registrationDate)}
                    </Row>
                    <Row label="예상 만료일">
                      <ReadOnly value={formatDisplayDateTime(activeRecord.expectedExpiryDate ?? null)} />
                    </Row>
                  </>
                ),
              },
              {
                key: 'numbers',
                label: '번호',
                children: (
                  <>
                    <Row label="출원번호">
                      {textInput('applicationNumber', activeRecord.applicationNumber)}
                      {createErrors.applicationNumber && (
                        <Text type="danger" className="pm-detail-field-error">필수 입력</Text>
                      )}
                    </Row>
                    <Row label="내부관리번호">
                      {textInput('internalRef', activeRecord.internalRef)}
                    </Row>
                    <Row label="공개번호">
                      {textInput('publicationNumber', activeRecord.publicationNumber)}
                    </Row>
                    <Row label="등록번호">
                      {textInput('registrationNumber', activeRecord.registrationNumber)}
                    </Row>
                  </>
                ),
              },
              {
                key: 'international',
                label: '국제(PCT)',
                children: (
                  <>
                    <Row label="국제출원번호">
                      {textInput('intApplicationNumber', activeRecord.intApplicationNumber)}
                    </Row>
                    <Row label="국제출원일">
                      {dateInput('intApplicationDate', activeRecord.intApplicationDate)}
                    </Row>
                    <Row label="국제공개번호">
                      {textInput('intPublicationNumber', activeRecord.intPublicationNumber)}
                    </Row>
                    <Row label="국제공개일">
                      {dateInput('intPublicationDate', activeRecord.intPublicationDate)}
                    </Row>
                  </>
                ),
              },
              // 값이 하나도 없으면 그룹째 내지 않는다.
              ...(hasRights
                ? [{
                  key: 'rights',
                  label: '권리·계약',
                  children: (
                    <>
                      <Row label="실시권 계약">
                        <ReadOnly value={activeRecord.licenseAgreement} />
                      </Row>
                      <Row label="권리관계 변경">
                        <ReadOnly value={activeRecord.rightsChange} />
                      </Row>
                      <Row label="지분약정">
                        <ReadOnly value={activeRecord.shareAgreement} />
                      </Row>
                    </>
                  ),
                }]
                : []),
            ]}
          />

          {!isCreate && <div className="pm-detail-stamps">
            {/* 감사 로그 마이그레이션 이전 행은 created_at이 마이그레이션 시점이다.
                실제 등록 시점이 아니라는 것을 툴팁으로 밝힌다. */}
            <span>{`만듦 ${formatDisplayDateTime(activeRecord.createdAt ?? null)}`}</span>
            <span>{`업데이트 ${formatDisplayDateTime(activeRecord.updatedAt ?? null)}`}</span>
          </div>}
        </aside>
      </div>
    </Modal>
  );
};

export default PatentRecordDetailModal;
