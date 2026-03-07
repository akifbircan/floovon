/**
 * Auth context ve useAuth hook.
 * Ayrı dosyada tutulur ki HMR sırasında context referansı değişmesin;
 * yoksa login sonrası "useAuth must be used within AuthProvider" hatası oluşur.
 */

import { createContext, useContext } from 'react';
import type { User } from '../../lib/auth';

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User, token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export { AuthContext };
