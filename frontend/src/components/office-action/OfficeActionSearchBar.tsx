import React from 'react';
import { Button, Input } from 'antd';
import { Search } from 'lucide-react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  loading?: boolean;
};

/**
 * 의견제출통지서 본문 전문(full-text) 검색 바.
 *
 * 검색어는 `patentSearchApi`의 keyword 조건으로 나가며 대상 문서는 이 페이지의 주제인
 * 의견제출통지서(`target: 'officeAction'`)로 고정된다. 의견서·보정서 본문까지 함께 찾으려면
 * keyword 항목을 여러 개 보내야 하는데(외부 API가 target 2개 이상을 처리하지 못한다),
 * 그 UI는 아직 없다. 상세는 `docs/patent_search_api.md` 참고.
 */
const OfficeActionSearchBar: React.FC<Props> = ({
  value,
  onChange,
  onSearch,
  loading = false,
}) => (
  <div className="oa-card oa-searchbar">
    <Input
      allowClear
      size="large"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onPressEnter={onSearch}
      placeholder="의견제출통지서 본문 검색"
      variant="borderless"
      prefix={<Search size={18} className="oa-searchbar-icon" />}
    />
    {/* 색은 브랜드 색상을 따른다. 시안의 주황은 시안 작성 시점의 브랜드 색이다. */}
    <Button
      type="primary"
      size="large"
      loading={loading}
      onClick={onSearch}
      icon={<Search size={16} />}
      className="oa-searchbar-button"
    >
      검색
    </Button>
  </div>
);

export default OfficeActionSearchBar;
