/**
 * WhatsApp sohbetinden Yapay Zeka ile çıkarılan alanlarla sipariş oluşturma modalı.
 */

import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiClient } from '@/lib/api';
import {
  checkDuplicateSiparisBeforeCreate,
  createSiparis,
  type SiparisFormData,
} from '../api/siparisActions';
import { invalidateSiparisGuncellemeQueries } from '../../../lib/invalidateQueries';
import { useQueryClient } from '@tanstack/react-query';
import { showToast, showToastInteractive } from '../../../shared/utils/toastUtils';
import { formatApiErrorForUser } from '../../../shared/utils/apiErrorMessage';
import { usePhoneInput } from '../../../shared/hooks/usePhoneInput';
import {
  formatPhoneNumber,
  formatTL,
  parseTL,
  formatOdemeYontemiDisplay,
  formatTLDisplayValue,
  formatTutarInputLive,
  formatTutarInputKeyDown,
} from '../../../shared/utils/formatUtils';
import type { OrganizasyonKart } from '../types';
import { useAddressSelect } from '../hooks/useAddressSelect';
import {
  fuzzyPickName,
  fuzzyPickMahalleLoose,
  resolveIlIlceMahalleWithTRAddress,
} from '../utils/resolveAddressTR';
import { finalizeTimeDisplay, formatTimeInputFromRaw } from '../utils/timeInputFormat';
import { buildMesajSablonuBankaBlokuAsync } from '../utils/musteriBankaWhatsappBlok';
import { AlertTriangle, Loader2, X } from 'lucide-react';

function pickAddrOptionName(
  name: string,
  options: { name: string }[],
  kind: 'il' | 'ilce' | 'mahalle'
): string {
  const n = (name || '').trim();
  if (!n || !options.length) return '';
  const addrItems = options.map((o, i) => ({ id: i, name: o.name }));
  const hit = fuzzyPickName(n, addrItems);
  if (hit) return hit;
  if (kind === 'mahalle') {
    const m = fuzzyPickMahalleLoose(n, addrItems);
    if (m) return m;
  }
  return '';
}

/** Sohbetten sipariş listesinde yalnızca araç süsleme kartları çıkar (kart_tur / kart_turu / görünen ad) */
function isAracSuslemeOrgKart(c: OrganizasyonKart): boolean {
  const slug = (s: unknown) =>
    String(s ?? '')
      .toLowerCase()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, '');
  const t1 = slug(c.kart_tur);
  const t2 = slug((c as { kart_turu?: string }).kart_turu);
  if (t1 === 'aracsusleme' || t2 === 'aracsusleme') return true;
  const d = String(c.kart_tur_display || '').toLowerCase();
  return (d.includes('araç') || d.includes('arac')) && (d.includes('süs') || d.includes('susleme'));
}

/** İl / ilçe / mahalle alanına yazılmaması gereken telefon benzeri metin */
function looksLikeTurkishPhoneValue(raw: string): boolean {
  const s = String(raw || '').trim();
  if (!s) return false;
  const d = s.replace(/\D/g, '');
  if (d.length < 10) return false;
  if (/^5\d{9}$/.test(d)) return true;
  if (/^05\d{9}$/.test(d)) return true;
  if (/^905\d{9}$/.test(d)) return true;
  if (d.length === 12 && d.startsWith('90') && d[2] === '5') return true;
  const letters = s.replace(/[\d\s+().\-/]/g, '');
  if (d.length >= 10 && letters.length <= 4) return true;
  return false;
}

function stripPhoneFromIlIlceMahalle(f: Record<string, string>): Record<string, string> {
  const next = { ...f };
  for (const k of ['teslim_il', 'teslim_ilce', 'teslim_mahalle'] as const) {
    const v = String((next as any)[k] || '').trim();
    if (v && looksLikeTurkishPhoneValue(v)) (next as any)[k] = '';
  }
  return next;
}

export interface WhatsAppChat {
  id: string;
  name: string;
  phoneNumber: string;
  lastMessage: string | null;
  lastMessageTime: number | null;
}

interface SohbettenSiparisModalProps {
  isOpen: boolean;
  onClose: () => void;
  chat: WhatsAppChat | null;
  /** Sipariş kaydedildi; üst modallar kapanır ve dashboard bu karta kayar */
  onSuccess?: (organizasyonKartId: number) => void;
}

const DEFAULT_FIELDS: Record<string, string> = {
  musteri_isim_soyisim: '',
  siparis_veren_telefon: '',
  siparis_urun: '',
  urun_yazisi: '',
  teslim_kisisi: '',
  teslim_kisisi_telefon: '',
  teslim_il: '',
  teslim_ilce: '',
  teslim_mahalle: '',
  teslim_acik_adres: '',
  teslim_tarih: '',
  teslim_saat: '',
  siparis_tutari: '',
  notes: '',
  // SiparisEditModal ile uyumlu: cari, nakit, havale_eft, pos
  odeme_yontemi: 'havale_eft',
  teslimat_konumu: '',
};

/**
 * "Organizasyon" = yalnızca düğün / nişan / nikah kartları.
 * kart_tur organizasyon ama etikette düğün-nişan yoksa → normal form (özel sipariş/gün gibi).
 */
function isDugunNisanOrganizasyonCard(c: OrganizasyonKart | undefined): boolean {
  if (!c) return false;
  if (String(c.kart_tur || '').toLowerCase().trim() !== 'organizasyon') return false;
  const blob = [c.kart_etiket, c.kart_tur_display, c.alt_tur].filter(Boolean).join(' ').toLowerCase().trim();
  if (!blob) return false;
  const folded = blob
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/düğün/g, 'dugun')
    .replace(/nişan/g, 'nisan');
  return /\bdugun\b|\bnisan\b|\bnikah\b/.test(folded) || /\bdüğün\b|\bnişan\b/i.test(blob);
}

/** Durum satırındaki "organizasyon seçilmedi" uyarısı (yazım/encoding farklarına toleranslı) */
function isOrganizasyonSecilmediDurumMesaji(msg: string): boolean {
  const t = (msg || '').trim().toLowerCase();
  if (!t.includes('organizasyon')) return false;
  return t.includes('seçilmedi') || t.includes('secilmedi');
}

const SOHBETTEN_SIPARIS_FIELD_LABELS: Record<string, string> = {
  musteri_isim_soyisim: 'Müşteri adı soyadı',
  teslim_kisisi: 'Teslim edilecek kişi/organizasyon adı soyadı',
  teslim_kisisi_telefon: 'Teslim edilecek telefon',
  teslim_il: 'Teslim ili',
  teslim_ilce: 'Teslim ilçesi',
  teslim_mahalle: 'Teslim mahalle',
  teslim_acik_adres: 'Teslim açık adresi (varsa konum)',
  teslim_tarih: 'Teslim tarihi',
  teslim_saat: 'Teslim saati',
  siparis_urun: 'Sipariş ürün',
  odeme_yontemi: 'Ödeme yöntemi',
};

function padTeslimSaat(h: number, m: number): string {
  return `${String(Math.min(23, Math.max(0, h))).padStart(2, '0')}:${String(Math.min(59, Math.max(0, m))).padStart(2, '0')}`;
}

/** Organizasyon kartı listesi: (21.03.2026 – 22:10) */
function formatOrgKartSecenekTarihSaat(tarih?: string | null, saat?: string | null): string {
  const t = String(tarih || '').trim();
  const s = String(saat || '').trim();
  if (!t && !s) return '';
  let datePart = '';
  if (t) {
    const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
      datePart = `${String(Number(iso[3])).padStart(2, '0')}.${String(Number(iso[2])).padStart(2, '0')}.${iso[1]}`;
    } else {
      const tr = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
      if (tr) {
        datePart = `${String(Number(tr[1])).padStart(2, '0')}.${String(Number(tr[2])).padStart(2, '0')}.${tr[3]}`;
      } else {
        datePart = t;
      }
    }
  }
  let timePart = '';
  if (s) {
    const tm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (tm) {
      timePart = `${String(Math.min(23, Math.max(0, Number(tm[1])))).padStart(2, '0')}:${tm[2]}`;
    } else {
      timePart = s;
    }
  }
  if (datePart && timePart) return `${datePart} – ${timePart}`;
  return datePart || timePart;
}

const SIPARIS_VEREN_PREFIX = '+90 (';
/** Input değerinden 905XXXXXXXXX (12 hane) veya kısmi */
function siparisVerenTelCleanFromInput(val: string): string {
  const raw = val.startsWith(SIPARIS_VEREN_PREFIX) ? val.slice(SIPARIS_VEREN_PREFIX.length) : val;
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('90')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  d = d.slice(0, 10);
  return d ? `90${d}` : '';
}

/** Sıkı HH:mm / H / HH:mm:ss */
function parseTeslimSaatToHHMM(raw: string): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  const m3 = s.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m3) return padTeslimSaat(Number(m3[1]), Number(m3[2]));
  const m = s.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return null;
  const hh = Number(m[1]);
  let mm = 0;
  if (m[2] !== undefined && m[2] !== '') {
    const rawM = m[2];
    mm = rawM.length === 1 ? Number(rawM) : Math.min(59, Number(rawM));
  }
  return padTeslimSaat(hh, mm);
}

/**
 * Sohbet / Türkçe ifadelerden saat (örn. 18.08, akşam 6, öğlen 2, saat 14)
 */
function parseTeslimSaatFlexible(raw: string): string | null {
  const strict = parseTeslimSaatToHHMM(raw);
  if (strict) return strict;
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!s) return null;

  const mDot = s.match(/^(\d{1,2})\.(\d{2})$/);
  if (mDot) return padTeslimSaat(Number(mDot[1]), Number(mDot[2]));

  const m4 = s.match(/^(\d{2})(\d{2})$/);
  if (m4) {
    const h = Number(m4[1]);
    const mm = Number(m4[2]);
    if (h <= 23 && mm <= 59) return padTeslimSaat(h, mm);
  }

  if (/ak[sş]am|aksam/.test(s)) {
    const ak = s.match(/(?:ak[sş]am|aksam)[^\d]*(\d{1,2})(?::(\d{2}))?/);
    if (ak) {
      let h = Number(ak[1]);
      if (h >= 1 && h <= 11) h += 12;
      const mm = ak[2] ? Number(ak[2]) : 0;
      return padTeslimSaat(h, mm);
    }
    return padTeslimSaat(18, 0);
  }

  if (/öğle|öğlen|ogle|oglen/.test(s)) {
    const n = s.match(/(?:öğle|öğlen|ogle|oglen)[^\d]*(\d{1,2})(?::(\d{2}))?/);
    if (n) {
      let h = Number(n[1]);
      const mm = n[2] ? Number(n[2]) : 0;
      if (h >= 1 && h <= 4) h += 12;
      if (h > 23) h = 23;
      return padTeslimSaat(h, mm);
    }
    return padTeslimSaat(12, 0);
  }

  if (/sabah/.test(s)) {
    const n = s.match(/sabah[^\d]*(\d{1,2})(?::(\d{2}))?/);
    if (n) return padTeslimSaat(Number(n[1]), n[2] ? Number(n[2]) : 0);
    return padTeslimSaat(10, 0);
  }

  const saat = s.match(/\bsaat\s*(\d{1,2})(?::(\d{2}))?/);
  if (saat) return padTeslimSaat(Number(saat[1]), saat[2] ? Number(saat[2]) : 0);

  const hOnly = s.match(/^(\d{1,2})$/);
  if (hOnly) return padTeslimSaat(Number(hOnly[1]), 0);

  return null;
}

function normalizeTeslimSaatStored(raw: string): string | null {
  return parseTeslimSaatToHHMM(raw) || parseTeslimSaatFlexible(raw);
}

const TR_AYLAR = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

/** Formda görünen tarih metni (12 Mart 2026, yarın, 20.03.2025…) eksik sayılmasın */
function isSohbettenTarihAlanDolu(raw: string): boolean {
  const t = (raw || '').trim();
  if (!t) return false;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(t)) return true;
  const iso = normalizeTeslimTarihToISO(t);
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(iso)) return true;
  const monPat = TR_AYLAR.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  if (new RegExp(`^\\d{1,2}\\s+(${monPat})\\s+\\d{4}`, 'i').test(t)) return true;
  return false;
}

/** Teslim tarihi: yarın/bugün/N gün sonra → YYYY-MM-DD (İstanbul günü); aksi halde dd.mm.yyyy vb. */
export function normalizeTeslimTarihToISO(dateLike: string): string {
  const raw = (dateLike || '').trim();
  if (!raw) return '';

  const baseYmdTR = () =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
  const addDaysISO = (baseYmd: string, delta: number): string => {
    const [y, mo, d] = baseYmd.split('-').map(Number);
    const dt = new Date(Date.UTC(y, mo - 1, d + delta));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
  };

  const m2 = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m2) {
    return `${String(Number(m2[1])).padStart(4, '0')}-${String(Number(m2[2])).padStart(2, '0')}-${String(Number(m2[3])).padStart(2, '0')}`;
  }
  const m1 = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m1) {
    return `${String(Number(m1[3])).padStart(4, '0')}-${String(Number(m1[2])).padStart(2, '0')}-${String(Number(m1[1])).padStart(2, '0')}`;
  }
  const mShort = raw.match(/^(\d{1,2})[./-](\d{1,2})$/);
  if (mShort) {
    const d = parseInt(mShort[1], 10);
    const mo = parseInt(mShort[2], 10);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      const base = baseYmdTR();
      const [by, bm, bd] = base.split('-').map(Number);
      let y = by;
      const cand = Date.UTC(y, mo - 1, d);
      if (cand < Date.UTC(by, bm - 1, bd)) y += 1;
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  const s = raw
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ')
    .trim();
  const base = baseYmdTR();
  const mGun = s.match(/\b(\d{1,2})\s*gun\s*sonra\b/);
  if (mGun) {
    const n = parseInt(mGun[1], 10);
    if (n >= 0 && n <= 120) return addDaysISO(base, n);
  }
  if (/\biki\s*gun\s*sonra\b/.test(s)) return addDaysISO(base, 2);
  if (/\b(uc|üc)\s*gun\s*sonra\b|3\s*gun\s*sonra\b/.test(s)) return addDaysISO(base, 3);
  if (/\bobur\s*gun\b|ertesi\s*gun\b/.test(s)) return addDaysISO(base, 2);
  if (/\b(yarin|yarın|yarina|yarına)\b/.test(s)) return addDaysISO(base, 1);
  if (/\b(bugun|bu\s*gun|bugune|bugüne)\b/.test(s)) return base;

  return raw;
}

/** Örn. 12 Mart 2026 Perşembe */
function formatDateLongTR(dateLike: string): string {
  const raw = (dateLike || '').trim();
  let d: Date | null = null;
  const m2 = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m2) d = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
  if (!d || Number.isNaN(d.getTime())) {
    const m1 = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (m1) d = new Date(Number(m1[3]), Number(m1[2]) - 1, Number(m1[1]));
  }
  if (!d || Number.isNaN(d.getTime())) return '';
  const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  return `${d.getDate()} ${TR_AYLAR[d.getMonth()]} ${d.getFullYear()} ${days[d.getDay()] || ''}`.trim();
}

/** Kurum adı tek kelime de olabilir; gerçek kişide en az ad+soyad */
const TESLIM_KISISI_ORG_HINT =
  /\b(a\.?ş\.?|ltd|şti|şirket|vakfı|derneği|hastane|otel|hotel|restoran|kafe|cafe|düğün\s+salonu|davet\s+salonu|holding|bank|üniversite|okulu|koleji|nakliyat)\b/i;

/** Teslim alıcı: E.164 905066593545 = ulusal 5066593545 (5 ile başlayan 10 hane; maskede +90 (506)…) */
function isValidTeslimKisisiMobile12(clean: string): boolean {
  const d = String(clean || '').replace(/\D/g, '');
  if (d.length !== 12 || !d.startsWith('90')) return false;
  return /^5\d{9}$/.test(d.slice(2));
}

function normalizeToTeslimTelClean12(raw: string): string {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) d = `90${d.slice(1)}`;
  if (d.length === 10 && d.startsWith('5')) d = `90${d}`;
  if (d.startsWith('90') && d.length > 12) d = d.slice(0, 12);
  if (d.length === 12 && d.startsWith('90') && /^5\d{9}$/.test(d.slice(2))) return d;
  return '';
}

/**
 * Son sohbet mesajından teslim cepi: 5066593545, 506 6593545, 0506…, +90 506…
 * Başka rakamların içine gömülü 506… (ör. 15066593545) sayılmaz.
 */
function extractValidTeslimE164FromChatText(text: string): string {
  const s = String(text || '');
  const compact = s.replace(/\D/g, '');
  let last = '';
  if (compact.length >= 10 && compact.length <= 13) {
    const n = normalizeToTeslimTelClean12(compact);
    if (n) return n;
  }
  const re =
    /(?<!\d)(?:\+?90[\s\-.]*)?(?:0[\s\-.]*)?(5(?:[\s./-]?\d){9})(?!\d)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const n = normalizeToTeslimTelClean12(m[1].replace(/\D/g, ''));
    if (n) last = n;
  }
  return last;
}

function resolveTeslimTelE164(formClean: string, chatLastMessage: string | null | undefined): string {
  return (
    normalizeToTeslimTelClean12(String(formClean || '')) ||
    extractValidTeslimE164FromChatText(String(chatLastMessage || ''))
  );
}

function teslimKisisiSoyadEksikGibi(raw: string): boolean {
  const t = (raw || '').trim();
  if (!t) return false;
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return false;
  if (TESLIM_KISISI_ORG_HINT.test(t)) return false;
  const one = parts[0] || '';
  if (/^[0-9]/.test(one) || one.length < 2) return false;
  return true;
}

/** Saat: yarım giriş (14:, 1830) da geçerli sayılır (blur’daki gibi tamamlanır) */
function isTeslimSaatAcceptable(raw: string): boolean {
  const s = String(raw || '').trim();
  if (!s) return false;
  if (normalizeTeslimSaatStored(s)) return true;
  const completed = finalizeTimeDisplay(formatTimeInputFromRaw(s));
  return !!completed && !!normalizeTeslimSaatStored(completed);
}

/** Anlık zorunlu alan eksikleri (form + il/ilçe/mahalle + teslim telefonu) */
function computeSohbettenSiparisRequiredMissing(
  f: Record<string, string>,
  teslimIl: string,
  teslimIlce: string,
  teslimMahalle: string,
  teslimKisisiTelefonClean: string,
  strictTeslimKisiAdSoyad: boolean,
  teslimTelFallbackFromChat: string,
  isDugunNisanOrg: boolean
): string[] {
  const musteriAdSoyad = (f.musteri_isim_soyisim || '').trim();
  /** Ürün alanı veya ürün notu (notta yazılmış ürün de geçerli sayılır) */
  const siparisUrun = (f.siparis_urun || f.urun_yazisi || '').trim();
  const tk = (f.teslim_kisisi || '').trim();
  const teslimKisisiEksik =
    !tk || (strictTeslimKisiAdSoyad && teslimKisisiSoyadEksikGibi(tk));
  const telFromField = normalizeToTeslimTelClean12(String(f.teslim_kisisi_telefon || ''));
  const telForm = String(teslimKisisiTelefonClean || '').replace(/\D/g, '');
  const telOk =
    isValidTeslimKisisiMobile12(telForm) ||
    (telFromField && isValidTeslimKisisiMobile12(telFromField)) ||
    (teslimTelFallbackFromChat && isValidTeslimKisisiMobile12(teslimTelFallbackFromChat));
  const tarihOk = isSohbettenTarihAlanDolu(f.teslim_tarih || '');
  const saatOk = isTeslimSaatAcceptable(f.teslim_saat || '');
  /** Açık adres, salon adı veya il+ilçe+mahalle seçiliyse yeterli (sokak no notta da olabilir) */
  const acikAdresDolu =
    !!(f.teslim_acik_adres || '').trim() ||
    (isDugunNisanOrg && !!(f.teslimat_konumu || '').trim()) ||
    (!!teslimIl && !!teslimIlce && !!teslimMahalle);
  const checks: [string, boolean][] = [
    ['musteri_isim_soyisim', !musteriAdSoyad],
    ['siparis_urun', !siparisUrun],
    ['odeme_yontemi', !String(f.odeme_yontemi || '').trim()],
    ['teslim_kisisi', teslimKisisiEksik],
    ['teslim_kisisi_telefon', !telOk],
    ['teslim_il', !teslimIl],
    ['teslim_ilce', !teslimIlce],
    ['teslim_mahalle', !teslimMahalle],
    ['teslim_acik_adres', !acikAdresDolu],
    ['teslim_tarih', !tarihOk],
    ['teslim_saat', !saatOk],
  ];
  return checks.filter(([, empty]) => empty).map(([k]) => k);
}

export const SohbettenSiparisModal: React.FC<SohbettenSiparisModalProps> = ({
  isOpen,
  onClose,
  chat,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>(DEFAULT_FIELDS);
  const [saving, setSaving] = useState(false);
  const [actionInfo, setActionInfo] = useState<string>('');
  const [summarySent, setSummarySent] = useState(false);
  const [orgCards, setOrgCards] = useState<OrganizasyonKart[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<number | ''>('');
  const [approvalStatus, setApprovalStatus] = useState<'draft' | 'waiting' | 'approved' | 'rejected' | 'needs_info'>('draft');
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [customerNote, setCustomerNote] = useState<string>('');
  const [finalSummarySent, setFinalSummarySent] = useState(false);
  /** İlk başarılı sohbet analizinden sonra buton «SOHBETİ TEKRAR ANALİZ ET» */
  const [analizFormuDoldurdu, setAnalizFormuDoldurdu] = useState(false);
  /** Form açıkken sohbeti yeniden analiz etmek için (API’yi tekrar çağırır) */
  const [reanalyzeKey, setReanalyzeKey] = useState(0);
  const [highlightMissingFields, setHighlightMissingFields] = useState(false);
  const manualReanalyzeRef = React.useRef(false);
  const siparisVerenTelefonInput = usePhoneInput(fields.siparis_veren_telefon);
  const teslimTelefonInput = usePhoneInput(fields.teslim_kisisi_telefon);
  const addressSelect = useAddressSelect(fields.teslim_il, fields.teslim_ilce, fields.teslim_mahalle);

  const selectedOrgCard = useMemo(
    () => (selectedOrgId ? orgCards.find((c) => c.id === selectedOrgId) : undefined),
    [orgCards, selectedOrgId]
  );
  const isOrgDugunNisanKart = useMemo(
    () => isDugunNisanOrganizasyonCard(selectedOrgCard),
    [selectedOrgCard]
  );

  const teslimTelFromChatPreview = useMemo(
    () => extractValidTeslimE164FromChatText(chat?.lastMessage || ''),
    [chat?.lastMessage]
  );

  const requiredMissingKeys = useMemo(
    () =>
      computeSohbettenSiparisRequiredMissing(
        fields,
        (fields.teslim_il || addressSelect.il || '').trim(),
        (fields.teslim_ilce || addressSelect.ilce || '').trim(),
        (fields.teslim_mahalle || addressSelect.mahalle || '').trim(),
        teslimTelefonInput.cleanValue,
        !isOrgDugunNisanKart,
        teslimTelFromChatPreview,
        isOrgDugunNisanKart
      ),
    [
      fields,
      addressSelect.il,
      addressSelect.ilce,
      addressSelect.mahalle,
      teslimTelefonInput.cleanValue,
      isOrgDugunNisanKart,
      teslimTelFromChatPreview,
    ]
  );

  /** Müşteri son mesajda cep yazdıysa (506… / 506 659…) forma yansıt */
  useEffect(() => {
    if (!isOpen || !chat?.lastMessage) return;
    const t12 = extractValidTeslimE164FromChatText(chat.lastMessage);
    if (!t12) return;
    setFields((prev) => {
      const cur = normalizeToTeslimTelClean12(String(prev.teslim_kisisi_telefon || ''));
      if (cur && isValidTeslimKisisiMobile12(cur)) return prev;
      if (String(prev.teslim_kisisi_telefon || '').replace(/\D/g, '') === t12) return prev;
      return { ...prev, teslim_kisisi_telefon: t12 };
    });
  }, [isOpen, chat?.lastMessage, chat?.id]);

  const markField = React.useCallback(
    (key: string) =>
      highlightMissingFields && requiredMissingKeys.includes(key) ? ' sohbetten-siparis-field--missing' : '',
    [highlightMissingFields, requiredMissingKeys]
  );
  const markTarihSaat =
    highlightMissingFields &&
    (requiredMissingKeys.includes('teslim_tarih') || requiredMissingKeys.includes('teslim_saat'))
      ? ' sohbetten-siparis-field--missing'
      : '';
  const markOrgSelect =
    highlightMissingFields && !selectedOrgId ? ' sohbetten-siparis-field--missing' : '';

  const orgFormUi = useMemo(() => {
    if (isOrgDugunNisanKart) {
      return {
        teslimBaslik: 'Teslimat Bilgileri',
        teslimKisisi: 'Teslim Alınacak Kişi veya Kurum (*)',
        teslimKisisiPh: 'Örn. salon yetkilisi, aile adı',
        teslimTel: 'Teslim Alıcı Telefonu (*)',
        mahalle: 'Mahalle (*)',
        acikAdres: 'Açık Adres (*)',
        acikPh: 'Salon, sokak, kapı no…',
        tarih: 'Organizasyon Teslim Tarihi ve Saati (*)',
        urunBaslik: 'Sipariş Ürün Bilgileri',
        urun: 'Çiçek / Ürün (*)',
        urunPh: 'Örn. gelin çiçeği, masalar',
      };
    }
    return {
      teslimBaslik: 'Teslimat Bilgileri',
      teslimKisisi: 'Teslim Edilecek Kişi (*)',
      teslimKisisiPh: 'Ad Soyad',
      teslimTel: 'Teslim Edilecek Telefon (*)',
      mahalle: 'Mahalle (*)',
      acikAdres: 'Açık Adres (*)',
      acikPh: 'Sokak, bina no, daire vb.',
      tarih: 'Teslim Tarihi ve Saati (*)',
      urunBaslik: 'Sipariş Ürün Bilgileri',
      urun: 'Sipariş Ürün (*)',
      urunPh: 'Sipariş Edilen Ürün',
    };
  }, [isOrgDugunNisanKart]);

  const initialSnapshotRef = React.useRef<{ fields: Record<string, string>; selectedOrgId: number | '' } | null>(null);
  const lastActionToastRef = React.useRef<string>('');
  const acikAdresLatestRef = React.useRef('');
  const acikAdresResolveSeq = React.useRef(0);
  /** Formdaki eksik alana kaydırmak için anchor'lar */
  const fieldAnchorRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const assignFieldAnchorRef = React.useCallback((key: string) => (el: HTMLDivElement | null) => {
    fieldAnchorRefs.current[key] = el;
  }, []);

  const scrollToFirstMissingField = React.useCallback((keys: string[]) => {
    if (!keys?.length) return;
    const missing = new Set(keys.map((k) => String(k).trim()).filter(Boolean));
    const order = [
      'selectedOrgId',
      'musteri_isim_soyisim',
      'siparis_urun',
      'siparis_tutari',
      'odeme_yontemi',
      'teslim_kisisi',
      'teslim_kisisi_telefon',
      'teslim_il',
      'teslim_ilce',
      'teslim_mahalle',
      'teslim_acik_adres',
      'teslim_tarih',
      'teslim_saat',
    ];
    const tryScroll = (fieldKey: string): boolean => {
      const anchorKey = fieldKey === 'teslim_saat' ? 'teslim_tarih' : fieldKey;
      const el = fieldAnchorRefs.current[anchorKey];
      if (!el) return false;
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        window.setTimeout(() => {
          const focusable = el.querySelector(
            'input:not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
          ) as HTMLElement | null;
          focusable?.focus?.({ preventScroll: true });
        }, 450);
      });
      return true;
    };
    for (const k of order) {
      if (missing.has(k) && tryScroll(k)) return;
    }
    for (const k of keys) {
      if (tryScroll(String(k))) return;
    }
  }, []);

  const setInitialSnapshot = React.useCallback((nextFields: Record<string, string>, nextSelectedOrgId: number | '') => {
    initialSnapshotRef.current = { fields: { ...nextFields }, selectedOrgId: nextSelectedOrgId };
  }, []);

  const isDirty = React.useCallback(() => {
    const snap = initialSnapshotRef.current;
    if (!snap) return false;
    if (snap.selectedOrgId !== selectedOrgId) return true;
    const keys = Object.keys(DEFAULT_FIELDS);
    for (const k of keys) {
      // default nakit tek başına "kirli" sayılmasın
      if (k === 'odeme_yontemi') {
        const cur = String((fields as any)[k] ?? '').trim() || 'nakit';
        const prev = String((snap.fields as any)[k] ?? '').trim() || 'nakit';
        if (cur !== prev) return true;
        continue;
      }
      const cur = String((fields as any)[k] ?? '').trim();
      const prev = String((snap.fields as any)[k] ?? '').trim();
      if (cur !== prev) return true;
    }
    return false;
  }, [fields, selectedOrgId]);

  const requestClose = React.useCallback(() => {
    if (!isDirty()) {
      onClose();
      return;
    }
    showToastInteractive({
      title: 'Değişiklikleri Kaydet',
      message: 'Kaydedilmeyen değişiklikler var!\nDeğişiklikleri kaydetmek istiyor musunuz?',
      confirmText: 'EVET, KAYDET',
      cancelText: 'İPTAL',
      isWarning: true,
      onConfirm: async () => {
        // Kullanıcı "kaydet" dedi: mevcut akışı çalıştır (özet gönder veya siparişi kaydet)
        await handleSubmit({ preventDefault: () => {} } as unknown as React.FormEvent);
      },
      onCancel: () => {
        // Kullanıcı kaydetmek istemiyorsa formu kapat
        onClose();
      },
    });
  }, [isDirty, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ enabled?: boolean }>;
      const enabled = Boolean(e?.detail?.enabled ?? true);
      if (!enabled) onClose();
    };
    window.addEventListener('floovon:ai-service', handler as EventListener);
    return () => window.removeEventListener('floovon:ai-service', handler as EventListener);
  }, [isOpen, onClose]);

  const normalizeToISODate = (dateLike: string): string => {
    const raw = (dateLike || '').trim();
    if (!raw) return '';

    const baseYmdTR = () =>
      new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
    const addDaysISO = (baseYmd: string, delta: number): string => {
      const [y, mo, d] = baseYmd.split('-').map(Number);
      const dt = new Date(Date.UTC(y, mo - 1, d + delta));
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    };

    // yyyy-mm-dd
    const m2 = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m2) {
      const yyyy = String(Number(m2[1])).padStart(4, '0');
      const mm = String(Number(m2[2])).padStart(2, '0');
      const dd = String(Number(m2[3])).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    // dd.mm.yyyy or dd/mm/yyyy (tam tarih)
    const m1 = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (m1) {
      const dd = String(Number(m1[1])).padStart(2, '0');
      const mm = String(Number(m1[2])).padStart(2, '0');
      const yyyy = String(Number(m1[3])).padStart(4, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    // dd.mm / dd/mm (yıl yok — TR: gün.ay, bugüne göre yıl)
    const mShort = raw.match(/^(\d{1,2})[./-](\d{1,2})$/);
    if (mShort) {
      const d = parseInt(mShort[1], 10);
      const mo = parseInt(mShort[2], 10);
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
        const base = baseYmdTR();
        const [by, bm, bd] = base.split('-').map(Number);
        let y = by;
        const cand = Date.UTC(y, mo - 1, d);
        if (cand < Date.UTC(by, bm - 1, bd)) y += 1;
        return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }

    // Yarın / bugün / ertesi gün / N gün sonra → mutlaka YYYY-MM-DD (formda kelime kalmasın)
    const s = raw
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/\s+/g, ' ')
      .trim();
    const base = baseYmdTR();
    const mGun = s.match(/\b(\d{1,2})\s*gun\s*sonra\b/);
    if (mGun) {
      const n = parseInt(mGun[1], 10);
      if (n >= 0 && n <= 120) return addDaysISO(base, n);
    }
    if (/\biki\s*gun\s*sonra\b/.test(s)) return addDaysISO(base, 2);
    if (/\b(uc|üc)\s*gun\s*sonra\b|3\s*gun\s*sonra\b/.test(s)) return addDaysISO(base, 3);
    if (/\bobur\s*gun\b|ertesi\s*gun\b/.test(s)) return addDaysISO(base, 2);
    if (/\b(yarin|yarın|yarina|yarına)\b/.test(s)) return addDaysISO(base, 1);
    if (/\b(bugun|bu\s*gun|bugune|bugüne)\b/.test(s)) return base;

    return raw;
  };

  const titleCaseTRSync = (s: string): string => {
    const str = String(s || '').trim();
    if (!str) return '';
    return str
      .toLocaleLowerCase('tr-TR')
      .split(/\s+/)
      .map((w) => (w ? w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1) : ''))
      .join(' ')
      .trim();
  };

  /** Mahalle/ilçe selectlere serbest metin yazılmaz; yanlışlıkla mahalle yazılmış kişi alanını temizle */
  const fixRecipientVsMahalleFieldsSync = (f: Record<string, string>): Record<string, string> => {
    const next = { ...f };
    const ilce = (next.teslim_ilce || '').trim();
    if (!ilce) return next;
    const ilceL = ilce.toLocaleLowerCase('tr-TR');
    const ilceCompact = ilceL.replace(/\s+/g, '');
    const raw = (next.teslim_kisisi || '').trim();
    if (!raw) return next;
    const lineL = raw.toLocaleLowerCase('tr-TR');
    const compact = lineL.replace(/\s+/g, '');

    const innerIlce =
      (lineL.startsWith('iç ') || lineL.startsWith('ic ')) &&
      lineL.replace(/^iç\s+|^ic\s+/i, '').replace(/\s+/g, '') === ilceCompact;
    const looksMahalle =
      /\bmah\.?\b|\bmahalle\b|\bmeydan\b|\bkv\b|\bköyü\b|^iç\s|^ic\s/i.test(raw) ||
      compact === ilceCompact ||
      innerIlce;

    const onlyIlceName = compact === ilceCompact && raw.length <= ilce.length + 2;

    if (looksMahalle || onlyIlceName) next.teslim_kisisi = '';
    return next;
  };

  const extractFirstAddrHints = (acik: string): string[] => {
    const a = (acik || '').trim();
    if (!a) return [];
    const seg = a.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)[0];
    if (seg && seg.length < 100 && !/^(\+?90)?5\d{9}$/.test(seg.replace(/\s/g, ''))) return [seg];
    return [];
  };

  const digitsFromChatPhoneSync = (raw: string): string => {
    const d = String(raw || '').replace(/\D/g, '');
    if (d.startsWith('90') && d.length >= 12) return d.slice(0, 12);
    if (d.length === 10) return `90${d}`;
    if (d.length === 11 && d.startsWith('0')) return `90${d.slice(1)}`;
    return d.length >= 10 ? d : '';
  };

  /** kart_tur=organizasyon seçilince boş teslimat alanlarını karttan doldur (düğün/nişan: ayrı Teslimat Konumu) */
  useEffect(() => {
    if (!isOpen || !selectedOrgId) return;
    const card = orgCards.find((c) => c.id === selectedOrgId);
    if (!card || String(card.kart_tur || '').toLowerCase() !== 'organizasyon') return;
    const dugunNisan = isDugunNisanOrganizasyonCard(card);

    setFields((prev) => {
      const next: Record<string, string> = { ...prev };
      const fill = (key: string, val: string) => {
        const v = (val || '').trim();
        if (!v) return;
        if (!(String(next[key] || '').trim())) next[key] = v;
      };
      fill('teslim_kisisi', titleCaseTRSync(card.teslim_kisisi || ''));
      const tt = normalizeToTeslimTelClean12(String(card.teslim_kisisi_telefon || ''));
      if (tt) fill('teslim_kisisi_telefon', tt);
      fill('teslim_il', (card.organizasyon_il || card.teslim_il || '').trim());
      fill('teslim_ilce', (card.organizasyon_ilce || card.teslim_ilce || '').trim());
      fill('teslim_mahalle', (card.mahalle || '').trim());

      const konum = (card.organizasyon_teslimat_konumu || '').trim();
      const acik = (card.acik_adres || '').trim();
      if (dugunNisan) {
        fill('teslimat_konumu', konum);
        if (acik && !(next.teslim_acik_adres || '').trim()) next.teslim_acik_adres = acik;
      } else {
        const acikJoined = [konum, acik].filter(Boolean).join(', ');
        if (acikJoined && !(next.teslim_acik_adres || '').trim()) next.teslim_acik_adres = acikJoined;
      }

      const iso = normalizeToISODate(card.teslim_tarih || '');
      fill('teslim_tarih', iso);
      const sa = normalizeTeslimSaatStored(String(card.teslim_saat || ''));
      if (sa) fill('teslim_saat', sa);

      return fixRecipientVsMahalleFieldsSync(next);
    });

    const il = (card.organizasyon_il || card.teslim_il || '').trim();
    const ilce = (card.organizasyon_ilce || card.teslim_ilce || '').trim();
    const mah = (card.mahalle || '').trim();
    const t1 = window.setTimeout(() => {
      if (il) addressSelect.setIl(il, { skipClear: true });
    }, 100);
    const t2 = window.setTimeout(() => {
      if (ilce) addressSelect.setIlce(ilce, { skipClear: true });
    }, 260);
    const t3 = window.setTimeout(() => {
      if (mah) addressSelect.setMahalle(mah);
    }, 420);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [selectedOrgId, orgCards, isOpen]);

  // Yalnızca TRAddress listesindeki resmi adlarla select state senkronu
  useEffect(() => {
    if (!isOpen) return;
    const ilN = pickAddrOptionName(fields.teslim_il || '', addressSelect.ilOptions, 'il');
    if (ilN && addressSelect.il !== ilN) addressSelect.setIl(ilN, { skipClear: true });
    const ilceN = pickAddrOptionName(fields.teslim_ilce || '', addressSelect.ilceOptions, 'ilce');
    if (ilceN && addressSelect.ilce !== ilceN) addressSelect.setIlce(ilceN, { skipClear: true });
    const mN = pickAddrOptionName(fields.teslim_mahalle || '', addressSelect.mahalleOptions, 'mahalle');
    if (mN && addressSelect.mahalle !== mN) addressSelect.setMahalle(mN);
  }, [
    isOpen,
    fields.teslim_il,
    fields.teslim_ilce,
    fields.teslim_mahalle,
    addressSelect.ilOptions,
    addressSelect.ilceOptions,
    addressSelect.mahalleOptions,
  ]);

  /** Not: Eski davranış eşleşmeyen il/ilçe/mahalle'yi siliyordu → analiz verisi kayboluyordu. Fuzzy eşleşme + silme yok. */

  /** Organizasyon seçilince (liste veya tek kart otomatik) uyarıyı çizimden önce kaldır */
  useLayoutEffect(() => {
    if (!isOpen) return;
    if (selectedOrgId === '' || selectedOrgId == null) return;
    if (typeof selectedOrgId === 'number' && !Number.isFinite(selectedOrgId)) return;
    setActionInfo((prev) => (isOrganizasyonSecilmediDurumMesaji(prev) ? '' : prev));
  }, [isOpen, selectedOrgId]);

  useEffect(() => {
    if (!isOpen) setHighlightMissingFields(false);
  }, [isOpen]);

  const prevSohbettenChatIdRef = React.useRef<string | null>(null);
  /** Onay sonrası teşekkür+IBAN mesajı yalnızca bir kez (aynı oturumda tekrar kontrol spamını önler) */
  const postApprovalBankMsgSentRef = React.useRef(false);

  /** Modal / sohbet açılışı: analiz YOK; sadece form sıfırla. Organizasyon seçilince ayrı effect analiz eder. */
  useEffect(() => {
    if (!isOpen || !chat?.id) {
      prevSohbettenChatIdRef.current = null;
      const base = { ...DEFAULT_FIELDS };
      setFields(base);
      setError(null);
      setSummarySent(false);
      setActionInfo('');
      setOrgCards([]);
      setSelectedOrgId('');
      setApprovalStatus('draft');
      setMissingFields([]);
      setCustomerNote('');
      setFinalSummarySent(false);
      postApprovalBankMsgSentRef.current = false;
      setInitialSnapshot(base, '');
      lastActionToastRef.current = '';
      setReanalyzeKey(0);
      manualReanalyzeRef.current = false;
      setLoading(false);
      setAnalizFormuDoldurdu(false);
      return;
    }
    const cid = String(chat.id);
    if (prevSohbettenChatIdRef.current !== cid) {
      prevSohbettenChatIdRef.current = cid;
      setSelectedOrgId('');
      setAnalizFormuDoldurdu(false);
    }
    setSummarySent(false);
    setApprovalStatus('draft');
    setMissingFields([]);
    setCustomerNote('');
    setFinalSummarySent(false);
    postApprovalBankMsgSentRef.current = false;
    setError(null);
    setLoading(false);
    const wa = chat?.phoneNumber ? digitsFromChatPhoneSync(chat.phoneNumber) : '';
    const base: Record<string, string> = { ...DEFAULT_FIELDS };
    if (wa.length >= 12) base.siparis_veren_telefon = wa;
    setFields(base);
    setInitialSnapshot(base, '');
  }, [isOpen, chat?.id]);

  /** Organizasyon kartı seçildikten sonra (veya «Sohbeti analiz et») Yapay Zeka analizi */
  useEffect(() => {
    if (!isOpen || !chat?.id || typeof selectedOrgId !== 'number') {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .post<{ success: boolean; fields?: Record<string, string>; error?: string }>(
        '/whatsapp/sohbetten-siparis-analiz',
        { chatId: chat.id, limit: 120 }
      )
      .then((res) => {
        if (cancelled) return;
        const data = res.data;
        if (data.success && data.fields && typeof data.fields === 'object') {
          if (manualReanalyzeRef.current) {
            showToast('success', 'Sohbet yeniden analiz edildi.');
            manualReanalyzeRef.current = false;
          }
          const merged = { ...DEFAULT_FIELDS, ...data.fields };
          if (typeof merged.urun_yazisi === 'string' && merged.urun_yazisi.trim()) {
            merged.urun_yazisi = normalizeNoteTR(merged.urun_yazisi);
          }
          if (!merged.siparis_urun && merged.urun_yazisi) merged.siparis_urun = merged.urun_yazisi;
          if (!String(merged.odeme_yontemi || '').trim()) merged.odeme_yontemi = 'havale_eft';
          const wa = chat?.phoneNumber ? digitsFromChatPhoneSync(chat.phoneNumber) : '';
          if (wa.length >= 12) merged.siparis_veren_telefon = wa;
          const isoT = normalizeToISODate(merged.teslim_tarih || '');
          merged.teslim_tarih = isoT || '';
          const tsNorm = normalizeTeslimSaatStored(String(merged.teslim_saat || ''));
          if (tsNorm) merged.teslim_saat = tsNorm;
          let t12 = normalizeToTeslimTelClean12(String(merged.teslim_kisisi_telefon || ''));
          if (!t12 && chat?.lastMessage)
            t12 = extractValidTeslimE164FromChatText(chat.lastMessage);
          merged.teslim_kisisi_telefon = t12;
          let fixed = fixRecipientVsMahalleFieldsSync(merged);
          fixed = stripPhoneFromIlIlceMahalle(fixed);
          /* İlk başarılı analizden sonra buton «TEKRAR ANALİZ» (AI az alan döndürse bile) */
          setAnalizFormuDoldurdu(true);
          setFields(fixed);
          setInitialSnapshot(fixed, selectedOrgId);
          resolveIlIlceMahalleWithTRAddress(
            fixed.teslim_il || '',
            fixed.teslim_ilce || '',
            fixed.teslim_mahalle || '',
            {
              kisisiMahalleFallback: !(fixed.teslim_mahalle || '').trim()
                ? (fixed.teslim_kisisi || '').trim()
                : undefined,
              fallbackMahalleHints: extractFirstAddrHints(fixed.teslim_acik_adres),
            }
          ).then((r) => {
            if (cancelled) return;
            setFields((prev) => {
              let next = { ...prev };
              next.teslim_il = r.teslim_il;
              next.teslim_ilce = r.teslim_ilce;
              next.teslim_mahalle = r.teslim_mahalle;
              if (r.clearedKisisiBecauseMahalle) next.teslim_kisisi = '';
              next = stripPhoneFromIlIlceMahalle(next);
              const strip = (text: string, tokens: string[]) => {
                let x = String(text || '');
                for (const tok of tokens.filter(Boolean)) {
                  const esc = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  x = x.replace(new RegExp(`\\b${esc}\\b`, 'ig'), ' ');
                }
                x = x.replace(/\bmahallesi\b/gi, ' ').replace(/\bmah\.\b/gi, ' ');
                return x.replace(/\s*[,;]\s*/g, ', ').replace(/\s{2,}/g, ' ').trim();
              };
              const toks = [next.teslim_il, next.teslim_ilce, next.teslim_mahalle].map((x) => String(x || '').trim()).filter(Boolean);
              if (toks.length && next.teslim_acik_adres) {
                next.teslim_acik_adres = normalizeAddressDetailTR(strip(next.teslim_acik_adres, toks));
              }
              return fixRecipientVsMahalleFieldsSync(next);
            });
          });
        } else {
          manualReanalyzeRef.current = false;
          const base = { ...DEFAULT_FIELDS };
          const wa = chat?.phoneNumber ? digitsFromChatPhoneSync(chat.phoneNumber) : '';
          if (wa.length >= 12) base.siparis_veren_telefon = wa;
          setFields(base);
          if (data.error) setError(data.error);
          setInitialSnapshot(base, selectedOrgId);
        }
      })
      .catch((err) => {
        manualReanalyzeRef.current = false;
        if (cancelled) return;
        const msg = formatApiErrorForUser(err, 'Analiz yapılamadı.', 'analiz');
        setError(msg);
        const base = { ...DEFAULT_FIELDS };
        const wa = chat?.phoneNumber ? digitsFromChatPhoneSync(chat.phoneNumber) : '';
        if (wa.length >= 12) base.siparis_veren_telefon = wa;
        setFields(base);
        setInitialSnapshot(base, selectedOrgId);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, chat?.id, selectedOrgId, reanalyzeKey]);

  // "Durum:" mesajı set edilen tüm kritik uyarılarda toast garanti et
  useEffect(() => {
    if (!isOpen) return;
    const msg = (actionInfo || '').trim();
    if (!msg) return;
    if (msg === lastActionToastRef.current) return;

    // Başarı/uyarı/hata sınıflandırması (basit)
    const isSuccess = /oluşturuldu|gönderildi|doğrulandı|tamamlandı|kaydedildi/i.test(msg);
    const isWarning = /eksik|bekleniyor|net değil/i.test(msg);
    const isError = /seçilmedi|zorunlu|bulunamadı|kaydedilemez|hata|yanlış|iptal/i.test(msg);

    if (isError) showToast('error', msg);
    else if (isSuccess) showToast('success', msg);
    else if (isWarning) showToast('warning', msg);
    else showToast('info', msg);

    lastActionToastRef.current = msg;
  }, [isOpen, actionInfo]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setOrgLoading(true);
    apiClient
      .get<{ success: boolean; data?: OrganizasyonKart[]; count?: number; error?: string }>('/organizasyon-kartlar')
      .then((res) => {
        if (cancelled) return;
        const raw = Array.isArray(res.data?.data) ? res.data.data : [];
        const list = raw.filter((c: OrganizasyonKart) => !isAracSuslemeOrgKart(c));
        setOrgCards(list);
        if (list.length === 1) setSelectedOrgId(Number(list[0].id));
      })
      .catch(() => {
        if (cancelled) return;
        setOrgCards([]);
      })
      .finally(() => {
        if (!cancelled) setOrgLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const updateField = (key: string, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    /* Tutar müşteriye gönderilmez; onay sonrası sadece ücret yazılınca onayı sıfırlama */
    if (key === 'siparis_tutari') return;
    if (finalSummarySent) {
      setFinalSummarySent(false);
    }
    if (approvalStatus === 'approved') {
      setApprovalStatus('draft');
      setCustomerNote('');
    }
  };

  const buildMissingInfoMessage = (missing: string[]): string => {
    const list = missing
      .map((k) => {
        if (
          k === 'teslim_kisisi' &&
          (fields.teslim_kisisi || '').trim() &&
          teslimKisisiSoyadEksikGibi(fields.teslim_kisisi)
        ) {
          return `- Teslim alıcının adı ve soyadı (şu an yalnızca tek isim görünüyor; lütfen soyadını da yazın)`;
        }
        if (k === 'teslim_kisisi_telefon') {
          const d = String(teslimTelefonInput.cleanValue || '').replace(/\D/g, '');
          const fromChat = extractValidTeslimE164FromChatText(chat?.lastMessage || '');
          if (
            d.length > 0 &&
            !isValidTeslimKisisiMobile12(d) &&
            !(fromChat && isValidTeslimKisisiMobile12(fromChat))
          ) {
            return `- Teslim alıcının cep telefonu (5 ile başlayan 10 hane; örn. 5066593545 veya 506 659 35 45)`;
          }
        }
        return `- ${SOHBETTEN_SIPARIS_FIELD_LABELS[k] || k}`;
      })
      .join('\n');
    let msg = `Merhaba,\nSiparişinizi tamamlamak için aşağıdaki bilgileri net olarak iletebilir misiniz?\n\n${list}\n\nTeşekkürler.`;
    if (isOrgDugunNisanKart && !(fields.teslimat_konumu || '').trim()) {
      msg +=
        '\n\n_İsteğe bağlı:_ Teslimat konumunu (örn. düğün/nişan salonu adı) netleştirmek isterseniz yazabilirsiniz.';
    }
    return msg;
  };

  const getTurkishWeekday = (dateLike: string): string => {
    const raw = (dateLike || '').trim();
    if (!raw) return '';
    let d: Date | null = null;
    // dd.mm.yyyy
    const m1 = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (m1) d = new Date(Number(m1[3]), Number(m1[2]) - 1, Number(m1[1]));
    // yyyy-mm-dd
    const m2 = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m2) d = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
    if (!d || Number.isNaN(d.getTime())) return '';
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    return days[d.getDay()] || '';
  };

  const formatDateTR = (dateLike: string): string => {
    const raw = (dateLike || '').trim();
    if (!raw) return '';
    // yyyy-mm-dd -> dd.mm.yyyy
    const m2 = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m2) {
      const dd = String(Number(m2[3])).padStart(2, '0');
      const mm = String(Number(m2[2])).padStart(2, '0');
      const yyyy = String(Number(m2[1])).padStart(4, '0');
      return `${dd}.${mm}.${yyyy}`;
    }
    // already dd.mm.yyyy (or similar)
    const m1 = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (m1) {
      const dd = String(Number(m1[1])).padStart(2, '0');
      const mm = String(Number(m1[2])).padStart(2, '0');
      const yyyy = String(Number(m1[3])).padStart(4, '0');
      return `${dd}.${mm}.${yyyy}`;
    }
    return raw;
  };

  const normalizeHHMM = (t: string): string => {
    const s = (t || '').trim();
    if (!s) return '';
    const m = s.match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (!m) return s;
    const hh = String(Math.min(23, Math.max(0, Number(m[1])))).padStart(2, '0');
    const mm = m[2] ? String(Math.min(59, Math.max(0, Number(m[2])))).padStart(2, '0') : '00';
    return `${hh}:${mm}`;
  };

  const normalizeAddressToken = (s: string): string => {
    return String(s || '')
      .toLocaleLowerCase('tr-TR')
      .replace(/[^\p{L}\p{N}]+/gu, '')
      .replace(/mahallesi|mahalle|mah/g, '')
      .trim();
  };

  const titleCaseTR = (s: string): string => {
    const str = String(s || '').trim();
    if (!str) return '';
    return str
      .toLocaleLowerCase('tr-TR')
      .split(/\s+/)
      .map((w) => w ? w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1) : '')
      .join(' ')
      .trim();
  };

  /** "Not olarak ...", "notum:", "not bu olacak" gibi girişleri çıkar; sadece asıl not kalsın */
  const stripUrunNotIntro = (raw: string): string => {
    let t = String(raw || '').trim();
    const patterns = [
      /^not\s+bu\s+olacak[ağ]?\s*[,:]?\s*/i,
      /^not\s+olarak\s*[,:]?\s*/i,
      /^notum\s*[,:]?\s*/i,
      /^ürün\s+notu[mda]?[sz]?a?\s*[,:]?\s*/i,
      /^urun\s+notu[mda]?[sz]?a?\s*[,:]?\s*/i,
      /^ürün\s+not[ıi]\s*[,:]?\s*/i,
      /^urun\s+not[ıi]\s*[,:]?\s*/i,
      /^not\s*[,:]\s*/i,
      /^not\s+/i,
    ];
    for (let i = 0; i < 8; i++) {
      const before = t;
      for (const re of patterns) t = t.replace(re, '').trim();
      if (t === before) break;
    }
    return t;
  };

  /** Sondaki talimat/betimleme: "yazalım", "bu şekilde", "gibi" vb. */
  const stripUrunNotTail = (raw: string): string => {
    let t = String(raw || '')
      .trim()
      .replace(/\s+/g, ' ');
    const tailRes = [
      /\s+lütfen\s+(yazalım|yazın|yazsın|ekleyin)\.?$/i,
      /\s+(yazalım|yazalim|yazın|yazin|yazsın|yazsin|ekleyin|ekleyelim|koyalım|koyalim)\.?$/i,
      /\s+bu\s+şekilde(\s+olsun)?\.?$/i,
      /\s+bu\s+sekilde(\s+olsun)?\.?$/i,
      /\s+böyle(\s+olsun)?\.?$/i,
      /\s+boyle(\s+olsun)?\.?$/i,
      /\s+şöyle(\s+olsun)?\.?$/i,
      /\s+soyle(\s+olsun)?\.?$/i,
      /\s+bu\s+gibi(\s+bir\s+şey|\s+bir\s+sey)?\.?$/i,
      /\s+gibi\.?$/i,
      /\s+olsun\s+lütfen\.?$/i,
      /\s+yazdırın\.?$/i,
      /\s+yazdirin\.?$/i,
    ];
    for (let i = 0; i < 14; i++) {
      const before = t;
      for (const re of tailRes) t = t.replace(re, '').trim();
      if (t === before) break;
    }
    return t;
  };

  const normalizeNoteTR = (s: string): string => {
    // Basit imla: baş harf, boşluklar, noktalama sonrası boşluk
    let t = stripUrunNotTail(stripUrunNotIntro(s)).replace(/\s+/g, ' ');
    if (!t) return '';
    t = t.replace(/\s*([,.;:!?])\s*/g, '$1 ');
    t = t.replace(/\s+\)/g, ')').replace(/\(\s+/g, '(').trim();
    // İlk harfi büyüt (Türkçe)
    t = t.charAt(0).toLocaleUpperCase('tr-TR') + t.slice(1);
    // Çok kaba bir kural: sona nokta yoksa ekleme yapma (müşteri "yazsın" vb. diyebilir)
    return t;
  };

  /** WhatsApp numarası → sipariş formu (90 + 10 hane) */
  const digitsFromChatPhone = digitsFromChatPhoneSync;

  const normalizeAddressDetailTR = (s: string): string => {
    let t = String(s || '').trim().replace(/\s+/g, ' ');
    if (!t) return '';

    // Yaygın cadde adı kısaltmaları (TRAddress'te sokak listesi yok; bilinen kalıplar)
    t = t.replace(/\bM\.?\s*Kemal\b/gi, 'Mustafa Kemal');
    t = t.replace(/\bM\.?\s*K\.?\s*Atatürk\b/gi, 'Mustafa Kemal Atatürk');

    // Cadde/Sokak kısaltmaları
    t = t.replace(/\b(cadde|cd|cad)\b\.?/gi, 'Cad.');
    t = t.replace(/\b(sokak|sk)\b\.?/gi, 'Sok.');
    t = t.replace(/\b(bulvar|blv)\b\.?/gi, 'Blv.');

    // No/Daire/Apt
    t = t.replace(/\b(no|numara)\b\.?\s*[-:]?\s*/gi, 'No: ');
    t = t.replace(/\b(daire|d)\b\.?\s*[-:]?\s*/gi, 'Daire: ');
    t = t.replace(/\b(apartman|apt)\b\.?/gi, 'Apt.');

    // Parantez içine alma: "yeşil kapılı ev" gibi tarifleri virgülden sonra paranteze al
    // Örn: "Menekşe Cad. 10574 Sok., yeşil kapılı ev" => "Menekşe Cad. 10574 Sok. (Yeşil Kapılı Ev)"
    const m = t.match(/^(.*?)[,;-]\s*(.+)$/);
    if (m && m[2] && m[2].length <= 60) {
      const left = m[1].trim().replace(/\s*[,;-]\s*$/g, '');
      const right = titleCaseTR(m[2].trim());
      t = `${left} (${right})`;
    }

    // Genel title-case (Cad./Sok. sonrası sayılar bozulmasın diye kelime bazlı)
    t = t
      .split(' ')
      .map((w) => {
        if (!w) return '';
        if (/^\d+[A-Za-zÇĞİÖŞÜçğıöşü]*\.?$/.test(w)) return w; // sayı/numara
        if (/^(Cad\.|Sok\.|Blv\.|No:|Daire:|Apt\.)$/i.test(w)) return w;
        return w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1).toLocaleLowerCase('tr-TR');
      })
      .join(' ')
      .replace(/\s+\)/g, ')')
      .replace(/\(\s+/g, '(')
      .trim();

    return t;
  };

  const extractAddressFromFreeText = (raw: string) => {
    // Ham metinden mahalle/ilçe/il ve detay adresi ayır (basit, güvenli heuristik)
    const original = String(raw || '');
    const lines = original.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    const oneLine = original.replace(/\s+/g, ' ').trim();

    let mahalle = '';
    let ilce = '';
    let il = '';
    let detail = oneLine;

    // Mahalle: "X Mah." / "X Mahallesi"
    const mahMatch = oneLine.match(/([^\d,;]+?)\s+(mahallesi|mahalle|mah\.)\b/i);
    if (mahMatch) {
      mahalle = titleCaseTR(`${mahMatch[1].trim()} Mah.`);
      detail = detail.replace(mahMatch[0], '').trim();
    }

    // İlçe: seçeneklerden eşleşmeye çalış
    const ilceCandidates = addressSelect.ilceOptions.map((x) => x.name);
    const ilceFound = ilceCandidates.find((name) => name && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i').test(oneLine));
    if (ilceFound) {
      ilce = ilceFound;
      detail = detail.replace(new RegExp(`\\b${ilceFound.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'ig'), '').trim();
    }

    // İl: seçeneklerden eşleşmeye çalış
    const ilCandidates = addressSelect.ilOptions.map((x) => x.name);
    const ilFound = ilCandidates.find((name) => name && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i').test(oneLine));
    if (ilFound) {
      il = ilFound;
      detail = detail.replace(new RegExp(`\\b${ilFound.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'ig'), '').trim();
    }

    // İlk satırı körü körüne ilçe yapma (isim/telefon satırı ilçe oluyordu). Yalnızca ilçe listesinde eşleşirse.
    if (!ilce && lines.length >= 1 && addressSelect.ilceOptions.length) {
      const l0 = lines[0].trim();
      if (
        l0.length >= 2 &&
        l0.length <= 45 &&
        !looksLikeTurkishPhoneValue(l0) &&
        !/mah\b|mah\./i.test(l0)
      ) {
        const pick = fuzzyPickName(l0, addressSelect.ilceOptions);
        if (pick) ilce = pick;
      }
    }
    if (!mahalle && lines.length >= 2) {
      const l1 = lines[1].trim();
      if (
        l1.length <= 40 &&
        /mah\b|mah\./i.test(l1) &&
        !looksLikeTurkishPhoneValue(l1)
      ) {
        mahalle = titleCaseTR(l1.replace(/\bmah(allesi|alle)?\.?\b/i, 'Mah.').trim());
      }
    }

    detail = detail.replace(/^[-,;]+/g, '').replace(/\s*[,;]\s*/g, ', ').replace(/\s{2,}/g, ' ').trim();

    // Detay adreste il/ilçe/mahalle bilgisi KALMASIN (select'te zaten gösteriliyor)
    const stripTokens = (text: string, tokens: string[]) => {
      let t = String(text || '');
      for (const token of tokens.filter(Boolean)) {
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Kelime sınırı + Türkçe büyük/küçük harf toleransı
        t = t.replace(new RegExp(`\\b${escaped}\\b`, 'ig'), ' ');
      }
      // "Mah.", "Mahallesi" gibi ekleri de temizle
      t = t.replace(/\bmahallesi\b/ig, ' ').replace(/\bmahalle\b/ig, ' ').replace(/\bmah\.\b/ig, ' ');
      // Boşalan parantezleri sil
      t = t.replace(/\(\s*\)/g, ' ');
      // Noktalama/boşluk toparla
      t = t.replace(/\s*[,;]\s*/g, ', ').replace(/\s{2,}/g, ' ').trim();
      t = t.replace(/^, /, '').replace(/, $/, '').trim();
      return t;
    };

    const tokensToStrip = [
      il,
      ilce,
      mahalle,
      // mevcut select değerleri (kullanıcı seçmiş olabilir)
      addressSelect.il,
      addressSelect.ilce,
      addressSelect.mahalle,
      fields.teslim_il,
      fields.teslim_ilce,
      fields.teslim_mahalle,
    ].map((x) => String(x || '').trim()).filter(Boolean);

    detail = stripTokens(detail, tokensToStrip);
    return { il, ilce, mahalle, detail };
  };

  const buildFinalOrderSummaryMessage = (): string => {
    const musteri = (fields.musteri_isim_soyisim || '').trim();
    const tel = siparisVerenTelefonInput.cleanValue ? formatPhoneNumber(siparisVerenTelefonInput.cleanValue) : '';
    const urun = (fields.siparis_urun || fields.urun_yazisi || '').trim();
    const tutarNumSummary = parseTL(fields.siparis_tutari || '');
    const urunNotu = normalizeNoteTR(fields.urun_yazisi || '');
    const tarihRaw = (fields.teslim_tarih || '').trim();
    const tarih = formatDateTR(tarihRaw);
    const gun = getTurkishWeekday(tarihRaw);
    const saat = normalizeHHMM((fields.teslim_saat || '').trim());
    const teslimKisi = (fields.teslim_kisisi || '').trim();
    let mahalle = (fields.teslim_mahalle || addressSelect.mahalle || '').trim();
    const acikAdres = normalizeAddressDetailTR(fields.teslim_acik_adres || '');
    const ilce = (fields.teslim_ilce || addressSelect.ilce || '').trim();
    const ilceUpper = ilce ? ilce.toLocaleUpperCase('tr-TR') : '';
    // Müşteri mesajında il gösterme: sadece mahalle + açık adres + İLÇE
    const mahN = normalizeAddressToken(mahalle);
    const adrN = normalizeAddressToken(acikAdres);
    // Mahalle ismini mesajda da mahalle olduğunu belli edecek şekilde göster (Mah. ekle),
    // ama seçenek zaten "Mah." içeriyorsa tekrar ekleme.
    if (mahalle && !/\bmah(allesi|alle)?\.?\b/i.test(mahalle)) {
      mahalle = `${mahalle} Mah.`;
    }
    // Açık adres içinde mahalle zaten varsa (veya iki taraf aynıysa) mahalleyi tekrar yazma
    const safeMahalle = mahN && (adrN.includes(mahN) || adrN === mahN) ? '' : mahalle;
    const adresParts = [safeMahalle, acikAdres].filter(Boolean).join(' ').trim();
    const adres = [adresParts, ilceUpper].filter(Boolean).join(', ').trim();

    const lines: string[] = [];
    lines.push('*Sipariş Özeti:*');
    lines.push('');
    lines.push(`Müşteri: *${musteri || '-'}* ${tel || ''}`.trim());
    lines.push('———————');
    lines.push(`Sipariş Ürün: *${urun || '-'}*`);
    if (tutarNumSummary > 0) lines.push(`Tutar: *${formatTL(tutarNumSummary)}*`);
    if (fields.odeme_yontemi) lines.push(`Ödeme: *${formatOdemeYontemiDisplay(fields.odeme_yontemi)}*`);
    if (urunNotu) lines.push(`Ürün Notu: _${urunNotu}_`);
    lines.push('———————');
    lines.push('*TESLİMAT BİLGİLERİ:*');
    lines.push('Teslim Tarihi & Saati:');
    lines.push(`*${tarih}${gun ? ` ${gun}` : ''} | Saat ${saat || '--:--'}*`);
    if (teslimKisi) {
      const teslimTelRaw = resolveTeslimTelE164(teslimTelefonInput.cleanValue, chat?.lastMessage).replace(
        /\D/g,
        ''
      );
      const teslimTelFmt =
        isValidTeslimKisisiMobile12(teslimTelRaw) ? formatPhoneNumber(teslimTelRaw) : '';
      lines.push(`Teslim Edilecek Kişi: *${teslimKisi}*${teslimTelFmt ? ` ${teslimTelFmt}` : ''}`.trim());
    }
    const teslimatKonum = (fields.teslimat_konumu || '').trim();
    if (isOrgDugunNisanKart && teslimatKonum) lines.push(`Teslimat Konumu: *${teslimatKonum}*`);
    if (adres) lines.push(`Teslim Adresi: ${adres}`);
    lines.push('');
    lines.push('Yukarıdaki sipariş bilgileriniz doğruysa lütfen onay verin.');
    return lines.join('\n');
  };

  const handleCheckCustomerReply = async () => {
    if (!chat?.id) return;
    setSaving(true);
    try {
      const currentFields = {
        siparis_urun: (fields.siparis_urun || fields.urun_yazisi || '').trim(),
        siparis_veren_telefon: siparisVerenTelefonInput.cleanValue.trim(),
        teslim_kisisi: (fields.teslim_kisisi || '').trim(),
        teslim_kisisi_telefon:
          resolveTeslimTelE164(
            teslimTelefonInput.cleanValue || fields.teslim_kisisi_telefon,
            chat?.lastMessage
          ) || teslimTelefonInput.cleanValue.trim(),
        teslim_il: (fields.teslim_il || addressSelect.il || '').trim(),
        teslim_ilce: (fields.teslim_ilce || addressSelect.ilce || '').trim(),
        teslim_mahalle: (fields.teslim_mahalle || addressSelect.mahalle || '').trim(),
        teslim_acik_adres: (fields.teslim_acik_adres || '').trim(),
        teslim_tarih: (fields.teslim_tarih || '').trim(),
        teslim_saat: (fields.teslim_saat || '').trim(),
      };

      const res = await apiClient.post<{
        success: boolean;
        status: 'approved' | 'rejected' | 'needs_info' | 'unclear';
        customer_message?: string;
        fields_patch?: Record<string, string>;
        missing_fields?: string[];
        reason?: string;
      }>('/whatsapp/siparis-onay-analiz', { chatId: chat.id, limit: 40, currentFields, phase: finalSummarySent ? 'final_approval' : 'collecting' });

      const data = res.data;
      if (!data?.success) throw new Error('Analiz yapılamadı');

      setCustomerNote(data.customer_message || '');
      const patch = data.fields_patch || {};
      if (patch && typeof patch === 'object') {
        // sadece desteklenen alanları güncelle
        const allowed = [
          'musteri_isim_soyisim',
          'siparis_urun',
          'urun_yazisi',
          'siparis_tutari',
          'teslim_kisisi',
          'teslim_kisisi_telefon',
          'teslim_il',
          'teslim_ilce',
          'teslim_mahalle',
          'teslim_acik_adres',
          'teslim_tarih',
          'teslim_saat',
          'odeme_yontemi',
        ];
        const next = { ...fields };
        for (const k of allowed) {
          if (k === 'siparis_veren_telefon') continue;
          if (typeof (patch as any)[k] === 'string') {
            if (k === 'teslim_kisisi_telefon') {
              (next as any)[k] = normalizeToTeslimTelClean12((patch as any)[k]);
            } else {
              (next as any)[k] =
                k === 'urun_yazisi' ? normalizeNoteTR((patch as any)[k]) : (patch as any)[k];
            }
          }
        }
        if (!String((next as any).odeme_yontemi || '').trim()) (next as any).odeme_yontemi = 'havale_eft';
        if (typeof (next as any).teslim_tarih === 'string') (next as any).teslim_tarih = normalizeToISODate((next as any).teslim_tarih);
        if (typeof (next as any).teslim_saat === 'string') {
          const sn = normalizeTeslimSaatStored(String((next as any).teslim_saat));
          if (sn) (next as any).teslim_saat = sn;
        }
        let n = fixRecipientVsMahalleFieldsSync(next);
        n = stripPhoneFromIlIlceMahalle(n);
        (n as any).teslim_kisisi_telefon = normalizeToTeslimTelClean12(
          String((n as any).teslim_kisisi_telefon || '')
        );
        setFields(n);
        resolveIlIlceMahalleWithTRAddress(
          n.teslim_il || '',
          n.teslim_ilce || '',
          n.teslim_mahalle || '',
          {
            kisisiMahalleFallback: !(n.teslim_mahalle || '').trim() ? (n.teslim_kisisi || '').trim() : undefined,
            fallbackMahalleHints: extractFirstAddrHints(n.teslim_acik_adres),
          }
        ).then((r) => {
          setFields((prev) =>
            stripPhoneFromIlIlceMahalle({
              ...prev,
              teslim_il: r.teslim_il,
              teslim_ilce: r.teslim_ilce,
              teslim_mahalle: r.teslim_mahalle,
              ...(r.clearedKisisiBecauseMahalle ? { teslim_kisisi: '' } : {}),
            })
          );
        });
      }

      const missing = (Array.isArray(data.missing_fields) ? data.missing_fields : []).filter(
        (k) => k !== 'siparis_tutari' && k !== 'siparis_veren_telefon'
      );
      setMissingFields(missing);
      if (missing.length) {
        window.setTimeout(() => scrollToFirstMissingField(missing), 200);
      }

      if (!missing.length && !finalSummarySent) {
        // Eksikler tamamlandı: müşteriye SON sipariş özetini gönder ve onay iste
        const phoneForSend = chat?.phoneNumber?.replace(/\D/g, '') || siparisVerenTelefonInput.cleanValue.trim();
        const finalMsg = buildFinalOrderSummaryMessage();
        await apiClient.post('/whatsapp/send', { phone: phoneForSend, message: finalMsg });
        setFinalSummarySent(true);
        setApprovalStatus('waiting');
        setActionInfo('Tüm bilgiler tamamlandı. Müşteriye sipariş özeti gönderildi; onay bekleniyor.');
        showToast('success', 'Tüm bilgiler tamamlandı. Müşteriye sipariş özeti gönderildi; onay mesajını bekleyin.');
      } else if (data.status === 'approved' && missing.length === 0 && finalSummarySent) {
        setApprovalStatus('approved');
        setActionInfo('');
        showToast('success', 'Müşteri onayı doğrulandı. Artık siparişi kaydedebilirsiniz.');
        const phoneTesekkur =
          chat?.phoneNumber?.replace(/\D/g, '') || siparisVerenTelefonInput.cleanValue.trim();
        if (phoneTesekkur && !postApprovalBankMsgSentRef.current) {
          postApprovalBankMsgSentRef.current = true;
          try {
            const bankBlok = await buildMesajSablonuBankaBlokuAsync();
            const baslik =
              'Siparişiniz için teşekkür ederiz, sipariş ücretini aşağıdaki banka hesaplarımıza gönderebilirsiniz:';
            const mesaj = bankBlok ? `${baslik}\n\n${bankBlok}` : 'Siparişiniz için teşekkür ederiz.';
            await apiClient.post('/whatsapp/send', { phone: phoneTesekkur, message: mesaj });
            if (bankBlok) {
              showToast('success', 'Ödeme bilgileri müşteriye WhatsApp ile gönderildi.');
            }
          } catch {
            postApprovalBankMsgSentRef.current = false;
            showToast(
              'warning',
              'Teşekkür/ödeme mesajı gönderilemedi. WhatsApp bağlantısını kontrol edip tekrar deneyin.'
            );
          }
        }
      } else if (data.status === 'rejected') {
        setApprovalStatus('rejected');
        setActionInfo('Müşteri siparişi onaylamadı / itiraz etti.');
        showToast('error', 'Müşteri siparişi onaylamadı / itiraz etti. Lütfen alanları düzeltip tekrar özet gönderin.');
      } else {
        setApprovalStatus('needs_info');
        setActionInfo(missing.length ? 'Eksik bilgiler var. Müşteriden bilgi isteniyor.' : 'Müşteri cevabı net değil.');
        if (missing.length) {
          const phone = chat?.phoneNumber?.replace(/\D/g, '') || siparisVerenTelefonInput.cleanValue.trim();
          const msg = buildMissingInfoMessage(missing);
          await apiClient.post('/whatsapp/send', { phone, message: msg });
          showToast('success', 'Güncel eksik listesi müşteriye gönderildi.');
        } else {
          showToast('warning', 'Müşteri cevabı net değil. Lütfen mesajı kontrol edin.');
        }
      }
    } catch (err: unknown) {
      showToast('error', formatApiErrorForUser(err, 'Cevap kontrol edilemedi.', 'cevap'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setHighlightMissingFields(true);
    setSaving(true);
    setActionInfo(
      summarySent && finalSummarySent ? 'İşleniyor...' : 'Gönderiliyor...'
    );

    const phone = siparisVerenTelefonInput.cleanValue.trim();
    const siparisUrun = (fields.siparis_urun || fields.urun_yazisi || '').trim();
    const urunYazisi = (fields.urun_yazisi || '').trim();
    if (!selectedOrgId) {
      setSaving(false);
      setActionInfo('Organizasyon kartı seçilmedi.');
      showToast('error', 'Lütfen siparişin ekleneceği organizasyon kartını seçin.');
      window.setTimeout(() => scrollToFirstMissingField(['selectedOrgId']), 100);
      return;
    }

    if (!summarySent) {
      try {
        const phoneDigits = (chat?.phoneNumber || '').replace(/\D/g, '');
        if (phoneDigits.length < 10) {
          setSaving(false);
          setActionInfo('WhatsApp sohbet numarası okunamadı.');
          showToast('error', 'Bu sohbet için geçerli telefon bulunamadı.');
          return;
        }
        const missing = requiredMissingKeys;
        const summary = missing.length ? buildMissingInfoMessage(missing) : buildFinalOrderSummaryMessage();
        await apiClient.post('/whatsapp/send', { phone: phoneDigits, message: summary });
        setSummarySent(true);
        setApprovalStatus('waiting');
        setMissingFields(missing);
        setFinalSummarySent(missing.length === 0);
        const eksikOkMsg = 'Güncel eksik listesi müşteriye gönderildi.';
        setActionInfo(missing.length ? eksikOkMsg : 'Sipariş özeti gönderildi.');
        showToast('success', missing.length ? eksikOkMsg : 'Sipariş özeti müşteriye gönderildi.');
        if (missing.length) {
          window.setTimeout(() => scrollToFirstMissingField(missing), 150);
        }
      } catch (err: unknown) {
        const msg = formatApiErrorForUser(err, 'Mesaj gönderilemedi.', 'mesaj');
        setActionInfo(msg);
        showToast('error', msg);
      } finally {
        setSaving(false);
      }
      return;
    }

    /* Özet gönderildi ama henüz tam sipariş özeti (onay isteği) gitmediyse */
    if (!finalSummarySent) {
      try {
        const phoneDigits = (chat?.phoneNumber || '').replace(/\D/g, '');
        if (phoneDigits.length < 10) {
          setSaving(false);
          setActionInfo('WhatsApp sohbet numarası okunamadı.');
          showToast('error', 'Bu sohbet için geçerli telefon bulunamadı.');
          return;
        }
        const missing = requiredMissingKeys;
        if (missing.length > 0) {
          const summary = buildMissingInfoMessage(missing);
          await apiClient.post('/whatsapp/send', { phone: phoneDigits, message: summary });
          setMissingFields(missing);
          setActionInfo('Güncel eksik listesi müşteriye gönderildi.');
          showToast('success', 'Güncel eksik listesi müşteriye gönderildi.');
          window.setTimeout(() => scrollToFirstMissingField(missing), 150);
        } else {
          await apiClient.post('/whatsapp/send', {
            phone: phoneDigits,
            message: buildFinalOrderSummaryMessage(),
          });
          setFinalSummarySent(true);
          setApprovalStatus('waiting');
          setMissingFields([]);
          setActionInfo('Müşteriye sipariş özeti gönderildi; onay bekleniyor.');
          showToast('success', 'Onay mesajı müşteriye gönderildi. Cevap sonrası "ONAY CEVABINI KONTROL ET" kullanın.');
        }
      } catch (err: unknown) {
        const msg = formatApiErrorForUser(err, 'Mesaj gönderilemedi.', 'mesaj');
        setActionInfo(msg);
        showToast('error', msg);
      } finally {
        setSaving(false);
      }
      return;
    }

    if (approvalStatus !== 'approved' || requiredMissingKeys.length > 0) {
      setSaving(false);
      setActionInfo('Müşteri onayı alınmadan sipariş kaydedilemez.');
      showToast('error', 'Müşteri onayı alınmadan sipariş kaydedilemez. Önce "ONAY CEVABINI KONTROL ET" ile onayı doğrulayın.');
      if (requiredMissingKeys.length > 0) {
        window.setTimeout(() => scrollToFirstMissingField(requiredMissingKeys), 100);
      }
      return;
    }
    let savePhone = String(siparisVerenTelefonInput.cleanValue || '').replace(/\D/g, '');
    if (savePhone.length >= 12) savePhone = savePhone.slice(0, 12);
    if (savePhone.length < 12) {
      const fallback = chat?.phoneNumber ? digitsFromChatPhone(chat.phoneNumber) : String(phone || '').replace(/\D/g, '');
      if (fallback && fallback.length >= 12) savePhone = fallback.slice(0, 12);
    }
    if (!savePhone || savePhone.length < 12) {
      setSaving(false);
      setActionInfo('Kayıt için geçerli sipariş veren telefonu gerekli.');
      showToast('error', 'Lütfen sipariş veren telefonunu eksiksiz girin (10 hane).');
      return;
    }
    if (!String(fields.siparis_tutari || '').trim() || parseTL(fields.siparis_tutari || '') <= 0) {
      setSaving(false);
      setActionInfo('Sipariş tutarı girilmeden kayıt yapılamaz.');
      showToast('error', 'Lütfen sipariş tutarını (₺) girin. Tutar müşteriden istenmez; çiçekçi belirler.');
      window.setTimeout(() => scrollToFirstMissingField(['siparis_tutari']), 100);
      return;
    }
    const teslimTelSave = resolveTeslimTelE164(
      teslimTelefonInput.cleanValue || fields.teslim_kisisi_telefon,
      chat?.lastMessage
    );
    if (!teslimTelSave) {
      setSaving(false);
      setActionInfo('Teslim alıcı telefonu eksiksiz ve geçerli olmalı.');
      showToast('error', 'Teslim alıcı cep telefonu eksik veya hatalı (5 ile başlayan 10 hane).');
      window.setTimeout(() => scrollToFirstMissingField(['teslim_kisisi_telefon']), 100);
      return;
    }
    setActionInfo('');

    const payload: SiparisFormData = {
      organizasyon_kart_id: Number(selectedOrgId),
      siparis_veren_telefon: savePhone,
      siparis_urun: siparisUrun,
      urun_yazisi: urunYazisi || undefined,
      siparis_tutari: parseTL(fields.siparis_tutari || ''),
      odeme_yontemi: (fields.odeme_yontemi || 'havale_eft').trim(),
      musteri_isim_soyisim: (fields.musteri_isim_soyisim || '').trim() || undefined,
      teslim_kisisi: (fields.teslim_kisisi || '').trim() || undefined,
      teslim_kisisi_telefon: teslimTelSave,
      teslim_il: (fields.teslim_il || addressSelect.il || '').trim() || undefined,
      teslim_ilce: (fields.teslim_ilce || addressSelect.ilce || '').trim() || undefined,
      teslim_mahalle: (fields.teslim_mahalle || addressSelect.mahalle || '').trim() || undefined,
      teslim_acik_adres:
        (fields.teslim_acik_adres || '').trim() ||
        (isOrgDugunNisanKart ? (fields.teslimat_konumu || '').trim() : '') ||
        undefined,
      teslim_saat:
        normalizeTeslimSaatStored((fields.teslim_saat || '').trim()) ||
        normalizeTeslimSaatStored(
          finalizeTimeDisplay(formatTimeInputFromRaw(fields.teslim_saat || ''))
        ) ||
        undefined,
      notes: (() => {
        const n = (fields.notes || '').trim();
        const tk = (fields.teslimat_konumu || '').trim();
        if (tk && isOrgDugunNisanKart) {
          const line = `Teslimat konumu: ${tk}`;
          return n ? `${n}\n${line}` : line;
        }
        return n || undefined;
      })(),
    };
    const rawPayload = payload as unknown as Record<string, unknown>;
    if ((fields.teslim_tarih || '').trim()) rawPayload.teslim_tarih = fields.teslim_tarih.trim();

    const executeCreate = async () => {
      showToast('info', 'Sipariş kaydediliyor...');
      const result = await createSiparis(payload as SiparisFormData);
      if (result.success) {
        showToast('success', 'Sipariş kaydedildi.');
        setActionInfo('Sipariş oluşturuldu.');
        invalidateSiparisGuncellemeQueries(queryClient, {});
        onSuccess?.(Number(selectedOrgId));
      } else {
        setActionInfo(result.message || 'Sipariş oluşturulamadı.');
        showToast('error', result.message || 'Sipariş oluşturulamadı.');
      }
    };

    try {
      const dup = await checkDuplicateSiparisBeforeCreate({
        musteri_isim_soyisim: payload.musteri_isim_soyisim,
        siparis_veren_telefon: savePhone,
        teslim_kisisi: payload.teslim_kisisi,
        teslim_kisisi_telefon: teslimTelSave,
      });
      if (dup.duplicateMusteri || dup.duplicateTeslim) {
        const aciklama =
          dup.duplicateMusteri && dup.duplicateTeslim
            ? 'Bu müşteri ve bu teslim kişisi için sistemde halen aktif sipariş var.'
            : dup.duplicateMusteri
              ? 'Bu müşterinin (isim-soyisim + telefon) sistemde halen aktif siparişi var.'
              : 'Bu teslim kişisinin (isim-soyisim + telefon) sistemde halen aktif siparişi var.';
        showToastInteractive({
          title: 'Çift sipariş uyarısı',
          message: `${aciklama}\n\nYine de aynı bilgilerle sipariş oluşturmak istiyor musunuz?`,
          confirmText: 'Evet, oluştur',
          cancelText: 'Vazgeç',
          isWarning: true,
          onConfirm: async () => {
            try {
              setSaving(true);
              await executeCreate();
            } catch (err: unknown) {
              const msg = formatApiErrorForUser(err, 'Sipariş oluşturulamadı.', 'siparis');
              setActionInfo(msg);
              showToast('error', msg);
            } finally {
              setSaving(false);
            }
          },
        });
        return;
      }
      await executeCreate();
    } catch (err: unknown) {
      const msg = formatApiErrorForUser(err, 'Sipariş oluşturulamadı.', 'siparis');
      setActionInfo(msg);
      showToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const overlay = (
    <div
      className="modal-react-whatsapp-son-konusmalar-overlay show"
      onMouseDown={(e) => {
        // Bu modal sadece Kapat/İptal ile kapanmalı; overlay tıklaması hiçbir şeye gitmesin.
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--overlay-bg-black)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2147483647,
        pointerEvents: 'auto',
      }}
    >
      <div
        className="modal-react-whatsapp-son-konusmalar-content modal-sohbetten-siparis"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: 'var(--white)',
          borderRadius: '12px',
          maxWidth: '520px',
          width: '90%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 2147483647,
          pointerEvents: 'auto',
        }}
      >
        <div className="modal-react-whatsapp-son-konusmalar-header" style={{ flexShrink: 0, padding: '20px 24px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h2 className="modal-react-whatsapp-son-konusmalar-title" style={{ margin: 0 }}>
              Sohbetten Sipariş Oluştur
            </h2>
            {(chat?.name || chat?.phoneNumber) && (
              <div className="sohbetten-siparis-header-chat">
                {chat?.name && (
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ana-renk)' }}>
                    {chat.name}
                  </div>
                )}
                {chat?.phoneNumber && (
                  <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--gri70)' }}>
                    {formatPhoneNumber(chat.phoneNumber)}
                  </div>
                )}
              </div>
            )}
          </div>
          <button type="button" className="btn-close-modal modal-react-whatsapp-son-konusmalar-close-btn" onClick={requestClose} aria-label="Kapat">
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 24px 24px' }}>
          <form onSubmit={handleSubmit} style={{ marginTop: 16 }} className="sohbetten-siparis-form">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <section
                ref={assignFieldAnchorRef('selectedOrgId')}
                className={`sohbetten-siparis-group sohbetten-siparis-group-bordered sohbetten-siparis-group-org${markOrgSelect}`}
              >
                <h3 className="sohbetten-siparis-group-title">Organizasyon</h3>
                <label className="sohbetten-siparis-label">Organizasyon Kartı *</label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSelectedOrgId(v ? Number(v) : '');
                    setSummarySent(false);
                    if (v) {
                      setActionInfo((prev) =>
                        isOrganizasyonSecilmediDurumMesaji(prev) ? '' : prev
                      );
                    }
                  }}
                  className="modal-sohbetten-siparis-input"
                  disabled={orgLoading || orgCards.length === 0}
                >
                  <option value="">
                    {orgLoading ? 'Yükleniyor...' : 'Organizasyon kartı seçin…'}
                  </option>
                  {orgCards.map((c) => {
                    const title = [c.kart_tur_display || c.kart_tur, c.kart_etiket].filter(Boolean).join(' — ');
                    const when = formatOrgKartSecenekTarihSaat(c.teslim_tarih, c.teslim_saat);
                    return (
                      <option key={c.id} value={c.id}>
                        {title}{when ? ` (${when})` : ''}
                      </option>
                    );
                  })}
                </select>
                {!orgLoading && orgCards.length === 0 && (
                  <p
                    className="sohbetten-siparis-org-bos-uyari"
                    style={{
                      marginTop: 10,
                      marginBottom: 0,
                      fontSize: 12,
                      lineHeight: 1.45,
                      color: 'var(--warning-box-text, #5c5348)',
                    }}
                  >
                    Bu akışta yalnızca <strong>araç süsleme dışındaki</strong> kartlar listelenir. Şu an seçilecek
                    kart görünmüyorsa tüm aktif kartlarınız araç süsleme olabilir veya henüz başka türde kart
                    oluşturulmamış olabilir.
                  </p>
                )}
              </section>

              {typeof selectedOrgId === 'number' && loading && (
                <div className="sohbetten-siparis-analiz-inline" role="status" aria-live="polite">
                  <Loader2 className="modal-react-whatsapp-info-icon-spin" size={22} aria-hidden />
                  <span>Yapay Zeka sohbeti analiz ediyor...</span>
                </div>
              )}
              {typeof selectedOrgId === 'number' && !loading && error && (
                <div className="sohbetten-siparis-analiz-error modal-react-whatsapp-son-konusmalar-error">
                  <AlertTriangle size={24} strokeWidth={2} aria-hidden />
                  <p>{error}</p>
                  <p style={{ fontSize: 12, marginTop: 8 }}>
                    Ayarlar &gt; Yapay Zeka Ayarları bölümünden OpenAI API anahtarınızı girin.
                  </p>
                </div>
              )}

              {typeof selectedOrgId === 'number' && !loading && !error && (
              <>
              <section className="sohbetten-siparis-group sohbetten-siparis-group-bordered">
                <h3 className="sohbetten-siparis-group-title">Müşteri Bilgileri</h3>
                <div className="sohbetten-siparis-row">
                  <div
                    className={`sohbetten-siparis-field${markField('musteri_isim_soyisim')}`}
                    ref={assignFieldAnchorRef('musteri_isim_soyisim')}
                  >
                    <label className="sohbetten-siparis-label">Müşteri Adı Soyadı (*)</label>
                    <input
                      type="text"
                      value={fields.musteri_isim_soyisim}
                      onChange={(e) => updateField('musteri_isim_soyisim', e.target.value)}
                      className="modal-sohbetten-siparis-input"
                      placeholder="Ad Soyad"
                    />
                  </div>
                  <div className="sohbetten-siparis-field">
                    <label className="sohbetten-siparis-label">Sipariş Veren Telefon</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="off"
                      ref={siparisVerenTelefonInput.inputRef}
                      title="Varsayılan sohbet numarasıdır; gerekirse düzenleyebilirsiniz."
                      value={siparisVerenTelefonInput.displayValue}
                      onChange={(e) => {
                        siparisVerenTelefonInput.handleChange(e);
                        updateField('siparis_veren_telefon', siparisVerenTelCleanFromInput(e.target.value));
                      }}
                      onKeyDown={siparisVerenTelefonInput.handleKeyDown}
                      onFocus={siparisVerenTelefonInput.handleFocus}
                      onPaste={(e) => {
                        e.preventDefault();
                        const text = e.clipboardData.getData('text') || '';
                        let d = text.replace(/\D/g, '');
                        if (d.startsWith('90')) d = d.slice(2);
                        if (d.startsWith('0')) d = d.slice(1);
                        d = d.slice(0, 10);
                        const clean = d ? `90${d}` : '';
                        siparisVerenTelefonInput.setDisplayValue(clean);
                        updateField('siparis_veren_telefon', clean);
                      }}
                      className="modal-sohbetten-siparis-input"
                    />
                  </div>
                </div>
              </section>

              <section className="sohbetten-siparis-group sohbetten-siparis-group-bordered">
                <h3 className="sohbetten-siparis-group-title">{orgFormUi.urunBaslik}</h3>
                <div className={`sohbetten-siparis-field${markField('siparis_urun')}`} ref={assignFieldAnchorRef('siparis_urun')}>
                  <label className="sohbetten-siparis-label">{orgFormUi.urun}</label>
                  <input
                    type="text"
                    value={fields.siparis_urun}
                    onChange={(e) => updateField('siparis_urun', e.target.value)}
                    className="modal-sohbetten-siparis-input"
                    placeholder={orgFormUi.urunPh}
                  />
                </div>
                <div className="sohbetten-siparis-field">
                  <label className="sohbetten-siparis-label">Ürün Yazısı/Notu</label>
                  <textarea
                    value={fields.urun_yazisi}
                    onBlur={(e) => {
                      const v = normalizeNoteTR(e.target.value);
                      if (v !== (fields.urun_yazisi || '')) updateField('urun_yazisi', v);
                    }}
                    onChange={(e) => updateField('urun_yazisi', e.target.value)}
                    className="modal-sohbetten-siparis-input"
                    placeholder="Ürünle ilgili ek not"
                    rows={2}
                  />
                </div>
                <div className="sohbetten-siparis-row">
                  <div className={`sohbetten-siparis-field${markField('siparis_tutari')}`} ref={assignFieldAnchorRef('siparis_tutari')}>
                    <label className="sohbetten-siparis-label">Sipariş Tutarı (₺) (*)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="modal-sohbetten-siparis-input tl-input"
                      value={fields.siparis_tutari}
                      onChange={(e) => updateField('siparis_tutari', formatTutarInputLive(e.target.value))}
                      onKeyDown={(e) => formatTutarInputKeyDown(e, fields.siparis_tutari)}
                      onBlur={() =>
                        updateField('siparis_tutari', formatTLDisplayValue(parseTL(fields.siparis_tutari)))
                      }
                      placeholder="0,00 TL"
                      aria-label="Sipariş tutarı (TL)"
                    />
                  </div>
                  <div className={`sohbetten-siparis-field${markField('odeme_yontemi')}`} ref={assignFieldAnchorRef('odeme_yontemi')}>
                    <label className="sohbetten-siparis-label">Ödeme Yöntemi (*)</label>
                    <select
                      value={fields.odeme_yontemi}
                      onChange={(e) => updateField('odeme_yontemi', e.target.value)}
                      className="modal-sohbetten-siparis-input"
                    >
                      <option value="cari">CARİ HESAP</option>
                      <option value="nakit">NAKİT</option>
                      <option value="havale_eft">HAVALE/EFT</option>
                      <option value="pos">POS</option>
                    </select>
                  </div>
                </div>
              </section>

              <section className="sohbetten-siparis-group sohbetten-siparis-group-bordered">
                <h3 className="sohbetten-siparis-group-title">{orgFormUi.teslimBaslik}</h3>
                <div className="sohbetten-siparis-row">
                  <div className={`sohbetten-siparis-field${markField('teslim_kisisi')}`} ref={assignFieldAnchorRef('teslim_kisisi')}>
                    <label className="sohbetten-siparis-label">{orgFormUi.teslimKisisi}</label>
                    <input
                      type="text"
                      value={fields.teslim_kisisi}
                      onChange={(e) => updateField('teslim_kisisi', e.target.value)}
                      className="modal-sohbetten-siparis-input"
                      placeholder={orgFormUi.teslimKisisiPh}
                    />
                  </div>
                  <div className={`sohbetten-siparis-field${markField('teslim_kisisi_telefon')}`} ref={assignFieldAnchorRef('teslim_kisisi_telefon')}>
                    <label className="sohbetten-siparis-label">{orgFormUi.teslimTel}</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      value={teslimTelefonInput.displayValue}
                      onChange={teslimTelefonInput.handleChange}
                      onKeyDown={teslimTelefonInput.handleKeyDown}
                      onFocus={teslimTelefonInput.handleFocus}
                      onPaste={teslimTelefonInput.handlePaste}
                      className="modal-sohbetten-siparis-input"
                      placeholder="+90 (5XX) XXX XX XX"
                    />
                  </div>
                </div>
                {isOrgDugunNisanKart && (
                  <div className="sohbetten-siparis-field">
                    <label className="sohbetten-siparis-label">Teslimat Konumu</label>
                    <input
                      type="text"
                      value={fields.teslimat_konumu || ''}
                      onChange={(e) => updateField('teslimat_konumu', e.target.value)}
                      className="modal-sohbetten-siparis-input"
                      placeholder="Örn. düğün salonu, mekân adı (isteğe bağlı)"
                    />
                  </div>
                )}
                <div className="sohbetten-siparis-row">
                  <div className={`sohbetten-siparis-field${markField('teslim_il')}`} ref={assignFieldAnchorRef('teslim_il')}>
                    <label className="sohbetten-siparis-label">İl (*)</label>
                    <select
                      value={pickAddrOptionName(fields.teslim_il || addressSelect.il, addressSelect.ilOptions, 'il')}
                      onChange={(e) => {
                        const v = e.target.value;
                        addressSelect.setIl(v);
                        updateField('teslim_il', v);
                        if (!v) { updateField('teslim_ilce', ''); updateField('teslim_mahalle', ''); }
                      }}
                      className="modal-sohbetten-siparis-input org-adres-select"
                    >
                      <option value="">İl seçiniz</option>
                      {addressSelect.ilOptions.map((il) => (
                        <option key={il.id} value={il.name}>{il.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className={`sohbetten-siparis-field${markField('teslim_ilce')}`} ref={assignFieldAnchorRef('teslim_ilce')}>
                    <label className="sohbetten-siparis-label">İlçe (*)</label>
                    <select
                      value={pickAddrOptionName(fields.teslim_ilce || addressSelect.ilce, addressSelect.ilceOptions, 'ilce')}
                      onChange={(e) => {
                        const v = e.target.value;
                        addressSelect.setIlce(v);
                        updateField('teslim_ilce', v);
                        if (!v) updateField('teslim_mahalle', '');
                      }}
                      disabled={!String(addressSelect.il || fields.teslim_il || '').trim()}
                      className="modal-sohbetten-siparis-input org-adres-select"
                    >
                      <option value="">İlçe seçiniz</option>
                      {addressSelect.ilceOptions.map((ilce) => (
                        <option key={ilce.id} value={ilce.name}>{ilce.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className={`sohbetten-siparis-field${markField('teslim_mahalle')}`} ref={assignFieldAnchorRef('teslim_mahalle')}>
                  <label className="sohbetten-siparis-label">{orgFormUi.mahalle}</label>
                  <select
                    value={pickAddrOptionName(fields.teslim_mahalle || addressSelect.mahalle, addressSelect.mahalleOptions, 'mahalle')}
                    onChange={(e) => {
                      const v = e.target.value;
                      addressSelect.setMahalle(v);
                      updateField('teslim_mahalle', v);
                    }}
                    disabled={!String(addressSelect.ilce || fields.teslim_ilce || '').trim()}
                    className="modal-sohbetten-siparis-input org-adres-select"
                  >
                    <option value="">Mahalle seçiniz</option>
                    {addressSelect.mahalleOptions.map((m) => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div className={`sohbetten-siparis-field${markField('teslim_acik_adres')}`} ref={assignFieldAnchorRef('teslim_acik_adres')}>
                  <label className="sohbetten-siparis-label">{orgFormUi.acikAdres}</label>
                  <textarea
                    value={fields.teslim_acik_adres}
                    onChange={(e) => {
                      const raw = e.target.value;
                      acikAdresLatestRef.current = raw;
                      const { il, ilce, mahalle, detail } = extractAddressFromFreeText(raw);
                      const detailNorm = normalizeAddressDetailTR(detail);
                      updateField('teslim_acik_adres', detailNorm);
                      const hints =
                        [il, ilce, mahalle].some(Boolean) || extractFirstAddrHints(raw).length > 0;
                      if (!hints) return;
                      const seq = ++acikAdresResolveSeq.current;
                      window.setTimeout(async () => {
                        if (seq !== acikAdresResolveSeq.current) return;
                        const latest = acikAdresLatestRef.current;
                        const ex = extractAddressFromFreeText(latest);
                        const r = await resolveIlIlceMahalleWithTRAddress(
                          ex.il || '',
                          ex.ilce || '',
                          ex.mahalle || '',
                          { fallbackMahalleHints: extractFirstAddrHints(latest) }
                        );
                        if (seq !== acikAdresResolveSeq.current) return;
                        const d = normalizeAddressDetailTR(ex.detail);
                        setFields((prev) => ({
                          ...prev,
                          teslim_acik_adres: d || prev.teslim_acik_adres,
                          ...(r.teslim_il ? { teslim_il: r.teslim_il } : {}),
                          ...(r.teslim_ilce ? { teslim_ilce: r.teslim_ilce } : {}),
                          ...(r.teslim_mahalle ? { teslim_mahalle: r.teslim_mahalle } : {}),
                        }));
                        if (r.teslim_il) addressSelect.setIl(r.teslim_il, { skipClear: true });
                        await new Promise((x) => setTimeout(x, 200));
                        if (seq !== acikAdresResolveSeq.current) return;
                        if (r.teslim_ilce) addressSelect.setIlce(r.teslim_ilce, { skipClear: true });
                        await new Promise((x) => setTimeout(x, 200));
                        if (seq !== acikAdresResolveSeq.current) return;
                        if (r.teslim_mahalle) addressSelect.setMahalle(r.teslim_mahalle);
                      }, 500);
                    }}
                    className="modal-sohbetten-siparis-input"
                    placeholder={orgFormUi.acikPh}
                    rows={2}
                  />
                </div>
                <div
                  className={`sohbetten-siparis-tarih-saat-kutu${markTarihSaat}`}
                  ref={assignFieldAnchorRef('teslim_tarih')}
                >
                  <label className="sohbetten-siparis-label">{orgFormUi.tarih}</label>
                  <div className="sohbetten-siparis-tarih-saat-inner">
                    <div className="sohbetten-siparis-tarih-time-row">
                      <input
                        type="date"
                        value={fields.teslim_tarih}
                        onChange={(e) => updateField('teslim_tarih', e.target.value)}
                        className="modal-sohbetten-siparis-input sohbetten-siparis-date-input sohbetten-siparis-datetime-pair"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="SS:DD"
                        maxLength={5}
                        title="00:00 – 23:59. Rakamları yazın; iki nokta otomatik eklenir. 24+ saat veya 60+ dakika kabul edilmez."
                        value={fields.teslim_saat}
                        onChange={(e) => {
                          updateField('teslim_saat', formatTimeInputFromRaw(e.target.value));
                        }}
                        onBlur={() => {
                          const v = finalizeTimeDisplay(fields.teslim_saat);
                          if (v !== fields.teslim_saat) updateField('teslim_saat', v);
                        }}
                        className="modal-sohbetten-siparis-input sohbetten-siparis-time-input sohbetten-siparis-datetime-pair"
                      />
                    </div>
                    {!!fields.teslim_tarih && !!formatDateLongTR(fields.teslim_tarih) && (
                      <span className="sohbetten-siparis-tarih-gun-label" aria-live="polite">
                        <span className="sohbetten-siparis-tarih-gun-prefix">Sipariş Teslim Tarihi:</span>{' '}
                        <span className="sohbetten-siparis-tarih-gun-value">
                          {formatDateLongTR(fields.teslim_tarih)}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </section>
              </>
              )}
            </div>
            {typeof selectedOrgId === 'number' && !loading && !error && summarySent && finalSummarySent && (
              <p
                style={{
                  marginTop: 16,
                  padding: 12,
                  background:
                    approvalStatus === 'approved'
                      ? 'var(--whatsapp-green-soft, rgba(37, 211, 102, 0.12))'
                      : 'var(--gray-100)',
                  border:
                    approvalStatus === 'approved' ? '1px solid var(--whatsapp-green)' : '1px solid transparent',
                  borderRadius: 8,
                  fontSize: 13,
                  color: approvalStatus === 'approved' ? 'var(--ana-renk-only)' : 'var(--gray-700)',
                }}
              >
                {approvalStatus === 'approved' ? (
                  <>Müşteri onayladı, tüm bilgileri kontrol ederek siparişi kaydedebilirsiniz.</>
                ) : (
                  <>
                    Sipariş özeti müşteriye gönderildi. Müşteri cevap verdikten sonra &quot;ONAY CEVABINI KONTROL ET&quot; ile onayı
                    doğrulayın.
                  </>
                )}
              </p>
            )}
            {typeof selectedOrgId === 'number' && !loading && !error && summarySent && !finalSummarySent && requiredMissingKeys.length > 0 && (
              <p style={{ marginTop: 16, padding: 12, background: 'var(--warning-bg)', borderRadius: 8, fontSize: 13, color: 'var(--warning-box-text)' }}>
                Eksik alanları aşağıdan tamamlayın. İsterseniz &quot;Müşteriden bilgi iste&quot; ile güncel eksik listesini tekrar gönderebilirsiniz.
              </p>
            )}
            {typeof selectedOrgId === 'number' && !loading && !error && summarySent && !finalSummarySent && requiredMissingKeys.length === 0 && (
              <p style={{ marginTop: 16, padding: 12, background: 'var(--gray-100)', borderRadius: 8, fontSize: 13, color: 'var(--gray-700)' }}>
                Tüm zorunlu alanlar dolu. &quot;Müşteriden onay iste&quot; ile sipariş özetini ve onay talebini müşteriye gönderin.
              </p>
            )}
            {!!customerNote && !loading && !error && (
              <p
                className={`sohbetten-siparis-customer-note ${approvalStatus === 'approved' ? 'is-approved' : ''}`}
                style={{
                  marginTop: 10,
                  padding: 12,
                  background: approvalStatus === 'approved' ? 'var(--whatsapp-green-soft, rgba(37, 211, 102, 0.12))' : 'var(--gray-50)',
                  border: approvalStatus === 'approved' ? '1px solid var(--whatsapp-green)' : '1px solid transparent',
                  borderRadius: 8,
                  fontSize: 13,
                  color: approvalStatus === 'approved' ? 'var(--ana-renk-only)' : 'var(--gray-800)',
                }}
              >
                <strong>Müşteri cevabı:</strong> {customerNote}
              </p>
            )}
            {typeof selectedOrgId === 'number' && !loading && !error && requiredMissingKeys.length > 0 && (
              <p style={{ marginTop: 10, padding: 12, background: 'var(--warning-bg)', borderRadius: 8, fontSize: 13, color: 'var(--warning-box-text)' }}>
                <strong>Formda eksik zorunlu alanlar:</strong>{' '}
                {requiredMissingKeys.map((k) => SOHBETTEN_SIPARIS_FIELD_LABELS[k] || k).join(', ')}
              </p>
            )}
            {!!actionInfo && !loading && (
              <p
                style={{
                  marginTop: 10,
                  padding: 12,
                  background: /kaydedilemez|hata|zorunlu|geçerli|bulunamadı|boş/i.test(actionInfo)
                    ? 'rgba(220, 38, 38, 0.08)'
                    : 'var(--gray-50)',
                  border: /kaydedilemez|hata|zorunlu|geçerli|bulunamadı|boş/i.test(actionInfo)
                    ? '1px solid rgba(220, 38, 38, 0.35)'
                    : '1px solid transparent',
                  borderRadius: 8,
                  fontSize: 13,
                  color: /kaydedilemez|hata|zorunlu|geçerli|bulunamadı|boş/i.test(actionInfo) ? '#b91c1c' : 'var(--gray-800)',
                }}
              >
                <strong>Durum:</strong> {actionInfo}
              </p>
            )}
            <div className="sohbetten-siparis-actions">
              {summarySent && approvalStatus !== 'approved' && (
                <button
                  type="button"
                  className="secondary-button sohbetten-siparis-action-btn sohbetten-siparis-kontrol-btn"
                  disabled={saving || loading}
                  onClick={handleCheckCustomerReply}
                >
                  ONAY CEVABINI KONTROL ET
                </button>
              )}
              {/* İlk mesaj gönderilene kadar: tam sohbet çıkarımı. Sonrasında «ONAY CEVABINI KONTROL ET» sohbeti okur + formu günceller. */}
              {typeof selectedOrgId === 'number' && !summarySent && !loading && (
                <div className="sohbetten-siparis-reanalyze-row sohbetten-siparis-reanalyze-row--actions">
                  <button
                    type="button"
                    className="secondary-button sohbetten-siparis-reanalyze-btn sohbetten-siparis-action-btn"
                    disabled={saving || !chat?.id}
                    onClick={() => {
                      manualReanalyzeRef.current = true;
                      setReanalyzeKey((k) => k + 1);
                    }}
                  >
                    {analizFormuDoldurdu ? 'SOHBETİ TEKRAR ANALİZ ET' : 'SOHBETİ ANALİZ ET'}
                  </button>
                  <span className="sohbetten-siparis-reanalyze-hint">
                    {analizFormuDoldurdu
                      ? 'Yeni mesaj veya eksik düzeltme sonrası formu yenilemek için tekrar analiz edin.'
                      : 'Yeni mesajlar geldiyse formu güncellemek için tekrar analiz edin.'}
                  </span>
                </div>
              )}
              <button
                type="button"
                className={`modal-react-whatsapp-info-son-konusmalar-btn sohbetten-siparis-gonder-btn sohbetten-siparis-action-btn${
                  typeof selectedOrgId !== 'number' ? ' sohbetten-siparis-gonder-btn--need-org' : ''
                }`}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                disabled={
                  saving ||
                  loading ||
                  typeof selectedOrgId !== 'number' ||
                  (summarySent &&
                    finalSummarySent &&
                    approvalStatus !== 'approved') ||
                  (summarySent && finalSummarySent && approvalStatus === 'approved' && requiredMissingKeys.length > 0)
                }
                title={
                  typeof selectedOrgId !== 'number'
                    ? 'Önce yukarıdan organizasyon kartını seçin; ardından sipariş formu açılır.'
                    : summarySent && finalSummarySent && approvalStatus === 'waiting'
                      ? 'Müşteri onayı için önce "ONAY CEVABINI KONTROL ET" kullanın.'
                      : undefined
                }
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSubmit(e as unknown as React.FormEvent);
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSubmit(e);
                }}
              >
                {saving ? (
                  <>
                    <Loader2 className="modal-react-whatsapp-info-icon-spin" size={16} aria-hidden style={{ flexShrink: 0 }} />
                    {summarySent && finalSummarySent ? 'İŞLENİYOR...' : 'GÖNDERİLİYOR...'}
                  </>
                ) : loading && typeof selectedOrgId === 'number' ? (
                  <>
                    <Loader2 className="modal-react-whatsapp-info-icon-spin" size={16} aria-hidden style={{ flexShrink: 0 }} />
                    ANALİZ EDİLİYOR…
                  </>
                ) : typeof selectedOrgId !== 'number' ? (
                  'ÖNCE ORGANİZASYON KARTINI SEÇİN'
                ) : summarySent && finalSummarySent && approvalStatus === 'approved' && requiredMissingKeys.length === 0 ? (
                  'SİPARİŞİ KAYDET'
                ) : summarySent && finalSummarySent && approvalStatus === 'waiting' ? (
                  'ONAY BEKLENİYOR…'
                ) : summarySent && finalSummarySent ? (
                  'ÖNCE ONAY CEVABINI KONTROL EDİN'
                ) : requiredMissingKeys.length > 0 ? (
                  'MÜŞTERİDEN BİLGİ İSTE'
                ) : (
                  'MÜŞTERİDEN ONAY İSTE'
                )}
              </button>
              <button type="button" className="secondary-button btn-vazgec sohbetten-siparis-action-btn" onClick={requestClose}>
                İPTAL
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};
