import {
  App as AntApp,
  Button,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  theme,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Edit3, MessageSquare, Plus, Trash2 } from 'lucide-react';
import React from 'react';
import ContactContentViewer from '../components/contact/ContactContentViewer';
import ContactReplyModal, { type ContactReplyValues } from '../components/contact/ContactReplyModal';
import ContactWriteModal, { type ContactWriteValues } from '../components/contact/ContactWriteModal';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import { useAuthSession } from '../contexts/AuthSessionContext';
import {
  CONTACT_AUTHOR_CHECK_LABELS,
  CONTACT_CATEGORY_OPTIONS,
  CONTACT_STATUS_LABELS,
  CONTACT_TYPE_LABELS,
  contactInquiryMocks,
  type ContactInquiry,
  type ContactInquiryStatus,
} from '../mocks/contactInquiries';
import { useUIStore } from '../store/useUIStore';
import { useViewportTableHeight } from '../hooks/useViewportTableHeight';
import { formatDisplayDate, formatNumberWithComma } from '../utils/displayFormat';
import './Contact.css';

type StatusFilter = 'ALL' | ContactInquiryStatus;

const FIXED_COLUMN_WIDTH = 880;
const MIN_CONTENT_WIDTH = 360;
const MIN_COMMENT_WIDTH = 240;

const Contact: React.FC = () => {
  const { token } = theme.useToken();
  const { message, modal } = AntApp.useApp();
  const session = useAuthSession();
  const { setHeaderContent } = useUIStore();
  const {
    tableBodyHeight,
    tableRegionRef: tableWrapperRef,
    tableRegionStyle,
  } = useViewportTableHeight();
  const [tableWidth, setTableWidth] = React.useState(0);
  const [inquiries, setInquiries] = React.useState<ContactInquiry[]>(() => (
    contactInquiryMocks.map((inquiry) => ({ ...inquiry }))
  ));
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('ALL');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('ALL');
  const [pagination, setPagination] = React.useState({ current: 1, pageSize: 10 });
  const [expandedInquiryIds, setExpandedInquiryIds] = React.useState<Set<string>>(() => new Set());
  const [expandedCommentIds, setExpandedCommentIds] = React.useState<Set<string>>(() => new Set());
  const [isWriteModalOpen, setIsWriteModalOpen] = React.useState(false);
  const [editingInquiry, setEditingInquiry] = React.useState<ContactInquiry | null>(null);
  const [selectedInquiryId, setSelectedInquiryId] = React.useState<string | null>(null);
  const [replyInquiry, setReplyInquiry] = React.useState<ContactInquiry | null>(null);

  React.useEffect(() => {
    setHeaderContent(<PageHeaderBreadcrumb items={[{ label: '문의하기' }]} />);
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  React.useEffect(() => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper) return;
    const updateWidth = () => setTableWidth(Math.floor(wrapper.getBoundingClientRect().width));
    updateWidth();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
    const observer = new ResizeObserver(updateWidth);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  const variableWidth = Math.max(
    MIN_CONTENT_WIDTH + MIN_COMMENT_WIDTH,
    tableWidth - FIXED_COLUMN_WIDTH,
  );
  const contentWidth = Math.max(MIN_CONTENT_WIDTH, Math.floor(variableWidth * (2 / 3)));
  const commentWidth = Math.max(MIN_COMMENT_WIDTH, variableWidth - contentWidth);
  const tableScrollX = FIXED_COLUMN_WIDTH + contentWidth + commentWidth;

  const filteredInquiries = React.useMemo(() => inquiries.filter((inquiry) => (
    (statusFilter === 'ALL' || inquiry.status === statusFilter)
    && (categoryFilter === 'ALL' || inquiry.category === categoryFilter)
  )), [categoryFilter, inquiries, statusFilter]);
  const selectedInquiry = React.useMemo(
    () => inquiries.find((inquiry) => inquiry.id === selectedInquiryId) ?? null,
    [inquiries, selectedInquiryId],
  );

  React.useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredInquiries.length / pagination.pageSize));
    if (pagination.current > maxPage) {
      setPagination((current) => ({ ...current, current: maxPage }));
    }
  }, [filteredInquiries.length, pagination.current, pagination.pageSize]);

  const toggleInquiry = React.useCallback((id: string) => {
    setExpandedInquiryIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleComment = React.useCallback((id: string) => {
    setExpandedCommentIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openCreateModal = React.useCallback(() => {
    setEditingInquiry(null);
    setIsWriteModalOpen(true);
  }, []);

  const openEditModal = React.useCallback(() => {
    if (!selectedInquiry) return;
    setEditingInquiry(selectedInquiry);
    setIsWriteModalOpen(true);
  }, [selectedInquiry]);

  const handleWrite = React.useCallback((values: ContactWriteValues) => {
    if (editingInquiry) {
      setInquiries((current) => current.map((inquiry) => (
        inquiry.id === editingInquiry.id
          ? {
              ...inquiry,
              category: values.category,
              type: values.type,
              contentHtml: values.contentHtml,
            }
          : inquiry
      )));
      setEditingInquiry(null);
      setIsWriteModalOpen(false);
      void message.success('문의가 mock 목록에서 수정되었습니다.');
      return;
    }

    const nextSequence = inquiries.reduce((max, inquiry) => Math.max(max, inquiry.sequence), 0) + 1;
    const authorName = session.user.name || session.user.email;
    setInquiries((current) => [{
      id: `contact-mock-${Date.now()}`,
      sequence: nextSequence,
      category: values.category,
      createdAt: new Date().toISOString(),
      type: values.type,
      authorName,
      contentHtml: values.contentHtml,
      status: 'PROCESSING',
      authorCheck: 'UNCHECKED',
      canReply: true,
    }, ...current]);
    setPagination((current) => ({ ...current, current: 1 }));
    setIsWriteModalOpen(false);
    void message.success('문의가 mock 목록에 등록되었습니다.');
  }, [editingInquiry, inquiries, message, session.user.email, session.user.name]);

  const handleDelete = React.useCallback(() => {
    if (!selectedInquiry) return;
    modal.confirm({
      title: '문의를 삭제하시겠습니까?',
      content: `${formatNumberWithComma(selectedInquiry.sequence)}번 문의가 mock 목록에서 삭제됩니다.`,
      okText: '삭제',
      cancelText: '취소',
      okButtonProps: { danger: true },
      onOk: () => {
        setInquiries((current) => current.filter((inquiry) => inquiry.id !== selectedInquiry.id));
        setExpandedInquiryIds((current) => {
          const next = new Set(current);
          next.delete(selectedInquiry.id);
          return next;
        });
        setExpandedCommentIds((current) => {
          const next = new Set(current);
          next.delete(selectedInquiry.id);
          return next;
        });
        setSelectedInquiryId(null);
        void message.success('문의가 mock 목록에서 삭제되었습니다.');
      },
    });
  }, [message, modal, selectedInquiry]);

  const handleReply = React.useCallback((values: ContactReplyValues) => {
    if (!replyInquiry) return;
    const replyId = replyInquiry.id;
    setInquiries((current) => current.map((inquiry) => (
      inquiry.id === replyId
        ? {
            ...inquiry,
            commentHtml: values.commentHtml,
            commenterName: '관리자 (Mock)',
            commentedAt: new Date().toISOString(),
          }
        : inquiry
    )));
    setReplyInquiry(null);
    void message.success('답글이 mock 데이터에 반영되었습니다.');
  }, [message, replyInquiry]);

  const columns = React.useMemo<ColumnsType<ContactInquiry>>(() => [
    {
      title: '순번',
      dataIndex: 'sequence',
      key: 'sequence',
      width: 64,
      align: 'center',
      render: (value: number) => formatNumberWithComma(value),
    },
    { title: '카테고리', dataIndex: 'category', key: 'category', width: 120, align: 'center' },
    {
      title: '작성일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 112,
      align: 'center',
      render: (value: string) => formatDisplayDate(value).split(' ')[0],
    },
    {
      title: '유형',
      dataIndex: 'type',
      key: 'type',
      width: 88,
      align: 'center',
      render: (value: ContactInquiry['type']) => CONTACT_TYPE_LABELS[value],
    },
    { title: '작성자', dataIndex: 'authorName', key: 'authorName', width: 104, align: 'center' },
    {
      title: '내용',
      dataIndex: 'contentHtml',
      key: 'contentHtml',
      width: contentWidth,
      render: (value: string, record) => (
        <ContactContentViewer
          html={value}
          expanded={expandedInquiryIds.has(record.id)}
          onToggle={() => toggleInquiry(record.id)}
        />
      ),
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 96,
      align: 'center',
      render: (value: ContactInquiryStatus) => (
        <Tag color={value === 'COMPLETED' ? 'success' : value === 'ON_HOLD' ? 'warning' : 'processing'}>
          {CONTACT_STATUS_LABELS[value]}
        </Tag>
      ),
    },
    {
      title: '적용 버전',
      dataIndex: 'appliedVersion',
      key: 'appliedVersion',
      width: 104,
      align: 'center',
      render: (value?: string) => value || '-',
    },
    {
      title: 'Comment',
      dataIndex: 'commentHtml',
      key: 'commentHtml',
      width: commentWidth,
      render: (value: string | undefined, record: ContactInquiry) => value ? (
        <div className="contact-comment-cell">
          <ContactContentViewer
            html={value}
            expanded={expandedCommentIds.has(record.id)}
            onToggle={() => toggleComment(record.id)}
          />
          {record.commenterName ? (
            <Typography.Text type="secondary" className="contact-comment-meta">
              {record.commenterName} · {formatDisplayDate(record.commentedAt)}
            </Typography.Text>
          ) : null}
        </div>
      ) : <span className="contact-empty-cell">-</span>,
    },
    {
      title: '작성자 확인',
      dataIndex: 'authorCheck',
      key: 'authorCheck',
      width: 112,
      align: 'center',
      render: (value: ContactInquiry['authorCheck']) => (
        <Tag color={value === 'CONFIRMED' ? 'success' : value === 'RE_REQUESTED' ? 'warning' : 'default'}>
          {CONTACT_AUTHOR_CHECK_LABELS[value]}
        </Tag>
      ),
    },
    {
      title: '답글',
      key: 'reply',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Tooltip title={record.canReply ? '답글 작성' : '현재 mock 상태에서는 답글을 작성할 수 없습니다.'}>
          <span>
            <Button
              type="text"
              size="small"
              aria-label={`${record.sequence}번 문의 답글 작성`}
              icon={<MessageSquare size={15} />}
              disabled={!record.canReply}
              onClick={() => setReplyInquiry(record)}
            />
          </span>
        </Tooltip>
      ),
    },
  ], [commentWidth, contentWidth, expandedCommentIds, expandedInquiryIds, toggleComment, toggleInquiry]);

  const scrollbarStyle = {
    '--contact-scrollbar-track': token.colorBgContainer,
    '--contact-scrollbar-thumb': token.colorBorder,
    '--contact-scrollbar-thumb-hover': token.colorTextTertiary,
    '--contact-filter-border': token.colorBorderSecondary,
    '--contact-filter-bg': token.colorBgLayout,
    '--contact-filter-selected-bg': token.colorInfoBg,
    '--contact-filter-selected-border': token.colorInfoBorder,
    '--contact-filter-selected-text': token.colorInfoText,
  } as React.CSSProperties;

  return (
    <div className="contact-page" style={scrollbarStyle}>
      <div className="v-table-card contact-table-card">
        <div className="v-table-header contact-table-header">
          <Space size={10} wrap>
            <Typography.Text strong className="contact-table-title">문의 내역</Typography.Text>
            <Button
              type="primary"
              size="small"
              icon={<Plus size={14} />}
              onClick={openCreateModal}
            >
              신규 작성
            </Button>
            <Button
              type="primary"
              size="small"
              icon={<Edit3 size={14} />}
              disabled={!selectedInquiry}
              onClick={openEditModal}
            >
              수정
            </Button>
            <Button
              type="primary"
              size="small"
              icon={<Trash2 size={14} />}
              disabled={!selectedInquiry}
              onClick={handleDelete}
            >
              삭제
            </Button>
          </Space>
          <Space size={8} wrap className="contact-filter-controls">
            <div className="contact-status-filter">
              <Segmented
                className="contact-status-filter-options"
                size="small"
                value={statusFilter}
                options={[
                  { label: '전체', value: 'ALL' },
                  { label: '처리중', value: 'PROCESSING' },
                  { label: '보류', value: 'ON_HOLD' },
                  { label: '완료', value: 'COMPLETED' },
                ]}
                onChange={(value) => {
                  setStatusFilter(value as StatusFilter);
                  setSelectedInquiryId(null);
                  setPagination((current) => ({ ...current, current: 1 }));
                }}
              />
            </div>
            <Select
              className="contact-category-filter"
              size="small"
              value={categoryFilter}
              aria-label="문의 카테고리 필터"
              classNames={{ popup: { root: 'contact-select-popup' } }}
              options={[
                { value: 'ALL', label: '전체 카테고리' },
                ...CONTACT_CATEGORY_OPTIONS.map((value) => ({ value, label: value })),
              ]}
              onChange={(value) => {
                setCategoryFilter(value);
                setSelectedInquiryId(null);
                setPagination((current) => ({ ...current, current: 1 }));
              }}
            />
          </Space>
        </div>
        <div className="contact-table-wrapper" ref={tableWrapperRef} style={tableRegionStyle}>
          <Table<ContactInquiry>
            className="contact-table viewport-fill-table"
            rowKey="id"
            size="small"
            dataSource={filteredInquiries}
            columns={columns}
            tableLayout="fixed"
            scroll={{ x: tableScrollX, y: tableBodyHeight }}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              showSizeChanger: true,
              pageSizeOptions: [10, 30, 50, 100],
              onChange: (current, pageSize) => {
                setSelectedInquiryId(null);
                setPagination({ current, pageSize });
              },
            }}
            rowClassName={(record) => record.id === selectedInquiryId ? 'contact-table-row-selected' : ''}
            onRow={(record) => ({
              onClick: (event) => {
                const target = event.target as HTMLElement;
                if (target.closest('button, a, input, textarea, .ant-select, .ant-dropdown')) return;
                setSelectedInquiryId((current) => current === record.id ? null : record.id);
              },
            })}
          />
        </div>
      </div>

      <ContactWriteModal
        open={isWriteModalOpen}
        mode={editingInquiry ? 'edit' : 'create'}
        initialValues={editingInquiry ? {
          category: editingInquiry.category,
          type: editingInquiry.type,
          contentHtml: editingInquiry.contentHtml,
        } : undefined}
        onCancel={() => {
          setIsWriteModalOpen(false);
          setEditingInquiry(null);
        }}
        onSubmit={handleWrite}
      />
      <ContactReplyModal
        inquiry={replyInquiry}
        onCancel={() => setReplyInquiry(null)}
        onSubmit={handleReply}
      />
    </div>
  );
};

export default Contact;
