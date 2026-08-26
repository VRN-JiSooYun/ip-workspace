import React, { useMemo } from 'react';
import { Button, Pagination, Table, Tag, Tooltip, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { FileText, ListTodo, Pencil, Plus, Trash2, UploadCloud } from 'lucide-react';
import { PATENT_LIST_PAGE_SIZE } from '../../../../hooks/usePatentWorkspaceState';
import type { PatentRecord } from '../../../../services/patentRecordApi';
import { formatDisplayDateTime, formatNumberWithComma } from '../../../../utils/displayFormat';
import { getLegalStatusTagColor } from '../../../../utils/legalStatusTag';
import { usePatentWorkspace } from '../PatentWorkspaceContext';

const { Text } = Typography;

const emptyDash = (value: string | null | undefined) => value ?? '-';

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
  const {
    canManage,
    patents,
    total,
    page,
    setPage,
    search,
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
    setDocumentPatent,
  } = usePatentWorkspace();

  const columns = useMemo<TableColumnsType<PatentRecord>>(() => [
    {
      title: '내부관리번호',
      key: 'internalRef',
      width: 132,
      render: (_, record) => {
        if (!record.internalRef) return emptyDash(null);
        // 파싱된 구성요소가 없으면 IP팀 규칙에서 벗어난 값이다. 막지 않고 표시만 한다.
        const unparsed = record.refOrigin === null;
        return (
          <Tooltip title={unparsed ? '알려진 번호 규칙과 형식이 다릅니다' : undefined}>
            <span>
              {highlightMatch(record.internalRef, search)}
              {unparsed && <Tag color="orange" style={{ marginLeft: 6 }}>규칙 외</Tag>}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: '국가',
      key: 'country',
      width: 80,
      render: (_, record) => record.country?.country ?? '-',
    },
    {
      title: '출원번호',
      dataIndex: 'applicationNumber',
      key: 'applicationNumber',
      width: 168,
      render: (value: string) => highlightMatch(value, search),
    },
    {
      title: '출원일',
      dataIndex: 'applicationDate',
      key: 'applicationDate',
      width: 110,
      render: (value: string | null) => formatDisplayDateTime(value),
    },
    {
      title: '명칭',
      key: 'title',
      width: 260,
      render: (_, record) => (
        <Tooltip title={record.englishTitle ?? record.koreanTitle ?? ''}>
          <span className="pm-ellipsis">
            {highlightMatch(record.koreanTitle ?? record.englishTitle, search) ?? '-'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '출원인',
      dataIndex: 'applicant',
      key: 'applicant',
      width: 140,
      render: (value: string | null) => highlightMatch(value, search) ?? emptyDash(null),
    },
    {
      title: '대리인',
      key: 'attorney',
      width: 110,
      render: (_, record) => record.attorney?.attorneyName ?? emptyDash(null),
    },
    {
      title: '법적 상태',
      key: 'legalStatus',
      width: 110,
      render: (_, record) =>
        record.legalStatus ? (
          <Tag color={getLegalStatusTagColor(record.legalStatus.status)}>
            {record.legalStatus.status}
          </Tag>
        ) : emptyDash(null),
    },
    {
      title: '심사 상태',
      key: 'examStatus',
      width: 110,
      render: (_, record) =>
        record.examStatus ? <Tag>{record.examStatus.status}</Tag> : emptyDash(null),
    },
    {
      title: '등록번호',
      dataIndex: 'registrationNumber',
      key: 'registrationNumber',
      width: 140,
      render: emptyDash,
    },
    {
      title: '문서',
      key: 'documents',
      width: 76,
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
              onClick={() => setDocumentPatent(record)}
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
            width: 128,
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
  ], [canManage, confirmDelete, openDetailModal, search, setDocumentPatent, setTodoPatent]);

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
          scroll={{ x: 'max-content' }}
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
