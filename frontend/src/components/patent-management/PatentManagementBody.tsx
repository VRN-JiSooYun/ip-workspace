import React from 'react';
import FiltersPanel from './workspace/panels/FiltersPanel';
import PatentListPanel from './workspace/panels/PatentListPanel';

/**
 * 특허 관리 화면의 본문 — 위(상세 검색) 아래(관리 특허 목록) 두 칸.
 *
 * 페이지에서 떼어 낸 이유는 harness가 같은 markup을 그릴 수 있게 하려는 것뿐이다
 * (dev/patentManagementHarness). 페이지는 인증 뒤에 있어 dev 브라우저로 열 수 없는데,
 * harness가 배치를 따로 베껴 그리면 페이지가 바뀔 때 조용히 어긋난다.
 *
 * 상태는 PatentWorkspaceProvider에서 받는다. 이 컴포넌트는 배치만 정한다.
 */
const PatentManagementBody: React.FC = () => (
  <>
    {/* 위: 조건. 내용 높이를 그대로 쓰고 안에서 스크롤하지 않는다 — 어떤 조건이
        걸려 있는지 가려지면 안 된다. */}
    <section className="pm-section pm-section-filters">
      <FiltersPanel />
    </section>

    {/* 아래: 결과. 남는 높이를 전부 받고 표가 그 안에서 스크롤한다. */}
    <section className="pm-section pm-section-list">
      <PatentListPanel />
    </section>
  </>
);

export default PatentManagementBody;
