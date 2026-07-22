import React, { createContext, useContext } from 'react';
import type { AuthSession } from '../services/authApi';

const AuthSessionContext = createContext<AuthSession | null>(null);

export const AuthSessionProvider: React.FC<
  React.PropsWithChildren<{ session: AuthSession }>
> = ({ session, children }) => (
  <AuthSessionContext.Provider value={session}>
    {children}
  </AuthSessionContext.Provider>
);

export const useAuthSession = (): AuthSession => {
  const session = useContext(AuthSessionContext);
  if (!session) throw new Error('useAuthSession must be used within AuthSessionProvider');
  return session;
};
