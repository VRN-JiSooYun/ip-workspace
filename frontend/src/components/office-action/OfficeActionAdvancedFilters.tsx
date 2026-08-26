import React, { useState } from 'react';
import {
  Button,
  Collapse,
  DatePicker,
  InputNumber,
  Select,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { Check, ChevronDown, Info, Plus, Settings2 } from 'lucide-react';
import {
  PATENT_SEARCH_DATE_FIELDS,
  PATENT_SEARCH_DATE_FIELD_LABELS,
  type PatentSearchDateField,
  type PatentSearchFilters,
  type OaLookups,
} from '../../services/patentSearchApi';

const { Text } = Typography;

/**
 * 법종류. 외부 API는 `law_type`을 코드(int)나 명칭(str)으로 받는데, 실제로 데이터가 있는
 * 값은 이 둘뿐이다(1=특허법 13,488건 / 2=특허법 시행령 2,452건). 3 이상은 0건이다.
 * 명칭은 공백까지 정확히 맞아야 한다("특허법시행령"은 0건).
 */
export const LAW_TYPE_OPTIONS = ['특허법', '특허법 시행령', '실용신안법'] as const;

/** IPC 섹션은 표준 분류라 데이터와 무관하게 고정 목록이다. */
const IPC_SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

export type StatuteCondition = {
  lawTypeText: string;
  article?: number;
  paragraph?: number;
  subParagraph?: number;
};

export type IpcCondition = {
  section?: string;
  classCode?: string;
  subclass?: string;
  mainGroup?: string;
  subgroup?: string;
};

export type OfficeActionFilterState = {
  hasOpinion?: boolean;
  hasAmendment?: boolean;
  examRequested?: boolean;
  examinerNames: string[];
  attorneyNames: string[];
  legalStatusText: string[];
  examStatusText: string[];
  statutes: StatuteCondition[];
  ipc: IpcCondition[];
  dateField: PatentSearchDateField;
  /** `YYYY-MM-DD`. 저장된 날짜가 모두 자정이라 날짜만으로 경계가 정확히 잡힌다. */
  dateFrom?: string;
  dateTo?: string;
};

export const EMPTY_OFFICE_ACTION_FILTERS: OfficeActionFilterState = {
  examinerNames: [],
  attorneyNames: [],
  legalStatusText: [],
  examStatusText: [],
  statutes: [],
  ipc: [],
  dateField: 'applicationDate',
};

/** `특허법 시행령 제6조 제2호` */
export const statuteLabel = (statute: StatuteCondition): string =>
  [
    statute.lawTypeText,
    statute.article !== undefined ? `제${statute.article}조` : null,
    statute.paragraph !== undefined ? `제${statute.paragraph}항` : null,
    statute.subParagraph !== undefined ? `제${statute.subParagraph}호` : null,
  ]
    .filter(Boolean)
    .join(' ');

/** `A61K 31/198`. 뒤쪽 구성요소가 비어 있어도 있는 것까지만 조립한다. */
export const ipcLabel = (ipc: IpcCondition): string => {
  const code = [ipc.section, ipc.classCode, ipc.subclass].filter(Boolean).join('');
  const group =
    ipc.mainGroup && ipc.subgroup
      ? `${ipc.mainGroup}/${ipc.subgroup}`
      : (ipc.mainGroup ?? '');
  return [code, group].filter(Boolean).join(' ');
};

const hasAnyComponent = (ipc: IpcCondition) =>
  Object.values(ipc).some((value) => value !== undefined && value !== '');

/** 화면 상태 → API filter. 비어 있는 조건은 key 자체를 만들지 않는다. */
export const toPatentSearchFilters = (
  state: OfficeActionFilterState,
): PatentSearchFilters => ({
  ...(state.hasOpinion !== undefined ? { hasOpinion: state.hasOpinion } : {}),
  ...(state.hasAmendment !== undefined ? { hasAmendment: state.hasAmendment } : {}),
  ...(state.examRequested !== undefined ? { examRequested: state.examRequested } : {}),
  ...(state.examinerNames.length ? { examinerNames: state.examinerNames } : {}),
  ...(state.attorneyNames.length ? { attorneyNames: state.attorneyNames } : {}),
  ...(state.legalStatusText.length ? { legalStatusText: state.legalStatusText } : {}),
  ...(state.examStatusText.length ? { examStatusText: state.examStatusText } : {}),
  ...(state.statutes.length
    ? {
        statutes: state.statutes.map((statute) => ({
          lawTypeText: statute.lawTypeText,
          ...(statute.article !== undefined ? { article: statute.article } : {}),
          ...(statute.paragraph !== undefined ? { paragraph: statute.paragraph } : {}),
          ...(statute.subParagraph !== undefined
            ? { subParagraph: statute.subParagraph }
            : {}),
        })),
      }
    : {}),
  ...(state.ipc.length ? { ipc: state.ipc } : {}),
  // from/to 둘 다 없으면 기간 조건이 아니다.
  ...(state.dateFrom || state.dateTo
    ? {
        dateRanges: [
          {
            field: state.dateField,
            ...(state.dateFrom ? { from: state.dateFrom } : {}),
            ...(state.dateTo ? { to: state.dateTo } : {}),
          },
        ],
      }
    : {}),
});

/** 적용된 조건 개수. 접혀 있을 때 badge로 보여준다. */
export const countActiveFilters = (state: OfficeActionFilterState): number =>
  [
    state.hasOpinion !== undefined,
    state.hasAmendment !== undefined,
    state.examRequested !== undefined,
    state.examinerNames.length > 0,
    state.attorneyNames.length > 0,
    state.legalStatusText.length > 0,
    state.examStatusText.length > 0,
    state.statutes.length > 0,
    state.ipc.length > 0,
    Boolean(state.dateFrom || state.dateTo),
  ].filter(Boolean).length;

const YES_NO_OPTIONS = [
  { label: '유', value: true },
  { label: '무', value: false },
];

type Props = {
  value: OfficeActionFilterState;
  lookups: OaLookups | null;
  lookupsLoading?: boolean;
  /**
   * `useState`의 setter를 그대로 받는다. 한 tick에 두 필드가 바뀌어도 뒤쪽 갱신이
   * 앞쪽을 덮어쓰지 않도록 항상 updater 형태로 쓴다.
   */
  onChange: React.Dispatch<React.SetStateAction<OfficeActionFilterState>>;
  /**
   * '조건 적용'. 조건을 바꾸는 것만으로는 검색이 나가지 않는다 — 이 버튼이나 필터 안에서의
   * Enter(또는 검색 바의 '검색')가 지금 조건으로 다시 검색하게 한다.
   *
   * 호출 시점의 조건이 아니라 **다음 render의 조건**으로 검색되어야 한다. Enter는 태그 확정
   * 같은 조건 갱신과 같은 이벤트에서 일어나서, 그 자리에서 검색하면 방금 넣은 값이 빠진다.
   */
  onApply: () => void;
  /** 검색 중. 적용 버튼에 그대로 물린다. */
  applying?: boolean;
  /** 마지막 검색 이후 조건이 바뀌었는지. 아직 반영되지 않았음을 알려 주는 데 쓴다. */
  dirty?: boolean;
};

/** 라벨을 위에 두는 필드 한 칸. */
const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
  span?: number;
}> = ({ label, hint, children, span }) => (
  <div className="oa-field" style={span ? { gridColumn: `span ${span}` } : undefined}>
    <span className="oa-field-label">
      {label}
      {hint && (
        <Tooltip title={hint}>
          <Info size={12} className="oa-field-hint" />
        </Tooltip>
      )}
    </span>
    {children}
  </div>
);

/**
 * 고급 검색 필터.
 *
 * 법적상태·심사진행상태 option은 외부 OA PostgreSQL의 코드 테이블에서 받는다. 로컬
 * `patentRecordApi.lookups()`은 IP팀 관리 데이터의 별개 ID 체계라 이 검색에는 사용하지 않는다.
 */
const OfficeActionAdvancedFilters: React.FC<Props> = ({
  value,
  lookups,
  lookupsLoading = false,
  onChange,
  onApply,
  applying = false,
  dirty = false,
}) => {
  const [statuteDraft, setStatuteDraft] = useState<StatuteCondition>({ lawTypeText: '' });
  const [ipcDraft, setIpcDraft] = useState<IpcCondition>({});

  const patch = (next: Partial<OfficeActionFilterState>) =>
    onChange((prev) => ({ ...prev, ...next }));

  const addStatute = () => {
    if (!statuteDraft.lawTypeText) return;
    const label = statuteLabel(statuteDraft);
    onChange((prev) =>
      // 같은 조건을 두 번 넣어도 결과가 달라지지 않으므로 중복은 버린다.
      prev.statutes.some((statute) => statuteLabel(statute) === label)
        ? prev
        : { ...prev, statutes: [...prev.statutes, statuteDraft] },
    );
    setStatuteDraft({ lawTypeText: '' });
  };

  const addIpc = () => {
    if (!hasAnyComponent(ipcDraft)) return;
    const label = ipcLabel(ipcDraft);
    onChange((prev) =>
      prev.ipc.some((ipc) => ipcLabel(ipc) === label)
        ? prev
        : { ...prev, ipc: [...prev.ipc, ipcDraft] },
    );
    setIpcDraft({});
  };

  const activeCount = countActiveFilters(value);

  /**
   * 필터 안에서의 Enter = 조건 적용.
   *
   * 셀렉트·날짜 같은 antd 컴포넌트는 자기 Enter 처리(후보 확정, 날짜 확정)를 먼저 끝내고
   * 여기까지 올려 보낸다. 그래서 여기서는 '이번 Enter로 바뀐 조건까지 넣어 검색해 달라'고
   * 요청만 하면 된다(실제 검색은 조건이 반영된 다음 render에서 나간다).
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter') return;
    // 한글 조합을 끝내는 Enter는 입력의 일부다. 이걸로 검색하면 글자를 칠 때마다 검색된다.
    if (event.nativeEvent.isComposing) return;
    const target = event.target as HTMLElement;
    // 버튼 위에서의 Enter는 그 버튼을 누른 것이다(추가·초기화·적용·패널 접기).
    if (target.closest('button, [role="button"]')) return;
    // 법조문·IPC 칸의 Enter는 '추가'까지 대신 해 준다. 눈에 보이는 값이 조건에서 빠진 채
    // 검색되는 것이 제일 헷갈린다. 조건이 안 되는 draft라면 각 함수가 알아서 아무것도 안 한다.
    if (target.closest('.oa-subpanel-grid-statute')) addStatute();
    if (target.closest('.oa-subpanel-grid-ipc')) addIpc();
    onApply();
  };

  return (
    <div className="oa-card oa-filters" onKeyDown={handleKeyDown}>
      <Collapse
        ghost
        defaultActiveKey={['advanced']}
        // 시안처럼 라벨 바로 뒤에 chevron을 두려고 antd 기본 아이콘은 끈다.
        expandIcon={() => null}
        items={[
          {
            key: 'advanced',
            label: (
              <span className="oa-filters-header">
                <Settings2 size={18} className="oa-filters-header-icon" />
                <span className="oa-filters-header-title">고급 검색</span>
                <ChevronDown size={16} className="oa-filters-header-chevron" />
                {activeCount > 0 && (
                  <Tag className="oa-filters-count">{`${activeCount}개 적용`}</Tag>
                )}
              </span>
            ),
            children: (
              <>
                <div className="oa-filter-grid">
                  <Field label="의견서 유무">
                    <Select
                      allowClear
                      placeholder="전체"
                      value={value.hasOpinion}
                      onChange={(next) => patch({ hasOpinion: next ?? undefined })}
                      options={YES_NO_OPTIONS}
                    />
                  </Field>
                  <Field label="보정서 유무">
                    <Select
                      allowClear
                      placeholder="전체"
                      value={value.hasAmendment}
                      onChange={(next) => patch({ hasAmendment: next ?? undefined })}
                      options={YES_NO_OPTIONS}
                    />
                  </Field>
                  <Field
                    label="심사관"
                  >
                    <Select
                      mode="tags"
                      allowClear
                      placeholder="이름 입력"
                      value={value.examinerNames}
                      onChange={(next: string[]) => patch({ examinerNames: next })}
                      // 자유 입력 전용이라 자동완성 목록은 띄우지 않는다.
                      open={false}
                      suffixIcon={null}
                    />
                  </Field>
                  <Field label="대리인" hint="API 연동 예정">
                    <Select
                      mode="tags"
                      allowClear
                      placeholder="이름 입력"
                      value={value.attorneyNames}
                      onChange={(next: string[]) => patch({ attorneyNames: next })}
                      open={false}
                      suffixIcon={null}
                    />
                  </Field>
                  <Field label="법적상태">
                    <Select
                      mode="multiple"
                      allowClear
                      showSearch
                      placeholder="전체"
                      value={value.legalStatusText}
                      onChange={(next: string[]) => patch({ legalStatusText: next })}
                      optionFilterProp="label"
                      loading={lookupsLoading}
                      disabled={!lookups}
                      options={(lookups?.legalStatuses ?? []).map((item) => ({
                        label: item.status,
                        value: item.status,
                      }))}
                    />
                  </Field>
                  <Field label="심사청구 여부">
                    <Select
                      allowClear
                      placeholder="전체"
                      value={value.examRequested}
                      onChange={(next) => patch({ examRequested: next ?? undefined })}
                      options={YES_NO_OPTIONS}
                    />
                  </Field>
                  <Field label="심사진행상태">
                    <Select
                      mode="multiple"
                      allowClear
                      showSearch
                      placeholder="전체"
                      value={value.examStatusText}
                      onChange={(next: string[]) => patch({ examStatusText: next })}
                      optionFilterProp="label"
                      loading={lookupsLoading}
                      disabled={!lookups}
                      options={(lookups?.examStatuses ?? []).map((item) => ({
                        label: item.status,
                        value: item.status,
                      }))}
                    />
                  </Field>
                </div>

                {/* ---- 법조문 ---- */}
                <div className="oa-subpanel">
                  <div className="oa-subpanel-grid oa-subpanel-grid-statute">
                    <Field label="법 유형">
                      <Select
                        allowClear
                        placeholder="선택"
                        value={statuteDraft.lawTypeText || undefined}
                        onChange={(next: string) =>
                          setStatuteDraft({ ...statuteDraft, lawTypeText: next ?? '' })
                        }
                        options={LAW_TYPE_OPTIONS.map((lawType) => ({
                          label: lawType,
                          value: lawType,
                        }))}
                      />
                    </Field>
                    <Field label="조">
                      <InputNumber
                        min={1}
                        placeholder="29"
                        value={statuteDraft.article}
                        onChange={(next) =>
                          setStatuteDraft({ ...statuteDraft, article: next ?? undefined })
                        }
                      />
                    </Field>
                    <Field label="항">
                      <InputNumber
                        min={1}
                        placeholder="1"
                        value={statuteDraft.paragraph}
                        onChange={(next) =>
                          setStatuteDraft({ ...statuteDraft, paragraph: next ?? undefined })
                        }
                      />
                    </Field>
                    <Field label="호">
                      <InputNumber
                        min={1}
                        placeholder="2"
                        value={statuteDraft.subParagraph}
                        onChange={(next) =>
                          setStatuteDraft({
                            ...statuteDraft,
                            subParagraph: next ?? undefined,
                          })
                        }
                      />
                    </Field>
                    <Field label=" ">
                      <Button
                        icon={<Plus size={14} />}
                        disabled={!statuteDraft.lawTypeText}
                        onClick={addStatute}
                        block
                      >
                        추가
                      </Button>
                    </Field>
                  </div>
                </div>
                {value.statutes.length > 0 && (
                  <div className="oa-tag-row">
                    {value.statutes.map((statute) => {
                      const label = statuteLabel(statute);
                      return (
                        <Tag
                          key={label}
                          closable
                          className="oa-condition-tag"
                          onClose={() =>
                            onChange((prev) => ({
                              ...prev,
                              statutes: prev.statutes.filter(
                                (item) => statuteLabel(item) !== label,
                              ),
                            }))
                          }
                        >
                          {label}
                        </Tag>
                      );
                    })}
                  </div>
                )}

                {/* ---- IPC ---- */}
                <div className="oa-subpanel">
                  <div className="oa-subpanel-grid oa-subpanel-grid-ipc">
                    <Field label="IPC 섹션">
                      <Select
                        allowClear
                        placeholder="A"
                        value={ipcDraft.section}
                        onChange={(next: string) =>
                          setIpcDraft({ ...ipcDraft, section: next ?? undefined })
                        }
                        options={IPC_SECTIONS.map((section) => ({
                          label: section,
                          value: section,
                        }))}
                      />
                    </Field>
                    {/* 시안에는 '서브클래스'가 두 번 있으나 앞쪽(61)은 클래스다. */}
                    <Field label="클래스">
                      <Select
                        mode="tags"
                        maxCount={1}
                        allowClear
                        placeholder="61"
                        value={ipcDraft.classCode ? [ipcDraft.classCode] : []}
                        onChange={(next: string[]) =>
                          setIpcDraft({ ...ipcDraft, classCode: next[0] })
                        }
                        open={false}
                        suffixIcon={null}
                      />
                    </Field>
                    <Field label="서브클래스">
                      <Select
                        mode="tags"
                        maxCount={1}
                        allowClear
                        placeholder="K"
                        value={ipcDraft.subclass ? [ipcDraft.subclass] : []}
                        onChange={(next: string[]) =>
                          setIpcDraft({ ...ipcDraft, subclass: next[0]?.toUpperCase() })
                        }
                        open={false}
                        suffixIcon={null}
                      />
                    </Field>
                    <Field label="메인그룹">
                      <Select
                        mode="tags"
                        maxCount={1}
                        allowClear
                        placeholder="31"
                        value={ipcDraft.mainGroup ? [ipcDraft.mainGroup] : []}
                        onChange={(next: string[]) =>
                          setIpcDraft({ ...ipcDraft, mainGroup: next[0] })
                        }
                        open={false}
                        suffixIcon={null}
                      />
                    </Field>
                    <Field label="서브그룹">
                      <Select
                        mode="tags"
                        maxCount={1}
                        allowClear
                        placeholder="198"
                        value={ipcDraft.subgroup ? [ipcDraft.subgroup] : []}
                        onChange={(next: string[]) =>
                          setIpcDraft({ ...ipcDraft, subgroup: next[0] })
                        }
                        open={false}
                        suffixIcon={null}
                      />
                    </Field>
                    <Field label=" ">
                      <Button
                        icon={<Plus size={14} />}
                        disabled={!hasAnyComponent(ipcDraft)}
                        onClick={addIpc}
                        block
                      >
                        추가
                      </Button>
                    </Field>
                  </div>
                </div>
                {value.ipc.length > 0 && (
                  <div className="oa-tag-row">
                    {value.ipc.map((ipc) => {
                      const label = ipcLabel(ipc);
                      return (
                        <Tag
                          key={label}
                          closable
                          className="oa-condition-tag"
                          onClose={() =>
                            onChange((prev) => ({
                              ...prev,
                              ipc: prev.ipc.filter((item) => ipcLabel(item) !== label),
                            }))
                          }
                        >
                          {label}
                        </Tag>
                      );
                    })}
                  </div>
                )}

                {/* ---- 기간 ---- */}
                <div className="oa-subpanel">
                  <div className="oa-subpanel-grid oa-subpanel-grid-date">
                    <Field
                      label="날짜 유형"
                      hint="API 연동 예정"
                    >
                      <Select
                        value={value.dateField}
                        onChange={(next: PatentSearchDateField) =>
                          patch({ dateField: next })
                        }
                        options={PATENT_SEARCH_DATE_FIELDS.map((field) => ({
                          label: PATENT_SEARCH_DATE_FIELD_LABELS[field],
                          value: field,
                        }))}
                      />
                    </Field>
                    <Field label="부터">
                      <DatePicker
                        format="YYYY.MM.DD"
                        placeholder="연도 - 월 - 일"
                        value={value.dateFrom ? dayjs(value.dateFrom) : null}
                        onChange={(date) =>
                          patch({ dateFrom: date ? date.format('YYYY-MM-DD') : undefined })
                        }
                      />
                    </Field>
                    <Field label="까지">
                      <DatePicker
                        format="YYYY.MM.DD"
                        placeholder="연도 - 월 - 일"
                        value={value.dateTo ? dayjs(value.dateTo) : null}
                        onChange={(date) =>
                          patch({ dateTo: date ? date.format('YYYY-MM-DD') : undefined })
                        }
                      />
                    </Field>
                  </div>
                </div>

                <div className="oa-filters-footer">
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dirty
                      ? '변경한 조건은 아직 검색에 반영되지 않았습니다. Enter로도 적용됩니다.'
                      : '법조문·IPC는 여러 건을 추가할 수 있습니다.'}
                  </Text>
                  <div className="oa-filters-footer-actions">
                    <Button
                      disabled={activeCount === 0}
                      onClick={() => onChange(EMPTY_OFFICE_ACTION_FILTERS)}
                    >
                      조건 초기화
                    </Button>
                    {/* 본문 검색과 별개다. 여기 조건만 다시 걸어 검색한다. */}
                    <Button
                      type="primary"
                      loading={applying}
                      onClick={onApply}
                      icon={<Check size={16} />}
                    >
                      조건 적용
                    </Button>
                  </div>
                </div>
              </>
            ),
          },
        ]}
      />
    </div>
  );
};

export default OfficeActionAdvancedFilters;
