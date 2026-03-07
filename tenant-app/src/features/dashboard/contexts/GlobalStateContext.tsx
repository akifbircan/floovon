import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface WhatsAppConnectionStatus {
  isReady: boolean;
  isAuthenticated: boolean;
  lastDisconnectReason: string | null;
  browserSessionActive: boolean;
  lastCheckTime: number | null;
  checkInterval: NodeJS.Timeout | null;
}

interface GlobalStateContextType {
  // WhatsApp connection status
  whatsAppConnectionStatus: WhatsAppConnectionStatus;
  setWhatsAppConnectionStatus: (status: Partial<WhatsAppConnectionStatus>) => void;
  
  // Search query
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // Dashboard billing period
  dashboardBillingPeriod: 'monthly' | 'yearly';
  setDashboardBillingPeriod: (period: 'monthly' | 'yearly') => void;
  
  // Query client (for legacy compatibility)
  queryClient: ReturnType<typeof useQueryClient>;
}

const GlobalStateContext = createContext<GlobalStateContextType | undefined>(undefined);

export const GlobalStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  
  const [whatsAppConnectionStatus, setWhatsAppConnectionStatusState] = useState<WhatsAppConnectionStatus>({
    isReady: false,
    isAuthenticated: false,
    lastDisconnectReason: null,
    browserSessionActive: false,
    lastCheckTime: null,
    checkInterval: null,
  });
  
  const [searchQuery, setSearchQueryState] = useState<string>('');
  const [dashboardBillingPeriod, setDashboardBillingPeriodState] = useState<'monthly' | 'yearly'>('monthly');

  // Update WhatsApp connection status
  const setWhatsAppConnectionStatus = (status: Partial<WhatsAppConnectionStatus>) => {
    setWhatsAppConnectionStatusState((prev) => ({ ...prev, ...status }));
  };

  // Update search query
  const setSearchQuery = (query: string) => {
    setSearchQueryState(query);
    // Legacy compatibility: Update window variable
    (window as any).__REACT_SEARCH_QUERY__ = query;
    // Dispatch custom event for legacy JS
    window.dispatchEvent(new CustomEvent('searchQueryChanged', { detail: { query } }));
  };

  // Update dashboard billing period
  const setDashboardBillingPeriod = (period: 'monthly' | 'yearly') => {
    setDashboardBillingPeriodState(period);
    // Legacy compatibility: Update window variable
    (window as any).dashboardBillingPeriod = period;
  };

  // Initialize window variables for legacy compatibility
  useEffect(() => {
    // Query client
    (window as any).queryClient = queryClient;
    
    // Search query
    (window as any).__REACT_SEARCH_QUERY__ = searchQuery;
    
    // Dashboard billing period
    (window as any).dashboardBillingPeriod = dashboardBillingPeriod;
    
    // WhatsApp connection status
    (window as any).whatsAppConnectionStatus = whatsAppConnectionStatus;
    
    return () => {
      // Cleanup
      delete (window as any).queryClient;
      delete (window as any).__REACT_SEARCH_QUERY__;
      delete (window as any).dashboardBillingPeriod;
      delete (window as any).whatsAppConnectionStatus;
    };
  }, [queryClient, searchQuery, dashboardBillingPeriod, whatsAppConnectionStatus]);

  const value: GlobalStateContextType = {
    whatsAppConnectionStatus,
    setWhatsAppConnectionStatus,
    searchQuery,
    setSearchQuery,
    dashboardBillingPeriod,
    setDashboardBillingPeriod,
    queryClient,
  };

  return (
    <GlobalStateContext.Provider value={value}>
      {children}
    </GlobalStateContext.Provider>
  );
};

export const useGlobalState = () => {
  const context = useContext(GlobalStateContext);
  if (!context) {
    throw new Error('useGlobalState must be used within GlobalStateProvider');
  }
  return context;
};

