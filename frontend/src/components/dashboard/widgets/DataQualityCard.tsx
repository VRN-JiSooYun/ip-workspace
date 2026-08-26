import React from 'react';
import { Button, Tooltip, Typography } from 'antd';
import { ArrowRight } from 'lucide-react';
import {
  PATENT_QUALITY_FILTERS,
  type PatentQualityFilter,
} from '../../../services/patentRecordApi';
import { formatNumberWithComma } from '../../../utils/displayFormat';
import '../dashboard.css';

const { Text } = Typography;

/**
 * 품질 항목의 표시 정보. key는 백엔드 `patent-quality.ts`의 표와 같다.
 *
 * `action`은 이 항목을 실제로 고치러 가는 곳이다. 건수만 보여 주고 갈 곳이 없으면
 * 아무도 보지 않는 숫자가 된다.
 */
const QUALITY_META: Record<PatentQualityFilter, {
  label: string;
  hint: string;
  /** 코드 관리 화면에서 고쳐야 하는 항목. 나머지는 목록 필터로 보낸다. */
  toCodeAdmin?: boolean;
}> = {
  unmappedStatus: {
    label: '진행 단계 미매핑 Status',
    hint: '현재 Status가 진행 단계에 연결되지 않아 파이프라인에서 미분류로 잡힙니다.',
    toCodeAdmin: true,
  },
  refParseFailed: {
    label: '내부관리번호 규칙 불일치',
    hint: '내부관리번호가 적혀 있지만 규칙(A25W001 등)에 맞지 않아 구성요소를 파싱하지 못했습니다.',
  },
  missingApplicationDate: {
    label: '출원일 누락',
    hint: '출원일이 비어 있어 연도별 집계와 기한 계산에서 빠집니다.',
  },
  missingExpectedExpiry: {
    label: '예상 만료일 누락',
    hint: '예상 만료일이 비어 있어 만료 임박 집계에 잡히지 않습니다.',
  },
  noTodo: {
    label: 'To-do 없는 진행 건',
    hint: '심사·대응 중인데 미완료 To-do가 하나도 없습니다. 방치된 건일 수 있습니다.',
  },
};

type Props = {
  counts?: Record<PatentQualityFilter, number>;
  loading?: boolean;
  error?: string | null;
  /** patentAnalysis.manage가 없으면 조치 링크를 감추고 건수만 보여 준다. */
  canManage: boolean;
  onOpenList: (quality: PatentQualityFilter) => void;
  onOpenCodeAdmin: () => void;
};

/**
 * 데이터 품질 카드.
 *
 * 이 스키마는 legal_status → patent_stage 매핑과 내부관리번호를 **사람이 손으로** 채우는
 * 구조다(schema.prisma 주석). 그래서 조용히 썩는 데이터가 생기고, 그걸 드러내는 화면이
 * 없으면 아무도 모른다.
 *
 * 전 항목이 0이면 카드를 접는다. "이상 없음"을 크게 띄워 자리를 먹는 것보다 낫다.
 */
const DataQualityCard: React.FC<Props> = ({
  counts,
  loading,
  error,
  canManage,
  onOpenList,
  onOpenCodeAdmin,
}) => {
  if (loading) {
    return (
      <div className="db-panel-scroll">
        <Text type="secondary" className="db-status">품질 점검 중입니다.</Text>
      </div>
    );
  }

  if (error) {
    return (
      <div className="db-panel-scroll">
        <Text type="danger" className="db-status">품질 집계를 불러오지 못했습니다.</Text>
      </div>
    );
  }

  const rows = PATENT_QUALITY_FILTERS
    .map((key) => ({ key, count: counts?.[key] ?? 0 }))
    .filter((row) => row.count > 0);

  if (rows.length === 0) {
    return (
      <div className="db-panel-scroll">
        <Text type="secondary" className="db-status">확인이 필요한 항목이 없습니다.</Text>
      </div>
    );
  }

  return (
    <div className="db-panel-scroll">
      {rows.map(({ key, count }) => {
        const meta = QUALITY_META[key];
        return (
          <div key={key} className="db-quality-row">
            <Tooltip title={meta.hint}>
              <span className="db-quality-label">{meta.label}</span>
            </Tooltip>
            <span className="db-quality-count">{formatNumberWithComma(count)}</span>
            {canManage ? (
              <Button
                type="text"
                size="small"
                icon={<ArrowRight size={14} />}
                aria-label={`${meta.label} 확인하러 가기`}
                onClick={() => (meta.toCodeAdmin ? onOpenCodeAdmin() : onOpenList(key))}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export default DataQualityCard;
