import React from 'react';
import { Tag, Tooltip, Typography } from 'antd';
import { MessageSquare, PencilLine, Stamp, User } from 'lucide-react';
import { formatDisplayDateTime } from '../../utils/displayFormat';
import { getLegalStatusTagColor } from '../../utils/legalStatusTag';
import type {
  PatentSearchExaminer,
  PatentSearchItem,
  PatentSearchRejection,
} from '../../services/patentSearchApi';

const { Text } = Typography;

/**
 * `law_type` 코드 → 법령명. 외부 DB에 데이터가 있는 값은 이 둘뿐이다
 * (`OfficeActionAdvancedFilters.LAW_TYPE_OPTIONS`와 같은 근거).
 */
const LAW_TYPE_NAMES: Record<number, string> = {
  1: '특허법',
  2: '특허법 시행령',
  3: '실용신안법',
};

/** 시안 표기를 따라 `특허법 제42조제3항제1호`처럼 조·항·호를 붙여 쓴다. */
export const formatStatute = (rejection: PatentSearchRejection): string => {
  const lawName =
    rejection.lawType !== null ? (LAW_TYPE_NAMES[rejection.lawType] ?? null) : null;
  const article = [
    rejection.article !== null ? `제${rejection.article}조` : '',
    rejection.paragraph !== null ? `제${rejection.paragraph}항` : '',
    rejection.subParagraph !== null ? `제${rejection.subParagraph}호` : '',
  ].join('');
  return [lawName, article].filter(Boolean).join(' ') || '조문 미지정';
};

/** `특허청 화학생명심사국 유기화학심사과 이정아` */
const formatExaminer = (examiner: PatentSearchExaminer): string =>
  [examiner.office, examiner.bureau, examiner.department, examiner.name]
    .filter(Boolean)
    .join(' ');

const emptyDash = (value: string | null | undefined) => value ?? '-';

type Props = {
  item: PatentSearchItem;
  selected: boolean;
  onSelect: (item: PatentSearchItem) => void;
};

/**
 * 검색 결과 한 건(= OA 1건) 카드.
 *
 * 하단 6개 항목(출원일자·공개번호·등록번호 등)은 검색 응답에 없어
 * `includePatentDetail: true`로 받아야 채워진다. 없으면 `-`로 남는다.
 */
const OfficeActionResultCard: React.FC<Props> = ({ item, selected, onSelect }) => {
  const hasOpinion = item.submissions.some((s) => s.kind === 'OPINION');
  const hasAmendment = item.submissions.some((s) => s.kind === 'AMENDMENT');

  return (
    <article
      className={`oa-result-card${selected ? ' oa-result-card-selected' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(item);
        }
      }}
    >
      <div className="oa-result-top">
        <span className="oa-result-action-number">{emptyDash(item.actionNumber)}</span>
        {item.actionDate && (
          <span className="oa-result-date-badge">
            {formatDisplayDateTime(item.actionDate)}
          </span>
        )}
        {item.legalStatus && (
          <Tag
            className="oa-result-status"
            color={getLegalStatusTagColor(item.legalStatus)}
            bordered={false}
          >
            {item.legalStatus}
          </Tag>
        )}
      </div>

      <h3 className="oa-result-title-ko">{emptyDash(item.koreanTitle)}</h3>
      {item.englishTitle && (
        <p className="oa-result-title-en">{item.englishTitle}</p>
      )}

      {item.rejections.length > 0 && (
        <dl className="oa-result-rejections">
          {item.rejections.map((rejection, index) => (
            <div className="oa-result-rejection" key={rejection.rejectionId ?? index}>
              <dt>{emptyDash(rejection.claim)}</dt>
              <dd>{formatStatute(rejection)}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="oa-result-meta">
        <span className="oa-result-docs">
          {/* 제출되지 않은 문서는 흐리게 둔다. */}
          <span className={`oa-result-doc${hasOpinion ? ' oa-result-doc-on' : ''}`}>
            <MessageSquare size={14} /> 의견서
          </span>
          <span className={`oa-result-doc${hasAmendment ? ' oa-result-doc-on' : ''}`}>
            <PencilLine size={14} /> 보정서
          </span>
        </span>

        <span className="oa-result-people">
          {item.applicant && (
            <span className="oa-result-person">
              <User size={14} className="oa-result-person-icon" />
              <span className="oa-ellipsis">{item.applicant}</span>
            </span>
          )}
          {item.examiners.length > 0 && (
            <Tooltip title={item.examiners.map(formatExaminer).join(', ')}>
              <span className="oa-result-person">
                <Stamp size={14} className="oa-result-person-icon" />
                <span className="oa-ellipsis">
                  {formatExaminer(item.examiners[0])}
                  {item.examiners.length > 1 && ` 외 ${item.examiners.length - 1}`}
                </span>
              </span>
            </Tooltip>
          )}
        </span>
      </div>

      <div className="oa-result-footer">
        <span>
          <Text type="secondary" className="oa-result-footer-label">출원번호</Text>
          <span className="oa-result-footer-value">{emptyDash(item.applicationNumber)}</span>
        </span>
        <span>
          <Text type="secondary" className="oa-result-footer-label">출원일자</Text>
          <span className="oa-result-footer-value">
            {item.patent ? formatDisplayDateTime(item.patent.applicationDate) : '-'}
          </span>
        </span>
        <span>
          <Text type="secondary" className="oa-result-footer-label">공개번호</Text>
          <span className="oa-result-footer-value">
            {emptyDash(item.patent?.publicationNumber)}
          </span>
        </span>
        <span>
          <Text type="secondary" className="oa-result-footer-label">공개일자</Text>
          <span className="oa-result-footer-value">
            {item.patent ? formatDisplayDateTime(item.patent.publicationDate) : '-'}
          </span>
        </span>
        <span>
          <Text type="secondary" className="oa-result-footer-label">등록번호</Text>
          <span className="oa-result-footer-value">
            {emptyDash(item.patent?.registrationNumber)}
          </span>
        </span>
        <span>
          <Text type="secondary" className="oa-result-footer-label">등록일자</Text>
          <span className="oa-result-footer-value">
            {item.patent ? formatDisplayDateTime(item.patent.registrationDate) : '-'}
          </span>
        </span>
      </div>
    </article>
  );
};

export default OfficeActionResultCard;
