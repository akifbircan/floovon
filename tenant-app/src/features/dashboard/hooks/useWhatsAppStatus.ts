import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { usePlan } from '@/app/providers/PlanProvider';

export const WHATSAPP_STATUS_CHANNEL = 'floovon-whatsapp-status';

/** Başka sekmelerdeki header’ın hemen pasif görünmesi için (disconnect/çıkış sonrası) çağrılabilir */
export function broadcastWhatsAppDisconnected() {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const ch = new BroadcastChannel(WHATSAPP_STATUS_CHANNEL);
    ch.postMessage({
      type: 'disconnected',
      status: {
        installed: true,
        isReady: false,
        isAuthenticated: false,
        hasQRCode: false,
        browserSessionActive: false,
        lastDisconnectReason: 'LOGOUT',
        phoneNumber: null,
        userName: null,
        connectedAt: null,
        warning: null,
        status: 'disconnected',
        initializing: false,
      } as WhatsAppStatus,
    });
    ch.close();
  } catch (_) {}
}

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

function parseStatusFromApi(statusData: Record<string, unknown>): WhatsAppStatus {
  return {
    installed: !!(statusData.installed ?? true),
    isReady: !!(statusData.isReady ?? false),
    isAuthenticated: !!(statusData.isAuthenticated ?? false),
    hasQRCode: !!(statusData.hasQRCode ?? false),
    browserSessionActive: !!(statusData.browserSessionActive ?? false),
    lastDisconnectReason: (statusData.lastDisconnectReason as string) ?? null,
    phoneNumber: (statusData.phoneNumber ?? statusData.phone_number) as string ?? null,
    userName: (statusData.userName ?? statusData.user_name ?? statusData.username) as string ?? null,
    connectedAt: (statusData.connectedAt as string) ?? null,
    warning: (statusData.warning as string) ?? null,
    status: statusData.status as string | undefined,
    initializing: !!(statusData.initializing ?? false),
  };
}

/**
 * WhatsApp bağlantı durumu hook'u
 * Header'da durum göstergesi için kullanılır.
 * Bağlı değilse sayfa açılır açılmaz arka planda initialize tetiklenir – popup açıldığında karekod hazır olsun.
 * Diğer sekmelerde çıkış yapıldığında header'ın pasif görünmesi için BroadcastChannel ile senkronize edilir.
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
      const statusData = response.data as Record<string, unknown>;
      const nextStatus = parseStatusFromApi(statusData);
      setStatus(nextStatus);

      // Bir sekmede çıkış algılandığında diğer sekmelere yayınla – header’lar hemen pasif görünsün
      const isDisconnected = !nextStatus.isReady && (nextStatus.status === 'disconnected' || !nextStatus.isAuthenticated);
      if (isDisconnected && typeof BroadcastChannel !== 'undefined') {
        try {
          const ch = new BroadcastChannel(WHATSAPP_STATUS_CHANNEL);
          ch.postMessage({ type: 'disconnected', status: nextStatus });
          ch.close();
        } catch (_) {}
      }

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

  // Diğer sekmelerde çıkış yapıldığında bu sekmede de header’ı pasif yap
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(WHATSAPP_STATUS_CHANNEL);
    const onMessage = (ev: MessageEvent) => {
      if (ev.data?.type === 'disconnected' && ev.data?.status) {
        setStatus(ev.data.status as WhatsAppStatus);
      }
    };
    ch.addEventListener('message', onMessage);
    return () => {
      ch.removeEventListener('message', onMessage);
      ch.close();
    };
  }, []);

  useEffect(() => {
    checkStatus();
    if (isBaslangicPlan === true) return;
    // QR açıkken veya bağlanırken sık poll (karekod okutulunca popup hızlı güncellensin); bağlıyken 100ms; değilse 5 sn
    const hasQROrConnecting = !!(status?.hasQRCode || isReconnecting);
    const intervalMs = isConnected ? 100 : hasQROrConnecting ? 800 : 5000;
    const interval = setInterval(checkStatus, intervalMs);
    return () => clearInterval(interval);
  }, [checkStatus, isBaslangicPlan, isConnected, isReconnecting, status?.hasQRCode]);

  return {
    status,
    loading,
    isConnected,
    isReconnecting,
    checkStatus,
  };
}

