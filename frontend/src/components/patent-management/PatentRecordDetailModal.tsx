import React, { useState } from 'react';
import { Button, Checkbox, Collapse, DatePicker, Input, Modal, Select, Tag, Tooltip, Typography } from 'antd';
import type { InputRef } from 'antd';
import dayjs from 'dayjs';
import { AlertCircle, Check, FileText, Link2, ListChecks, Loader2, X } from 'lucide-react';
import {
  usePatentFieldSave,
  type FieldSaveState,
  type PatentFieldKey,
} from '../../hooks/usePatentFieldSave';
import {
  patentRecordApi,
  type PatentDocumentLinkResult,
  type PatentRecord,
  type PatentRecordLookups,
} from '../../services/patentRecordApi';
import { formatDisplayDateTime } from '../../utils/displayFormat';
import RichTextField from '../common/RichTextField';
import PatentAuditFeed from './PatentAuditFeed';
import './PatentRecordDetailModal.css';

const { Text } = Typography;

type Props = {
  open: boolean;
  /** null이면 아무것도 그리지 않는다. */
  record: PatentRecord | null;
  lookups: PatentRecordLookups | null;
  canManage: boolean;
  onClose: () => void;
  /** 필드가 저장되면 갱신된 행을 넘긴다. 목록 행 갱신에 쓴다. */
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
};

/** 필드 옆의 저장 상태. 조용히 실패하면 사용자가 저장됐다고 믿는다. */
const SaveBadge: React.FC<{ state: FieldSaveState; onRetryHint?: () => void }> = ({
  state,
  onRetryHint,
}) => {
  if (state.status === 'saving') {
    return <Loader2 size={12} className="pm-field-badge pm-field-badge-spin" aria-label="저장 중" />;
  }
  if (state.status === 'saved') {
    return <Check size={12} className="pm-field-badge pm-field-badge-ok" aria-label="저장됨" />;
  }
  if (state.status === 'error') {
    return (
      <Tooltip title={`${state.message ?? '저장하지 못했습니다.'} (눌러서 되돌리기)`}>
        <button
          type="button"
          className="pm-field-badge pm-field-badge-error"
          aria-label="저장 실패, 눌러서 되돌리기"
          onClick={onRetryHint}
        >
          <AlertCircle size={12} />
        </button>
      </Tooltip>
    );
  }
  return null;
};

/** 사이드바 한 줄. 라벨 왼쪽, 값 오른쪽. */
const Row: React.FC<{
  label: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}> = ({ label, children, badge }) => (
  <div className="pm-detail-row">
    <span className="pm-detail-row-label">{label}</span>
    <span className="pm-detail-row-value">
      {children}
      {badge}
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

/**
 * 문서 연결 결과 → 한 줄.
 *
 * '없다'를 뭉뚱그리지 않는다. 세 가지가 각각 다음에 할 일이 다르다 — 출원번호 형식이
 * 안 맞으면 사람이 할 수 있는 것이 없고, 상류에 특허가 없으면 나중에 다시 눌러 볼 만하고,
 * 문서만 없으면 특허는 맞게 찾은 것이다.
 */
const describeLinkResult = (result: PatentDocumentLinkResult): string => {
  if (!result.matched) {
    if (result.reason === 'NOT_KR_APPLICATION_NUMBER') {
      return `OA DB는 국내 출원(13자리)만 담고 있습니다. 이 출원번호는 숫자 ${result.normalizedApplicationNumber.length}자리라 찾을 수 없습니다.`;
    }
    if (result.reason === 'NOT_FOUND_UPSTREAM') {
      return `OA DB에 ${result.normalizedApplicationNumber} 출원이 없습니다.`;
    }
    return '특허는 찾았지만 연결할 문서가 없습니다.';
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
 * **필드별 저장이다.** 하단 [저장] 버튼이 없다. 필드 하나를 고치면 그 키만 담은 PATCH가
 * 나가고, 서버가 그 필드만 감사 로그에 남긴다. 다만 "언제 한 번인가"는 필드의 성격에
 * 따라 다르다(usePatentFieldSave):
 *
 *  - select·날짜·체크박스: 고르는 즉시. 한 번의 조작이 곧 최종값이다.
 *  - 한 줄 텍스트: blur·Enter로 확정할 때 한 번. 타자 중에는 보내지 않는다.
 *  - 설명: 편집기를 열고 [저장]을 눌러야. 문단은 다 쓰고 나서가 사람의 단위다.
 *
 * 뒤의 두 규칙은 활동 피드 때문에 이렇게 됐다 — 타자 중에 저장하면 중간값마다 이력이
 * 한 줄씩 남아 피드가 타자 기록이 된다.
 *
 * 추가(생성)는 이 모달이 아니다 — 없는 레코드에는 PATCH를 할 수 없어 일괄 POST 폼이
 * 따로 있다(PatentRecordCreateModal). JIRA도 생성 다이얼로그와 상세 화면이 다르다.
 *
 * 읽기 전용 필드(inventors·권리 관계 등)는 DB·응답에는 있지만 갱신 DTO에 없어 편집할
 * 수 없다. CSV 임포트로만 채워진다. note('설명')는 이 규칙에서 빠져나와 편집 가능해졌고,
 * 옛 '상태 메모'(status_note)도 여기로 합쳐졌다 — 자유 서술은 '설명' 한 자리다.
 */
const PatentRecordDetailModal: React.FC<Props> = ({
  open,
  record,
  lookups,
  canManage,
  onClose,
  onSaved,
  onOpenDocuments,
  onOpenTodos,
}) => {
  /** 저장이 일어나면 활동 피드를 다시 받는다(어떤 로그가 남았는지는 서버만 안다). */
  const [auditRevision, setAuditRevision] = useState(0);
  /**
   * 명칭 칸이 포커스를 잡고 있는가. 잡고 있을 때만 적용·취소 아이콘을 낸다.
   *
   * 이 칸은 제목 자리라 평소에는 테두리도 없이 그냥 글로 보인다(JIRA와 같다). 그래서
   * "지금 고치는 중이고, 이렇게 끝낸다"를 보여 줄 것이 필요하다.
   */
  const [titleActive, setTitleActive] = useState(false);
  const titleRef = React.useRef<InputRef>(null);
  /** 문서 연결이 도는 중인가. 상류 조회가 있어 몇 초 걸릴 수 있다. */
  const [linkingDocuments, setLinkingDocuments] = useState(false);
  /** 마지막 연결 결과를 사람 말로. 눌렀는데 아무 말이 없으면 눌린 줄 모른다. */
  const [linkMessage, setLinkMessage] = useState('');

  const save = usePatentFieldSave({
    patent: record,
    onSaved: (next) => {
      onSaved(next);
      setAuditRevision((current) => current + 1);
    },
  });

  if (!record) return null;

  const badgeFor = (key: PatentFieldKey) => (
    <SaveBadge state={save.stateOf(key)} onRetryHint={() => save.revert(key)} />
  );

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
      const result = await patentRecordApi.linkDocuments(record.id);
      setLinkMessage(describeLinkResult(result));
      // 문서 건수가 바뀌었으면 이 행을 쓰는 곳(목록 배지·'문서 N건 열기')도 함께 고친다.
      if (result.documentCount !== (record.documentCount ?? 0)) {
        onSaved({ ...record, documentCount: result.documentCount });
      }
      setAuditRevision((current) => current + 1);
    } catch (error) {
      setLinkMessage(error instanceof Error ? error.message : '문서를 연결하지 못했습니다.');
    } finally {
      setLinkingDocuments(false);
    }
  };

  /** 적용 — 지금 값을 확정한다. blur도 같은 일을 하므로 두 번 불려도 안전하다. */
  const applyTitle = () => {
    save.commitText('koreanTitle');
    titleRef.current?.blur();
  };

  /** 취소 — 초안을 버리고 서버 값으로 되돌린다. 되돌린 뒤에 나가야 blur가 저장하지 않는다. */
  const cancelTitle = () => {
    save.revert('koreanTitle');
    titleRef.current?.blur();
  };

  /**
   * 텍스트 입력 한 칸. blur·Enter로 확정한다(타자 중에는 보내지 않는다).
   *
   * extra는 이 규칙을 **더하는** 자리다 — onBlur는 덮어쓰지 않고 확정 뒤에 이어 부른다.
   * 덮어쓸 수 있게 두면 확정을 빠뜨린 칸이 조용히 생긴다.
   */
  const textInput = (
    key: PatentFieldKey,
    serverValue: string | null | undefined,
    extra?: {
      ref?: React.Ref<InputRef>;
      onFocus?: () => void;
      onBlur?: () => void;
      onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
    },
  ) => (
    <Input
      ref={extra?.ref}
      size="small"
      disabled={!canManage}
      value={save.textValue(key, serverValue)}
      onChange={(event) => save.editText(key, event.target.value, serverValue)}
      onFocus={extra?.onFocus}
      onBlur={() => {
        save.commitText(key);
        extra?.onBlur?.();
      }}
      onPressEnter={() => save.commitText(key)}
      onKeyDown={extra?.onKeyDown}
      status={save.stateOf(key).status === 'error' ? 'error' : undefined}
    />
  );

  /** 날짜 한 칸. 고르는 즉시 저장한다. */
  const dateInput = (key: PatentFieldKey, serverValue: string | null | undefined) => (
    <DatePicker
      size="small"
      disabled={!canManage}
      value={toDayjs(serverValue)}
      onChange={(next) => save.saveValue(key, next ? next.format('YYYY-MM-DD') : null)}
    />
  );

  const codeSelect = (
    key: PatentFieldKey,
    value: number | null | undefined,
    options: { value: number; label: string }[],
  ) => (
    <Select
      size="small"
      allowClear
      showSearch
      optionFilterProp="label"
      placeholder="없음"
      disabled={!canManage || !lookups}
      value={value ?? undefined}
      onChange={(next?: number) => save.saveValue(key, next ?? null)}
      options={options}
    />
  );

  const documentCount = record.documentCount ?? 0;
  /** 값이 하나도 없으면 그룹째 숨긴다. 빈 항목만 늘어놓지 않는다. */
  const rightsValues = [record.licenseAgreement, record.rightsChange, record.shareAgreement];
  const hasRights = rightsValues.some((value) => value && value.trim().length > 0);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={1120}
      destroyOnClose
      className="pm-detail-modal"
      title={
        <div className="pm-detail-title-bar">
          <Tag color="blue" style={{ margin: 0 }}>{record.target ?? '-'}</Tag>
          <span className="pm-detail-ref">{record.internalRef ?? '관리번호 없음'}</span>
          <span className="pm-detail-appno">{record.applicationNumber}</span>
          <span className="pm-detail-title-spacer" />
          {/* 가장 자주 보고 바꾸는 값이라 JIRA의 상태 드롭다운 자리에 올린다. */}
          <span className="pm-detail-status">
            {codeSelect(
              'legalStatusId',
              record.legalStatusId,
              (lookups?.legalStatuses ?? []).map((item) => ({ value: item.id, label: item.status })),
            )}
            {badgeFor('legalStatusId')}
          </span>
        </div>
      }
    >
      <div className="pm-detail-body">
        {/* ---- 왼쪽: 사람이 읽는 것 ---- */}
        <div className="pm-detail-main">
          {/*
            지금 보고 고치는 것(제목·설명)을 한 칸으로 묶는다. 아래 '활동'과 7:3으로
            나누려면 나눌 대상이 둘이어야 한다 — 섹션 셋이 나란히 있으면 비율을 줄 수 없다.
          */}
          <div className="pm-detail-primary">
            <section className="pm-detail-section">
              <div className={`pm-detail-heading-row${titleActive ? ' is-active' : ''}`}>
                {textInput('koreanTitle', record.koreanTitle, {
                  ref: titleRef,
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
                {badgeFor('koreanTitle')}
              </div>
              {titleActive && (
                /*
                  버튼을 누르는 동안 입력이 포커스를 잃으면 blur가 **먼저** 확정해 버려서
                  [취소]가 되돌릴 것이 남지 않는다. mousedown을 막아 포커스를 붙들어 두고,
                  할 일을 한 뒤에 우리가 직접 나간다.
                */
                <div className="pm-detail-inline-actions">
                  <Tooltip title="적용 (Enter)">
                    <button
                      type="button"
                      className="pm-inline-action"
                      aria-label="적용"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={applyTitle}
                    >
                      <Check size={15} />
                    </button>
                  </Tooltip>
                  <Tooltip title="취소 (Esc)">
                    <button
                      type="button"
                      className="pm-inline-action"
                      aria-label="취소"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={cancelTitle}
                    >
                      <X size={15} />
                    </button>
                  </Tooltip>
                </div>
              )}
            </section>

            <section className="pm-detail-section">
              <h4 className="pm-detail-section-title">설명</h4>
              <RichTextField
                value={record.note}
                readOnly={!canManage}
                onSave={(next) => save.saveField('note', next)}
                uploadImage={async (file) => patentRecordApi.uploadNoteImage(record.id, file)}
                deleteImage={(imageUrl) => patentRecordApi.removeNoteImage(record.id, imageUrl)}
                resolveImageUrl={patentRecordApi.noteImageDisplayUrl}
              />
            </section>
          </div>

          {/* 아래 3할. 지나간 기록이라 읽고 고치는 것과 자리를 갈라 둔다. */}
          <section className="pm-detail-section pm-detail-activity">
            <h4 className="pm-detail-section-title">활동</h4>
            <PatentAuditFeed patentId={record.id} revision={auditRevision} />
          </section>
        </div>

        {/* ---- 오른쪽: 코드·날짜 ---- */}
        <aside className="pm-detail-side">
          <Collapse
            ghost
            size="small"
            defaultActiveKey={['basic', 'links', 'status', 'dates']}
            items={[
              {
                key: 'basic',
                label: '기본',
                children: (
                  <>
                    <Row label="Target" badge={badgeFor('target')}>
                      <Select
                        size="small"
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        placeholder="없음"
                        disabled={!canManage || !lookups}
                        value={record.target ?? undefined}
                        onChange={(next?: string) => save.saveValue('target', next ?? null)}
                        options={(lookups?.targets ?? []).map((item) => ({
                          value: item.target,
                          label: item.target,
                        }))}
                      />
                    </Row>
                    <Row label="국가" badge={badgeFor('countryId')}>
                      {codeSelect(
                        'countryId',
                        record.countryId,
                        (lookups?.countries ?? []).map((item) => ({
                          value: item.id,
                          label: item.country,
                        })),
                      )}
                    </Row>
                    <Row label="출원인" badge={badgeFor('applicant')}>
                      {textInput('applicant', record.applicant)}
                    </Row>
                    <Row label="대리인" badge={badgeFor('attorneyNumber')}>
                      {codeSelect(
                        'attorneyNumber',
                        record.attorneyNumber,
                        (lookups?.attorneys ?? []).map((item) => ({
                          value: item.attorneyNumber,
                          label: item.attorneyName ?? String(item.attorneyNumber),
                        })),
                      )}
                    </Row>
                    <Row label="발명자">
                      <ReadOnly value={record.inventors} />
                    </Row>
                  </>
                ),
              },
              /*
                본문에 있던 '첨부 파일'·'하위 작업'·'연결된 업무 항목'이 여기로 왔다.

                셋 다 본문에서 한 칸씩 차지할 만큼 읽을 것이 없었다 — 문서는 건수와 여는
                버튼, 하위 작업은 전용 창으로 가는 길, 연결은 번호 한 줄과 관계 한 줄이다.
                본문은 사람이 읽는 것(제목·설명·활동)만 남기고, 이것들은 다른 필드와 같은
                줄 모양으로 사이드바에 세운다.

                '기본' 바로 다음에 두고 기본으로 펼쳐 둔다. 아래로 내리면 문서가 있는지조차
                모르게 된다 — 누를 것이 있는 그룹이라 접어 두면 안 된다.
              */
              {
                key: 'links',
                label: '연결',
                children: (
                  <>
                    <Row label="문서">
                      <div className="pm-detail-documents">
                        {documentCount > 0 ? (
                          <Button
                            size="small"
                            icon={<FileText size={13} />}
                            onClick={() => onOpenDocuments(record)}
                          >
                            {`${documentCount}건 열기`}
                          </Button>
                        ) : (
                          <ReadOnly value={null} />
                        )}
                        {canManage && (
                          <Tooltip title="출원번호로 OA DB를 찾아 통지서·제출 서류를 이어 붙입니다.">
                            <Button
                              size="small"
                              type="text"
                              loading={linkingDocuments}
                              icon={<Link2 size={13} />}
                              onClick={() => void linkDocuments()}
                            >
                              {documentCount > 0 ? '다시 연결' : '문서 연결'}
                            </Button>
                          </Tooltip>
                        )}
                      </div>
                    </Row>
                    {linkMessage && (
                      <Row label="">
                        <Text type="secondary" style={{ fontSize: 11 }}>{linkMessage}</Text>
                      </Row>
                    )}
                    {onOpenTodos && (
                      <Row label="하위 작업">
                        <Button
                          size="small"
                          icon={<ListChecks size={13} />}
                          onClick={() => onOpenTodos(record)}
                        >
                          To-do 열기
                        </Button>
                      </Row>
                    )}
                    <Row label="원출원번호" badge={badgeFor('parentApplicationNumber')}>
                      {textInput('parentApplicationNumber', record.parentApplicationNumber)}
                    </Row>
                    <Row label="관계">
                      <ReadOnly value={record.relationType} />
                    </Row>
                  </>
                ),
              },
              {
                key: 'status',
                label: '상태',
                children: (
                  <>
                    <Row label="심사 상태" badge={badgeFor('examStatusId')}>
                      {codeSelect(
                        'examStatusId',
                        record.examStatusId,
                        (lookups?.examStatuses ?? []).map((item) => ({
                          value: item.id,
                          label: item.status,
                        })),
                      )}
                    </Row>
                    <Row label="심사청구" badge={badgeFor('exam')}>
                      <Checkbox
                        disabled={!canManage}
                        checked={record.exam === true}
                        onChange={(event) => save.saveValue('exam', event.target.checked)}
                      />
                    </Row>
                    <Row label="심사일" badge={badgeFor('examDate')}>
                      {dateInput('examDate', record.examDate)}
                    </Row>
                  </>
                ),
              },
              {
                key: 'dates',
                label: '일자',
                children: (
                  <>
                    <Row label="출원일" badge={badgeFor('applicationDate')}>
                      {dateInput('applicationDate', record.applicationDate)}
                    </Row>
                    <Row label="공개일" badge={badgeFor('publicationDate')}>
                      {dateInput('publicationDate', record.publicationDate)}
                    </Row>
                    {/* registration_date는 컬럼이 문자열이다(형식이 제각각인 운영 시트 값을
                        보존한다). DatePicker로 바꾸면 기존 값을 잃는다. */}
                    <Row label="등록일" badge={badgeFor('registrationDate')}>
                      {textInput('registrationDate', record.registrationDate)}
                    </Row>
                    <Row label="예상 만료일">
                      <ReadOnly value={formatDisplayDateTime(record.expectedExpiryDate ?? null)} />
                    </Row>
                  </>
                ),
              },
              {
                key: 'numbers',
                label: '번호',
                children: (
                  <>
                    <Row label="출원번호" badge={badgeFor('applicationNumber')}>
                      {textInput('applicationNumber', record.applicationNumber)}
                    </Row>
                    <Row label="내부관리번호" badge={badgeFor('internalRef')}>
                      {textInput('internalRef', record.internalRef)}
                    </Row>
                    <Row label="공개번호" badge={badgeFor('publicationNumber')}>
                      {textInput('publicationNumber', record.publicationNumber)}
                    </Row>
                    <Row label="등록번호" badge={badgeFor('registrationNumber')}>
                      {textInput('registrationNumber', record.registrationNumber)}
                    </Row>
                  </>
                ),
              },
              {
                key: 'international',
                label: '국제(PCT)',
                children: (
                  <>
                    <Row label="국제출원번호" badge={badgeFor('intApplicationNumber')}>
                      {textInput('intApplicationNumber', record.intApplicationNumber)}
                    </Row>
                    <Row label="국제출원일" badge={badgeFor('intApplicationDate')}>
                      {dateInput('intApplicationDate', record.intApplicationDate)}
                    </Row>
                    <Row label="국제공개번호" badge={badgeFor('intPublicationNumber')}>
                      {textInput('intPublicationNumber', record.intPublicationNumber)}
                    </Row>
                    <Row label="국제공개일" badge={badgeFor('intPublicationDate')}>
                      {dateInput('intPublicationDate', record.intPublicationDate)}
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
                        <ReadOnly value={record.licenseAgreement} />
                      </Row>
                      <Row label="권리관계 변경">
                        <ReadOnly value={record.rightsChange} />
                      </Row>
                      <Row label="지분약정">
                        <ReadOnly value={record.shareAgreement} />
                      </Row>
                    </>
                  ),
                }]
                : []),
            ]}
          />

          <div className="pm-detail-stamps">
            {/* 감사 로그 마이그레이션 이전 행은 created_at이 마이그레이션 시점이다.
                실제 등록 시점이 아니라는 것을 툴팁으로 밝힌다. */}
            <span>{`만듦 ${formatDisplayDateTime(record.createdAt ?? null)}`}</span>
            <span>{`업데이트 ${formatDisplayDateTime(record.updatedAt ?? null)}`}</span>
          </div>
        </aside>
      </div>
    </Modal>
  );
};

export default PatentRecordDetailModal;
