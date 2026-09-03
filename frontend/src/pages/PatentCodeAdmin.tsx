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
 * 특허 코드 관리 — 국가, 대리인, 법적 상태, Target, 출원인, 발명자 코드 테이블.
 *
 * 심사 상태 탭은 걷어냈다. 그 코드를 쓰는 화면(특허 관리·의견제출통지서)이 없어졌기
 * 때문이다. API(`/patent-codes/exam-statuses`)와 코드 표 자체는 아직 남아 있다.
 *
 * 특허 값의 정본과 추가·변경 화면의 select 옵션이 여기서 나온다. 라우트는
 * `patentAnalysis.read`만 요구하므로 특허를 볼 수 있는 사람에게는 메뉴도 보인다
 * (메뉴는 라우트 권한을 그대로 따라간다 — routes.tsx 주석 참고).
 *
 * 추가·변경·삭제는 `patentAnalysis.manage`를 가진 사람에게만 보인다. 서버도 같은 조건을
 * 다시 보므로(patent-code.controller), 화면의 canManage는 400을 받기 전에 가리는 쪽이다.
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
          특허 관리 메뉴의 각종 코드를 관리하는 화면입니다.
          사용 중인 코드는 삭제할 수 없습니다.
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
