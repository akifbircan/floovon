import { useState, useCallback, useEffect, useRef } from 'react';

const PREFIX = '+90 (';

/**
 * Sadece rakam; 90/0 kırp, en fazla 10 hane (5xxxxxxxxx).
 */
function normalizeToLocal10(dbOrAny: string): string {
  let d = (dbOrAny || '').replace(/\D/g, '');
  if (d.startsWith('90')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 10);
}

/**
 * 10 (veya daha az) haneyi "+90 (5XX) XXX XX XX" içeriği. Parantez sadece 4+ rakamda kapanır ki tek tek silerken takılmasın.
 */
function formatLocal10(d10: string): string {
  if (!d10.length) return '';
  const p1 = d10.slice(0, 3);
  if (d10.length <= 3) return p1;
  const p2 = d10.slice(3, 6);
  const p3 = d10.slice(6, 8);
  const p4 = d10.slice(8, 10);
  return p1 + ') ' + [p2, p3, p4].filter(Boolean).join(' ').trim();
}

/**
 * Input'ta gösterilecek tam metin: +90 ( + "5xx xxx xx xx"
 */
function renderInputFromLocal10(d10: string): string {
  return PREFIX + formatLocal10(d10);
}

/**
 * Telefon input: input içinde sabit "+90 (" (silinmez).
 * Kullanıcı 5xx xxx xx xx yazar/siler; DB'ye 905066593545 kaydedilir; DB'den okununca +90 ( formatında gösterilir.
 */
export function usePhoneInput(initialValue: string = '') {
  const inputRef = useRef<HTMLInputElement>(null);
  const [displayValue, setDisplayValue] = useState<string>(() =>
    renderInputFromLocal10(normalizeToLocal10(initialValue))
  );

  useEffect(() => {
    const el = inputRef.current;
    if (!el || document.activeElement !== el) return;
    requestAnimationFrame(() => {
      el.setSelectionRange(displayValue.length, displayValue.length);
    });
  }, [displayValue]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.startsWith(PREFIX) ? e.target.value.slice(PREFIX.length) : e.target.value;
    const d10 = normalizeToLocal10(raw);
    setDisplayValue(renderInputFromLocal10(d10));
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const isCaret = start === end;

    // Sadece tek karakter (caret) prefix’teyken Backspace/Delete engelle; Ctrl+A ile tam seçimde silinebilsin
    if (e.key === 'Backspace' && isCaret && start <= PREFIX.length) {
      e.preventDefault();
      requestAnimationFrame(() => el.setSelectionRange(PREFIX.length, PREFIX.length));
      return;
    }
    if (e.key === 'Delete' && isCaret && start < PREFIX.length) {
      e.preventDefault();
      requestAnimationFrame(() => el.setSelectionRange(PREFIX.length, PREFIX.length));
      return;
    }
    if (/^\d$/.test(e.key) && normalizeToLocal10(displayValue).length >= 10) {
      e.preventDefault();
    }
  }, [displayValue]);

  const handleFocus = useCallback(() => {
    if (!displayValue.startsWith(PREFIX)) {
      setDisplayValue(PREFIX);
    }
  }, [displayValue]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const d10 = normalizeToLocal10(e.clipboardData.getData('text') || '');
    setDisplayValue(renderInputFromLocal10(d10));
  }, []);

  useEffect(() => {
    if (initialValue !== undefined) {
      setDisplayValue(renderInputFromLocal10(normalizeToLocal10(initialValue)));
    }
  }, [initialValue]);

  const d10 = normalizeToLocal10(displayValue);
  const cleanValue = d10 ? '90' + d10 : '';

  return {
    displayValue,
    cleanValue,
    handleChange,
    handleKeyDown,
    handleFocus,
    handlePaste,
    setDisplayValue: (dbPhone: string) => setDisplayValue(renderInputFromLocal10(normalizeToLocal10(dbPhone))),
    inputRef,
  };
}
