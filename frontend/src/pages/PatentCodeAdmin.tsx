import React, { useEffect } from 'react';
import { Card, Tabs, Typography } from 'antd';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import PatentCodeTablePanel, {
  PATENT_CODE_TABS,
} from '../components/patent-management/PatentCodeTablePanel';
import { useAccessContext } from '../contexts/AccessContext';
import { useUIStore } from '../store/useUIStore';

const { Text } = Typography;

/**
 * 특허 코드 관리 — `country`, `attorney`, `legal_status`, `exam_status` 네 코드 테이블.
 *
 * 특허 추가·변경 화면의 select 옵션이 여기서 나온다. 라우트가
 * `patentAnalysis.manage`를 요구하므로 메뉴도 같은 권한으로 자동 게이팅된다.
 */
const PatentCodeAdmin: React.FC = () => {
  const { setHeaderContent } = useUIStore();
  const { hasPermission } = useAccessContext();
  const canManage = hasPermission('patentAnalysis.manage');

  useEffect(() => {
    setHeaderContent(
      <PageHeaderBreadcrumb items={[{ label: '특허 코드 관리' }]} />,
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          특허 추가·변경 화면의 선택 목록에 쓰이는 코드입니다. 사용 중인 코드는 삭제할 수 없습니다.
        </Text>
        <Tabs
          items={PATENT_CODE_TABS.map((config) => ({
            key: config.type,
            label: config.label,
            children: (
              <PatentCodeTablePanel config={config} canManage={canManage} />
            ),
          }))}
        />
      </Card>
    </div>
  );
};

export default PatentCodeAdmin;
