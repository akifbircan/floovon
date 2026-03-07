/**
 * Sekmeler arası cache invalidation.
 * Bir sekmede veri güncellendiğinde diğer açık sekmelerdeki React Query cache'ini
 * de invalidate eder; böylece diğer sekmede sayfa yenilemeden veri güncellenir.
 */

const CHANNEL_NAME = 'floovon-query-invalidate';

export type QueryKeyType = readonly unknown[];

/**
 * Diğer sekmelere "bu query key'leri invalidate et" mesajı gönderir.
 * Sadece BroadcastChannel destekleyen tarayıcılarda çalışır.
 */
export function broadcastInvalidation(queryKeys: QueryKeyType[]): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ type: 'invalidate', queryKeys });
    channel.close();
  } catch {
    // sessizce yoksay
  }
}

/**
 * BroadcastChannel adı (listener'ın dinlemesi için).
 */
export function getInvalidateChannelName(): string {
  return CHANNEL_NAME;
}
