import { create } from 'zustand';
import {
  SIDE_PANEL_DEFAULT_WIDTH,
  SIDE_PANEL_MIN_WIDTH,
} from '../components/common/ResizableSidePanel';
import type { PatentSearchItem, PatentSearchKeyword } from '../services/patentSearchApi';

/**
 * 우측 레일의 상태.
 *
 * 레일은 MainLayout에 있어 모든 화면 밖이다. 그래서 화면이 레일에 무언가를 넣으려면
 * (예: 목록에서 고른 문서) props가 아니라 store를 거쳐야 한다 — `useUIStore`가
 * headerContent를 다루는 것과 같은 이유이고 같은 방식이다.
 */

export const RIGHT_RAIL_ITEMS = ['documents', 'schedule', 'todo'] as const;

export type RightRailItemId = typeof RIGHT_RAIL_ITEMS[number];

const RAIL_ITEM_SET = new Set<string>(RIGHT_RAIL_ITEMS);

export const isRightRailItemId = (value: string): value is RightRailItemId => (
  RAIL_ITEM_SET.has(value)
);

/**
 * 항목별 기본 폭.
 *
 * 하나의 고정폭을 쓸 수 없다. 문서 뷰어는 PDF가 읽혀야 해서 넓어야 하고
 * (`SIDE_PANEL_DEFAULT_WIDTH`와 같은 값을 쓴다), 일정·To-do는 목록·격자라 좁아도 된다.
 * 일정이 320인 이유: 7칸 격자가 이보다 좁으면 날짜가 겹친다.
 */
export const RAIL_DEFAULT_WIDTH: Record<RightRailItemId, number> = {
  documents: SIDE_PANEL_DEFAULT_WIDTH,
  schedule: 320,
  todo: 340,
};

/** 어느 항목이든 이보다 좁아지면 내용이 못 읽힌다. */
export const RAIL_MIN_WIDTH: Record<RightRailItemId, number> = {
  documents: SIDE_PANEL_MIN_WIDTH,
  schedule: 300,
  todo: 280,
};

export const RAIL_MAX_WIDTH = 1000;

/** 아이콘 레일 자체의 폭. 항목 라벨이 두 줄로 접히지 않을 만큼만. */
export const RAIL_WIDTH = 56;

/**
 * 화면이 레일 문서 뷰어에 넣어 준 문서 묶음.
 *
 * `source`는 넣은 화면을 가리킨다. 화면을 떠날 때 자기가 넣은 것만 지우기 위한 것이다 —
 * 다른 화면이 이미 새로 채웠다면 지우면 안 된다.
 */
export type RailDocumentContext = {
  source: string;
  /**
   * 관리 특허 id. 검색 결과에서 온 문서는 이 값이 없을 수 있어(`PatentSearchItem.patentId`가
   * nullable) null을 허용한다.
   */
  patentId: number | null;
  /** 레일 머리줄 부제로 보여 줄 이름. 내부관리번호 ?? 출원번호. */
  label: string;
  items: PatentSearchItem[];
  /** 보고 있는 통지서(officeActionId). null이면 첫 항목을 본다. */
  activeId: number | null;
  legalStatusLabel: string | null;
  examStatusLabel: string | null;
  /** 이 문서를 찾은 본문 검색 조건. 문서 뷰어의 검색 근거와 PDF 하이라이트에만 쓴다. */
  searchKeywords?: PatentSearchKeyword[];
};

type RightSidebarState = {
  /** null이면 내용 패널이 접혀 있고 아이콘 레일만 보인다. */
  activeItem: RightRailItemId | null;
  /**
   * 마지막으로 펼쳐 본 항목. 레일 상단 화살표로 다시 열 때 무엇을 열지 알아야 한다.
   * activeItem이 null이 되어도 남는다.
   */
  lastItem: RightRailItemId;
  widths: Record<RightRailItemId, number>;
  documentContext: RailDocumentContext | null;

  /** 같은 항목을 다시 누르면 접는다(토스 레일과 같은 동작). */
  toggleItem: (item: RightRailItemId) => void;
  openItem: (item: RightRailItemId) => void;
  collapse: () => void;
  /** 레일 상단 화살표. 펼쳐져 있으면 접고, 접혀 있으면 마지막 항목을 다시 펼친다. */
  toggleCollapsed: () => void;
  setWidth: (item: RightRailItemId, width: number) => void;

  /** 문서를 레일에 올리고 문서 뷰어를 펼친다. */
  showDocuments: (context: RailDocumentContext) => void;
  setActiveDocumentId: (officeActionId: number | null) => void;

  /**
   * 문서 뷰어에서 보고 있던 탭의 key.
   *
   * 뷰어가 아니라 여기서 갖는 이유: 뷰어는 문서가 바뀌면 내용이 통째로 갈리고 레일이 접히면
   * 언마운트된다. 그 안에 두면 "다른 문서를 골라도 같은 탭을 본다"가 문서 교체까지만
   * 성립하고, 접었다 펴면 초기화된다.
   *
   * 문서 내용과 마찬가지로 저장하지 않는다. 새로고침하면 볼 문서 자체가 없다.
   */
  documentTabKey: string | null;
  setDocumentTabKey: (key: string) => void;
  /**
   * `source`가 넣은 문서만 지운다. 다른 화면이 채웠으면 그대로 둔다.
   *
   * 기본은 패널까지 접는다(빈 뷰어를 펼쳐 두지 않는다). `keepPanelOpen`은 문서 뷰어를
   * 늘 펼쳐 두는 화면을 위한 예외다 — 의견제출통지서 화면은 검색할 때마다 선택을 비우는데,
   * 그때마다 레일이 접히면 "뷰어는 펼쳐져 있다"는 그 화면의 규칙이 깨진다.
   */
  clearDocuments: (source: string, options?: { keepPanelOpen?: boolean }) => void;

  /**
   * To-do가 화면 쪽에서 바뀌었음을 레일에 알린다(특허 관리의 To-do 모달에서 추가·수정).
   * 레일 패널은 이 값이 바뀌면 다시 조회한다. 화면과 레일이 서로를 직접 알지 않아도
   * 되도록 숫자 하나만 주고받는다.
   */
  todoRevision: number;
  invalidateTodos: () => void;
};

const STORAGE_KEY = 'right-sidebar:v1';

type StoredState = {
  activeItem: RightRailItemId | null;
  lastItem: RightRailItemId | null;
  widths: Record<string, number>;
};

/**
 * 레일 상태를 읽는다. 좌측 Sider의 모드와 달리 이것은 저장한다 — 사용자가 문서 뷰어를
 * 열어 둔 채로 화면을 옮겨 다니는 것이 이 기능의 목적이라, 새로고침마다 접히면 쓸모가 없다.
 * 문서 내용은 저장하지 않는다(화면이 다시 넣어 준다).
 */
const readStored = (): StoredState => {
  const fallback: StoredState = { activeItem: null, lastItem: null, widths: {} };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    const activeItem = typeof parsed.activeItem === 'string' && isRightRailItemId(parsed.activeItem)
      ? parsed.activeItem
      : null;
    const widths: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed.widths ?? {})) {
      if (isRightRailItemId(key) && typeof value === 'number' && Number.isFinite(value)) {
        widths[key] = value;
      }
    }
    const lastItem = typeof parsed.lastItem === 'string' && isRightRailItemId(parsed.lastItem)
      ? parsed.lastItem
      : null;
    return { activeItem, lastItem, widths };
  } catch {
    return fallback;
  }
};

const writeStored = (state: StoredState): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장이 실패해도 화면은 계속 써야 한다.
  }
};

const stored = readStored();

/**
 * 폭 저장을 미루는 시간. 드래그 한 번에 mousemove가 수십 번 오는데 그때마다 쓰면
 * JSON.stringify + 동기 저장이 매 프레임 끼어든다(PatentManagement의 LAYOUT_SAVE_DELAY와
 * 같은 이유·같은 값).
 */
const WIDTH_SAVE_DELAY = 300;

export const useRightSidebarStore = create<RightSidebarState>((set, get) => {
  const persist = () => {
    const { activeItem, lastItem, widths } = get();
    writeStored({ activeItem, lastItem, widths });
  };

  let widthSaveTimer: ReturnType<typeof setTimeout> | null = null;
  const persistWidthsSoon = () => {
    if (widthSaveTimer !== null) clearTimeout(widthSaveTimer);
    widthSaveTimer = setTimeout(() => {
      widthSaveTimer = null;
      persist();
    }, WIDTH_SAVE_DELAY);
  };

  return {
    // 문서 뷰어를 열어 둔 상태로 저장됐어도 문서 내용은 복원되지 않는다. 빈 뷰어를
    // 펼쳐 놓는 대신 접힌 상태로 시작한다.
    activeItem: stored.activeItem === 'documents' ? null : stored.activeItem,
    // 저장된 값이 없으면 일정으로 시작한다. 문서는 화면이 넣어 줘야 볼 것이 생기므로
    // 화살표만 눌러 여는 첫 경험에는 맞지 않는다.
    lastItem: stored.lastItem ?? stored.activeItem ?? 'schedule',
    widths: { ...RAIL_DEFAULT_WIDTH, ...stored.widths },
    documentContext: null,
    documentTabKey: null,
    todoRevision: 0,

    toggleItem: (item) => {
      // 접을 때도 lastItem은 남긴다. 상단 화살표가 다시 열 대상이다.
      set((state) => ({
        activeItem: state.activeItem === item ? null : item,
        lastItem: item,
      }));
      persist();
    },

    openItem: (item) => {
      set({ activeItem: item, lastItem: item });
      persist();
    },

    collapse: () => {
      set({ activeItem: null });
      persist();
    },

    toggleCollapsed: () => {
      set((state) => (
        state.activeItem
          ? { activeItem: null }
          : { activeItem: state.lastItem }
      ));
      persist();
    },

    setWidth: (item, width) => {
      // 같은 값이면 아무것도 하지 않는다. 새 객체를 만들면 구독자가 헛돈다.
      if (get().widths[item] === width) return;
      set((state) => ({ widths: { ...state.widths, [item]: width } }));
      persistWidthsSoon();
    },

    showDocuments: (context) => {
      set({ documentContext: context, activeItem: 'documents', lastItem: 'documents' });
      persist();
    },

    setDocumentTabKey: (key) => set({ documentTabKey: key }),

    setActiveDocumentId: (officeActionId) => set((state) => (
      state.documentContext
        ? { documentContext: { ...state.documentContext, activeId: officeActionId } }
        : {}
    )),

    invalidateTodos: () => set((state) => ({ todoRevision: state.todoRevision + 1 })),

    clearDocuments: (source, options) => set((state) => {
      if (state.documentContext?.source !== source) return {};
      return {
        documentContext: null,
        // 문서가 사라졌으니 빈 뷰어를 펼쳐 두지 않는다(keepPanelOpen이면 그대로 둔다).
        activeItem: !options?.keepPanelOpen && state.activeItem === 'documents'
          ? null
          : state.activeItem,
      };
    }),
  };
});
