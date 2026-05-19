import { create } from 'zustand';
import { MockUser, mockUsers } from '../mocks/users';

interface UserState {
  users: MockUser[];
  currentUserId: string;
  currentUser: MockUser;
  setCurrentUserId: (userId: string) => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  users: mockUsers,
  currentUserId: mockUsers[0].id,
  currentUser: mockUsers[0],
  setCurrentUserId: (userId) => {
    const nextUser = get().users.find((user) => user.id === userId);
    if (!nextUser) return;

    set({
      currentUserId: nextUser.id,
      currentUser: nextUser,
    });
  },
}));
