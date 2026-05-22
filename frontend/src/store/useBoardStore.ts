import { create } from 'zustand';
import { CompoundGroup, mockGroups } from '../mocks/compounds';

interface BoardState {
  selectedGroupIds: string[];
  selectedSarCompoundIds: string[];
  groups: CompoundGroup[];
  searchType: string[]; // ['my designs', 'my compounds']
  toggleGroupSelection: (groupId: string) => void;
  setSelectedSarCompoundIds: (compoundIds: string[]) => void;
  clearSelectedSarCompoundIds: () => void;
  setSearchType: (types: string[]) => void;
  addGroup: (group: CompoundGroup) => void;
  mergeGroups: (groupIds: string[], name: string) => void;
  copyGroup: (groupId: string) => void;
  deleteGroups: (groupIds: string[]) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  selectedGroupIds: [],
  selectedSarCompoundIds: [],
  groups: mockGroups,
  searchType: ['my designs', 'my compounds'],
  toggleGroupSelection: (groupId) => set((state) => ({
    selectedGroupIds: state.selectedGroupIds.includes(groupId)
      ? state.selectedGroupIds.filter(id => id !== groupId)
      : [...state.selectedGroupIds, groupId]
  })),
  setSelectedSarCompoundIds: (compoundIds) => set({ selectedSarCompoundIds: compoundIds }),
  clearSelectedSarCompoundIds: () => set({ selectedSarCompoundIds: [] }),
  setSearchType: (types) => set({ searchType: types }),
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
