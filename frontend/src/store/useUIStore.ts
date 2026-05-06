import { create } from 'zustand';
import { ReactNode } from 'react';

interface UIState {
  headerContent: ReactNode | null;
  setHeaderContent: (content: ReactNode | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  headerContent: null,
  setHeaderContent: (content) => set({ headerContent: content }),
}));
