import React, { useCallback, useEffect, useState } from 'react';
import { App as AntApp } from 'antd';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import ResizableSidePanel from '../components/common/ResizableSidePanel';
import OfficeActionAdvancedFilters, {
  EMPTY_OFFICE_ACTION_FILTERS,
  toPatentSearchFilters,
  type OfficeActionFilterState,
} from '../components/office-action/OfficeActionAdvancedFilters';
import OfficeActionResultList from '../components/office-action/OfficeActionResultList';
import OfficeActionSearchBar from '../components/office-action/OfficeActionSearchBar';
// 문서 뷰어는 특허 관리 화면과 같은 컴포넌트를 그대로 쓴다.
import PatentDocumentViewer from '../components/patent-management/PatentDocumentViewer';
import { patentSearchApi, type PatentSearchItem } from '../services/patentSearchApi';
import { useUIStore } from '../store/useUIStore';
import './OfficeActionAnalysis.css';

const DEFAULT_PAGE_SIZE = 10;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

/**
 * 의견제출통지서 — 전문 검색 화면.
 *
 * 검색 바 + 고급 검색 필터로 조건을 만들고, 결과를 카드 목록으로 보여준다.
 * 카드를 클릭하면 오른쪽에 문서 뷰어 패널이 열린다.
 */
const OfficeActionAnalysis: React.FC = () => {
  const { setHeaderContent } = useUIStore();
  const { message } = AntApp.useApp();

  const [keyword, setKeyword] = useState('');
  const [filters, setFilters] = useState<OfficeActionFilterState>(
    EMPTY_OFFICE_ACTION_FILTERS,
  );

  const [items, setItems] = useState<PatentSearchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pristine, setPristine] = useState(true);
  const [selected, setSelected] = useState<PatentSearchItem | null>(null);

  useEffect(() => {
    setHeaderContent(
      <PageHeaderBreadcrumb items={[{ label: '분석' }, { label: '의견제출통지서' }]} />,
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  const runSearch = useCallback(
    async (nextPage: number, nextPageSize: number) => {
      setLoading(true);
      setError('');
      try {
        const trimmed = keyword.trim();
        const result = await patentSearchApi.search({
          page: nextPage,
          size: nextPageSize,
          // 카드 클릭 즉시 뷰어에 본문을 그려야 한다. 검색 API에 단건 조회가 없어
          // 목록에서 함께 받아 두는 것 말고는 방법이 없다.
          includeContent: true,
          // 카드 하단의 출원일자·공개번호·등록번호는 검색 응답에 없는 column이다.
          includePatentDetail: true,
          filters: toPatentSearchFilters(filters),
          ...(trimmed
            ? { keywords: [{ query: trimmed, target: 'officeAction' as const }] }
            : {}),
        });
        setItems(result.items);
        setTotal(result.total);
        setPage(nextPage);
        setPageSize(nextPageSize);
        // 목록이 바뀌면 이전 선택은 더 이상 화면에 없을 수 있다.
        setSelected(null);
      } catch (caught) {
        setItems([]);
        setTotal(0);
        setError(getErrorMessage(caught));
        void message.error(`검색에 실패했습니다: ${getErrorMessage(caught)}`);
      } finally {
        setPristine(false);
        setLoading(false);
      }
    },
    [filters, keyword, message],
  );

  const isViewerOpen = selected !== null;

  return (
    <div className={`oa-page${isViewerOpen ? ' oa-page-viewer-open' : ''}`}>
      <div className="oa-main">
        <OfficeActionSearchBar
          value={keyword}
          onChange={setKeyword}
          onSearch={() => void runSearch(1, pageSize)}
          loading={loading}
        />

        <OfficeActionAdvancedFilters value={filters} onChange={setFilters} />

        <OfficeActionResultList
          items={items}
          total={total}
          page={page}
          pageSize={pageSize}
          loading={loading}
          pristine={pristine}
          error={error}
          selectedId={selected?.officeActionId ?? null}
          onSelect={setSelected}
          onPageChange={(nextPage, nextPageSize) =>
            void runSearch(nextPage, nextPageSize)
          }
        />
      </div>

      {isViewerOpen && (
        <ResizableSidePanel label="문서 뷰어 너비 조절">
          <PatentDocumentViewer
            item={selected}
            legalStatusLabel={selected.legalStatus}
            // 외부 exam_status 코드 테이블이 비어 있어 명칭으로 옮길 수 없다.
            examStatusLabel={null}
            onClose={() => setSelected(null)}
          />
        </ResizableSidePanel>
      )}

    </div>
  );
};

export default OfficeActionAnalysis;
