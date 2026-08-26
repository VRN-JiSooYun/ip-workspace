import React from 'react';
import { Empty, Pagination, Select, Skeleton, Tooltip, Typography } from 'antd';
import { Info } from 'lucide-react';
import { formatNumberWithComma } from '../../utils/displayFormat';
import type { PatentSearchItem } from '../../services/patentSearchApi';
import OfficeActionResultCard from './OfficeActionResultCard';

const { Text } = Typography;

export const OFFICE_ACTION_PAGE_SIZES = [10, 30, 50, 100];

export type OfficeActionSort = 'relevance' | 'actionDateDesc';

const SORT_OPTIONS = [
  { label: '관련도순', value: 'relevance' },
  { label: '의견제출통지서 발행일자순', value: 'actionDateDesc' },
];

type Props = {
  items: PatentSearchItem[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  /** 아직 한 번도 검색하지 않은 상태. 0건과 구분해 안내 문구를 다르게 보여준다. */
  pristine: boolean;
  error: string;
  selectedId: number | null;
  /** 외부 API가 적용한 자동 정렬. 키워드가 있으면 relevance, 없으면 actionDateDesc다. */
  sortBy: OfficeActionSort;
  onSelect: (item: PatentSearchItem) => void;
  onPageChange: (page: number, pageSize: number) => void;
};

/** 검색 결과 카드 목록. */
const OfficeActionResultList: React.FC<Props> = ({
  items,
  total,
  page,
  pageSize,
  loading,
  pristine,
  error,
  selectedId,
  sortBy,
  onSelect,
  onPageChange,
}) => (
  <section className="oa-results">
    <div className="oa-results-header">
      <span className="oa-results-count">
        <strong>{formatNumberWithComma(total)}</strong> Results
      </span>
      <span className="oa-results-sort">
        <Text type="secondary" className="oa-results-sort-label">
          Sort By
        </Text>
        {/* 폭은 CSS가 컨테이너에 맞춰 정한다. 인라인 고정 폭은 좁은 폭에서 헤더를 밀어낸다. */}
        <Select
          value={sortBy}
          options={SORT_OPTIONS}
          className="oa-results-sort-select"
          disabled
        />
        <Tooltip
          title={sortBy === 'relevance'
            ? '키워드 검색 결과는 관련도 점수가 높은 순서로 자동 정렬됩니다.'
            : '키워드가 없으면 의견제출통지서 발행일자순으로 정렬됩니다.'}
        >
          <Info size={13} className="oa-field-hint" />
        </Tooltip>
      </span>
    </div>

    {loading ? (
      <div className="oa-result-card oa-result-card-skeleton">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    ) : error ? (
      <div className="oa-card oa-results-empty">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Text type="danger" style={{ fontSize: 12 }}>
              {`검색에 실패했습니다: ${error}`}
            </Text>
          }
        />
      </div>
    ) : items.length === 0 ? (
      <div className="oa-card oa-results-empty">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Text type="secondary" style={{ fontSize: 12 }}>
              {pristine
                ? '조건을 지정하고 Search를 누르세요.'
                : '조건에 맞는 의견제출통지서가 없습니다.'}
            </Text>
          }
        />
      </div>
    ) : (
      <>
        <div className="oa-result-cards">
          {items.map((item) => (
            <OfficeActionResultCard
              key={item.officeActionId ?? `${item.patentId}-${item.actionNumber}`}
              item={item}
              selected={item.officeActionId === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>

        <div className="oa-results-pagination">
          <Pagination
            size="small"
            current={page}
            total={total}
            pageSize={pageSize}
            showSizeChanger
            pageSizeOptions={OFFICE_ACTION_PAGE_SIZES}
            showTotal={undefined}
            onChange={onPageChange}
          />
        </div>
      </>
    )}
  </section>
);

export default OfficeActionResultList;
