import React from 'react';
import { Empty, Pagination, Select, Skeleton, Tooltip, Typography } from 'antd';
import { Info } from 'lucide-react';
import { formatNumberWithComma } from '../../utils/displayFormat';
import type { PatentSearchItem } from '../../services/patentSearchApi';
import OfficeActionResultCard from './OfficeActionResultCard';

const { Text } = Typography;

export const OFFICE_ACTION_PAGE_SIZES = [10, 30, 50, 100];

/**
 * 외부 검색 API에는 정렬 parameter가 없고 결과가 항상 의견제출통지서 발행일자
 * 내림차순으로 온다. 그래서 선택지도 이 하나뿐이다. 다른 정렬이 필요하면 외부 API에
 * 정렬 지원이 먼저 추가되어야 한다.
 */
const SORT_OPTIONS = [
  { label: '의견제출통지서 발행일자순', value: 'actionDateDesc' },
];

const SORT_HINT =
  '외부 검색 API가 정렬 조건을 받지 않아 발행일자 내림차순만 제공합니다.';

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
          value={SORT_OPTIONS[0].value}
          options={SORT_OPTIONS}
          className="oa-results-sort-select"
          onChange={() => undefined}
        />
        <Tooltip title={SORT_HINT}>
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
