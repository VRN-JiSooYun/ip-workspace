import { create } from 'zustand';
import { CompoundGroup, mockGroups } from '../mocks/compounds';

interface BoardState {
  selectedGroupIds: string[];
  groups: CompoundGroup[];
  searchType: string[]; // ['my designs', 'my compounds']
  toggleGroupSelection: (groupId: string) => void;
  setSearchType: (types: string[]) => void;
  addGroup: (group: CompoundGroup) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  selectedGroupIds: [],
  groups: mockGroups,
  searchType: ['my designs', 'my compounds'],
  toggleGroupSelection: (groupId) => set((state) => ({
    selectedGroupIds: state.selectedGroupIds.includes(groupId)
      ? state.selectedGroupIds.filter(id => id !== groupId)
      : [...state.selectedGroupIds, groupId]
  })),
  setSearchType: (types) => set({ searchType: types }),
  addGroup: (group) => set((state) => ({ groups: [...state.groups, group] })),
}));
