/**
 * Axios benzeri hatalardan kullanıcıya gösterilecek Türkçe mesaj üretir.
 * Teknik detaylar console'a yazılır.
 */

const REQUEST_FAILED_EN = /Request failed with status code|Network Error|timeout of \d+ms exceeded|ECONNABORTED/i;

function pickServerMessage(data: unknown): string | undefined {
  if (data == null) return undefined;
  if (typeof data === 'string') {
    const t = data.trim();
    if (!t || t.length > 600 || /<!DOCTYPE/i.test(t)) return undefined;
    return t;
  }
  if (typeof data === 'object') {
    const o = data as Record<string, unknown>;
    for (const k of ['error', 'message', 'detail']) {
      const v = o[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return undefined;
}

export type ApiErrorContext = 'analiz' | 'cevap' | 'mesaj' | 'siparis' | 'genel';

const FIVE_XX_BY_CONTEXT: Record<ApiErrorContext, string> = {
  analiz:
    'Analiz şu an yapılamadı. Lütfen tekrar deneyin; sorun sürerse destek ile iletişime geçin.',
  cevap:
    'Cevap kontrol edilemedi. Sunucuda geçici bir hata oluştu. Lütfen bir süre sonra tekrar deneyin.',
  mesaj:
    'Mesaj gönderilemedi. Sunucuda geçici bir hata oluştu. Lütfen tekrar deneyin.',
  siparis:
    'Sipariş kaydedilemedi. Sunucuda geçici bir hata oluştu. Lütfen tekrar deneyin.',
  genel: 'Sunucuda geçici bir hata oluştu. Lütfen tekrar deneyin.',
};

/**
 * @param err — axios catch parametresi
 * @param fallback — 4xx veya bilinmeyen durumda sunucu mesajı yoksa
 * @param context — 5xx için bağlama özel Türkçe metin
 */
export function formatApiErrorForUser(
  err: unknown,
  fallback: string,
  context: ApiErrorContext = 'genel'
): string {
  const e = err as {
    response?: { status?: number; data?: unknown };
    message?: string;
    code?: string;
  };

  console.error('[API hata]', err);

  if (!e?.response) {
    const msg = String(e?.message || '');
    if (e?.code === 'ERR_NETWORK' || msg === 'Network Error') {
      return 'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.';
    }
    if (REQUEST_FAILED_EN.test(msg) || e?.code === 'ECONNABORTED') {
      return 'İstek zaman aşımına uğradı veya sunucuya ulaşılamadı. Lütfen tekrar deneyin.';
    }
    if (msg && !REQUEST_FAILED_EN.test(msg)) return msg;
    return fallback;
  }

  const status = e.response.status ?? 0;
  const serverMsg = pickServerMessage(e.response.data);

  if (status >= 500) {
    return FIVE_XX_BY_CONTEXT[context] ?? FIVE_XX_BY_CONTEXT.genel;
  }

  if (status === 401) {
    return 'Oturum süreniz dolmuş olabilir. Lütfen yeniden giriş yapın.';
  }
  if (status === 403) {
    return 'Bu işlem için yetkiniz bulunmuyor.';
  }
  if (status === 404) {
    return serverMsg && !REQUEST_FAILED_EN.test(serverMsg)
      ? serverMsg
      : 'İstenen kaynak bulunamadı.';
  }

  if (serverMsg && !REQUEST_FAILED_EN.test(serverMsg)) {
    return serverMsg;
  }

  const raw = String(e.message || '');
  if (REQUEST_FAILED_EN.test(raw)) {
    return fallback;
  }
  return fallback;
}
