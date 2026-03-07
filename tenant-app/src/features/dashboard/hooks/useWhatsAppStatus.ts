import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { usePlan } from '@/app/providers/PlanProvider';

interface WhatsAppStatus {
  installed: boolean;
  isReady: boolean;
  isAuthenticated: boolean;
  hasQRCode: boolean;
  browserSessionActive: boolean;
  lastDisconnectReason: string | null;
  phoneNumber: string | null;
  userName: string | null;
  connectedAt: string | null;
  warning: string | null;
  /** Backend: 'connecting' = DB'de bağlı, session diskten yükleniyor (restart sonrası) */
  status?: string;
  initializing?: boolean;
}

/**
 * WhatsApp bağlantı durumu hook'u
 * Header'da durum göstergesi için kullanılır.
 * Bağlı değilse sayfa açılır açılmaz arka planda initialize tetiklenir – popup açıldığında karekod hazır olsun.
 */
export function useWhatsAppStatus() {
  const { isBaslangicPlan } = usePlan();
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const preInitDoneRef = useRef(false);

  const checkStatus = useCallback(async () => {
    // Başlangıç planında veya plan bilgisi yüklenene kadar WhatsApp API'sine istek atma (403 önlenir)
    if (isBaslangicPlan !== false) {
      setStatus(null);
      setLoading(false);
      return;
    }
    try {
      const response = await apiClient.get('/whatsapp/status');
      const statusData = response.data;
      
      // DB'ye yazılmamış olsa bile arayüzde görünsün: API camelCase veya snake_case dönebilir
      setStatus({
        installed: statusData.installed || false,
        isReady: statusData.isReady || false,
        isAuthenticated: statusData.isAuthenticated || false,
        hasQRCode: statusData.hasQRCode || false,
        browserSessionActive: statusData.browserSessionActive || false,
        lastDisconnectReason: statusData.lastDisconnectReason || null,
        phoneNumber: statusData.phoneNumber || statusData.phone_number || null,
        userName: statusData.userName || statusData.user_name || statusData.username || null,
        connectedAt: statusData.connectedAt || null,
        warning: statusData.warning || null,
        status: statusData.status ?? undefined,
        initializing: statusData.initializing ?? false,
      });

      // "connecting" = DB'de bağlı, backend session'ı diskten yüklüyor (restart sonrası) – initialize zaten status'ta tetikleniyor, tekrar çağırma
      const isReconnecting = statusData.status === 'connecting' || (!!statusData.installed && !!statusData.initializing && !!(statusData.phoneNumber || statusData.phone_number));
      if (isReconnecting) {
        preInitDoneRef.current = true; // QR isteme, bekle
      }
      // Bağlı değilse ve "reconnecting" değilse, bir kez initialize tetikle
      const needConnect = statusData.installed && !statusData.isReady && !isReconnecting;
      if (needConnect && !preInitDoneRef.current) {
        preInitDoneRef.current = true;
        apiClient.post('/whatsapp/initialize').catch(() => {});
      }
      if (statusData.isReady) preInitDoneRef.current = false;
    } catch (error: unknown) {
      const isNetworkError = error && typeof error === 'object' && 'message' in error &&
        (String((error as { message?: string }).message).includes('Network Error') ||
         String((error as { message?: string }).message).toLowerCase().includes('connection reset'));
      if (isNetworkError) {
        // Backend kapalı veya ulaşılamıyor – sessizce "bağlı değil" kabul et, kullanıcıyı alarmlamayalım
        setStatus({
          installed: false,
          isReady: false,
          isAuthenticated: false,
          hasQRCode: false,
          browserSessionActive: false,
          lastDisconnectReason: null,
          phoneNumber: null,
          userName: null,
          connectedAt: null,
          warning: 'Backend bağlantısı yok',
        });
      } else {
        setStatus(null);
      }
    } finally {
      setLoading(false);
    }
  }, [isBaslangicPlan]);

  const isReconnecting = !!(status?.installed && !status?.isReady && (status?.status === 'connecting' || (status?.initializing && status?.phoneNumber)));
  const isConnected = !!(status?.installed && 
                      status?.isReady && 
                      status?.isAuthenticated && 
                      !status?.browserSessionActive &&
                      status?.lastDisconnectReason !== 'LOGOUT');

  useEffect(() => {
    checkStatus();
    if (isBaslangicPlan === true) return;
    // Restart sonrası session yüklenirken 2 sn'de bir poll; bağlıyken 100ms; değilse 5 sn
    const intervalMs = isConnected ? 100 : isReconnecting ? 2000 : 5000;
    const interval = setInterval(checkStatus, intervalMs);
    return () => clearInterval(interval);
  }, [checkStatus, isBaslangicPlan, isConnected, isReconnecting]);

  return {
    status,
    loading,
    isConnected,
    isReconnecting,
    checkStatus,
  };
}

