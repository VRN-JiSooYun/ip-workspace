import { useCallback, useEffect, useMemo, useState } from 'react';
import { App as AntApp } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { buildStageTiles, type StageTileRow } from '../components/patent-management/PatentProgressPipeline';
import type { PatentListFilterValues } from '../components/patent-management/PatentListFilters';
import { useAccessContext } from '../contexts/AccessContext';
import {
  patentSearchApi,
  type OaLookups,
  type PatentSearchItem,
} from '../services/patentSearchApi';
import {
  patentRecordApi,
  type CreatePatentRecordInput,
  type PatentRecord,
  type PatentRecordLookups,
  type PatentStageSummary,
} from '../services/patentRecordApi';
import { readPatentListQueryParams } from '../utils/patentListQueryParams';

export const PATENT_LIST_PAGE_SIZE = 20;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

/**
 * 특허 관리 화면의 상태 전부.
 *
 * 예전에는 PatentManagement.tsx가 이 상태를 들고 카드들을 인라인으로 그렸다. 배치가
 * 트리로 바뀌면서 패널이 서로 다른 위치에 독립적으로 마운트되므로, 상태를 한 곳에 모아
 * 컨텍스트로 내려 준다. 로직은 옮기기만 했고 동작은 그대로다.
 *
 * 목록·진행 현황·Target 결과는 로컬 DB(`/api/patent-records`)를 본다. 다만 상세 검색의
 * 국가·법적상태·심사상태 선택지는 office-actions와 같은 OA DB lookup을 정본으로 쓴다.
 *
 * 일정·To-do·문서 뷰어는 여기 없다. 우측 상시 레일이 갖는다
 * (components/layout/rail/) — 그쪽은 조회도 스스로 한다.
 */
export const usePatentWorkspaceState = () => {
  const { message, modal } = AntApp.useApp();
  const { hasPermission } = useAccessContext();
  const canManage = hasPermission('patentAnalysis.manage');
  const [searchParams] = useSearchParams();

  /**
   * URL query로 들어온 초기 필터(대시보드 위젯의 딥링크).
   *
   * state의 **초기값으로만** 쓰고 그 뒤에는 보지 않는다. 계속 따라가면 사용자가 화면에서
   * 바꾼 조건을 URL이 되돌려 버린다. effect로 나중에 넣지 않는 이유도 같다 —
   * 기본값으로 한 번 조회하고 다시 조회하는 왕복이 생긴다.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const urlSeed = useMemo(() => readPatentListQueryParams(searchParams), []);

  // ---- Target ----
  /**
   * Target 필터. 이 화면에는 Target을 고르는 UI가 없다 — 대시보드에서 고른 뒤
   * `/patent-management?targets=...`로 넘어온 값을 그대로 쓴다(useDashboardState의
   * openPatentList). 여기서는 무엇이 걸려 있는지 보여 주고 해제만 한다.
   */
  const [selectedTargets, setSelectedTargets] = useState<string[]>(urlSeed.targets ?? []);

  // ---- 필터·진행 현황 ----
  /** null이면 단계 필터 없이 전체를 본다. */
  const [activeStageGroup, setActiveStageGroup] = useState<string | null>(
    urlSeed.stageGroup ?? null,
  );
  /** 국가·법적상태·심사상태. 목록과 진행 현황 집계가 함께 쓴다. */
  const [listFilters, setListFilters] = useState<PatentListFilterValues>(urlSeed.filters);
  const [stageSummary, setStageSummary] = useState<PatentStageSummary | null>(null);
  const [stagesLoading, setStagesLoading] = useState(false);
  const [stagesError, setStagesError] = useState('');

  // ---- 목록 ----
  const [patents, setPatents] = useState<PatentRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(urlSeed.q ?? '');
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');

  // ---- 모달·문서 뷰어 ----
  const [lookups, setLookups] = useState<PatentRecordLookups | null>(null);
  const [oaLookups, setOaLookups] = useState<OaLookups | null>(null);
  const [oaLookupsLoading, setOaLookupsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PatentRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [todoPatent, setTodoPatent] = useState<PatentRecord | null>(null);
  /** 문서 뷰어 패널에 띄운 특허. null이면 패널이 빈 상태로 남는다. */
  const [documentPatent, setDocumentPatent] = useState<PatentRecord | null>(null);
  const [documentItems, setDocumentItems] = useState<PatentSearchItem[]>([]);

  // ---- 조회 ----------------------------------------------------------------

  const loadPatents = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      const result = await patentRecordApi.list({
        q: search || undefined,
        targets: selectedTargets.length > 0 ? selectedTargets : undefined,
        stageGroup: activeStageGroup ?? undefined,
        ...listFilters,
        page,
        pageSize: PATENT_LIST_PAGE_SIZE,
      });
      setPatents(result.items);
      setTotal(result.total);
    } catch (error) {
      setPatents([]);
      setTotal(0);
      setListError(getErrorMessage(error));
    } finally {
      setListLoading(false);
    }
  }, [activeStageGroup, listFilters, page, search, selectedTargets]);

  /**
   * 상세 검색의 '총 N건'과 진행 단계 select의 단계별 건수.
   *
   * 목록과 같은 조건을 쓰지만 **단계 축(stageCode·stageGroup)은 넘기지 않는다.** 넘기면
   * 고른 단계만 건수가 남아, select가 자기 선택 때문에 나머지 선택지를 지우는 꼴이 된다.
   * activeStageGroup은 애초에 여기로 넘기지 않으므로 select는 늘 전체 단계를 보여 준다.
   */
  const loadStages = useCallback(async () => {
    setStagesLoading(true);
    setStagesError('');
    try {
      const { stageCode: _pipelineAxis, ...populationFilters } = listFilters;
      setStageSummary(await patentRecordApi.stages({
        q: search || undefined,
        targets: selectedTargets.length > 0 ? selectedTargets : undefined,
        ...populationFilters,
      }));
    } catch (error) {
      setStageSummary(null);
      setStagesError(getErrorMessage(error));
    } finally {
      setStagesLoading(false);
    }
  }, [listFilters, search, selectedTargets]);

  useEffect(() => { void loadStages(); }, [loadStages]);
  useEffect(() => { void loadPatents(); }, [loadPatents]);

  /** 로컬 코드 목록은 Target·대리인 필터와 등록·수정 modal이 함께 쓴다. */
  const ensureLookups = useCallback(async () => {
    if (lookups) return;
    try {
      setLookups(await patentRecordApi.lookups());
    } catch (error) {
      void message.error(`선택 목록을 불러오지 못했습니다: ${getErrorMessage(error)}`);
    }
  }, [lookups, message]);

  // Target·대리인 필터도 진입 직후부터 채워져 있어야 한다.
  useEffect(() => { void ensureLookups(); }, [ensureLookups]);

  // 국가·법적상태·심사상태 상세 검색은 office-actions와 같은 OA DB 목록을 쓴다.
  // 로컬 CRUD modal의 코드 목록과 ID 체계가 다르므로 별도 state로 유지한다.
  useEffect(() => {
    let active = true;
    setOaLookupsLoading(true);
    void patentSearchApi.lookups()
      .then((next) => {
        if (active) setOaLookups(next);
      })
      .catch((error) => {
        if (!active) return;
        setOaLookups(null);
        void message.error(`OA 선택 목록을 불러오지 못했습니다: ${getErrorMessage(error)}`);
      })
      .finally(() => {
        if (active) setOaLookupsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [message]);

  // ---- 필터 조작 ----------------------------------------------------------

  /**
   * 입력값은 PatentSearchBar가 들고 있다(한글 조합이 끊기지 않게 하려면 타이핑이
   * store를 거쳐 돌아오면 안 된다 — 컴포넌트 주석 참고).
   */
  const applySearch = useCallback((value: string) => {
    setPage(1);
    setSearch(value.trim());
  }, []);

  /**
   * 진행 단계 대분류. 상세 검색의 select가 고르고, 목록 헤더의 칩이 해제한다.
   * 조건이 바뀌면 보던 페이지 번호는 의미가 없다.
   */
  const applyStageGroup = useCallback((next: string | null) => {
    setPage(1);
    setActiveStageGroup(next);
  }, []);

  /** 목록 헤더 칩의 닫기. 같은 코드를 다시 넘기면 해제한다. */
  const toggleStageGroup = useCallback((code: string) => {
    setPage(1);
    setActiveStageGroup((current) => (current === code ? null : code));
  }, []);

  /** 조건이 바뀌면 보던 페이지 번호는 의미가 없다. */
  const applyListFilters = useCallback((next: PatentListFilterValues) => {
    setListFilters(next);
    setPage(1);
  }, []);

  /** Target 다중 선택. 상세 검색의 select가 고른다. */
  const applySelectedTargets = useCallback((next: string[]) => {
    setSelectedTargets(next);
    setPage(1);
  }, []);

  // ---- 진행 현황 파생값 ---------------------------------------------------

  const stageGroupTiles = useMemo(() => buildStageTiles(stageSummary), [stageSummary]);

  /** 목록 헤더에 붙는 단계 필터 표시. 타일 라벨과 같은 값을 쓴다. */
  const activeStageLabel = useMemo(() => {
    if (activeStageGroup === null) return '';
    return (
      stageGroupTiles.find((tile) => tile.code === activeStageGroup)?.label ?? activeStageGroup
    );
  }, [activeStageGroup, stageGroupTiles]);

  /** stageCode는 코드만 들고 다니므로 칩에 쓸 라벨을 여기서 찾아 준다. */
  const stageCodeLabel = useMemo(() => {
    if (!listFilters.stageCode) return undefined;
    for (const tile of stageGroupTiles) {
      const hit = tile.rows.find(
        (row) => row.filter && 'stageCode' in row.filter && row.filter.stageCode === listFilters.stageCode,
      );
      if (hit) return hit.label;
    }
    return undefined;
  }, [listFilters.stageCode, stageGroupTiles]);

  /** popover 줄 = 상세 검색 조건 하나. 같은 값을 다시 누르면 뺀다. */
  const isStageRowActive = useCallback((row: StageTileRow): boolean => {
    if (!row.filter) return false;
    return 'stageCode' in row.filter
      ? listFilters.stageCode === row.filter.stageCode
      : listFilters.legalStatusId === row.filter.legalStatusId;
  }, [listFilters.legalStatusId, listFilters.stageCode]);

  const pickStageRow = useCallback((row: StageTileRow) => {
    if (!row.filter) return;
    const active = isStageRowActive(row);
    applyListFilters(
      'stageCode' in row.filter
        ? { ...listFilters, stageCode: active ? undefined : row.filter.stageCode }
        : {
            ...listFilters,
            legalStatusId: active ? undefined : row.filter.legalStatusId,
            legalStatusText: undefined,
          },
    );
  }, [applyListFilters, isStageRowActive, listFilters]);

  /**
   * 추가와 수정이 다른 모달을 쓴다.
   *
   * 수정은 필드별 즉시 PATCH(JIRA식 상세)라서 하단 [저장]이 없다. 추가는 아직 없는
   * 레코드에 PATCH를 할 수 없으니 일괄 POST 폼이어야 한다 — JIRA도 생성 다이얼로그와
   * 상세 화면이 다르다.
   */
  const openCreateModal = useCallback(() => {
    setIsModalOpen(true);
    void ensureLookups();
  }, [ensureLookups]);

  const openDetailModal = useCallback((record: PatentRecord) => {
    setEditingRecord(record);
    void ensureLookups();
  }, [ensureLookups]);

  const closeRecordModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const closeDetailModal = useCallback(() => {
    setEditingRecord(null);
  }, []);

  /**
   * 상세 모달이 필드 하나를 저장한 뒤. 목록을 통째로 다시 받지 않고 그 행만 갈아 끼운다 —
   * 필드마다 목록을 재조회하면 스크롤과 페이지가 흔들린다.
   *
   * 진행 현황 집계(총 N건·단계별 건수)는 법적 상태가 바뀌면 달라지므로 함께 새로 받는다.
   */
  const handleFieldSaved = useCallback((next: PatentRecord) => {
    setEditingRecord((current) => (current?.id === next.id ? next : current));
    setPatents((current) => current.map((item) => (item.id === next.id ? next : item)));
    void loadStages();
  }, [loadStages]);

  const handleSubmit = useCallback(async (values: CreatePatentRecordInput) => {
    setSubmitting(true);
    try {
      await patentRecordApi.create(values);
      void message.success('특허를 추가했습니다.');
      setPage(1);
      setIsModalOpen(false);
      await Promise.all([loadPatents(), loadStages()]);
    } catch (error) {
      void message.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }, [loadPatents, loadStages, message]);

  const confirmDelete = useCallback((record: PatentRecord) => {
    modal.confirm({
      title: '특허를 삭제할까요?',
      content: `출원번호 ${record.applicationNumber}. 연결된 IPC와 행정 처리 이력도 함께 삭제됩니다.`,
      okText: '삭제',
      okButtonProps: { danger: true },
      cancelText: '취소',
      onOk: async () => {
        try {
          await patentRecordApi.remove(record.id);
          void message.success('특허를 삭제했습니다.');
          void loadStages();
          // 마지막 항목을 지웠으면 이전 페이지로 물러난다.
          if (patents.length === 1 && page > 1) setPage(page - 1);
          else await loadPatents();
        } catch (error) {
          void message.error(getErrorMessage(error));
          throw error;
        }
      },
    });
  }, [loadPatents, loadStages, message, modal, page, patents.length]);

  const handleImportApplied = useCallback(() => {
    // 코드가 새로 생겼을 수 있으니 select 옵션 캐시도 버린다.
    setLookups(null);
    setPage(1);
    void loadPatents();
    void loadStages();
  }, [loadPatents, loadStages]);

  // ---- 문서 뷰어 ----------------------------------------------------------

  /**
   * 고른 특허가 바뀌면 문서를 다시 받는다.
   *
   * "어느 통지서를 보고 있는가"는 여기서 갖지 않는다. 뷰어가 우측 상시 레일로 갔고
   * 그 선택은 레일 store가 소유한다(useRightSidebarStore). 이 화면의 몫은 "어느 특허의
   * 문서인가"까지다.
   */
  useEffect(() => {
    if (!documentPatent) {
      setDocumentItems([]);
      return;
    }
    let active = true;
    void patentRecordApi
      .documents(documentPatent.id)
      .then((result) => {
        if (!active) return;
        setDocumentItems(result.items);
      })
      .catch((error) => {
        if (!active) return;
        setDocumentItems([]);
        void message.error(`문서를 불러오지 못했습니다: ${getErrorMessage(error)}`);
      });
    return () => {
      active = false;
    };
  }, [documentPatent, message]);

  return {
    canManage,

    // Target
    selectedTargets,
    applySelectedTargets,


    // 필터·진행 현황
    lookups,
    oaLookups,
    oaLookupsLoading,
    listFilters,
    applyListFilters,
    stageSummary,
    stagesLoading,
    stagesError,
    stageGroupTiles,
    activeStageGroup,
    activeStageLabel,
    applyStageGroup,
    toggleStageGroup,
    stageCodeLabel,
    isStageRowActive,
    pickStageRow,

    // 목록
    patents,
    total,
    page,
    setPage,
    search,
    applySearch,
    listLoading,
    listError,

    // 등록·변경·삭제
    isModalOpen,
    editingRecord,
    submitting,
    openCreateModal,
    openDetailModal,
    closeRecordModal,
    closeDetailModal,
    handleFieldSaved,
    handleSubmit,
    confirmDelete,
    isImportOpen,
    setIsImportOpen,
    handleImportApplied,

    // To-do 모달
    todoPatent,
    setTodoPatent,

    // 문서 뷰어
    documentPatent,
    setDocumentPatent,
    documentItems,
  };
};

export type PatentWorkspaceState = ReturnType<typeof usePatentWorkspaceState>;
