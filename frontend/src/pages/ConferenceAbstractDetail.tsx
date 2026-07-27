import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Empty,
  Image,
  Input,
  List,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowLeft,
  Bookmark,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Play,
  Send,
  Trash2,
  UserRound,
} from 'lucide-react';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import {
  conferenceApi,
  resolveConferenceAssetUrl,
  type ConferenceAbstractDetail as ConferenceAbstractDetailData,
  type ConferenceAsset,
  type ConferenceNotificationRecipient,
} from '../services/conferenceApi';
import { useAuthSession } from '../contexts/AuthSessionContext';
import { useUIStore } from '../store/useUIStore';
import { formatDisplayDate, formatNumberWithComma } from '../utils/displayFormat';
import './Conference.css';

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;
const HTTP_URL_PATTERN = /^https?:\/\/[^\s]+$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DIRECT_EMAIL_VALUE_PREFIX = 'direct-email:';
const DIRECT_EMAIL_DOMAINS: string[] = (
  import.meta.env.VITE_GMAIL_ALLOWED_RECIPIENT_DOMAINS || 'voronoi.io'
)
  .split(',')
  .map((domain: string) => domain.trim().toLowerCase())
  .filter(Boolean);

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const directEmailValue = (email: string) => `${DIRECT_EMAIL_VALUE_PREFIX}${email}`;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isValidHttpUrl = (value: string): boolean => {
  if (!HTTP_URL_PATTERN.test(value)) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
};

const stripHtml = (value: string) => {
  const withLineBreaks = value.replace(/<br\s*\/?>/gi, '\n');
  if (!withLineBreaks.includes('<') || typeof DOMParser === 'undefined') return withLineBreaks;
  return new DOMParser().parseFromString(withLineBreaks, 'text/html').body.textContent
    || withLineBreaks;
};

const readableLabel = (value: string) => value
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const StructuredContent: React.FC<{ value: unknown; depth?: number }> = ({ value, depth = 0 }) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    return <Paragraph className="conference-content-paragraph">{stripHtml(value)}</Paragraph>;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return <Text>{String(value)}</Text>;
  }
  if (Array.isArray(value)) {
    return (
      <div className="conference-content-array">
        {value.map((item, index) => (
          <StructuredContent key={`${depth}-${index}`} value={item} depth={depth + 1} />
        ))}
      </div>
    );
  }
  if (isRecord(value)) {
    return (
      <div className="conference-content-object">
        {Object.entries(value).map(([key, item]) => {
          if (item === null || item === undefined || item === '') return null;
          return (
            <section key={key} className="conference-content-section">
              <Title level={depth === 0 ? 5 : 5}>{readableLabel(key)}</Title>
              <StructuredContent value={item} depth={depth + 1} />
            </section>
          );
        })}
      </div>
    );
  }
  return null;
};

const valueText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join(', ');
  if (isRecord(value)) {
    return Object.values(value).map(valueText).filter(Boolean).join(', ');
  }
  return '';
};

const formatBytes = (value: string | null) => {
  if (!value) return '';
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${formatNumberWithComma(bytes)} B`;
  if (bytes < 1024 ** 2) return `${formatNumberWithComma((bytes / 1024).toFixed(1))} KB`;
  if (bytes < 1024 ** 3) return `${formatNumberWithComma((bytes / 1024 ** 2).toFixed(1))} MB`;
  return `${formatNumberWithComma((bytes / 1024 ** 3).toFixed(1))} GB`;
};

const isImageAsset = ({ filename, mimeType }: ConferenceAsset) => (
  mimeType?.startsWith('image/') === true
  || /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(filename)
);

const AssetDownload: React.FC<{ asset: ConferenceAsset }> = ({ asset }) => (
  <div className="conference-download-item">
    <div className="conference-download-name">
      <FileText size={18} />
      <div>
        <Text ellipsis={{ tooltip: asset.filename }}>{asset.filename}</Text>
        {asset.byteSize && <Text type="secondary">{formatBytes(asset.byteSize)}</Text>}
      </div>
    </div>
    {asset.downloadUrl && (
      <Button
        icon={<Download size={15} />}
        href={resolveConferenceAssetUrl(asset.downloadUrl)}
      >
        다운로드
      </Button>
    )}
  </div>
);

const ConferenceAbstractDetail: React.FC = () => {
  const { abstractId } = useParams<{ abstractId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();
  const session = useAuthSession();
  const { setHeaderContent } = useUIStore();
  const [detail, setDetail] = useState<ConferenceAbstractDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [directRecipientEmails, setDirectRecipientEmails] = useState<string[]>([]);
  const [knownRecipients, setKnownRecipients] = useState<ConferenceNotificationRecipient[]>([]);
  const [recipientSearchResultIds, setRecipientSearchResultIds] = useState<string[]>([]);
  const [recipientSearchText, setRecipientSearchText] = useState('');
  const [recipientSearchLoading, setRecipientSearchLoading] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [deletingCommentIds, setDeletingCommentIds] = useState<Set<string>>(new Set());
  const returnConferenceId = (
    new URLSearchParams(location.search).get('conferenceId')
    ||
    (location.state as { conferenceId?: string } | null)?.conferenceId
    || detail?.conference.id
  );
  const returnToList = useCallback(() => navigate(
    returnConferenceId ? `/conferences?conferenceId=${encodeURIComponent(returnConferenceId)}` : '/conferences',
  ), [navigate, returnConferenceId]);

  useEffect(() => {
    if (!abstractId) {
      setLoading(false);
      setError('Abstract 식별자가 없습니다.');
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    conferenceApi.getAbstract(abstractId, controller.signal)
      .then(setDetail)
      .catch((requestError) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
        const nextError = requestError instanceof Error
          ? requestError.message
          : 'Abstract 상세 정보를 불러오지 못했습니다.';
        setError(nextError);
        void message.error(nextError);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [abstractId, message]);

  useEffect(() => {
    const conferenceLabel = detail?.conference.abbreviation || 'Conference';
    setHeaderContent(
      <PageHeaderBreadcrumb
        items={[
          { label: 'Conference', onClick: returnToList },
          { label: conferenceLabel, onClick: returnToList },
          { label: detail?.abstractNumber || 'Abstract Detail' },
        ]}
      />,
    );
    return () => setHeaderContent(null);
  }, [detail, returnToList, setHeaderContent]);

  useEffect(() => {
    const q = recipientSearchText.trim();
    setRecipientSearchResultIds([]);
    if (q.length < 2) {
      setRecipientSearchLoading(false);
      return;
    }
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setRecipientSearchLoading(true);
      conferenceApi.searchRecipients(q, 10, controller.signal)
        .then((recipients) => {
          setRecipientSearchResultIds(recipients.map(({ id }) => id));
          setKnownRecipients((current) => {
            const merged = new Map(current.map((recipient) => [recipient.id, recipient]));
            recipients.forEach((recipient) => merged.set(recipient.id, recipient));
            return [...merged.values()];
          });
        })
        .catch((searchError) => {
          if (searchError instanceof DOMException && searchError.name === 'AbortError') return;
          void message.error(searchError instanceof Error ? searchError.message : '메일 알림 대상을 검색하지 못했습니다.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setRecipientSearchLoading(false);
        });
    }, 350);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [message, recipientSearchText]);

  const visibleRecipientOptions = useMemo(() => {
    const resultIds = new Set(recipientSearchResultIds);
    const selectedIds = new Set(recipientIds);
    return knownRecipients.filter(
      ({ id }) => resultIds.has(id) && !selectedIds.has(id),
    );
  }, [knownRecipients, recipientIds, recipientSearchResultIds]);
  const selectedRecipientValues = useMemo(
    () => [
      ...recipientIds,
      ...directRecipientEmails.map(directEmailValue),
    ],
    [directRecipientEmails, recipientIds],
  );
  const selectedRecipientCount = recipientIds.length + directRecipientEmails.length;

  const groupedAssets = useMemo(() => {
    const assets = detail?.assets ?? [];
    return {
      videos: assets.filter(({ kind }) => kind === 'VIDEO'),
      images: assets.filter((asset) => (
        asset.kind === 'REFERENCE_IMAGE' || (asset.kind === 'POSTER' && isImageAsset(asset))
      )),
      downloads: assets.filter((asset) => (
        asset.kind === 'DOCUMENT'
        || asset.kind === 'ATTACHMENT'
        || (asset.kind === 'POSTER' && !isImageAsset(asset))
      )),
    };
  }, [detail]);

  const toggleFavorite = useCallback(async () => {
    if (!detail || savingFavorite) return;
    const nextFavorite = !detail.isFavorite;
    setSavingFavorite(true);
    try {
      await conferenceApi.setAbstractBookmark(detail.id, nextFavorite);
      setDetail((current) => current ? { ...current, isFavorite: nextFavorite } : current);
      void message.success(nextFavorite ? 'Abstract를 즐겨찾기에 추가했습니다.' : 'Abstract 즐겨찾기를 해제했습니다.');
    } catch (favoriteError) {
      void message.error(favoriteError instanceof Error ? favoriteError.message : '즐겨찾기를 변경하지 못했습니다.');
    } finally {
      setSavingFavorite(false);
    }
  }, [detail, message, savingFavorite]);

  const submitComment = useCallback(async () => {
    const content = commentContent.trim();
    if (!abstractId || !content || submittingComment) return;
    setSubmittingComment(true);
    try {
      const comment = await conferenceApi.createComment(
        abstractId,
        content,
        recipientIds,
        directRecipientEmails,
      );
      setDetail((current) => current
        ? { ...current, comments: [...current.comments, comment] }
        : current);
      setCommentContent('');
      setRecipientIds([]);
      setDirectRecipientEmails([]);
      setRecipientSearchText('');
      void message.success(
        comment.notificationQueuedCount
          ? `댓글을 등록했고 메일 ${formatNumberWithComma(comment.notificationQueuedCount)}건을 발송 대기열에 추가했습니다.`
          : '댓글을 등록했습니다.',
      );
    } catch (commentError) {
      void message.error(commentError instanceof Error ? commentError.message : '댓글을 등록하지 못했습니다.');
    } finally {
      setSubmittingComment(false);
    }
  }, [
    abstractId,
    commentContent,
    directRecipientEmails,
    recipientIds,
    message,
    submittingComment,
  ]);

  const deleteComment = useCallback(async (commentId: string) => {
    if (deletingCommentIds.has(commentId)) return;
    setDeletingCommentIds((current) => new Set(current).add(commentId));
    try {
      await conferenceApi.deleteComment(commentId);
      setDetail((current) => current
        ? { ...current, comments: current.comments.filter(({ id }) => id !== commentId) }
        : current);
      void message.success('댓글을 삭제했습니다.');
    } catch (deleteError) {
      void message.error(deleteError instanceof Error ? deleteError.message : '댓글을 삭제하지 못했습니다.');
    } finally {
      setDeletingCommentIds((current) => {
        const next = new Set(current);
        next.delete(commentId);
        return next;
      });
    }
  }, [deletingCommentIds, message]);

  if (loading) {
    return (
      <div className="conference-detail-page">
        <Card><Skeleton active paragraph={{ rows: 12 }} /></Card>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="conference-detail-page conference-detail-error">
        <Alert type="error" showIcon message="Abstract를 불러올 수 없습니다." description={error} />
        <Button icon={<ArrowLeft size={16} />} onClick={returnToList}>목록으로 돌아가기</Button>
      </div>
    );
  }

  const authors = valueText(detail.authors) || detail.firstAuthorName || '-';
  const organizations = valueText(detail.organizations)
    || valueText(detail.authorOrganizations)
    || detail.firstAuthorOrganization
    || '-';
  const originalSourceUrl = detail.sourceUrl?.trim() || '';
  const hasValidOriginalSourceUrl = isValidHttpUrl(originalSourceUrl);

  return (
    <div className="conference-detail-page">
      <div className="conference-detail-topbar">
        <Button icon={<ArrowLeft size={16} />} onClick={returnToList}>목록</Button>
        <Space wrap>
          <Button
            type={detail.isFavorite ? 'primary' : 'default'}
            loading={savingFavorite}
            icon={(
              <Bookmark
                size={15}
                fill={detail.isFavorite ? 'currentColor' : 'none'}
              />
            )}
            onClick={() => void toggleFavorite()}
          >
            즐겨찾기 {detail.isFavorite ? 'ON' : 'OFF'}
          </Button>
          {detail.sourceUrl && (
            <Button
              icon={<ExternalLink size={15} />}
              disabled={!hasValidOriginalSourceUrl}
              href={hasValidOriginalSourceUrl ? originalSourceUrl : undefined}
              target={hasValidOriginalSourceUrl ? '_blank' : undefined}
              rel={hasValidOriginalSourceUrl ? 'noreferrer' : undefined}
            >
              원본 보기
            </Button>
          )}
        </Space>
      </div>

      <Card className="conference-detail-hero">
        <Space wrap size={[8, 8]}>
          <Tag color="volcano">{detail.conference.abbreviation} {detail.conference.year}</Tag>
          {detail.abstractNumber && <Tag>{detail.abstractNumber}</Tag>}
          {detail.sessionType && <Tag>{detail.sessionType}</Tag>}
        </Space>
        <Title level={3}>{detail.title}</Title>
        <div className="conference-detail-author">
          <UserRound size={17} />
          <Text>{detail.firstAuthorName || '저자 정보 없음'}</Text>
          {detail.firstAuthorOrganization && (
            <Text type="secondary">· {detail.firstAuthorOrganization}</Text>
          )}
        </div>
      </Card>

      <div className="conference-detail-grid">
        <main className="conference-detail-main">
          <Card title="Abstract 상세" className="conference-detail-card">
            {detail.contents ? (
              <StructuredContent value={detail.contents} />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="등록된 Abstract 본문이 없습니다." />
            )}
          </Card>

          {groupedAssets.videos.length > 0 && (
            <Card
              title={<Space><Play size={18} />동영상</Space>}
              className="conference-detail-card"
            >
              <div className="conference-video-list">
                {groupedAssets.videos.map((asset) => (
                  <figure key={asset.id} className="conference-video-item">
                    <video
                      controls
                      preload="metadata"
                      src={resolveConferenceAssetUrl(asset.contentUrl)}
                    >
                      브라우저에서 동영상 재생을 지원하지 않습니다.
                    </video>
                    <figcaption>{asset.filename}</figcaption>
                  </figure>
                ))}
              </div>
            </Card>
          )}

          {groupedAssets.images.length > 0 && (
            <Card
              title={<Space><ImageIcon size={18} />이미지 / 포스터</Space>}
              className="conference-detail-card"
            >
              <Image.PreviewGroup>
                <div className="conference-image-grid">
                  {groupedAssets.images.map((asset) => (
                    <figure key={asset.id}>
                      <Image
                        src={resolveConferenceAssetUrl(asset.contentUrl)}
                        alt={asset.filename}
                      />
                      <figcaption>{asset.filename}</figcaption>
                    </figure>
                  ))}
                </div>
              </Image.PreviewGroup>
            </Card>
          )}

          {groupedAssets.downloads.length > 0 && (
            <Card
              title={<Space><Download size={18} />PDF / 첨부파일</Space>}
              className="conference-detail-card"
            >
              <div className="conference-download-list">
                {groupedAssets.downloads.map((asset) => (
                  <AssetDownload key={asset.id} asset={asset} />
                ))}
              </div>
            </Card>
          )}

          <Card
            title={<Space><MessageSquare size={18} />댓글</Space>}
            className="conference-detail-card"
          >
            <div className="conference-comment-form">
              <TextArea
                value={commentContent}
                onChange={(event) => setCommentContent(event.target.value)}
                placeholder="댓글을 입력해 주세요."
                autoSize={{ minRows: 3, maxRows: 8 }}
                maxLength={5000}
                showCount
              />
              <div className="conference-comment-form-actions">
                <div className="conference-mention-field">
                  <Text type="secondary">메일 알림 대상</Text>
                  <div className="conference-mention-input-row">
                    <Select
                      mode="multiple"
                      allowClear
                      showSearch
                      filterOption={false}
                      maxCount={20}
                      maxTagCount="responsive"
                      style={{
                        width: `min(100%, ${Math.min(
                          680,
                          250 + selectedRecipientCount * 110,
                        )}px)`,
                      }}
                      value={selectedRecipientValues}
                      searchValue={recipientSearchText}
                      onSearch={setRecipientSearchText}
                      onChange={(values) => {
                        const nextRecipientIds: string[] = [];
                        const nextDirectEmails: string[] = [];
                        values.forEach((value) => {
                          const stringValue = String(value);
                          if (stringValue.startsWith(DIRECT_EMAIL_VALUE_PREFIX)) {
                            nextDirectEmails.push(
                              stringValue.slice(DIRECT_EMAIL_VALUE_PREFIX.length),
                            );
                          } else {
                            nextRecipientIds.push(stringValue);
                          }
                        });
                        setRecipientIds(nextRecipientIds);
                        setDirectRecipientEmails(nextDirectEmails);
                      }}
                      onSelect={() => {
                        setRecipientSearchText('');
                        setRecipientSearchResultIds([]);
                      }}
                      onInputKeyDown={(event) => {
                        if (event.key !== 'Enter') return;
                        if (visibleRecipientOptions.length > 0) return;
                        const email = normalizeEmail(recipientSearchText);
                        if (!email.includes('@')) return;
                        event.preventDefault();
                        event.stopPropagation();
                        if (!EMAIL_PATTERN.test(email)) {
                          void message.error('올바른 이메일을 입력해 주세요.');
                          return;
                        }
                        const emailDomain = email.slice(email.lastIndexOf('@') + 1);
                        if (!DIRECT_EMAIL_DOMAINS.includes(emailDomain)) {
                          void message.error(
                            `${DIRECT_EMAIL_DOMAINS.map((domain) => `@${domain}`).join(', ')} 이메일만 추가할 수 있습니다.`,
                          );
                          return;
                        }
                        const exactRecipient = knownRecipients.find(
                          (recipient) => normalizeEmail(recipient.email) === email,
                        );
                        const alreadySelected = directRecipientEmails.includes(email)
                          || recipientIds.some((id) => (
                            normalizeEmail(
                              knownRecipients.find((recipient) => recipient.id === id)?.email ?? '',
                            ) === email
                          ));
                        if (alreadySelected) {
                          setRecipientSearchText('');
                          setRecipientSearchResultIds([]);
                          return;
                        }
                        if (selectedRecipientCount >= 20) {
                          void message.error('메일 알림 대상은 최대 20명까지 추가할 수 있습니다.');
                          return;
                        }
                        if (exactRecipient) {
                          setRecipientIds((current) => [...current, exactRecipient.id]);
                        } else {
                          setDirectRecipientEmails((current) => [...current, email]);
                        }
                        setRecipientSearchText('');
                        setRecipientSearchResultIds([]);
                      }}
                      loading={recipientSearchLoading}
                      classNames={{
                        popup: { root: 'conference-recipient-dropdown' },
                      }}
                      placeholder="이름 또는 이메일 2자 이상 검색"
                      notFoundContent={(
                        recipientSearchText.trim().length < 2
                          ? '2자 이상 입력해 주세요.'
                          : EMAIL_PATTERN.test(normalizeEmail(recipientSearchText))
                            ? 'Enter를 눌러 이메일을 직접 추가하세요.'
                            : undefined
                      )}
                      options={visibleRecipientOptions.map((recipient) => ({
                        value: recipient.id,
                        label: recipient.name || recipient.email,
                        email: recipient.email,
                      }))}
                      optionRender={(option) => (
                        <div>
                          <div>{option.label}</div>
                          <Text type="secondary">{String(option.data.email)}</Text>
                        </div>
                      )}
                      tagRender={({ label, value, closable, onClose }) => {
                        const stringValue = String(value);
                        const email = stringValue.startsWith(DIRECT_EMAIL_VALUE_PREFIX)
                          ? stringValue.slice(DIRECT_EMAIL_VALUE_PREFIX.length)
                          : undefined;
                        const recipient = knownRecipients.find(({ id }) => id === value);
                        return (
                          <Tag
                            closable={closable}
                            onClose={onClose}
                            title={recipient?.email || email}
                          >
                            {recipient?.name || recipient?.email || email || label}
                          </Tag>
                        );
                      }}
                    />
                  </div>
                  <Text type="secondary" className="conference-mention-help">
                    검색 결과에 없는 사내 이메일도 입력 후 Enter로 추가할 수 있습니다.
                  </Text>
                </div>
                <Button
                  type="primary"
                  icon={<Send size={15} />}
                  loading={submittingComment}
                  disabled={!commentContent.trim()}
                  onClick={() => void submitComment()}
                >
                  댓글 등록
                </Button>
              </div>
            </div>
            <List
              dataSource={detail.comments}
              locale={{ emptyText: '등록된 댓글이 없습니다.' }}
              renderItem={(comment) => (
                <List.Item
                  actions={(
                    comment.author.id === session.user.id || session.user.role === 'ADMIN'
                      ? [
                        <Popconfirm
                          key="delete"
                          title="댓글을 삭제하시겠습니까?"
                          okText="삭제"
                          cancelText="취소"
                          onConfirm={() => void deleteComment(comment.id)}
                        >
                          <Button
                            type="text"
                            danger
                            size="small"
                            loading={deletingCommentIds.has(comment.id)}
                            icon={<Trash2 size={14} />}
                          >
                            삭제
                          </Button>
                        </Popconfirm>,
                      ]
                      : undefined
                  )}
                >
                  <List.Item.Meta
                    title={(
                      <Space wrap>
                        <Text strong>{comment.author.name || comment.author.email}</Text>
                        {comment.sourceSystem !== 'LEGACY_DJANGO' && (
                          <Text type="secondary">{formatDisplayDate(comment.createdAt)}</Text>
                        )}
                      </Space>
                    )}
                    description={(
                      <>
                        <Paragraph className="conference-comment-content">{comment.content}</Paragraph>
                        {(
                          comment.mentionedRecipients.length > 0
                          || (comment.directRecipientEmails?.length ?? 0) > 0
                        ) && (
                          <Text type="secondary">
                            알림 대상: {[
                              ...comment.mentionedRecipients.map(
                                ({ name, email }) => name || email,
                              ),
                              ...(comment.directRecipientEmails ?? []),
                            ].join(', ')}
                          </Text>
                        )}
                      </>
                    )}
                  />
                </List.Item>
              )}
            />
          </Card>
        </main>

        <aside className="conference-detail-aside">
          <Card title="발표 정보" className="conference-detail-card">
            <Descriptions column={1} size="small" colon={false}>
              <Descriptions.Item label="Conference">
                {detail.conference.fullTitle || detail.conference.title}
              </Descriptions.Item>
              <Descriptions.Item label="Abstract No.">
                {detail.abstractNumber || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Poster No.">
                {detail.posterNumber || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="공개일">
                {detail.dateOpen ? formatDisplayDate(detail.dateOpen) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Meeting">{detail.meeting || '-'}</Descriptions.Item>
              <Descriptions.Item label="Session">{detail.sessionTitle || detail.sessionType || '-'}</Descriptions.Item>
              <Descriptions.Item label="Track">
                {[detail.track, detail.subTrack].filter(Boolean).join(' / ') || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="임상시험 번호">
                {detail.clinicalTrialRegistrationNumber || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="저자 및 소속" className="conference-detail-card">
            <div className="conference-metadata-block">
              <Text type="secondary">Authors</Text>
              <Paragraph>{authors}</Paragraph>
              <Text type="secondary">Organizations</Text>
              <Paragraph>{organizations}</Paragraph>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
};

export default ConferenceAbstractDetail;
