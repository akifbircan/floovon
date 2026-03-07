/**
 * Plan kontrolü - Başlangıç (plan_id=1) vs Premium
 * Kampanya, araç takip gibi özellikler sadece premium'da
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiClient } from '../../lib/api';
import { useAuth } from './authContext';

interface PlanContextType {
  isBaslangicPlan: boolean | null;
  maxUsers: number | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const PlanContext = createContext<PlanContextType | null>(null);

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) {
    throw new Error('usePlan must be used within PlanProvider');
  }
  return ctx;
}

interface PlanProviderProps {
  children: ReactNode;
}

export const PlanProvider: React.FC<PlanProviderProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [isBaslangicPlan, setIsBaslangicPlan] = useState<boolean | null>(null);
  const [maxUsers, setMaxUsers] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPlan = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setIsBaslangicPlan(null);
      setMaxUsers(null);
      return;
    }
    setIsLoading(true);
    try {
      const tenantCode =
        localStorage.getItem('floovon_tenant_code') ||
        localStorage.getItem('tenant_code') ||
        localStorage.getItem('remembered_tenant_code') ||
        new URLSearchParams(window.location.search).get('tenant');

      let tenantId: number | null = null;
      if (!tenantCode) {
        const userStr = localStorage.getItem('floovon_user') || localStorage.getItem('user');
        if (userStr) {
          try {
            const u = JSON.parse(userStr);
            tenantId = u.tenant_id || parseInt(localStorage.getItem('floovon_tenant_id') || '0', 10) || null;
          } catch {
            // ignore
          }
        }
      }

      if (!tenantCode && !tenantId) {
        setIsBaslangicPlan(false);
        setMaxUsers(null);
        return;
      }

      const subscriptionUrl = tenantCode
        ? `/public/subscription?tenant_code=${tenantCode}`
        : `/public/subscription?tenant_id=${tenantId}`;

      const response = await apiClient.get(subscriptionUrl);
      const data = response.data;

      if (data?.success && data?.data?.plan_id != null) {
        const planId = Number(data.data.plan_id);
        setIsBaslangicPlan(planId === 1);
        const max = data?.data?.max_users ?? data?.data?.max_kullanici;
        setMaxUsers(max != null ? Number(max) : null);
      } else {
        setIsBaslangicPlan(false);
        setMaxUsers(null);
      }
    } catch {
      setIsBaslangicPlan(false);
      setMaxUsers(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const value: PlanContextType = {
    isBaslangicPlan,
    maxUsers,
    isLoading,
    refetch: fetchPlan,
  };

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
};
