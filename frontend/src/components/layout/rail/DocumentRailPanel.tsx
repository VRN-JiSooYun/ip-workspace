import React from 'react';
import { Typography } from 'antd';
import PatentDocumentViewer from '../../patent-management/PatentDocumentViewer';
import { useRightSidebarStore } from '../../../store/useRightSidebarStore';

const { Text } = Typography;

/**
 * 우측 레일의 문서 뷰어 패널.
 *
 * 일정·To-do 패널과 달리 스스로 조회하지 않는다. "어느 특허의 문서를 볼 것인가"는 화면이
 * 아는 일이라, 화면이 `showDocuments()`로 밀어 넣는다(store가 그 seam이다).
 *
 * 뷰어 컴포넌트는 특허 관리·의견제출통지서 화면이 함께 쓰던 것이고, 두 화면이 모두 레일로
 * 넘어온 뒤로는 이 패널이 유일한 호출자다. 테두리·제목은 레일 패널 머리줄이 제공한다.
 *
 * 통지 건 선택기(Segmented)를 여기서 걷어냈다 — 뷰어의 가로 타임라인이 통지 건과 그 안의
 * 문서를 한 축에 함께 보여 주므로, 선택기가 두 줄로 갈려 있을 이유가 없어졌다.
 */
const DocumentRailPanel: React.FC = () => {
  const context = useRightSidebarStore((state) => state.documentContext);
  const setActiveDocumentId = useRightSidebarStore((state) => state.setActiveDocumentId);
  // 보고 있던 탭은 store가 갖는다. 문서를 바꿔도, 레일을 접었다 펴도 같은 탭으로 돌아온다.
  const documentTabKey = useRightSidebarStore((state) => state.documentTabKey);
  const setDocumentTabKey = useRightSidebarStore((state) => state.setDocumentTabKey);

  if (!context) {
    return (
      <div className="rs-empty">
        <Text type="secondary">
          특허 목록에서 문서 버튼을 누르면 여기에 통지서가 열립니다.
        </Text>
      </div>
    );
  }

  const activeDocument = context.items.find(
    (item) => item.officeActionId === context.activeId,
  ) ?? context.items[0] ?? null;

  return (
    <PatentDocumentViewer
      items={context.items}
      activeItemId={context.activeId}
      onActiveItemChange={setActiveDocumentId}
      // 고른 건의 법적 상태가 있으면 그것을, 없으면 화면이 준 특허 단위 값을 쓴다.
      legalStatusLabel={activeDocument?.legalStatus ?? context.legalStatusLabel}
      examStatusLabel={context.examStatusLabel}
      activeTabKey={documentTabKey}
      onActiveTabKeyChange={setDocumentTabKey}
      searchKeywords={context.searchKeywords}
    />
  );
};

export default DocumentRailPanel;
