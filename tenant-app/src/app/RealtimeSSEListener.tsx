/**
 * SSE ile sunucudan gelen "invalidate" mesajlarını dinler.
 * Bir kullanıcı sipariş/güncelleme yaptığında backend tüm aynı tenant oturumlarına yayın yapar;
 * bu component de cache'i invalidate ederek sayfaların anında güncellenmesini sağlar.
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './providers/AuthProvider';
import { getApiBaseUrl } from '../lib/runtime';

export function RealtimeSSEListener() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const base = getApiBaseUrl().replace(/\/+$/, '');
    const url = base.startsWith('http')
      ? (base.endsWith('/api') ? `${base}/sse` : `${base}/api/sse`)
      : `${typeof window !== 'undefined' ? window.location.origin : ''}${base}${base.endsWith('/api') ? '' : '/api'}/sse`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'invalidate' || data?.type === 'connected') {
          if (data.type === 'invalidate') {
            queryClient.invalidateQueries({ queryKey: ['siparis-kartlar'] });
            queryClient.invalidateQueries({ queryKey: ['organizasyon-kartlar'] });
            queryClient.invalidateQueries({ queryKey: ['baglantili-siparisler'] });
            queryClient.invalidateQueries({ queryKey: ['archived-orders'] });
          }
        }
        if (data?.type === 'ciceksepeti_new_order') {
          const win = typeof window !== 'undefined' ? (window as Window & { ciceksepetiIntegration?: { showSystemNotification: (t: string, b: string, tag?: string) => void; playNotificationSound: () => void } }) : null;
          const integration = win?.ciceksepetiIntegration;
          if (integration) {
            const title = 'Yeni Çiçek Sepeti siparişi';
            const body = data.siparis_no ? `Sipariş no: ${data.siparis_no}` : 'Yeni sipariş geldi.';
            const uniqueTag = data.siparis_no ? String(data.siparis_no) : undefined;
            if (typeof integration.showSystemNotification === 'function') integration.showSystemNotification(title, body, uniqueTag);
            if (typeof localStorage !== 'undefined' && localStorage.getItem('ciceksepeti_ses_bildirimi') !== 'false' && typeof integration.playNotificationSound === 'function') {
              integration.playNotificationSound();
            }
          }
        }
      } catch (_) {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [user?.id, queryClient]);

  return null;
}
