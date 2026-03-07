/**
 * Sayfa erişim izinleri - Navbar filtreleme ve route koruması için
 * /api/user/page-permissions endpoint'inden kullanıcının sayfa izinlerini alır
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiRequest } from '../../lib/api';
import { useAuth } from './authContext';

export type PagePermissions = Record<string, boolean>;

interface PagePermissionsContextType {
  permissions: PagePermissions;
  isLoading: boolean;
  refetch: () => Promise<void>;
  hasAccess: (pageId: string) => boolean;
}

const PagePermissionsContext = createContext<PagePermissionsContextType | null>(null);

export function usePagePermissions() {
  const ctx = useContext(PagePermissionsContext);
  if (!ctx) {
    throw new Error('usePagePermissions must be used within PagePermissionsProvider');
  }
  return ctx;
}

/** Sistem yöneticisi rol kontrolü */
function isSystemAdmin(role: string | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase().trim();
  return (
    r === 'sistem yöneticisi' ||
    r === 'sistem-yoneticisi' ||
    r === 'sistem_yoneticisi' ||
    r === 'admin'
  );
}

interface PagePermissionsProviderProps {
  children: ReactNode;
}

export const PagePermissionsProvider: React.FC<PagePermissionsProviderProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [permissions, setPermissions] = useState<PagePermissions>({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchPermissions = useCallback(async (silent = false) => {
    if (!isAuthenticated || !user) {
      setPermissions({});
      return;
    }
    if (!silent) setIsLoading(true);
    try {
      const data = await apiRequest<Array<{ page_id: string; has_access: boolean | number }>>(
        '/user/page-permissions',
        { method: 'GET' }
      );
      const map: PagePermissions = {};
      if (Array.isArray(data)) {
        data.forEach((p) => {
          const v = p.has_access;
          map[p.page_id] = v === true || v === 1 || v === '1' || v === 'true';
        });
      }
      setPermissions(map);
    } catch (error) {
      console.error('Sayfa izinleri yüklenemedi:', error);
      setPermissions({});
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Profil ayarlarında izin güncellendiğinde yeniden yükle (silent: sayfa unmount olmasın, sekme kaymasın)
  useEffect(() => {
    const handler = () => fetchPermissions(true);
    window.addEventListener('pagePermissionsUpdated', handler);
    return () => window.removeEventListener('pagePermissionsUpdated', handler);
  }, [fetchPermissions]);

  const hasAccess = useCallback(
    (pageId: string): boolean => {
      if (!user) return false;
      // index (Siparişler) her zaman erişilebilir - değiştirilemez
      if (pageId === 'index') return true;
      if (isSystemAdmin(user.role || (user as any).yetki)) return true;
      return permissions[pageId] === true;
    },
    [user, permissions]
  );

  const value: PagePermissionsContextType = {
    permissions,
    isLoading,
    refetch: fetchPermissions,
    hasAccess,
  };

  return (
    <PagePermissionsContext.Provider value={value}>
      {children}
    </PagePermissionsContext.Provider>
  );
};
