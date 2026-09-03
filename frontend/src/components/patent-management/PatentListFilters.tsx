import React, { useEffect, useRef, useState } from 'react';
import { Button, DatePicker, Input, Select, Tag } from 'antd';
import dayjs from 'dayjs';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import type {
  PatentQualityFilter,
  PatentRecordLookups,
  PatentStageSummary,
} from '../../services/patentRecordApi';
import { UNMAPPED_STAGE_GROUP } from '../../services/patentRecordApi';
import { buildCountryOption, filterCountryOption } from '../common/CountryTag';
import '../../styles/filter-system.css';
import './PatentListFilters.css';

const { RangePicker } = DatePicker;

/**
 * 목록·집계가 공유하는 상세 조건. 이름은 백엔드 DTO(PatentStageQueryDto)와 맞춘다.
 * 여기에 항목을 더하려면 그 DTO에도 같이 넣어야 한다.
 *
 * 목록 표의 모든 열에 대응하는 조건이 들어 있다. 열을 늘리면 여기·DTO·서비스의
 * buildListWhere 세 곳을 함께 고쳐야 한다.
 */
export type PatentListFilterValues = {
  // ---- 코드·OA 명칭 조건 ----
  /** 로컬 country.id. 상세 검색의 국가 select가 쓰는 조건이다. */
  countryId?: number;
  /**
   * country.country 원문(완전 일치). 옛 딥링크가 이름으로 걸어 오는 경우를 위해 남겨 둔다
   * — select는 코드(id)로 고른다.
   */
  countryText?: string;
  /** 로컬 legal_status.id. 상세 검색의 법적상태 select가 쓰는 조건이다. */
  legalStatusId?: number;
  /**
   * legal_status.status 원문(완전 일치). 옛 딥링크가 이름으로 걸어 오는 경우를 위해
   * 남겨 둔다 — select는 코드(id)로 고른다.
   */
  legalStatusText?: string;
  attorneyNumber?: number;

  // ---- 부분 일치 조건 ----
  internalRef?: string;
  applicationNumber?: string;
  /** 국문·영문 명칭 어느 쪽이든 걸리면 통과한다. */
  title?: string;
  applicant?: string;
  registrationNumber?: string;

  // ---- 범위·유무 ----
  /** 출원일 시작(YYYY-MM-DD, 포함). */
  applicationDateFrom?: string;
  /** 출원일 끝(YYYY-MM-DD, 포함). */
  applicationDateTo?: string;
  /** 문서 유무. true면 있는 것, false면 없는 것만. */
  hasDocuments?: boolean;

  /** 진행 현황 popover에서 고른 세부 단계(patent_stage.code). select가 아니라 칩으로 보인다. */
  stageCode?: string;
  /**
   * 데이터 품질 조건. 대시보드 품질 카드에서 딥링크로 들어온다. stageCode와 마찬가지로
   * 이 화면에서 고를 수는 없고 칩으로만 되짚는다.
   */
  quality?: PatentQualityFilter;
};

/** 품질 조건 칩에 쓸 이름. 대시보드 카드의 라벨과 같아야 넘어온 맥락이 이어진다. */
export const PATENT_QUALITY_LABELS: Record<PatentQualityFilter, string> = {
  unmappedStatus: '진행 단계 미매핑',
  refParseFailed: '관리번호 규칙 불일치',
  missingApplicationDate: '출원일 누락',
  missingExpectedExpiry: '예상 만료일 누락',
  noTodo: 'To-do 없는 진행 건',
};

/**
 * 텍스트 조건을 서버로 보내기 전에 기다리는 시간.
 *
 * 글자마다 보내면 '보로노이'를 치는 동안 목록 조회가 다섯 번 나간다. 응답이 뒤섞여
 * 마지막 글자가 아닌 결과가 남을 수도 있다. 입력은 즉시 화면에 보이고(초안), 조회만 미룬다.
 */
const TEXT_FILTER_DEBOUNCE = 350;

/** 부분 일치 조건의 key. 이것만 초안을 거쳐 디바운스된다. */
const TEXT_KEYS = [
  'internalRef',
  'applicationNumber',
  'title',
  'applicant',
  'registrationNumber',
] as const;

type TextKey = typeof TEXT_KEYS[number];
type TextDraft = Record<TextKey, string>;

const toDraft = (values: PatentListFilterValues): TextDraft => (
  TEXT_KEYS.reduce((draft, key) => {
    draft[key] = values[key] ?? '';
    return draft;
  }, {} as TextDraft)
);

/** 빈 문자열은 조건 없음(undefined)으로 되돌린다. 빈 값을 보내면 전체를 훑는 조건이 된다. */
const fromDraft = (draft: TextDraft): PatentListFilterValues => (
  TEXT_KEYS.reduce((patch, key) => {
    const value = draft[key].trim();
    return { ...patch, [key]: value.length > 0 ? value : undefined };
  }, {} as PatentListFilterValues)
);

/** 문서 유무는 3-상태다(전체 / 있음 / 없음). undefined가 '전체'다. */
const DOCUMENT_OPTIONS = [
  { value: true, label: '있음' },
  { value: false, label: '없음' },
];

type Props = {
  /**
   * 로컬 코드 목록(특허 코드 관리가 고치는 표). Target·대리인·국가·법적상태 select와
   * 로컬 ID 딥링크 라벨에 쓴다.
   */
  lookups: PatentRecordLookups | null;
  values: PatentListFilterValues;
  onChange: (next: PatentListFilterValues) => void;

  /** Target 다중 선택. 대시보드 딥링크로 들어온 값도 이 select에 그대로 보인다. */
  selectedTargets: string[];
  onTargetsChange: (next: string[]) => void;

  /**
   * 진행 단계 대분류. 단계 목록과 건수는 집계 응답에서 온다 — 코드 표를 따로 받지 않고
   * 지금 조건에서 각 단계가 몇 건인지 함께 보여 주려면 이쪽이 맞다.
   */
  stageGroup: string | null;
  onStageGroupChange: (next: string | null) => void;
  stageSummary: PatentStageSummary | null;

  /** stageCode는 코드라서 그대로 보여줄 수 없다. 진행 현황이 아는 라벨을 받아 쓴다. */
  stageCodeLabel?: string;
};

/** 라벨을 위에 두는 필드 한 칸. 의견제출통지서 화면의 `Field`와 같은 구조다. */
const Field: React.FC<{ label: string; children: React.ReactNode; wide?: boolean }> = ({
  label,
  children,
  wide,
}) => (
  <div className={`filter-field${wide ? ' filter-field-wide' : ''}`}>
    <span className="filter-field-label">{label}</span>
    {children}
  </div>
);

/**
 * 관리 특허 목록 상세 검색 필터.
 *
 * 목록 표의 **모든 열**에 대응하는 조건이 여기 한 자리에 모여 있다. 열마다 헤더
 * 드롭다운을 다는 방식도 있지만, 그러면 지금 몇 개가 걸렸는지·한 번에 초기화하는 일이
 * 두 군데로 갈린다. Target과 진행 단계도 예전에는 별도 패널이었는데 같은 이유로 들여왔다.
 *
 * 후보 값은 모두 로컬 코드 표(특허 코드 관리)에서 온다. 헤더의 통합 검색바(q)는 그대로 남는다. "번호 일부는 아는데 어느 열인지 모르겠다"는
 * 검색은 열별 조건으로 표현할 수 없어 둘이 서로를 대체하지 않는다(서로 AND).
 *
 * 레이아웃은 의견제출통지서의 '고급 검색'과 같은 프리미티브(filter-system.css)를 쓴다.
 */
const PatentListFilters: React.FC<Props> = ({
  lookups,
  values,
  onChange,
  selectedTargets,
  onTargetsChange,
  stageGroup,
  onStageGroupChange,
  stageSummary,
  stageCodeLabel,
}) => {
  const set = (patch: PatentListFilterValues) => onChange({ ...values, ...patch });

  // ---- 텍스트 조건: 즉시 보이고, 조회만 미룬다 ----------------------------

  const [draft, setDraft] = useState<TextDraft>(() => toDraft(values));
  const pushTimer = useRef<number | null>(null);
  /**
   * 미룬 push가 실행될 때의 '텍스트 아닌 조건'을 최신으로 읽기 위한 상자.
   * values를 클로저로 물면 기다리는 동안 바뀐 select 선택을 되돌려 버린다.
   */
  const latestValues = useRef(values);
  latestValues.current = values;

  const cancelPush = () => {
    if (pushTimer.current !== null) {
      window.clearTimeout(pushTimer.current);
      pushTimer.current = null;
    }
  };

  useEffect(() => cancelPush, []);

  /**
   * 밖에서 값이 바뀌면(초기화 버튼, 대시보드 딥링크, 칩 닫기) 초안을 맞춘다.
   * 기다리던 push는 버린다 — 그대로 두면 방금 지운 조건이 되살아난다.
   */
  const externalText = TEXT_KEYS.map((key) => values[key] ?? '').join('\u0000');
  useEffect(() => {
    setDraft((current) => {
      const next = toDraft(latestValues.current);
      // 내가 방금 보낸 값이 돌아온 것이면 초안을 건드리지 않는다(커서가 튀지 않게).
      const same = TEXT_KEYS.every((key) => current[key].trim() === next[key]);
      if (same) return current;
      cancelPush();
      return next;
    });
  }, [externalText]);

  const editText = (key: TextKey) => (
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setDraft((current) => {
        const next = { ...current, [key]: value };
        cancelPush();
        // 초안 전체를 보낸다. 한 필드씩 보내면 빠르게 두 칸을 칠 때 앞의 것이 사라진다.
        pushTimer.current = window.setTimeout(() => {
          pushTimer.current = null;
          onChange({ ...latestValues.current, ...fromDraft(next) });
        }, TEXT_FILTER_DEBOUNCE);
        return next;
      });
    }
  );

  const columnCount = [
    values.countryText ?? values.countryId,
    values.legalStatusText ?? values.legalStatusId,
    values.attorneyNumber,
    values.internalRef,
    values.applicationNumber,
    values.title,
    values.applicant,
    values.registrationNumber,
    values.hasDocuments,
    values.stageCode,
    values.quality,
  ].filter((value) => value !== undefined).length;

  const activeCount =
    columnCount +
    // 출원일은 시작·끝이 한 조건이다. 둘 중 하나만 있어도 1개로 센다.
    (values.applicationDateFrom !== undefined || values.applicationDateTo !== undefined ? 1 : 0) +
    (selectedTargets.length > 0 ? 1 : 0) +
    (stageGroup !== null ? 1 : 0);

  const reset = () => {
    cancelPush();
    setDraft(toDraft({}));
    onChange({});
    onTargetsChange([]);
    onStageGroupChange(null);
  };

  /** 단계 select 옵션. 미매핑 건도 버리지 않고 마지막에 붙인다. */
  const stageOptions = [
    ...(stageSummary?.groups ?? []).map((group) => ({
      value: group.code,
      label: `${group.label} (${group.count})`,
    })),
    ...(stageSummary && stageSummary.unmapped.count > 0
      ? [{
        value: UNMAPPED_STAGE_GROUP,
        label: `미분류 (${stageSummary.unmapped.count})`,
      }]
      : []),
  ];

  /**
   * 국가도 법적상태와 같다 — **로컬 코드 표**(특허 코드 관리)의 값을 코드(id)로 고른다.
   * 목록 표와 상세 모달이 이미 이 코드(patent.country)를 보여 주고 고치기 때문이다.
   */
  const countryOptions = (lookups?.countries ?? [])
    .map((item) => buildCountryOption(item.id, item.country));
  /** 이름으로 들어온 옛 딥링크는 같은 코드가 있으면 그 코드로 바꿔 보여 준다. */
  const countryTextId = values.countryText
    ? lookups?.countries.find((item) => item.country === values.countryText)?.id
    : undefined;
  const selectedCountry = values.countryId ?? countryTextId;
  /** 코드 표에 없는 이름으로 들어온 조건. select로는 못 고르므로 칩으로 되짚는다. */
  const orphanCountryText = values.countryText && countryTextId === undefined
    ? values.countryText
    : undefined;
  /**
   * 법적상태는 **로컬 코드 표**(특허 코드 관리)의 값을 고른다. OA DB 원문이 아니라 이쪽이
   * 정본인 이유는 목록 표와 상세 모달이 이미 이 코드(patent.legal_status)를 보여 주고
   * 고치기 때문이다. 옵션만 OA 원문에서 뽑으면 코드 표에 있는 값이 목록에서 안 걸리고,
   * 코드 표에 없는 값이 후보로 뜬다.
   */
  const legalStatusOptions = (lookups?.legalStatuses ?? []).map((item) => ({
    value: item.id,
    label: item.status,
  }));
  /** 이름으로 들어온 옛 딥링크는 같은 이름의 코드가 있으면 그 코드로 바꿔 보여 준다. */
  const legalStatusTextId = values.legalStatusText
    ? lookups?.legalStatuses.find((item) => item.status === values.legalStatusText)?.id
    : undefined;
  const selectedLegalStatus = values.legalStatusId ?? legalStatusTextId;
  /** 코드 표에 없는 이름으로 들어온 조건. select로는 못 고르므로 칩으로 되짚는다. */
  const orphanLegalStatusText = values.legalStatusText && legalStatusTextId === undefined
    ? values.legalStatusText
    : undefined;

  return (
    <section className="filter-subpanel pm-detail-filters">
      <div className="pm-detail-filters-head">
        <span className="filter-subpanel-header">
          <span className="filter-subpanel-header-icon">
            <SlidersHorizontal size={16} />
          </span>
          <span className="filter-subpanel-title">상세 검색</span>
          {activeCount > 0 && (
            <Tag className="filter-count-tag">{`${activeCount}개 적용`}</Tag>
          )}
          {/* select로 고를 수 없는 조건(대시보드에서 딥링크로 들어온 것)은 칩으로 되짚는다. */}
          {values.stageCode !== undefined && (
            <Tag
              closable
              title={`진행 단계: ${stageCodeLabel ?? values.stageCode}`}
              onClose={() => onChange({ ...values, stageCode: undefined })}
              className="pm-detail-filters-stage-tag"
            >
              {stageCodeLabel ?? values.stageCode}
            </Tag>
          )}
          {orphanCountryText !== undefined && (
            <Tag
              closable
              title={`국가: ${orphanCountryText} (코드 표에 없는 값)`}
              onClose={() => onChange({ ...values, countryText: undefined })}
              className="pm-detail-filters-stage-tag"
            >
              {orphanCountryText}
            </Tag>
          )}
          {orphanLegalStatusText !== undefined && (
            <Tag
              closable
              title={`법적상태: ${orphanLegalStatusText} (코드 표에 없는 값)`}
              onClose={() => onChange({ ...values, legalStatusText: undefined })}
              className="pm-detail-filters-stage-tag"
            >
              {orphanLegalStatusText}
            </Tag>
          )}
          {values.quality !== undefined && (
            <Tag
              closable
              title={`데이터 품질: ${PATENT_QUALITY_LABELS[values.quality]}`}
              onClose={() => onChange({ ...values, quality: undefined })}
              className="pm-detail-filters-stage-tag"
            >
              {PATENT_QUALITY_LABELS[values.quality]}
            </Tag>
          )}
        </span>
        <Button
          size="small"
          type="text"
          icon={<RotateCcw size={13} />}
          disabled={activeCount === 0}
          onClick={reset}
          aria-label="상세 검색 조건 초기화"
        >
          초기화
        </Button>
      </div>

      <div className="filter-grid">
        {/* Target은 여러 개를 고를 수 있어 한 칸을 넓게 쓴다. */}
        <Field label="Target" wide>
          <Select
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="전체"
            aria-label="Target으로 거르기"
            value={selectedTargets}
            onChange={onTargetsChange}
            disabled={!lookups}
            maxTagCount="responsive"
            options={(lookups?.targets ?? []).map((item) => ({
              value: item.target,
              label: item.target,
            }))}
          />
        </Field>

        <Field label="진행 단계">
          <Select
            allowClear
            placeholder="전체"
            aria-label="진행 단계로 거르기"
            value={stageGroup ?? undefined}
            onChange={(next?: string) => onStageGroupChange(next ?? null)}
            disabled={stageOptions.length === 0}
            options={stageOptions}
          />
        </Field>

        <Field label="내부관리번호">
          <Input
            allowClear
            placeholder=""
            aria-label="내부관리번호로 거르기"
            value={draft.internalRef}
            onChange={editText('internalRef')}
          />
        </Field>

        <Field label="국가">
          <Select
            allowClear
            placeholder="전체"
            aria-label="국가로 거르기"
            value={selectedCountry}
            // 이름 조건과 코드 조건이 함께 걸리면 서로 좁혀 0건이 된다. 하나만 남긴다.
            onChange={(countryId?: number) => set({ countryId, countryText: undefined })}
            disabled={!lookups}
            showSearch
            filterOption={filterCountryOption}
            options={countryOptions}
          />
        </Field>

        <Field label="출원번호">
          <Input
            allowClear
            placeholder=""
            aria-label="출원번호로 거르기"
            value={draft.applicationNumber}
            onChange={editText('applicationNumber')}
          />
        </Field>

        {/* 기간 선택은 두 칸 폭이 필요하다(시작·끝 + 구분자). */}
        <Field label="출원일" wide>
          <RangePicker
            allowEmpty={[true, true]}
            aria-label="출원일 기간으로 거르기"
            value={[
              values.applicationDateFrom ? dayjs(values.applicationDateFrom) : null,
              values.applicationDateTo ? dayjs(values.applicationDateTo) : null,
            ]}
            onChange={(range) => set({
              applicationDateFrom: range?.[0]?.format('YYYY-MM-DD'),
              applicationDateTo: range?.[1]?.format('YYYY-MM-DD'),
            })}
          />
        </Field>

        <Field label="명칭" wide>
          <Input
            allowClear
            placeholder="국문·영문 부분 일치"
            aria-label="명칭으로 거르기"
            value={draft.title}
            onChange={editText('title')}
          />
        </Field>

        <Field label="출원인">
          <Input
            allowClear
            placeholder=""
            aria-label="출원인으로 거르기"
            value={draft.applicant}
            onChange={editText('applicant')}
          />
        </Field>

        <Field label="대리인">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="전체"
            aria-label="대리인으로 거르기"
            value={values.attorneyNumber}
            onChange={(attorneyNumber?: number) => set({ attorneyNumber })}
            disabled={!lookups}
            options={(lookups?.attorneys ?? []).map((item) => ({
              value: item.attorneyNumber,
              label: item.attorneyName,
            }))}
          />
        </Field>

        <Field label="법적상태">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="전체"
            aria-label="법적상태로 거르기"
            value={selectedLegalStatus}
            onChange={(legalStatusId?: number) => set({
              legalStatusId,
              // 이름 조건과 코드 조건이 함께 걸리면 서로 좁혀 0건이 된다. 하나만 남긴다.
              legalStatusText: undefined,
            })}
            disabled={!lookups}
            options={legalStatusOptions}
          />
        </Field>

        <Field label="등록번호">
          <Input
            allowClear
            placeholder=""
            aria-label="등록번호로 거르기"
            value={draft.registrationNumber}
            onChange={editText('registrationNumber')}
          />
        </Field>

        <Field label="문서">
          <Select
            allowClear
            placeholder="전체"
            aria-label="문서 유무로 거르기"
            value={values.hasDocuments}
            onChange={(hasDocuments?: boolean) => set({ hasDocuments })}
            options={DOCUMENT_OPTIONS}
          />
        </Field>
      </div>
    </section>
  );
};

export default PatentListFilters;
