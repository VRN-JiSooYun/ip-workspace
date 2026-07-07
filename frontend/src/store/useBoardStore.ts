import { create } from 'zustand';
import { Compound, CompoundGroup, mockGroups } from '../mocks/compounds';
import type { GroupedCompoundSarData, CompoundSarDataRow } from '../services/compoundApi';

export type SarHighlightMode = 'com' | 'diff' | 'off';
export type SarAtomColorMode = 'black' | 'color';
export type SarAbbreviationMode = 'keep' | 'all' | 'off';

export interface SarScaffoldSettings {
  mode: 'auto' | 'custom';
  source: 'none' | 'auto' | 'custom';
  smiles?: string;
  molBlock?: string;
  cdxml?: string;
  color?: string;
  svg?: string | null;
  updatedAt?: number;
}

export interface GroupStructureViewSettings {
  sarImageScalePercent: number;
  sarRotationDeg: number;
  sarOverlapPercent: number;
  sarHighlightMode: SarHighlightMode;
  sarAtomColorMode: SarAtomColorMode;
  sarAbbreviationMode: SarAbbreviationMode;
  sarScaffold: SarScaffoldSettings;
  myBoardImageScalePercent: number;
}

export const DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS: GroupStructureViewSettings = {
  sarImageScalePercent: 100,
  sarRotationDeg: 0,
  sarOverlapPercent: 0,
  sarHighlightMode: 'off',
  sarAtomColorMode: 'black',
  sarAbbreviationMode: 'off',
  sarScaffold: {
    mode: 'auto',
    source: 'none',
  },
  myBoardImageScalePercent: 100,
};

const BOOKMARKED_GROUP_IDS_STORAGE_KEY = 'my-board:bookmarked-group-ids';
const COMPOUND_LOGIN_TOKEN_STORAGE_KEY = 'compound-api:login-token';

const readBookmarkedGroupIds = (): string[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(BOOKMARKED_GROUP_IDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const writeBookmarkedGroupIds = (groupIds: string[]) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(BOOKMARKED_GROUP_IDS_STORAGE_KEY, JSON.stringify(groupIds));
  } catch {
    // Ignore temporary UX persistence failures.
  }
};

const readCompoundLoginToken = (): string => {
  if (typeof window === 'undefined') return '';

  try {
    return window.localStorage.getItem(COMPOUND_LOGIN_TOKEN_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};

const writeCompoundLoginToken = (loginToken: string) => {
  if (typeof window === 'undefined') return;

  try {
    if (loginToken) {
      window.localStorage.setItem(COMPOUND_LOGIN_TOKEN_STORAGE_KEY, loginToken);
    } else {
      window.localStorage.removeItem(COMPOUND_LOGIN_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore temporary UX persistence failures.
  }
};

const insertCompoundAfterGroupTail = (rows: Compound[], compound: Compound) => {
  const rowsWithoutCompound = rows.filter((item) => item.id !== compound.id);
  const lastGroupIndex = rowsWithoutCompound.reduce((lastIndex, item, index) => (
    item.groupId === compound.groupId ? index : lastIndex
  ), -1);
  const insertIndex = lastGroupIndex >= 0 ? lastGroupIndex + 1 : rowsWithoutCompound.length;

  return [
    ...rowsWithoutCompound.slice(0, insertIndex),
    compound,
    ...rowsWithoutCompound.slice(insertIndex),
  ];
};

interface BoardState {
  selectedGroupIds: string[];
  selectedSarCompoundIds: string[];
  hiddenCompoundIds: string[];
  bookmarkedGroupIds: string[];
  compoundLoginToken: string;
  externalCompoundRows: Compound[];
  compoundSarRows: CompoundSarDataRow[];
  groupedCompoundSarData: GroupedCompoundSarData[];
  groups: CompoundGroup[];
  groupStructureViewSettings: Record<string, GroupStructureViewSettings>;
  toggleGroupSelection: (groupId: string) => void;
  setSelectedGroupIds: (groupIds: string[]) => void;
  setSelectedSarCompoundIds: (compoundIds: string[]) => void;
  toggleBookmarkedGroup: (groupId: string) => void;
  setBookmarkedGroupIds: (groupIds: string[]) => void;
  setCompoundLoginToken: (loginToken: string) => void;
  addExternalCompoundRow: (compound: Compound) => void;
  setExternalCompoundRows: (compounds: Compound[]) => void;
  setCompoundSarData: (rows: CompoundSarDataRow[], groups: GroupedCompoundSarData[]) => void;
  clearSelectedSarCompoundIds: () => void;
  hideCompounds: (compoundIds: string[]) => void;
  unhideCompounds: (compoundIds: string[]) => void;
  updateGroupStructureViewSettings: (groupId: string, settings: Partial<GroupStructureViewSettings>) => void;
  addGroup: (group: CompoundGroup) => void;
  mergeGroups: (groupIds: string[], name: string) => void;
  copyGroup: (groupId: string) => void;
  deleteGroups: (groupIds: string[]) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  selectedGroupIds: [],
  selectedSarCompoundIds: [],
  hiddenCompoundIds: [],
  bookmarkedGroupIds: readBookmarkedGroupIds(),
  compoundLoginToken: readCompoundLoginToken(),
  externalCompoundRows: [],
  compoundSarRows: [],
  groupedCompoundSarData: [],
  groups: mockGroups,
  groupStructureViewSettings: {},
  toggleGroupSelection: (groupId) => set((state) => ({
    selectedGroupIds: state.selectedGroupIds.includes(groupId)
      ? state.selectedGroupIds.filter(id => id !== groupId)
      : [...state.selectedGroupIds, groupId]
  })),
  setSelectedGroupIds: (groupIds) => set({ selectedGroupIds: groupIds }),
  setSelectedSarCompoundIds: (compoundIds) => set({ selectedSarCompoundIds: compoundIds }),
  toggleBookmarkedGroup: (groupId) => set((state) => {
    const nextBookmarkedGroupIds = state.bookmarkedGroupIds.includes(groupId)
      ? state.bookmarkedGroupIds.filter((id) => id !== groupId)
      : [...state.bookmarkedGroupIds, groupId];

    writeBookmarkedGroupIds(nextBookmarkedGroupIds);
    return { bookmarkedGroupIds: nextBookmarkedGroupIds };
  }),
  setBookmarkedGroupIds: (groupIds) => {
    writeBookmarkedGroupIds(groupIds);
    set({ bookmarkedGroupIds: groupIds });
  },
  setCompoundLoginToken: (loginToken) => {
    writeCompoundLoginToken(loginToken);
    set({ compoundLoginToken: loginToken });
  },
  addExternalCompoundRow: (compound) => set((state) => ({
    externalCompoundRows: insertCompoundAfterGroupTail(state.externalCompoundRows, compound),
  })),
  setExternalCompoundRows: (compounds) => set({ externalCompoundRows: compounds }),
  setCompoundSarData: (rows, groups) => set({
    compoundSarRows: rows,
    groupedCompoundSarData: groups,
  }),
  clearSelectedSarCompoundIds: () => set({ selectedSarCompoundIds: [] }),
  hideCompounds: (compoundIds) => set((state) => ({
    hiddenCompoundIds: Array.from(new Set([...state.hiddenCompoundIds, ...compoundIds])),
    selectedSarCompoundIds: state.selectedSarCompoundIds.filter((compoundId) => !compoundIds.includes(compoundId)),
  })),
  unhideCompounds: (compoundIds) => set((state) => ({
    hiddenCompoundIds: state.hiddenCompoundIds.filter((compoundId) => !compoundIds.includes(compoundId)),
  })),
  updateGroupStructureViewSettings: (groupId, settings) => set((state) => ({
    groupStructureViewSettings: {
      ...state.groupStructureViewSettings,
      [groupId]: {
        ...DEFAULT_GROUP_STRUCTURE_VIEW_SETTINGS,
        ...state.groupStructureViewSettings[groupId],
        ...settings,
      },
    },
  })),
  addGroup: (group) => set((state) => ({ groups: [...state.groups, group] })),
  mergeGroups: (groupIds, name) => set((state) => {
    const targetGroups = state.groups.filter((group) => groupIds.includes(group.id));
    if (targetGroups.length === 0) return state;

    const [primaryGroup] = targetGroups;
    const mergedGroup: CompoundGroup = {
      ...primaryGroup,
      name,
      count: targetGroups.reduce((sum, group) => sum + group.count, 0),
      shareStatus: '공유 안함',
    };

    return {
      groups: state.groups
        .filter((group) => !groupIds.includes(group.id) || group.id === primaryGroup.id)
        .map((group) => (group.id === primaryGroup.id ? mergedGroup : group)),
      selectedGroupIds: groupIds,
    };
  }),
  copyGroup: (groupId) => set((state) => {
    const sourceGroup = state.groups.find((group) => group.id === groupId);
    if (!sourceGroup) return state;

    const copiedGroup: CompoundGroup = {
      ...sourceGroup,
      id: `${sourceGroup.id}-copy-${Date.now()}`,
      name: `${sourceGroup.name} Copy`,
      shareStatus: '공유 안함',
    };

    return { groups: [...state.groups, copiedGroup] };
  }),
  deleteGroups: (groupIds) => set((state) => ({
    groups: state.groups.filter((group) => !groupIds.includes(group.id)),
    selectedGroupIds: state.selectedGroupIds.filter((groupId) => !groupIds.includes(groupId)),
  })),
}));
