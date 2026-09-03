import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { App as AntApp, Button, Pagination, Table, Tag, Tooltip, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { Download, FileText, ListTodo, Pencil, Plus, Trash2, UploadCloud } from 'lucide-react';
import { PATENT_LIST_PAGE_SIZE } from '../../../../hooks/usePatentWorkspaceState';
import {
  patentRecordApi,
  type PatentRecord,
  type PatentRecordListQuery,
} from '../../../../services/patentRecordApi';
import { formatDisplayDateTime, formatNumberWithComma } from '../../../../utils/displayFormat';
import { getLegalStatusTagColor } from '../../../../utils/legalStatusTag';
import { CountryTag } from '../../../common/CountryTag';
import { usePatentWorkspace } from '../PatentWorkspaceContext';

const { Text } = Typography;

const emptyDash = (value: string | null | undefined) => value ?? '-';

type OverflowTooltipTextProps = {
  value: string | null | undefined;
  children?: React.ReactNode;
  lines?: 1 | 2;
};

/** 실제로 말줄임이 발생한 셀만 원문 Tooltip을 제공한다. */
const OverflowTooltipText: React.FC<OverflowTooltipTextProps> = ({
  value,
  children,
  lines = 1,
}) => {
  const textRef = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  const measureOverflow = useCallback(() => {
    const element = textRef.current;
    if (!element) return;
    setTruncated(
      element.scrollWidth > element.clientWidth + 1
      || element.scrollHeight > element.clientHeight + 1,
    );
  }, []);

  useLayoutEffect(() => {
    measureOverflow();
    const element = textRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(measureOverflow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measureOverflow, value, children]);

  return (
    <Tooltip title={truncated ? value : undefined}>
      <span
        ref={textRef}
        className={`pm-ellipsis${lines === 2 ? ' pm-ellipsis-two-lines' : ''}`}
        onMouseEnter={measureOverflow}
      >
        {children ?? emptyDash(value)}
      </span>
    </Tooltip>
  );
};

/**
 * 검색어와 일치한 구간을 <mark>로 감싼다. 서버가 대소문자 구분 없이 부분 일치로 찾으므로
 * (patent-record.service의 contains + insensitive) 화면도 같은 규칙으로 자른다.
 * 일치가 없으면 원본 문자열을 그대로 돌려주므로 불필요한 DOM이 늘지 않는다.
 */
const highlightMatch = (
  value: string | null | undefined,
  keyword: string,
): React.ReactNode => {
  const needle = keyword.trim();
  if (!value || !needle) return value ?? null;

  const haystack = value.toLocaleLowerCase();
  const target = needle.toLocaleLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;

  for (let at = haystack.indexOf(target); at !== -1; at = haystack.indexOf(target, from)) {
    if (at > from) parts.push(value.slice(from, at));
    parts.push(
      <mark key={at} className="pm-highlight">{value.slice(at, at + needle.length)}</mark>,
    );
    from = at + needle.length;
  }

  if (parts.length === 0) return value;
  if (from < value.length) parts.push(value.slice(from));
  return parts;
};

/**
 * 관리 특허 목록 패널. 이 화면의 본체라 탭을 닫을 수 없다(PATENT_PANEL_META.closable).
 *
 * 목록은 `/api/patent-records`(로컬 `patent` table)만 본다. 추가·변경·삭제 대상이
 * 이 table이다. 예전에는 외부 문서 전문 검색을 토글로 함께 보여줬지만, 문서 검색은
 * 의견제출통지서 화면으로 일원화해서 여기서는 뺐다.
 */
const PatentListPanel: React.FC = () => {
  const { message } = AntApp.useApp();
  const [csvDownloading, setCsvDownloading] = useState(false);
  const {
    canManage,
    patents,
    total,
    page,
    setPage,
    search,
    selectedTargets,
    listFilters,
    listLoading,
    listError,
    activeStageGroup,
    activeStageLabel,
    toggleStageGroup,
    openCreateModal,
    openDetailModal,
    confirmDelete,
    setIsImportOpen,
    setTodoPatent,
    openDocuments,
  } = usePatentWorkspace();

  const csvQuery = useMemo(() => ({
    q: search || undefined,
    targets: selectedTargets.length > 0 ? selectedTargets : undefined,
    stageGroup: activeStageGroup ?? undefined,
    ...listFilters,
  } satisfies PatentRecordListQuery), [
    activeStageGroup,
    listFilters,
    search,
    selectedTargets,
  ]);

  const downloadCsv = useCallback(async () => {
    setCsvDownloading(true);
    try {
      const blob = await patentRecordApi.exportCsv(csvQuery);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = 'patent-records.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      const detail = error instanceof Error ? error.message : '알 수 없는 오류';
      void message.error(`CSV를 다운로드하지 못했습니다: ${detail}`);
    } finally {
      setCsvDownloading(false);
    }
  }, [csvQuery, message]);

  const columns = useMemo<TableColumnsType<PatentRecord>>(() => {
    const allColumns: TableColumnsType<PatentRecord> = [
    {
      title: 'Target',
      dataIndex: 'target',
      key: 'target',
      width: '7%',
      render: (value: string | null) => (
        <OverflowTooltipText value={value}>
          {highlightMatch(value, search) ?? '-'}
        </OverflowTooltipText>
      ),
    },
    {
      title: <span className="pm-no-wrap">내부관리번호</span>,
      key: 'internalRef',
      width: '10%',
      className: 'pm-internal-ref-cell',
      render: (_, record) => {
        if (!record.internalRef) return emptyDash(null);
        // 파싱된 구성요소가 없으면 IP팀 규칙에서 벗어난 값이다. 막지 않고 표시만 한다.
        const unparsed = record.refOrigin === null;
        return (
            <span className="pm-no-wrap">
              {highlightMatch(record.internalRef, search)}
            </span>
        );
      },
    },
    {
      title: '국가',
      key: 'country',
      // 국기 SVG(약 16px)와 한국어 이름이 한 줄에 들어가야 한다.
      width: '7%',
      render: (_, record) => <CountryTag code={record.country?.country} />,
    },
    {
      title: '출원번호',
      dataIndex: 'applicationNumber',
      key: 'applicationNumber',
      width: '10%',
      render: (value: string) => highlightMatch(value, search),
    },
    {
      title: '출원일',
      dataIndex: 'applicationDate',
      key: 'applicationDate',
      width: '7%',
      render: (value: string | null) => {
        const displayValue = formatDisplayDateTime(value);
        return <OverflowTooltipText value={displayValue} />;
      },
    },
    {
      title: '명칭',
      key: 'title',
      // 심사 상태 열을 걷어내며 남은 폭은 늘 말줄임되던 명칭이 가져간다.
      width: '17%',
      render: (_, record) => {
        const value = record.koreanTitle ?? record.englishTitle;
        return (
          <OverflowTooltipText value={value} lines={2}>
            {highlightMatch(value, search) ?? '-'}
          </OverflowTooltipText>
        );
      },
    },
    {
      title: '출원인',
      dataIndex: 'applicant',
      key: 'applicant',
      width: '9%',
      render: (value: string | null) => (
        <OverflowTooltipText value={value}>
          {highlightMatch(value, search) ?? '-'}
        </OverflowTooltipText>
      ),
    },
    {
      title: '대리인',
      key: 'attorney',
      width: '7%',
      render: (_, record) => {
        const value = record.attorney?.attorneyName;
        return <OverflowTooltipText value={value} />;
      },
    },
    {
      title: '법적 상태',
      key: 'legalStatus',
      width: '7%',
      render: (_, record) =>
        record.legalStatus ? (
          <Tag color={getLegalStatusTagColor(record.legalStatus.status)}>
            {record.legalStatus.status}
          </Tag>
        ) : emptyDash(null),
    },
    {
      title: '등록번호',
      dataIndex: 'registrationNumber',
      key: 'registrationNumber',
      width: '7%',
      render: emptyDash,
    },
    {
      title: '문서',
      key: 'documents',
      width: '4%',
      align: 'center' as const,
      render: (_, record) => {
        const count = record.documentCount ?? 0;
        // 문서가 없으면 아무것도 그리지 않는다. 있는 특허가 한눈에 드러나야 한다.
        if (count === 0) return emptyDash(null);
        return (
          <Tooltip title={`문서 ${count}건 보기`}>
            <Button
              type="text"
              size="small"
              className="pm-doc-open"
              icon={<FileText size={14} />}
              aria-label={`${record.internalRef ?? record.applicationNumber} 문서 ${count}건 보기`}
              onClick={() => openDocuments(record)}
            >
              {count}
            </Button>
          </Tooltip>
        );
      },
    },
    ...(canManage
      ? [
          {
            title: '',
            key: 'actions',
            width: '8%',
            align: 'center' as const,
            render: (_: unknown, record: PatentRecord) => (
              <span style={{ display: 'inline-flex', gap: 2 }}>
                <Tooltip title="To-do 관리">
                  <Button
                    type="text"
                    size="small"
                    aria-label={`${record.applicationNumber} To-do 관리`}
                    icon={<ListTodo size={15} />}
                    onClick={() => setTodoPatent(record)}
                  />
                </Tooltip>
                <Tooltip title="변경">
                  <Button
                    type="text"
                    size="small"
                    aria-label={`${record.applicationNumber} 변경`}
                    icon={<Pencil size={15} />}
                    onClick={() => openDetailModal(record)}
                  />
                </Tooltip>
                <Tooltip title="삭제">
                  <Button
                    type="text"
                    size="small"
                    danger
                    aria-label={`${record.applicationNumber} 삭제`}
                    icon={<Trash2 size={15} />}
                    onClick={() => confirmDelete(record)}
                  />
                </Tooltip>
              </span>
            ),
          },
        ]
      : []),
    ];

    return allColumns;
  }, [
    canManage,
    confirmDelete,
    openDetailModal,
    openDocuments,
    search,
    setTodoPatent,
  ]);

  return (
    <div className="pm-panel-scroll pm-list-panel">
      <div className="pm-list-header">
        <span className="pm-list-header-title">
          {search && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              ‘{search}’ 검색 결과
            </Text>
          )}
          {activeStageGroup !== null && (
            <Tag closable onClose={() => toggleStageGroup(activeStageGroup)} style={{ margin: 0 }}>
              {activeStageLabel}
            </Tag>
          )}
        </span>
        <span className="pm-list-header-controls">
          <Button
            icon={<Download size={14} />}
            style={{ height: 30 }}
            loading={csvDownloading}
            onClick={() => void downloadCsv()}
          >
            CSV로 다운로드
          </Button>
          {canManage && (
            <Button
              icon={<UploadCloud size={14} />}
              style={{ height: 30 }}
              onClick={() => setIsImportOpen(true)}
            >
              CSV로 업로드
            </Button>
          )}
          {canManage && (
            <Button
              type="primary"
              icon={<Plus size={14} />}
              style={{ height: 30 }}
              onClick={openCreateModal}
            >
              관리 특허 추가
            </Button>
          )}
        </span>
      </div>

      <div className="pm-list-table">
        <Table<PatentRecord>
          columns={columns}
          dataSource={patents}
          rowKey="id"
          loading={listLoading}
          size="small"
          pagination={false}
          tableLayout="fixed"
          locale={{
            emptyText: listError
              ? `목록을 불러오지 못했습니다: ${listError}`
              : '등록된 특허가 없습니다.',
          }}
        />
      </div>

      <div className="pm-list-footer">
        <span>총 {formatNumberWithComma(total)}건</span>
        <Pagination
          simple
          size="small"
          current={page}
          total={total}
          pageSize={PATENT_LIST_PAGE_SIZE}
          onChange={setPage}
        />
      </div>
    </div>
  );
};

export default PatentListPanel;
