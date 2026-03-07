import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getInvalidateChannelName } from '../lib/crossTabInvalidate';

/**
 * Diğer sekmelerden gelen "cache invalidate et" mesajlarını dinler.
 * Index'te sipariş güncellenince partner cari sekmesindeki liste anında yenilenir.
 */
export function CrossTabInvalidateListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(getInvalidateChannelName());
    const handler = (event: MessageEvent<{ type: string; queryKeys?: unknown[][] }>) => {
      if (event.data?.type !== 'invalidate' || !Array.isArray(event.data.queryKeys)) return;
      event.data.queryKeys.forEach((queryKey) => {
        if (Array.isArray(queryKey) && queryKey.length > 0) {
          queryClient.invalidateQueries({ queryKey });
        }
      });
    };
    channel.addEventListener('message', handler);
    return () => {
      channel.removeEventListener('message', handler);
      channel.close();
    };
  }, [queryClient]);

  return null;
}
