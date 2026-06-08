export type UserRole = 'design' | 'synthesis';

export interface MockUser {
  id: string;
  name: string;
  team: string;
  role: UserRole;
}

export const mockUsers: MockUser[] = [
  { id: 'u-design-park', name: '박창인', team: '설계팀', role: 'design' },
  { id: 'u-modeling-son', name: '손민경', team: '모델링팀', role: 'design' },
  { id: 'u-synthesis-moon', name: '문태훈', team: '합성팀', role: 'synthesis' },
  { id: 'u-synthesis-yoon', name: '윤지수', team: '합성팀', role: 'synthesis' },
];
