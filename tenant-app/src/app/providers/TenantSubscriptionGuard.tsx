/**
 * Tenant ve abonelik durumu kontrolü
 * Abonelik sona erdiyse veya tenant silindiyse anında çıkış yapar
 */

import React, { useEffect, useRef } from 'react';
import { apiClient } from '../../lib/api';
import { useAuth } from './authContext';

const CHECK_INTERVAL_MS = 60_000; // 60 saniyede bir

function clearSessionAndRedirect() {
  localStorage.removeItem('floovon_token');
  localStorage.removeItem('token');
  localStorage.removeItem('floovon_user_id');
  localStorage.removeItem('user_id');
  localStorage.removeItem('floovon_user');
  localStorage.removeItem('user');
  localStorage.removeItem('floovon_tenant_id');
  localStorage.removeItem('tenant_id');
  window.location.href = '/login';
}

export const TenantSubscriptionGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const checkSession = async () => {
      try {
        const res = await apiClient.get('/auth/session-check');
        const data = res.data as { valid?: boolean; error?: string };
        if (data?.valid === false || data?.error) {
          clearSessionAndRedirect();
        }
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number; data?: { error?: string } } })?.response?.status;
        const errorMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || '';
        if (status === 403) {
          const forceLogout =
            /abonelik|aboneliğiniz|tenant|silindi|sona erdi|iptal/i.test(errorMsg);
          if (forceLogout) {
            clearSessionAndRedirect();
          }
        }
      }
    };

    // İlk kontrol
    checkSession();

    intervalRef.current = setInterval(checkSession, CHECK_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated]);

  return <>{children}</>;
};
