import React from 'react';
import { Button, Select, Tag } from 'antd';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { PatentRecordLookups } from '../../services/patentRecordApi';
import '../../styles/filter-system.css';
import './PatentListFilters.css';

/**
 * 목록·집계가 공유하는 상세 조건. 이름은 백엔드 DTO(PatentStageQueryDto)와 맞춘다.
 * 여기에 항목을 더하려면 그 DTO에도 같이 넣어야 한다.
 */
export type PatentListFilterValues = {
  countryId?: number;
  legalStatusId?: number;
  examStatusId?: number;
  /** 진행 현황 popover에서 고른 세부 단계(patent_stage.code). select가 아니라 칩으로 보인다. */
  stageCode?: string;
};

type Props = {
  /** null이면 아직 코드 목록을 못 받은 상태다. select는 비활성으로 둔다. */
  lookups: PatentRecordLookups | null;
  values: PatentListFilterValues;
  onChange: (next: PatentListFilterValues) => void;
  /** Target 선택은 아래 Target 카드가 갖는다. 여기서는 적용 개수와 초기화에만 쓴다. */
  selectedTargets: string[];
  onResetTargets: () => void;
  /** stageCode는 코드라서 그대로 보여줄 수 없다. 진행 현황이 아는 라벨을 받아 쓴다. */
  stageCodeLabel?: string;
};

/** 라벨을 위에 두는 필드 한 칸. 의견제출통지서 화면의 `Field`와 같은 구조다. */
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="filter-field">
    <span className="filter-field-label">{label}</span>
    {children}
  </div>
);

/**
 * 관리 특허 목록 상세 검색 필터.
 *
 * 키워드 검색(q)은 헤더 검색바가, Target은 Target 카드가 담당한다. 여기서는 헤더에
 * 넣기엔 긴 코드성 조건만 다룬다.
 *
 * 레이아웃은 의견제출통지서의 '고급 검색'과 같은 프리미티브(filter-system.css)를 쓴다.
 */
const PatentListFilters: React.FC<Props> = ({
  lookups,
  values,
  onChange,
  selectedTargets,
  onResetTargets,
  stageCodeLabel,
}) => {
  const set = (patch: PatentListFilterValues) => onChange({ ...values, ...patch });

  const activeCount =
    (values.countryId !== undefined ? 1 : 0) +
    (values.legalStatusId !== undefined ? 1 : 0) +
    (values.examStatusId !== undefined ? 1 : 0) +
    (values.stageCode !== undefined ? 1 : 0) +
    (selectedTargets.length > 0 ? 1 : 0);

  const reset = () => {
    onChange({});
    onResetTargets();
  };

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
          {/* select로 고를 수 없는 조건(진행 현황 popover에서 들어온 단계)은 칩으로 되짚는다.
              카드가 고정 높이라 줄을 새로 만들지 않고 머리줄에 얹는다. */}
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
        <Field label="국가">
          <Select
            allowClear
            placeholder="전체"
            aria-label="국가로 거르기"
            value={values.countryId}
            onChange={(countryId?: number) => set({ countryId })}
            disabled={!lookups}
            options={(lookups?.countries ?? []).map((item) => ({
              value: item.id,
              label: item.country,
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
            value={values.legalStatusId}
            onChange={(legalStatusId?: number) => set({ legalStatusId })}
            disabled={!lookups}
            options={(lookups?.legalStatuses ?? []).map((item) => ({
              value: item.id,
              label: item.status,
            }))}
          />
        </Field>
        <Field label="심사상태">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="전체"
            aria-label="심사상태로 거르기"
            value={values.examStatusId}
            onChange={(examStatusId?: number) => set({ examStatusId })}
            disabled={!lookups}
            options={(lookups?.examStatuses ?? []).map((item) => ({
              value: item.id,
              label: item.status,
            }))}
          />
        </Field>
      </div>
    </section>
  );
};

export default PatentListFilters;
