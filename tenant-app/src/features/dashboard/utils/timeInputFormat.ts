/**
 * Teslim saati: yazarken otomatik SS:DD, sadece 00:00–23:59 (TR 24s)
 */

function tryAppendTimeDigit(prevDigits: string, char: string): string | null {
  if (char < '0' || char > '9') return null;
  const d = prevDigits + char;
  const f = d[0];

  if (f > '2') {
    if (d.length > 3) return null;
    if (d.length === 1) return d;
    if (d.length === 2) {
      if (d[1] > '5') return null;
      return d;
    }
    const mm = Number(d.slice(1, 3));
    return mm <= 59 ? d : null;
  }

  if (d.length > 4) return null;
  if (d.length === 1) return d;
  if (d.length === 2) {
    const h = Number(d);
    return h <= 23 ? d : null;
  }
  if (d.length === 3) {
    if (d[2] > '5') return null;
    return d;
  }
  const m = Number(d.slice(2, 4));
  return m <= 59 ? d : null;
}

/** Ham rakamlardan ekranda gösterilecek metin (otomatik :) */
export function timeDigitsToDisplay(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (!d) return '';
  const f = d[0];
  if (f > '2') {
    if (d.length === 1) return `${d}:`;
    return `${d[0]}:${d.slice(1, 3)}`;
  }
  if (d.length === 1) return d;
  if (d.length === 2) return `${d}:`;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

/**
 * Kullanıcı yazışı / yapıştırma → geçerli önek + formatlı string
 */
export function formatTimeInputFromRaw(raw: string): string {
  const chars = String(raw || '')
    .replace(/\D/g, '')
    .split('');
  let cur = '';
  for (const c of chars) {
    const nxt = tryAppendTimeDigit(cur, c);
    if (nxt == null) break;
    cur = nxt;
  }
  return timeDigitsToDisplay(cur);
}

/**
 * Odaktan çıkınca: 14:4 → 14:40, 14 → 14:00, 9 → 09:00, 935 → 09:35
 * Tek hane (0–2) bırakılmışsa aynen bırakılır (tamamlanmamış).
 */
export function finalizeTimeDisplay(formatted: string): string {
  const d = formatted.replace(/\D/g, '');
  if (!d) return '';

  if (d[0] > '2') {
    if (d.length === 1) return padTeslimSaat(Number(d[0]), 0);
    if (d.length === 2) return padTeslimSaat(Number(d[0]), Number(d[1]) * 10);
    return padTeslimSaat(Number(d[0]), Number(d.slice(1, 3)));
  }

  if (d.length >= 4) {
    return padTeslimSaat(Number(d.slice(0, 2)), Number(d.slice(2, 4)));
  }
  if (d.length === 3) {
    return padTeslimSaat(Number(d.slice(0, 2)), Number(`${d[2]}0`));
  }
  if (d.length === 2) {
    return padTeslimSaat(Number(d), 0);
  }
  return timeDigitsToDisplay(d);
}

function padTeslimSaat(h: number, m: number): string {
  return `${String(Math.min(23, Math.max(0, h))).padStart(2, '0')}:${String(Math.min(59, Math.max(0, m))).padStart(2, '0')}`;
}

