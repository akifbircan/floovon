/**
 * Kullanım hata logları – frontend ve API hatalarını backend'e gönderir.
 * Sunucu ortamında proje_kullanim_hata_logs tablosundan takip edilebilir.
 */

import { getApiBaseUrl } from './runtime';

export interface ClientErrorPayload {
  message: string;
  stack?: string;
  url?: string;
  http_status?: number;
  endpoint?: string;
  source?: 'frontend' | 'api';
}

let lastSentKey = '';
const DEBOUNCE_MS = 5000;

function getDedupKey(payload: ClientErrorPayload): string {
  return `${payload.message?.slice(0, 100)}|${payload.endpoint || ''}|${payload.http_status || ''}`;
}

/**
 * Tek bir hata kaydını backend'e gönderir (veritabanına yazılır).
 */
export function logClientError(payload: ClientErrorPayload): void {
  const key = getDedupKey(payload);
  if (key === lastSentKey) return;
  lastSentKey = key;
  setTimeout(() => {
    lastSentKey = '';
  }, DEBOUNCE_MS);

  const base = getApiBaseUrl();
  const url = base.startsWith('http') ? `${base}/log-client-error` : `${window.location.origin}${base}/log-client-error`;
  const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('floovon_token') || localStorage.getItem('token')) : null;

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: 'include',
    body: JSON.stringify({
      message: payload.message,
      stack: payload.stack,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      http_status: payload.http_status,
      endpoint: payload.endpoint,
      source: payload.source || 'frontend',
    }),
  }).catch(() => {
    // Log gönderilemezse sessizce geç (console spam yapma)
  });
}

/**
 * Global hata yakalayıcıları kaydeder (uncaught errors, unhandled rejections).
 * main.tsx veya App.tsx içinde bir kez initErrorLogger() çağrılmalı.
 */
export function initErrorLogger(): void {
  if (typeof window === 'undefined') return;

  window.onerror = (message, source, lineno, colno, error) => {
    const stack = error?.stack || `${source}:${lineno}:${colno}`;
    logClientError({
      message: String(message),
      stack,
      source: 'frontend',
    });
    return false;
  };

  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message ?? event.reason ?? 'Unhandled rejection';
    const stack = event.reason?.stack;
    logClientError({
      message: String(message),
      stack: stack || undefined,
      source: 'frontend',
    });
  });
}
