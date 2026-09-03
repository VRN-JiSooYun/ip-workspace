import React, { useEffect } from 'react';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import PatentCsvImportModal from '../components/patent-management/PatentCsvImportModal';
import PatentRecordDetailModal from '../components/patent-management/PatentRecordDetailModal';
import PatentSearchBar from '../components/patent-management/PatentSearchBar';
import PatentTodoModal from '../components/patent-management/PatentTodoModal';
import PatentManagementBody from '../components/patent-management/PatentManagementBody';
import { PatentWorkspaceProvider } from '../components/patent-management/workspace/PatentWorkspaceContext';
import { usePatentWorkspaceState } from '../hooks/usePatentWorkspaceState';
import { useRightSidebarStore } from '../store/useRightSidebarStore';
import { useUIStore } from '../store/useUIStore';
import '../styles/dday.css';
import './PatentManagement.css';

/** 레일 문서 뷰어에 넣은 것이 이 화면 것임을 표시한다. 떠날 때 자기 것만 치우려고 쓴다. */
const DOCUMENT_SOURCE = 'patent-management';

/**
 * 특허 관리 — 상세 검색 + 관리 특허 목록.
 *
 * 배치는 위아래 두 칸으로 고정이다. 예전에는 이진 트리(BSP) 레이아웃으로 패널을 끌어
 * 옮기고 탭을 넣고 뺄 수 있었는데, 이 화면에 남은 것이 '조건을 좁힌다'와 '결과를 본다'
 * 두 가지뿐이어서 배치를 바꿀 이유가 없어졌다. 자유 배치 엔진(lib/layoutTree,
 * components/workspace)은 대시보드가 계속 쓰므로 그대로 있다.
 *
 * 일정·To-do·문서 뷰어는 우측 상시 레일(components/layout/rail)에 있다.
 *
 * 데이터와 상태는 usePatentWorkspaceState가 갖는다. 이 컴포넌트는 헤더를 심고, 두 칸을
 * 배치하고, 화면 전체를 덮는 모달을 띄운다.
 */
const PatentManagement: React.FC = () => {
  const { setHeaderContent } = useUIStore();
  const state = usePatentWorkspaceState();
  const showDocuments = useRightSidebarStore((store) => store.showDocuments);
  const clearDocuments = useRightSidebarStore((store) => store.clearDocuments);
  // To-do를 모달에서 바꾸면 레일 To-do 패널이 stale해진다. 숫자 하나로 알린다.
  const invalidateTodos = useRightSidebarStore((store) => store.invalidateTodos);

  /**
   * 목록에서 문서를 열면 우측 레일의 문서 뷰어에 밀어 넣는다.
   *
   * 뷰어는 이 화면이 아니라 레일에 있다. 화면을 옮겨도 보던 문서가 남아야 하고,
   * 의견제출통지서 화면과도 같은 자리를 쓰기 때문이다. 화면을 떠날 때는 **이 화면이 넣은
   * 것만** 치운다(다른 화면이 이미 새로 채웠으면 그대로 둔다 — clearDocuments의 source).
   */
  useEffect(() => {
    const patent = state.documentPatent;
    if (!patent) return;
    showDocuments({
      source: DOCUMENT_SOURCE,
      patentId: patent.id,
      label: patent.internalRef ?? patent.applicationNumber,
      items: state.documentItems,
      activeId: state.documentItems[0]?.officeActionId ?? null,
      legalStatusLabel: patent.legalStatus?.status ?? null,
      examStatusLabel: patent.examStatus?.status ?? null,
    });
  }, [showDocuments, state.documentItems, state.documentPatent]);

  useEffect(() => () => clearDocuments(DOCUMENT_SOURCE), [clearDocuments]);

  /**
   * 검색바에 넣을 초기 검색어. URL query `q`로 들어온 값이 여기 담긴다.
   * 헤더는 한 번만 심으므로 마운트 시점 값을 고정해 두고 쓴다.
   */
  const initialSearch = React.useRef(state.search).current;

  /** 검색바를 헤더의 breadcrumb과 같은 줄에 둔다. 값이 아니라 컴포넌트를 한 번만 심는다. */
  useEffect(() => {
    setHeaderContent(
      <div className="pm-header-row">
        <PageHeaderBreadcrumb items={[{ label: '특허 관리' }]} />
        {/* 검색 대상은 '관리 특허 목록'이다. 서버가 관리번호·출원번호·명칭·출원인을
            대소문자 구분 없이 부분 일치로 찾는다(patent-record.service). */}
        <PatentSearchBar onSearch={state.applySearch} initialValue={initialSearch} />
      </div>,
    );
    return () => setHeaderContent(null);
  }, [initialSearch, setHeaderContent, state.applySearch]);

  return (
    // 값이 매 렌더 새 객체지만, 두 칸은 어차피 이 상태가 바뀔 때 다시 그려져야 한다.
    <PatentWorkspaceProvider value={state}>
      <div className="pm-page">
        <PatentManagementBody />

        {/* 추가와 수정 모두 같은 상세 컴포넌트를 쓴다. 추가만 로컬 초안 후 일괄 POST한다. */}
        <PatentRecordDetailModal
          open={state.isModalOpen || state.editingRecord !== null}
          mode={state.isModalOpen ? 'create' : 'edit'}
          record={state.editingRecord}
          lookups={state.lookups}
          canManage={state.canManage}
          submitting={state.submitting}
          onClose={state.isModalOpen ? state.closeRecordModal : state.closeDetailModal}
          onCreate={(values) => void state.handleSubmit(values)}
          onSaved={state.handleFieldSaved}
          onOpenDocuments={state.openDocuments}
          onOpenTodos={state.setTodoPatent}
        />

        <PatentCsvImportModal
          open={state.isImportOpen}
          onCancel={() => state.setIsImportOpen(false)}
          onApplied={state.handleImportApplied}
        />

        <PatentTodoModal
          open={state.todoPatent !== null}
          patent={state.todoPatent}
          onClose={() => state.setTodoPatent(null)}
          onChanged={invalidateTodos}
        />
      </div>
    </PatentWorkspaceProvider>
  );
};

export default PatentManagement;
