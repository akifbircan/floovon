import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { showToast, showToastInteractive } from '../../../shared/utils/toastUtils';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { ErrorState } from '../../../shared/components/ErrorState';
import { EmptyState } from '../../../shared/components/EmptyState';
import { usePageAnimations } from '../../../shared/hooks/usePageAnimations';
import { getUploadUrl } from '../../../shared/utils/urlUtils';
import { formatTL, formatTLDisplayValue, parseTL, formatTutarInputLive, formatTutarInputKeyDown, formatPhoneNumber, cleanPhoneForDatabase, formatOdemeYontemiDisplay, normalizeOdemeYontemiForDb } from '../../../shared/utils/formatUtils';
import { SearchInput } from '../../../shared/components/SearchInput';
import { X, ArrowLeftCircle, Pencil, Trash2, FileSearch, Eye } from 'lucide-react';
import { getPrintLogoAndFooter, openPrintWindow, generateCariPrintHTMLWithHeader, downloadTableAsExcel, getPrintDateDDMMYYYY } from '../../dashboard/utils/exportUtils';
import { invalidatePartnerQueries } from '../../../lib/invalidateQueries';

interface PartnerDetail {
  id: number;
  partner_firma_adi?: string;
  partner_yetkili_kisi?: string;
  partner_telefon?: string;
  partner_eposta?: string;
  partner_acik_adres?: string;
  partner_logo?: string;
  firma_adi?: string;
  tip?: 'verilen' | 'alinan';
  toplam_siparis?: number;
  toplam_tutar?: number;
  kayit_tarihi?: string;
}

interface PartnerOrder {
  id: number;
  tarih?: string;
  durum?: string;
  tutar?: number;
  urun?: string;
  adet?: number;
  urun_fiyati?: number;
  fatura_no?: string;
  siparis_kodu?: string;
  olusturma_tarihi?: string;
  siparis_urun?: string;
  siparis_tutari?: number;
  toplam_tutar?: number;
  miktar?: number;
  birim_fiyat?: number;
  urun_gorsel?: string;
  product_gorsel?: string;
}

interface PartnerOdeme {
  id: number;
  islem_tarihi?: string;
  islem_tarihi_saati?: string;
  islem_saati?: string;
  odeme_yontemi?: string;
  tutar?: number;
  odeme_yapan_kisi?: string;
  aciklama?: string;
  makbuz_no?: string;
  durum?: string;
  transaction_type?: string;
  transaction_date?: string;
  amount?: number;
  payment_method?: string;
  responsible_person?: string;
  description?: string;
}

type PartnerTab = 'alinan-siparisler' | 'verilen-siparisler' | 'odeme-tahsilat';

function normalizeKartTur(kart_turu?: string | null): 'organizasyon' | 'aracsusleme' | 'ozelgun' | 'ozelsiparis' {
  if (!kart_turu) return 'organizasyon';
  const t = String(kart_turu).toLowerCase();
  if (t.includes('araç') || t.includes('arac') || t === 'aracsusleme') return 'aracsusleme';
  if (t.includes('özel gün') || t.includes('ozel gun') || t === 'ozelgun') return 'ozelgun';
  if (t.includes('özel sipariş') || t.includes('ozel siparis') || t === 'ozelsiparis') return 'ozelsiparis';
  return 'organizasyon';
}

function getKartTurDisplay(kartTur: 'organizasyon' | 'aracsusleme' | 'ozelgun' | 'ozelsiparis'): string {
  return { organizasyon: 'Organizasyon', aracsusleme: 'Araç Süsleme', ozelgun: 'Özel Gün', ozelsiparis: 'Özel Sipariş' }[kartTur] || 'Organizasyon';
}

/** Partner ödeme satırından alan değeri al (backend İngilizce/Türkçe key veya farklı casing) */
function getPayField(row: Record<string, unknown>, ...keys: string[]): string {
  if (!row || typeof row !== 'object') return '';
  for (const key of keys) {
    const v = row[key];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  for (const [k, v] of Object.entries(row)) {
    if (v != null && String(v).trim() !== '' && keys.some((key) => key.toLowerCase() === k.toLowerCase())) return String(v).trim();
  }
  return '';
}

/** Tablo için tek satırdan tüm alanları al (API'dan gelen her key denenir) */
function getPayRowDisplay(row: Record<string, unknown>) {
  const get = (...keys: string[]) => getPayField(row, ...keys);
  const transactionType = get('transaction_type', 'islem_tipi') || 'odeme';
  const transactionDate = get('transaction_date', 'islem_tarihi', 'islem_tarihi_saati', 'created_at') || String(row.transaction_date ?? row.islem_tarihi ?? row.created_at ?? '');
  const amountRaw = row.amount ?? row.tutar;
  const amount = amountRaw != null ? Number(amountRaw) : null;
  const paymentMethod = get('payment_method', 'odeme_yontemi') || String(row.payment_method ?? row.odeme_yontemi ?? '');
  const responsiblePerson = get('responsible_person', 'odeme_yapan_kisi') || String(row.responsible_person ?? row.odeme_yapan_kisi ?? '');
  const aciklama = get('description', 'aciklama') || '';
  return {
    transactionType,
    transactionDate,
    amount,
    paymentMethod,
    responsiblePerson,
    aciklama,
  };
}

/**
 * Partner Cari Hesap – Sol 25%, Sağ 75%, tablar: Alınan Siparişler, Verilen Siparişler, Ödeme ve Tahsilatlar.
 * Ödeme/Tahsilat formu sağdan drawer ile açılır.
 */
export const PartnerDetailPage: React.FC = () => {
  usePageAnimations('partners');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PartnerTab>('alinan-siparisler');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [odemeDrawerOpen, setOdemeDrawerOpen] = useState(false);
  const [odemeTutar, setOdemeTutar] = useState('');
  const [editingOdeme, setEditingOdeme] = useState<PartnerOdeme | null>(null);
  const [tableSearchByTab, setTableSearchByTab] = useState<Record<PartnerTab, string>>({
    'alinan-siparisler': '',
    'verilen-siparisler': '',
    'odeme-tahsilat': '',
  });
  const partnerOdemeFormRef = useRef<HTMLFormElement>(null);
  const odemeFormDirtyRef = useRef(false);

  const closeOdemeDrawer = () => {
    odemeFormDirtyRef.current = false;
    setOdemeTutar('');
    setEditingOdeme(null);
    setOdemeDrawerOpen(false);
  };

  const requestCloseOdemeDrawer = () => {
    if (odemeFormDirtyRef.current) {
      showToastInteractive({
        title: 'Değişiklikleri Kaydet',
        message: 'Kaydedilmeyen değişiklikler var! Değişiklikleri kaydetmek istiyor musunuz?',
        confirmText: 'Evet, Kaydet',
        cancelText: 'İptal',
        onConfirm: async () => {
          (window as unknown as { closeInteractiveToastIfOpen?: () => void }).closeInteractiveToastIfOpen?.();
          if (partnerOdemeFormRef.current) {
            const form = partnerOdemeFormRef.current;
            if (form.checkValidity()) {
              form.requestSubmit();
            } else {
              form.reportValidity();
            }
          }
        },
        onCancel: () => {
          (window as unknown as { closeInteractiveToastIfOpen?: () => void }).closeInteractiveToastIfOpen?.();
          closeOdemeDrawer();
        },
      });
    } else {
      closeOdemeDrawer();
    }
  };

  const handleExport = async (type: 'excel' | 'print') => {
    if (type === 'excel') {
      try {
        let data: Record<string, unknown>[] = [];
        const tabLabel = activeTab === 'alinan-siparisler' ? 'Alinan-Siparisler' : activeTab === 'verilen-siparisler' ? 'Verilen-Siparisler' : 'Odeme-Tahsilat';
        if (activeTab === 'alinan-siparisler' && filteredAlinan?.length) {
          data = (filteredAlinan as PartnerOrder[]).map((o) => {
            const t = o.tarih ?? o.olusturma_tarihi ?? (o as any).created_at ?? '';
            const urun = o.urun ?? o.siparis_urun ?? (o as any).siparis_urun ?? '';
            const adetVal = o.adet ?? o.miktar ?? (o as any).miktar ?? 1;
            const tutar = o.tutar ?? o.siparis_tutari ?? o.toplam_tutar ?? (o as any).siparis_tutari ?? '';
            return { 'Sipariş Kodu': o.siparis_kodu ?? (o as any).siparis_kodu ?? '', Tarih: t ? new Date(String(t)).toLocaleString('tr-TR') : '', Ürün: String(urun), Adet: adetVal, 'Toplam Tutar': tutar != null ? `${Number(tutar).toFixed(2)} TL` : '' };
          });
        } else if (activeTab === 'verilen-siparisler' && filteredVerilen?.length) {
          data = (filteredVerilen as PartnerOrder[]).map((o) => {
            const t = o.tarih ?? o.olusturma_tarihi ?? (o as any).created_at ?? '';
            const urun = o.urun ?? o.siparis_urun ?? (o as any).siparis_urun ?? '';
            const adetVal = o.adet ?? o.miktar ?? (o as any).miktar ?? 1;
            const tutar = o.tutar ?? o.siparis_tutari ?? o.toplam_tutar ?? (o as any).siparis_tutari ?? '';
            return { 'Sipariş Kodu': o.siparis_kodu ?? (o as any).siparis_kodu ?? '', Tarih: t ? new Date(String(t)).toLocaleString('tr-TR') : '', Ürün: String(urun), Adet: adetVal, 'Toplam Tutar': tutar != null ? `${Number(tutar).toFixed(2)} TL` : '' };
          });
        } else if (activeTab === 'odeme-tahsilat' && filteredOdemeler?.length) {
          data = (filteredOdemeler as PartnerOdeme[]).map((o) => {
            const tip = (o.transaction_type ?? 'odeme') === 'tahsilat' ? 'Tahsilat' : 'Ödeme';
            const transactionDate = o.transaction_date ?? o.islem_tarihi ?? o.islem_tarihi_saati ?? '';
            const tarihStr = transactionDate ? (() => { try { const d = new Date(String(transactionDate)); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('tr-TR'); } catch { return ''; } })() : '';
            const tutar = o.amount ?? o.tutar;
            const yontem = formatOdemeYontemiDisplay(o.payment_method ?? o.odeme_yontemi ?? '');
            const kisi = (o.responsible_person ?? o.odeme_yapan_kisi ?? '').trim() || '';
            const aciklama = (o.description ?? o.aciklama ?? '').trim() || '(Açıklama Yok)';
            return { 'İşlem Tarihi': tarihStr, 'İşlem Türü': tip, 'Ödeme Yöntemi': yontem, Tutar: tutar != null ? Number(tutar) : '', 'İşlem Sorumlusu': kisi, Açıklama: aciklama };
          });
        }
        if (data.length === 0) {
          showToast('warning', 'Dışa aktarılacak veri yok. Önce listeyi görüntüleyin.');
          setExportMenuOpen(false);
          return;
        }
        const unvan = (partner?.partner_firma_adi || partner?.firma_adi || 'Cari').replace(/[^\w\u00C0-\u024F\s\-]/gi, '');
        downloadTableAsExcel(data, `Partner-Cari-${unvan}-${tabLabel}`);
        showToast('success', 'Excel dosyası indirildi.');
      } catch (e: any) {
        showToast('error', e?.message ?? 'Excel dışa aktarılamadı.');
      }
    } else {
      try {
        const { logoMarkup, footerHtml } = await getPrintLogoAndFooter();
        const unvan = partner?.partner_firma_adi || partner?.firma_adi || '';
        const yetkiliStr = partner?.partner_yetkili_kisi ?? '';
        const telefonStr = partner?.partner_telefon ? formatPhoneNumber(partner.partner_telefon) : '';
        const docTitle = unvan ? `Cari – ${unvan}` : 'Cari Hesap Dökümü';
        const badgeLabelPartner = activeTab === 'alinan-siparisler' ? 'PARTNER > CARİ HESAP DÖKÜMÜ > ALINAN SİPARİŞLER' : activeTab === 'verilen-siparisler' ? 'PARTNER > CARİ HESAP DÖKÜMÜ > VERİLEN SİPARİŞLER' : 'PARTNER > CARİ HESAP DÖKÜMÜ > ÖDEME VE TAHSİLATLAR';
        let rows = '';
        let tableHeaders = '';
        const buildOrgCell = (raw: Record<string, unknown>, o: PartnerOrder) => {
          const oRec = (o as unknown) as Record<string, unknown>;
          const kartTurRaw = raw.organizasyon_kart_tur ?? oRec.organizasyon_kart_tur ?? raw.kart_tur ?? raw.kart_turu;
          const kartTur = normalizeKartTur(typeof kartTurRaw === 'string' ? kartTurRaw : String(raw.kart_tur_display ?? oRec.kart_tur_display ?? ''));
          const kartTurDisplay = (typeof oRec.kart_tur_display === 'string' ? oRec.kart_tur_display : null) ?? (typeof raw.kart_tur_display === 'string' ? raw.kart_tur_display : null) ?? getKartTurDisplay(kartTur);
          const altTurVal = raw.organizasyon_alt_tur ?? oRec.organizasyon_alt_tur ?? raw.alt_tur ?? raw.alt_kart_tur;
          let altTurStr = typeof altTurVal === 'string' ? altTurVal.trim() : (altTurVal != null ? String(altTurVal).trim() : '');
          const mahalleVal = raw.mahalle ?? raw.organizasyon_mahalle ?? oRec.organizasyon_mahalle ?? raw.teslim_mahalle;
          const mahalleStr = typeof mahalleVal === 'string' ? mahalleVal.trim() : (mahalleVal != null ? String(mahalleVal).trim() : '');
          const teslimatKonumu = raw.organizasyon_konum ?? oRec.organizasyon_konum ?? raw.organizasyon_teslimat_konumu ?? raw.teslimat_adresi;
          const teslimatKonumuStr = typeof teslimatKonumu === 'string' ? teslimatKonumu.trim() : (teslimatKonumu != null ? String(teslimatKonumu).trim() : '');
          const orgSahibiStr = typeof (raw.organizasyon_sahibi ?? oRec.organizasyon_sahibi) === 'string' ? String(raw.organizasyon_sahibi ?? oRec.organizasyon_sahibi).trim() : '';
          const teslimKisisiStr = typeof (raw.organizasyon_teslim_kisisi ?? oRec.organizasyon_teslim_kisisi ?? raw.teslim_kisisi) === 'string' ? String(raw.organizasyon_teslim_kisisi ?? oRec.organizasyon_teslim_kisisi ?? raw.teslim_kisisi).trim() : '';
          let primaryKonum: string; let secondaryContent: string;
          if (kartTur === 'aracsusleme') {
            const aracParts = [(raw.arac_markamodel ?? oRec.arac_markamodel), (raw.arac_renk ?? oRec.arac_renk), (raw.arac_plaka ?? oRec.arac_plaka)].filter(Boolean).map((x) => String(x).trim());
            primaryKonum = aracParts.length ? aracParts.join(', ') : '—';
            secondaryContent = typeof (raw.musteri_unvan ?? oRec.musteri_unvan) === 'string' ? String(raw.musteri_unvan ?? oRec.musteri_unvan).trim() : '—';
          } else {
            primaryKonum = teslimatKonumuStr || mahalleStr || '—';
            secondaryContent = [orgSahibiStr, teslimKisisiStr].filter(Boolean).join(' · ') || '—';
          }
          const orgParts = [kartTurDisplay, altTurStr || null, primaryKonum, secondaryContent].filter(Boolean);
          return orgParts.length ? orgParts.join('<br>') : '—';
        };
        if (activeTab === 'alinan-siparisler' && filteredAlinan?.length) {
          tableHeaders = '<tr><th>Sipariş Kodu</th><th>Tarih</th><th>Ürün</th><th>Organizasyon Bilgileri</th><th>Adet</th><th>Ürün Fiyatı</th><th>Toplam Tutar</th></tr>';
          rows = (filteredAlinan as PartnerOrder[]).map((o) => {
            const raw = (o as unknown) as Record<string, unknown>;
            const t = o.tarih ?? o.olusturma_tarihi ?? raw.created_at ?? raw.teslim_tarih ?? raw.created_at;
            const urun = o.urun ?? o.siparis_urun ?? raw.siparis_urun ?? raw.urun ?? '';
            const adetVal = o.adet ?? o.miktar ?? raw.miktar ?? raw.adet ?? raw.quantity;
            const adet = adetVal != null && adetVal !== '' ? String(adetVal) : '1';
            const tutar = o.tutar ?? o.siparis_tutari ?? o.toplam_tutar ?? raw.siparis_tutari ?? raw.toplam_tutar ?? raw.tutar;
            const fiyat = o.urun_fiyati ?? o.birim_fiyat ?? raw.birim_fiyat ?? raw.urun_fiyati ?? (tutar != null && Number(adet) > 0 ? Number(tutar) / Number(adet) : null);
            const fiyatStr = fiyat != null && !Number.isNaN(Number(fiyat)) ? `${Number(fiyat).toFixed(2)} TL` : (tutar != null ? `${Number(tutar).toFixed(2)} TL` : '—');
            const tutarStr = tutar != null ? `${Number(tutar).toFixed(2)} TL` : '—';
            const orgCell = buildOrgCell(raw, o);
            const siparisKoduPrint = (o.siparis_kodu ?? raw.siparis_kodu) != null ? String(o.siparis_kodu ?? raw.siparis_kodu) : '—';
            return `<tr><td>${siparisKoduPrint}</td><td>${t ? new Date(String(t)).toLocaleString('tr-TR') : '—'}</td><td>${String(urun)}</td><td class="print-org-cell">${orgCell}</td><td>${adet}</td><td>${fiyatStr}</td><td>${tutarStr}</td></tr>`;
          }).join('');
        } else if (activeTab === 'verilen-siparisler' && filteredVerilen?.length) {
          tableHeaders = '<tr><th>Sipariş Kodu</th><th>Tarih</th><th>Ürün</th><th>Organizasyon Bilgileri</th><th>Adet</th><th>Ürün Fiyatı</th><th>Toplam Tutar</th></tr>';
          rows = (filteredVerilen as PartnerOrder[]).map((o) => {
            const raw = (o as unknown) as Record<string, unknown>;
            const t = o.tarih ?? o.olusturma_tarihi ?? raw.created_at ?? raw.teslim_tarih ?? raw.created_at;
            const urun = o.urun ?? o.siparis_urun ?? raw.siparis_urun ?? raw.urun ?? '';
            const adetVal = o.adet ?? o.miktar ?? raw.miktar ?? raw.adet ?? raw.quantity;
            const adet = adetVal != null && adetVal !== '' ? String(adetVal) : '1';
            const tutar = o.tutar ?? o.siparis_tutari ?? o.toplam_tutar ?? raw.siparis_tutari ?? raw.toplam_tutar ?? raw.tutar;
            const fiyat = o.urun_fiyati ?? o.birim_fiyat ?? raw.birim_fiyat ?? raw.urun_fiyati ?? (tutar != null && Number(adet) > 0 ? Number(tutar) / Number(adet) : null);
            const fiyatStr = fiyat != null && !Number.isNaN(Number(fiyat)) ? `${Number(fiyat).toFixed(2)} TL` : (tutar != null ? `${Number(tutar).toFixed(2)} TL` : '—');
            const tutarStr = tutar != null ? `${Number(tutar).toFixed(2)} TL` : '—';
            const orgCell = buildOrgCell(raw, o);
            const siparisKoduVerilen = (o.siparis_kodu ?? raw.siparis_kodu) != null ? String(o.siparis_kodu ?? raw.siparis_kodu) : '—';
            return `<tr><td>${siparisKoduVerilen}</td><td>${t ? new Date(String(t)).toLocaleString('tr-TR') : '—'}</td><td>${String(urun)}</td><td class="print-org-cell">${orgCell}</td><td>${adet}</td><td>${fiyatStr}</td><td>${tutarStr}</td></tr>`;
          }).join('');
        } else if (activeTab === 'odeme-tahsilat' && filteredOdemeler?.length) {
          tableHeaders = '<tr><th>İşlem Tarihi</th><th>İşlem Türü</th><th>Ödeme Yöntemi</th><th>Tutar</th><th>İşlem Sorumlusu</th><th>Açıklama</th></tr>';
          rows = (filteredOdemeler as PartnerOdeme[]).map((o) => {
            const tip = (o.transaction_type ?? 'odeme') === 'tahsilat' ? 'Tahsilat' : 'Ödeme';
            const transactionDate = o.transaction_date ?? o.islem_tarihi ?? o.islem_tarihi_saati ?? '';
            const tarihStr = transactionDate ? (() => { try { const d = new Date(String(transactionDate)); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('tr-TR'); } catch { return '—'; } })() : '—';
            const tutar = o.amount ?? o.tutar;
            const yontem = formatOdemeYontemiDisplay(o.payment_method ?? o.odeme_yontemi ?? '');
            const kisi = (o.responsible_person ?? o.odeme_yapan_kisi ?? '').trim() || '—';
            const aciklama = (o.description ?? o.aciklama ?? '').trim() || '(Açıklama Yok)';
            return `<tr><td>${tarihStr}</td><td>${tip}</td><td>${yontem}</td><td>${tutar != null ? Number(tutar).toFixed(2) : '—'} TL</td><td>${kisi}</td><td>${aciklama}</td></tr>`;
          }).join('');
        }
        if (!rows) {
          showToast('warning', 'Yazdırılacak veri bulunamadı. Önce listeyi görüntüleyin.');
          setExportMenuOpen(false);
          return;
        }
        const tableContent = `<table><thead>${tableHeaders}</thead><tbody>${rows}</tbody></table>`;
        const html = generateCariPrintHTMLWithHeader(
          { badgeLabel: badgeLabelPartner, unvan, yetkili: yetkiliStr, telefon: telefonStr, eposta: partner?.partner_eposta ?? '', currentDate: getPrintDateDDMMYYYY(), footerHtml },
          tableContent,
          logoMarkup
        );
        openPrintWindow(html, `${docTitle} – ${getPrintDateDDMMYYYY()}`, '');
      } catch (e) {
        console.error(e);
        showToast('error', 'Yazdırma açılamadı.');
      }
    }
    setExportMenuOpen(false);
  };

  const { data: partner, isLoading: partnerLoading, error: partnerError } = useQuery({
    queryKey: ['partner-detail', id],
    queryFn: async () => {
      try {
        return await apiRequest<PartnerDetail>(`/partner-firmalar/${id}`, { method: 'GET' });
      } catch (err) {
        console.error('Partner detay yükleme hatası:', err);
        throw err;
      }
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const { data: cariOzet } = useQuery({
    queryKey: ['partner-cari-ozet', id],
    queryFn: async () => {
      try {
        return await apiRequest<{
          toplam_alacak: number;
          toplam_odeme: number;
          bakiye: number;
        }>(`/partner-firmalar/${id}/cari-ozet`, { method: 'GET' });
      } catch (err) {
        return { toplam_alacak: 0, toplam_odeme: 0, bakiye: 0 };
      }
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const { data: alinanSiparisler, isLoading: alinanLoading } = useQuery({
    queryKey: ['partner-orders-alinan', id],
    queryFn: async () => {
      try {
        const result = await apiRequest<PartnerOrder[] | { data?: PartnerOrder[] }>(`/partner-firmalar/${id}/alinan-siparisler`, { method: 'GET' });
        if (Array.isArray(result)) return result;
        if (result && typeof result === 'object' && 'data' in result && Array.isArray((result as { data: PartnerOrder[] }).data)) return (result as { data: PartnerOrder[] }).data;
        return [];
      } catch (err) {
        return [];
      }
    },
    enabled: !!id && (activeTab === 'alinan-siparisler'),
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const { data: verilenSiparisler, isLoading: verilenLoading } = useQuery({
    queryKey: ['partner-orders-verilen', id],
    queryFn: async () => {
      try {
        const result = await apiRequest<PartnerOrder[] | { data?: PartnerOrder[] }>(`/partner-firmalar/${id}/verilen-siparisler`, { method: 'GET' });
        if (Array.isArray(result)) return result;
        if (result && typeof result === 'object' && 'data' in result && Array.isArray((result as { data: PartnerOrder[] }).data)) return (result as { data: PartnerOrder[] }).data;
        return [];
      } catch (err) {
        return [];
      }
    },
    enabled: !!id && (activeTab === 'verilen-siparisler'),
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const { data: odemeler, isLoading: odemelerLoading } = useQuery({
    queryKey: ['partner-odemeler', id],
    queryFn: async () => {
      try {
        const result = await apiRequest<PartnerOdeme[] | { success?: boolean; data?: PartnerOdeme[] }>(`/partner-firmalar/${id}/odemeler`, { method: 'GET' });
        const list = Array.isArray(result) ? result : (result && typeof result === 'object' && 'data' in result && Array.isArray((result as { data?: PartnerOdeme[] }).data)) ? (result as { data: PartnerOdeme[] }).data : [];
        return list;
      } catch (err) {
        return [];
      }
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const searchLowerAlinan = (tableSearchByTab['alinan-siparisler'] || '').trim().toLowerCase();
  const filteredAlinan = useMemo(() => {
    if (!alinanSiparisler?.length) return [];
    if (!searchLowerAlinan) return alinanSiparisler;
    return alinanSiparisler.filter((o) => {
      const raw = (o as unknown) as Record<string, unknown>;
      const orgKart = (raw.organizasyon_kart ?? (o as unknown as Record<string, unknown>).organizasyon_kart) as Record<string, unknown> | undefined;
      const kod = String(o.siparis_kodu ?? raw.siparis_kodu ?? '').toLowerCase();
      const urun = String(o.urun ?? o.siparis_urun ?? raw.siparis_urun ?? raw.urun_adi ?? '').toLowerCase();
      const fatura = String(o.fatura_no ?? raw.fatura_no ?? '').toLowerCase();
      const idStr = String(o.id ?? '').toLowerCase();
      const tarih = (o.tarih ?? o.olusturma_tarihi ?? raw.created_at ?? raw.teslim_tarih ?? raw.olusturma_tarihi) ? new Date(String(o.tarih ?? o.olusturma_tarihi ?? raw.created_at ?? raw.teslim_tarih ?? raw.olusturma_tarihi)).toLocaleString('tr-TR').toLowerCase() : '';
      const adetStr = String(o.adet ?? o.miktar ?? raw.miktar ?? raw.adet ?? raw.quantity ?? '').toLowerCase();
      const tutarStr = String(o.tutar ?? o.siparis_tutari ?? raw.siparis_tutari ?? raw.toplam_tutar ?? raw.tutar ?? '').toLowerCase();
      const fiyatStr = String(o.urun_fiyati ?? o.birim_fiyat ?? raw.birim_fiyat ?? raw.urun_fiyati ?? '').toLowerCase();
      const kartTur = String(raw.organizasyon_kart_tur ?? (o as unknown as Record<string, unknown>).organizasyon_kart_tur ?? raw.kart_tur ?? raw.kart_turu ?? orgKart?.organizasyon_kart_tur ?? orgKart?.kart_tur ?? '').toLowerCase();
      const altTur = String(orgKart?.alt_tur ?? orgKart?.organizasyon_alt_tur ?? raw.organizasyon_alt_tur ?? raw.alt_tur ?? raw.alt_tur_display ?? raw.alt_kart_tur ?? raw.kart_alt_tur ?? raw.organizasyon_alt_tur_display ?? raw.sub_tur ?? raw.alt_kart_turu ?? '').toLowerCase();
      const etiket = String(raw.organizasyon_kart_etiket ?? orgKart?.organizasyon_kart_etiket ?? orgKart?.kart_etiket ?? '').toLowerCase();
      const konum = String(raw.organizasyon_konum ?? raw.organizasyon_teslimat_konumu ?? raw.teslimat_adresi ?? orgKart?.organizasyon_teslimat_konumu ?? '').toLowerCase();
      const mahalle = String(raw.mahalle ?? raw.organizasyon_mahalle ?? raw.teslim_mahalle ?? orgKart?.organizasyon_mahalle ?? '').toLowerCase();
      const sahip = String(raw.organizasyon_sahibi ?? raw.organizasyon_sahip ?? orgKart?.organizasyon_teslim_kisisi ?? '').toLowerCase();
      const teslimKisi = String(raw.organizasyon_teslim_kisisi ?? raw.teslim_kisisi ?? '').toLowerCase();
      const aracMarka = String(raw.arac_markamodel ?? '').toLowerCase();
      const aracRenk = String(raw.arac_renk ?? '').toLowerCase();
      const aracPlaka = String(raw.arac_plaka ?? '').toLowerCase();
      const musteriUnvan = String(raw.musteri_unvan ?? '').toLowerCase();
      const combined = [kod, urun, fatura, idStr, tarih, adetStr, tutarStr, fiyatStr, kartTur, altTur, etiket, konum, mahalle, sahip, teslimKisi, aracMarka, aracRenk, aracPlaka, musteriUnvan].join(' ');
      return combined.includes(searchLowerAlinan);
    });
  }, [alinanSiparisler, searchLowerAlinan]);
  const searchLowerVerilen = (tableSearchByTab['verilen-siparisler'] || '').trim().toLowerCase();
  const filteredVerilen = useMemo(() => {
    if (!verilenSiparisler?.length) return [];
    if (!searchLowerVerilen) return verilenSiparisler;
    return verilenSiparisler.filter((o) => {
      const raw = (o as unknown) as Record<string, unknown>;
      const orgKart = (raw.organizasyon_kart ?? (o as unknown as Record<string, unknown>).organizasyon_kart) as Record<string, unknown> | undefined;
      const kod = String(o.siparis_kodu ?? raw.siparis_kodu ?? '').toLowerCase();
      const urun = String(o.urun ?? o.siparis_urun ?? raw.siparis_urun ?? raw.urun_adi ?? '').toLowerCase();
      const fatura = String(o.fatura_no ?? raw.fatura_no ?? '').toLowerCase();
      const idStr = String(o.id ?? '').toLowerCase();
      const tarih = (o.tarih ?? o.olusturma_tarihi ?? raw.created_at ?? raw.teslim_tarih ?? raw.olusturma_tarihi) ? new Date(String(o.tarih ?? o.olusturma_tarihi ?? raw.created_at ?? raw.teslim_tarih ?? raw.olusturma_tarihi)).toLocaleString('tr-TR').toLowerCase() : '';
      const adetStr = String(o.adet ?? o.miktar ?? raw.miktar ?? raw.adet ?? raw.quantity ?? '').toLowerCase();
      const tutarStr = String(o.tutar ?? o.siparis_tutari ?? raw.siparis_tutari ?? raw.toplam_tutar ?? raw.tutar ?? '').toLowerCase();
      const fiyatStr = String(o.urun_fiyati ?? o.birim_fiyat ?? raw.birim_fiyat ?? raw.urun_fiyati ?? '').toLowerCase();
      const kartTur = String(raw.organizasyon_kart_tur ?? (o as unknown as Record<string, unknown>).organizasyon_kart_tur ?? raw.kart_tur ?? raw.kart_turu ?? orgKart?.organizasyon_kart_tur ?? orgKart?.kart_tur ?? '').toLowerCase();
      const altTur = String(orgKart?.alt_tur ?? orgKart?.organizasyon_alt_tur ?? raw.organizasyon_alt_tur ?? raw.alt_tur ?? raw.alt_tur_display ?? raw.alt_kart_tur ?? raw.kart_alt_tur ?? raw.organizasyon_alt_tur_display ?? raw.sub_tur ?? raw.alt_kart_turu ?? '').toLowerCase();
      const etiket = String(raw.organizasyon_kart_etiket ?? orgKart?.organizasyon_kart_etiket ?? orgKart?.kart_etiket ?? '').toLowerCase();
      const konum = String(raw.organizasyon_konum ?? raw.organizasyon_teslimat_konumu ?? raw.teslimat_adresi ?? orgKart?.organizasyon_teslimat_konumu ?? '').toLowerCase();
      const mahalle = String(raw.mahalle ?? raw.organizasyon_mahalle ?? raw.teslim_mahalle ?? orgKart?.organizasyon_mahalle ?? '').toLowerCase();
      const sahip = String(raw.organizasyon_sahibi ?? raw.organizasyon_sahip ?? orgKart?.organizasyon_teslim_kisisi ?? '').toLowerCase();
      const teslimKisi = String(raw.organizasyon_teslim_kisisi ?? raw.teslim_kisisi ?? '').toLowerCase();
      const aracMarka = String(raw.arac_markamodel ?? '').toLowerCase();
      const aracRenk = String(raw.arac_renk ?? '').toLowerCase();
      const aracPlaka = String(raw.arac_plaka ?? '').toLowerCase();
      const musteriUnvan = String(raw.musteri_unvan ?? '').toLowerCase();
      const combined = [kod, urun, fatura, idStr, tarih, adetStr, tutarStr, fiyatStr, kartTur, altTur, etiket, konum, mahalle, sahip, teslimKisi, aracMarka, aracRenk, aracPlaka, musteriUnvan].join(' ');
      return combined.includes(searchLowerVerilen);
    });
  }, [verilenSiparisler, searchLowerVerilen]);
  const searchLowerOdemeler = (tableSearchByTab['odeme-tahsilat'] || '').trim().toLowerCase();
  const filteredOdemeler = useMemo(() => {
    if (!odemeler?.length) return [];
    if (!searchLowerOdemeler) return odemeler;
    return odemeler.filter((o) => {
      const raw = (o as unknown) as Record<string, unknown>;
      const tip = String(o.transaction_type ?? raw.transaction_type ?? 'odeme').toLowerCase();
      const tipDisplay = tip === 'tahsilat' ? 'tahsilat' : 'odeme ödeme';
      const islemTarihi = o.transaction_date ?? o.islem_tarihi_saati ?? o.islem_tarihi ?? raw.transaction_date ?? raw.odeme_tarihi ?? raw.islem_tarihi_saati ?? raw.islem_tarihi ?? '';
      const tarih = String(islemTarihi).toLowerCase();
      const tarihFormatted = islemTarihi ? new Date(String(islemTarihi)).toLocaleString('tr-TR').toLowerCase() : '';
      const islemSaati = String(o.islem_saati ?? raw.islem_saati ?? '').toLowerCase();
      const yontem = String(o.odeme_yontemi ?? o.payment_method ?? raw.payment_method ?? raw.odeme_yontemi ?? '').toLowerCase();
      const kisi = String(o.odeme_yapan_kisi ?? o.responsible_person ?? raw.responsible_person ?? raw.odeme_yapan_kisi ?? '').toLowerCase();
      const aciklama = String(o.aciklama ?? o.description ?? raw.description ?? raw.aciklama ?? '').toLowerCase();
      const makbuz = String(o.makbuz_no ?? raw.makbuz_no ?? '').toLowerCase();
      const tutarStr = (o.tutar ?? o.amount ?? raw.amount ?? raw.odenen_tutar ?? '').toString().toLowerCase();
      const durumStr = String(o.durum ?? raw.durum ?? '').toLowerCase();
      const idStr = String(o.id ?? '').toLowerCase();
      const combined = [tip, tipDisplay, tarih, tarihFormatted, islemSaati, yontem, kisi, aciklama, makbuz, tutarStr, durumStr, idStr].join(' ');
      return combined.includes(searchLowerOdemeler);
    });
  }, [odemeler, searchLowerOdemeler]);

  useEffect(() => {
    if (!odemeDrawerOpen) return;
    const form = partnerOdemeFormRef.current;
    if (!form) return;
    const markDirty = () => { odemeFormDirtyRef.current = true; };
    form.addEventListener('input', markDirty);
    form.addEventListener('change', markDirty);
    return () => {
      form.removeEventListener('input', markDirty);
      form.removeEventListener('change', markDirty);
    };
  }, [odemeDrawerOpen]);

  if (partnerLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (partnerError || !partner) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ErrorState
          title="Partner firma bulunamadı"
          message={partnerError instanceof Error ? partnerError.message : 'Partner detayları yüklenemedi'}
        />
      </div>
    );
  }

  const toplamAlacak = cariOzet?.toplam_alacak ?? partner.toplam_tutar ?? 0;
  const toplamOdeme = cariOzet?.toplam_odeme ?? 0;
  const bakiye = cariOzet?.bakiye ?? 0;
  const firmaAdi = partner.partner_firma_adi || partner.firma_adi || `Partner #${partner.id}`;

  const formatCurrency = (n: number | undefined | null): string => {
    if (n === undefined || n === null || Number.isNaN(Number(n))) return '—';
    return formatTL(n);
  };

  const tabBaslik = () => {
    if (activeTab === 'alinan-siparisler') return 'Alınan Siparişler';
    if (activeTab === 'verilen-siparisler') return 'Verilen Siparişler';
    return 'Ödeme ve Tahsilatlar';
  };

  const handlePartnerOdemeSil = (o: PartnerOdeme) => {
    showToastInteractive({
      title: 'Kayıt Sil',
      message: 'Bu ödeme/tahsilat kaydını silmek istediğinize emin misiniz?',
      confirmText: 'Evet, Sil',
      cancelText: 'İptal',
      onConfirm: async () => {
        if (!id) return;
        try {
          await apiRequest(`/partner-firmalar/${id}/odemeler/${o.id}`, { method: 'DELETE' });
          showToast('success', 'Kayıt silindi.');
          invalidatePartnerQueries(queryClient, id);
        } catch (err) {
          showToast('error', err instanceof Error ? err.message : 'Silinemedi.');
        }
      },
    });
  };

  const formatDateTimeLocal = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '';
    try {
      const d = new Date(String(val));
      if (Number.isNaN(d.getTime())) return '';
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${day}T${h}:${min}`;
    } catch {
      return '';
    }
  };

  const handlePartnerOdemeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!id || !partnerOdemeFormRef.current) return;
    const form = partnerOdemeFormRef.current;
    
    // HTML5 validation kontrolü - geçersizse tarayıcı kendi mesajını gösterir
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    
    const fd = new FormData(form);
    let transaction_date = (fd.get('transaction_date') as string) || '';
    if (transaction_date && transaction_date.includes('T')) {
      transaction_date = transaction_date.replace('T', ' ') + (transaction_date.length === 16 ? ':00' : '');
    }
    const transaction_type = (fd.get('islem_tipi') as string) || '';
    const payment_method = normalizeOdemeYontemiForDb((fd.get('odeme') as string) || 'nakit');
    const responsible_person = (fd.get('responsible_person') as string) || '';
    const description = (fd.get('description') as string) || '';
    const amount = parseTL(odemeTutar);
    
    // Tutar kontrolü (parse edilebilir mi?)
    if (Number.isNaN(amount) || amount <= 0) {
      showToast('warning', 'Lütfen geçerli bir tutar girin.');
      return;
    }
    try {
      if (editingOdeme) {
        await apiRequest(`/partner-firmalar/${id}/odemeler/${editingOdeme.id}`, {
          method: 'PUT',
          data: {
            transaction_type,
            amount,
            payment_method: payment_method || null,
            transaction_date,
            responsible_person: responsible_person || null,
            description: description || null,
          },
        });
        showToast('success', 'Kayıt güncellendi.');
      } else {
        await apiRequest(`/partner-firmalar/${id}/odemeler`, {
          method: 'POST',
          data: {
            transaction_type,
            amount,
            payment_method: payment_method || null,
            transaction_date,
            responsible_person: responsible_person || null,
            description: description || null,
          },
        });
        showToast('success', 'Kayıt eklendi.');
      }
      invalidatePartnerQueries(queryClient, id);
      closeOdemeDrawer();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Kaydedilemedi.');
    }
  };

  return (
    <div className="cari-page">
      <aside className="cari-sol">
        <div className="geri-don">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/partner-firmalar'); }}>
            <ArrowLeftCircle size={20} strokeWidth={2} aria-hidden />
            Partner Firmalara Geri Dön
          </a>
        </div>
        <h1 className="cari-baslik">Partner Firma Cari Hesap</h1>

        <div className="cari-kart partner-cari-kart">
          <div className="partner-cari-bilgileri">
            {partner.partner_logo && (
              <img
                src={getUploadUrl(partner.partner_logo)}
                alt=""
                className="partner-cari-logo"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            <div className="partner-cari-firma-adi">{firmaAdi}</div>
            <div className="partner-cari-yetkili">{partner.partner_yetkili_kisi || '—'}</div>
            <div className="partner-cari-iletisim">
              {partner.partner_telefon ? (() => {
                const digits = cleanPhoneForDatabase(partner.partner_telefon).replace(/^90/, '');
                const tenDigits = digits.length > 10 ? digits.slice(-10) : digits;
                return (
                  <a href={`tel:+90${tenDigits}`} className="partner-cari-link partner-cari-tel">
                    {formatPhoneNumber(partner.partner_telefon)}
                  </a>
                );
              })() : null}
              {partner.partner_eposta ? (
                <a href={`mailto:${partner.partner_eposta}`} className="partner-cari-link partner-cari-eposta">
                  {partner.partner_eposta}
                </a>
              ) : null}
              {!partner.partner_telefon && !partner.partner_eposta && '—'}
            </div>
          </div>
        </div>

        <div className="cari-ozet-row cari-ozet-stacked">
          <div className="cari-ozet-box">
            <span>Toplam Alacak</span>
            <span className="cari-ozet-deger">{formatCurrency(toplamAlacak)}</span>
          </div>
          <div className="cari-ozet-box">
            <span>Toplam Ödeme / Tahsilat</span>
            <span className="cari-ozet-deger">{formatCurrency(toplamOdeme)}</span>
          </div>
          <div className={`cari-ozet-box ${bakiye >= 0 ? 'bakiye-pozitif' : 'bakiye-negatif'}`}>
            <span>Bakiye</span>
            <span className="cari-ozet-deger">{formatCurrency(bakiye)}</span>
          </div>
        </div>

        <button
          type="button"
          className="cari-tahsilat-btn"
          onClick={() => { setEditingOdeme(null); setOdemeTutar(''); setOdemeDrawerOpen(true); }}
        >
          Ödeme veya Tahsilat Ekle
        </button>
      </aside>

      <div className="cari-sag">
        <div className="cari-sag-inner">
          <div className="cari-tabs">
            <button
              type="button"
              className={`cari-tab ${activeTab === 'alinan-siparisler' ? 'active' : ''}`}
              onClick={() => setActiveTab('alinan-siparisler')}
            >
              Alınan Siparişler
            </button>
            <button
              type="button"
              className={`cari-tab ${activeTab === 'verilen-siparisler' ? 'active' : ''}`}
              onClick={() => setActiveTab('verilen-siparisler')}
            >
              Verilen Siparişler
            </button>
            <button
              type="button"
              className={`cari-tab ${activeTab === 'odeme-tahsilat' ? 'active' : ''}`}
              onClick={() => setActiveTab('odeme-tahsilat')}
            >
              Ödeme ve Tahsilatlar
            </button>
          </div>

          <div className="cari-tablo-alan">
            <div className="cari-tablo-header">
              <h2 className="cari-tablo-baslik">{tabBaslik()}</h2>
              <div className="cari-tablo-toolbar">
                <SearchInput
                  value={tableSearchByTab[activeTab]}
                  onChange={(v) => setTableSearchByTab((prev) => ({ ...prev, [activeTab]: v }))}
                  placeholder={`${tabBaslik()} içerisinde arayın`}
                  className="partner-cari-search-input"
                  aria-label="Tablo ara"
                />
                <div
                  className={`buton-disa-aktar clickdropdown cari-export-dropdown ${exportMenuOpen ? 'is-open' : ''}`}
                >
                  <div className="btn-baslik">
                    <i className="icon-dashboard-disa-aktar" />
                    Dışa Aktar
                  </div>
                  <div className="dosya-tur clickdropbtn" onClick={() => setExportMenuOpen(!exportMenuOpen)}>
                    .xls
                    <i className="fa-solid fa-chevron-down" />
                    <div className="dosya-tur-content clickdropdown-content">
                      <div className="liste-baslik">Listeyi Dışa Aktar</div>
                      <button type="button" className="btn-disa-aktar" onClick={() => void handleExport('excel')}>
                        <i className="icon-disa-aktar-excel" />
                        Excel'e Aktar
                      </button>
                      <button type="button" className="btn-yazdir" onClick={() => void handleExport('print')}>
                        <i className="icon-disa-aktar-yazdir" />
                        Yazdır
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="cari-table-wrapper">
              {activeTab === 'alinan-siparisler' && (
                <>
                  {alinanLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <LoadingSpinner />
                    </div>
                  ) : !filteredAlinan?.length ? (
                    <EmptyState variant="soft" title="Görüntülenecek sipariş bulunamadı" description="" icon={<FileSearch size={28} aria-hidden />} />
                  ) : (
                    <table className="cari-table">
                      <thead>
                        <tr>
                          <th>SİPARİŞ KODU</th>
                          <th>TARİH-SAAT</th>
                          <th>ÜRÜN ADI</th>
                          <th>ORGANİZASYON BİLGİLERİ</th>
                          <th>ADET</th>
                          <th>ÜRÜN FİYATI</th>
                          <th>TOPLAM TUTAR</th>
                          <th>İŞLEMLER</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAlinan.map((order) => {
                          const raw = (order as unknown) as Record<string, unknown>;
                          const tarih = order.tarih ?? order.olusturma_tarihi ?? raw.tarih ?? raw.created_at ?? raw.teslim_tarih ?? raw.olusturma_tarihi;
                          const urun = order.urun ?? order.siparis_urun ?? raw.siparis_urun ?? raw.urun ?? raw.urun_adi ?? '';
                          const urunGorsel = order.urun_gorsel ?? order.product_gorsel ?? (raw.urun_gorsel as string) ?? (raw.product_gorsel as string);
                          const adetVal = order.adet ?? order.miktar ?? raw.miktar ?? raw.adet ?? raw.quantity;
                          const adet = adetVal != null && adetVal !== '' ? String(adetVal) : '1';
                          const tutar = order.tutar ?? order.siparis_tutari ?? order.toplam_tutar ?? raw.siparis_tutari ?? raw.toplam_tutar ?? raw.tutar;
                          const fiyat = order.urun_fiyati ?? order.birim_fiyat ?? raw.birim_fiyat ?? raw.urun_fiyati ?? (tutar != null && Number(adet) > 0 ? Number(tutar) / Number(adet) : null);
                          const kartTurRaw = raw.organizasyon_kart_tur ?? ((order as unknown) as Record<string, unknown>).organizasyon_kart_tur ?? raw.kart_tur ?? raw.kart_turu;
                          const kartTur = normalizeKartTur(typeof kartTurRaw === 'string' ? kartTurRaw : String(raw.kart_tur_display ?? ((order as unknown) as Record<string, unknown>).kart_tur_display ?? ''));
                          const kartTurDisplay = (typeof ((order as unknown) as Record<string, unknown>).kart_tur_display === 'string' ? ((order as unknown) as Record<string, unknown>).kart_tur_display : null) ?? (typeof raw.kart_tur_display === 'string' ? raw.kart_tur_display : null) ?? getKartTurDisplay(kartTur);
                          const orgKart = (raw.organizasyon_kart ?? ((order as unknown) as Record<string, unknown>).organizasyon_kart) as Record<string, unknown> | undefined;
                          const altTurVal = orgKart?.alt_tur ?? orgKart?.organizasyon_alt_tur ?? raw.organizasyon_alt_tur ?? ((order as unknown) as Record<string, unknown>).organizasyon_alt_tur ?? raw.alt_tur ?? (order as unknown as Record<string, unknown>).alt_tur ?? raw.alt_tur_display ?? raw.alt_kart_tur ?? (order as unknown as Record<string, unknown>).kart_alt_tur ?? raw.kart_alt_tur ?? (order as unknown as Record<string, unknown>).alt_kart_tur ?? raw.organizasyon_alt_tur_display ?? raw.sub_tur ?? raw.alt_kart_turu;
                          let altTurStr = typeof altTurVal === 'string' ? altTurVal.trim() : (altTurVal != null ? String(altTurVal).trim() : '');
                          const displayForAlt = (typeof ((order as unknown) as Record<string, unknown>).kart_tur_display === 'string' ? ((order as unknown) as Record<string, unknown>).kart_tur_display : null) ?? (typeof raw.kart_tur_display === 'string' ? raw.kart_tur_display : null) ?? (orgKart?.kart_tur_display as string) ?? '';
                          if (!altTurStr && displayForAlt) {
                            const parts = String(displayForAlt).split(/\s*[-–—]\s*/);
                            if (parts.length > 1) altTurStr = parts.slice(1).join(' - ').trim();
                          }
                          const mahalleVal = orgKart?.mahalle ?? raw.mahalle ?? raw.organizasyon_mahalle ?? ((order as unknown) as Record<string, unknown>).organizasyon_mahalle ?? raw.teslim_mahalle;
                          const mahalleStr = typeof mahalleVal === 'string' ? mahalleVal.trim() : (mahalleVal != null ? String(mahalleVal).trim() : '');
                          const teslimatKonumu = raw.organizasyon_konum ?? ((order as unknown) as Record<string, unknown>).organizasyon_konum ?? raw.organizasyon_teslimat_konumu ?? raw.teslimat_adresi;
                          const teslimatKonumuStr = typeof teslimatKonumu === 'string' ? teslimatKonumu.trim() : (teslimatKonumu != null ? String(teslimatKonumu).trim() : '');
                          const orgSahibiStr = typeof (raw.organizasyon_sahibi ?? ((order as unknown) as Record<string, unknown>).organizasyon_sahibi) === 'string' ? String(raw.organizasyon_sahibi ?? ((order as unknown) as Record<string, unknown>).organizasyon_sahibi).trim() : '';
                          const teslimKisisiStr = typeof (raw.organizasyon_teslim_kisisi ?? ((order as unknown) as Record<string, unknown>).organizasyon_teslim_kisisi ?? raw.teslim_kisisi) === 'string' ? String(raw.organizasyon_teslim_kisisi ?? ((order as unknown) as Record<string, unknown>).organizasyon_teslim_kisisi ?? raw.teslim_kisisi).trim() : '';
                          let primaryKonum: string; let secondaryContent: string;
                          if (kartTur === 'aracsusleme') {
                            const aracParts = [(raw.arac_markamodel ?? ((order as unknown) as Record<string, unknown>).arac_markamodel), (raw.arac_renk ?? ((order as unknown) as Record<string, unknown>).arac_renk), (raw.arac_plaka ?? ((order as unknown) as Record<string, unknown>).arac_plaka)].filter(Boolean).map((x) => String(x).trim());
                            primaryKonum = aracParts.length ? aracParts.join(', ') : '—';
                            secondaryContent = typeof (raw.musteri_unvan ?? ((order as unknown) as Record<string, unknown>).musteri_unvan) === 'string' ? String(raw.musteri_unvan ?? ((order as unknown) as Record<string, unknown>).musteri_unvan).trim() : '—';
                          } else {
                            primaryKonum = teslimatKonumuStr || mahalleStr || '—';
                            secondaryContent = [orgSahibiStr, teslimKisisiStr].filter(Boolean).join(' · ') || '—';
                          }
                          const organizasyonKartId = (raw.organizasyon_kart_id ?? ((order as unknown) as Record<string, unknown>).organizasyon_kart_id) != null ? Number(raw.organizasyon_kart_id ?? ((order as unknown) as Record<string, unknown>).organizasyon_kart_id) : order.id;
                          return (
                            <tr key={order.id}>
                              <td data-label="Sipariş Kodu">{(order.siparis_kodu ?? raw.siparis_kodu) ? String(order.siparis_kodu ?? raw.siparis_kodu) : '—'}</td>
                              <td data-label="Tarih-Saat">{tarih ? new Date(String(tarih)).toLocaleString('tr-TR') : '—'}</td>
                              <td data-label="Ürün Adı">
                                <div className="cari-table-urun-cell">
                                  {urunGorsel ? (
                                    <img src={getUploadUrl(urunGorsel)} alt="" className="cari-table-urun-gorsel" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                  ) : (
                                    <span className="cari-table-urun-gorsel-placeholder" aria-hidden />
                                  )}
                                  <span className="cari-table-urun-adi">{urun != null && String(urun).trim() !== '' ? String(urun) : '—'}</span>
                                </div>
                              </td>
                              <td data-label="Organizasyon Bilgileri">
                                <div className={`cari-org-eski-yapi orgkart ${kartTur}`}>
                                  <div className="cari-org-badge-wrap">
                                    <span className="kart-tur">{String(kartTurDisplay ?? '')}</span>
                                    <span className="kart-alt-tur">{altTurStr || '—'}</span>
                                  </div>
                                  <div className="cari-org-icerik">
                                    <div className="cari-org-primary">{String(primaryKonum)}</div>
                                    <div className="cari-org-secondary">{String(secondaryContent)}</div>
                                  </div>
                                </div>
                              </td>
                              <td data-label="Adet">{adet}</td>
                              <td data-label="Ürün Fiyatı">{fiyat != null && !Number.isNaN(Number(fiyat)) ? `${Number(fiyat).toFixed(2)} TL` : (tutar != null ? `${Number(tutar).toFixed(2)} TL` : '—')}</td>
                              <td data-label="Toplam Tutar">{tutar != null ? formatCurrency(Number(tutar)) : '—'}</td>
                              <td data-label="İşlemler">
                                <div className="islem-ikonlar">
                                  <button type="button" className="islem-ikon" data-tooltip="Sipariş kart detayına git" aria-label="Sipariş kart detayına git" onClick={() => navigate(`/siparis-kart-detay/${organizasyonKartId}`)}>
                                    <Eye size={16} aria-hidden />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              {activeTab === 'verilen-siparisler' && (
                <>
                  {verilenLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <LoadingSpinner />
                    </div>
                  ) : !filteredVerilen?.length ? (
                    <EmptyState variant="soft" title="Görüntülenecek sipariş bulunamadı" description="" icon={<FileSearch size={28} aria-hidden />} />
                  ) : (
                    <table className="cari-table">
                      <thead>
                        <tr>
                          <th>SİPARİŞ KODU</th>
                          <th>TARİH-SAAT</th>
                          <th>ÜRÜN ADI</th>
                          <th>ORGANİZASYON BİLGİLERİ</th>
                          <th>ADET</th>
                          <th>ÜRÜN FİYATI</th>
                          <th>TOPLAM TUTAR</th>
                          <th>İŞLEMLER</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVerilen.map((order) => {
                          const raw = (order as unknown) as Record<string, unknown>;
                          const tarih = order.tarih ?? order.olusturma_tarihi ?? raw.tarih ?? raw.created_at ?? raw.teslim_tarih ?? raw.olusturma_tarihi;
                          const urun = order.urun ?? order.siparis_urun ?? raw.siparis_urun ?? raw.urun ?? raw.urun_adi ?? '';
                          const urunGorsel = order.urun_gorsel ?? order.product_gorsel ?? (raw.urun_gorsel as string) ?? (raw.product_gorsel as string);
                          const adetVal = order.adet ?? order.miktar ?? raw.miktar ?? raw.adet ?? raw.quantity;
                          const adet = adetVal != null && adetVal !== '' ? String(adetVal) : '1';
                          const tutar = order.tutar ?? order.siparis_tutari ?? order.toplam_tutar ?? raw.siparis_tutari ?? raw.toplam_tutar ?? raw.tutar;
                          const fiyat = order.urun_fiyati ?? order.birim_fiyat ?? raw.birim_fiyat ?? raw.urun_fiyati ?? (tutar != null && Number(adet) > 0 ? Number(tutar) / Number(adet) : null);
                          const kartTurRaw = raw.organizasyon_kart_tur ?? ((order as unknown) as Record<string, unknown>).organizasyon_kart_tur ?? raw.kart_tur ?? raw.kart_turu;
                          const kartTur = normalizeKartTur(typeof kartTurRaw === 'string' ? kartTurRaw : String(raw.kart_tur_display ?? ((order as unknown) as Record<string, unknown>).kart_tur_display ?? ''));
                          const kartTurDisplay = (typeof ((order as unknown) as Record<string, unknown>).kart_tur_display === 'string' ? ((order as unknown) as Record<string, unknown>).kart_tur_display : null) ?? (typeof raw.kart_tur_display === 'string' ? raw.kart_tur_display : null) ?? getKartTurDisplay(kartTur);
                          const orgKart = (raw.organizasyon_kart ?? ((order as unknown) as Record<string, unknown>).organizasyon_kart) as Record<string, unknown> | undefined;
                          const altTurVal = orgKart?.alt_tur ?? orgKart?.organizasyon_alt_tur ?? raw.organizasyon_alt_tur ?? ((order as unknown) as Record<string, unknown>).organizasyon_alt_tur ?? raw.alt_tur ?? (order as unknown as Record<string, unknown>).alt_tur ?? raw.alt_tur_display ?? raw.alt_kart_tur ?? (order as unknown as Record<string, unknown>).kart_alt_tur ?? raw.kart_alt_tur ?? (order as unknown as Record<string, unknown>).alt_kart_tur ?? raw.organizasyon_alt_tur_display ?? raw.sub_tur ?? raw.alt_kart_turu;
                          let altTurStr = typeof altTurVal === 'string' ? altTurVal.trim() : (altTurVal != null ? String(altTurVal).trim() : '');
                          const displayForAlt = (typeof ((order as unknown) as Record<string, unknown>).kart_tur_display === 'string' ? ((order as unknown) as Record<string, unknown>).kart_tur_display : null) ?? (typeof raw.kart_tur_display === 'string' ? raw.kart_tur_display : null) ?? (orgKart?.kart_tur_display as string) ?? '';
                          if (!altTurStr && displayForAlt) {
                            const parts = String(displayForAlt).split(/\s*[-–—]\s*/);
                            if (parts.length > 1) altTurStr = parts.slice(1).join(' - ').trim();
                          }
                          const mahalleVal = orgKart?.mahalle ?? raw.mahalle ?? raw.organizasyon_mahalle ?? ((order as unknown) as Record<string, unknown>).organizasyon_mahalle ?? raw.teslim_mahalle;
                          const mahalleStr = typeof mahalleVal === 'string' ? mahalleVal.trim() : (mahalleVal != null ? String(mahalleVal).trim() : '');
                          const teslimatKonumu = raw.organizasyon_konum ?? ((order as unknown) as Record<string, unknown>).organizasyon_konum ?? raw.organizasyon_teslimat_konumu ?? raw.teslimat_adresi;
                          const teslimatKonumuStr = typeof teslimatKonumu === 'string' ? teslimatKonumu.trim() : (teslimatKonumu != null ? String(teslimatKonumu).trim() : '');
                          const orgSahibiStr = typeof (raw.organizasyon_sahibi ?? ((order as unknown) as Record<string, unknown>).organizasyon_sahibi) === 'string' ? String(raw.organizasyon_sahibi ?? ((order as unknown) as Record<string, unknown>).organizasyon_sahibi).trim() : '';
                          const teslimKisisiStr = typeof (raw.organizasyon_teslim_kisisi ?? ((order as unknown) as Record<string, unknown>).organizasyon_teslim_kisisi ?? raw.teslim_kisisi) === 'string' ? String(raw.organizasyon_teslim_kisisi ?? ((order as unknown) as Record<string, unknown>).organizasyon_teslim_kisisi ?? raw.teslim_kisisi).trim() : '';
                          let primaryKonum: string; let secondaryContent: string;
                          if (kartTur === 'aracsusleme') {
                            const aracParts = [(raw.arac_markamodel ?? ((order as unknown) as Record<string, unknown>).arac_markamodel), (raw.arac_renk ?? ((order as unknown) as Record<string, unknown>).arac_renk), (raw.arac_plaka ?? ((order as unknown) as Record<string, unknown>).arac_plaka)].filter(Boolean).map((x) => String(x).trim());
                            primaryKonum = aracParts.length ? aracParts.join(', ') : '—';
                            secondaryContent = typeof (raw.musteri_unvan ?? ((order as unknown) as Record<string, unknown>).musteri_unvan) === 'string' ? String(raw.musteri_unvan ?? ((order as unknown) as Record<string, unknown>).musteri_unvan).trim() : '—';
                          } else {
                            primaryKonum = teslimatKonumuStr || mahalleStr || '—';
                            secondaryContent = [orgSahibiStr, teslimKisisiStr].filter(Boolean).join(' · ') || '—';
                          }
                          const organizasyonKartId = (raw.organizasyon_kart_id ?? ((order as unknown) as Record<string, unknown>).organizasyon_kart_id) != null ? Number(raw.organizasyon_kart_id ?? ((order as unknown) as Record<string, unknown>).organizasyon_kart_id) : order.id;
                          return (
                            <tr key={order.id}>
                              <td data-label="Sipariş Kodu">{(order.siparis_kodu ?? raw.siparis_kodu) ? String(order.siparis_kodu ?? raw.siparis_kodu) : '—'}</td>
                              <td data-label="Tarih-Saat">{tarih ? new Date(String(tarih)).toLocaleString('tr-TR') : '—'}</td>
                              <td data-label="Ürün Adı">
                                <div className="cari-table-urun-cell">
                                  {urunGorsel ? (
                                    <img src={getUploadUrl(urunGorsel)} alt="" className="cari-table-urun-gorsel" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                  ) : (
                                    <span className="cari-table-urun-gorsel-placeholder" aria-hidden />
                                  )}
                                  <span className="cari-table-urun-adi">{urun != null && String(urun).trim() !== '' ? String(urun) : '—'}</span>
                                </div>
                              </td>
                              <td data-label="Organizasyon Bilgileri">
                                <div className={`cari-org-eski-yapi orgkart ${kartTur}`}>
                                  <div className="cari-org-badge-wrap">
                                    <span className="kart-tur">{String(kartTurDisplay ?? '')}</span>
                                    <span className="kart-alt-tur">{altTurStr || '—'}</span>
                                  </div>
                                  <div className="cari-org-icerik">
                                    <div className="cari-org-primary">{String(primaryKonum)}</div>
                                    <div className="cari-org-secondary">{String(secondaryContent)}</div>
                                  </div>
                                </div>
                              </td>
                              <td data-label="Adet">{adet}</td>
                              <td data-label="Ürün Fiyatı">{fiyat != null && !Number.isNaN(Number(fiyat)) ? `${Number(fiyat).toFixed(2)} TL` : (tutar != null ? `${Number(tutar).toFixed(2)} TL` : '—')}</td>
                              <td data-label="Toplam Tutar">{tutar != null ? formatCurrency(Number(tutar)) : '—'}</td>
                              <td data-label="İşlemler">
                                <div className="islem-ikonlar">
                                  <button type="button" className="islem-ikon" data-tooltip="Sipariş kart detayına git" aria-label="Sipariş kart detayına git" onClick={() => navigate(`/siparis-kart-detay/${organizasyonKartId}`)}>
                                    <Eye size={16} aria-hidden />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              {activeTab === 'odeme-tahsilat' && (
                <>
                  {odemelerLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <LoadingSpinner />
                    </div>
                  ) : !filteredOdemeler?.length ? (
                    <EmptyState variant="soft" title="Görüntülenecek ödeme/tahsilat bulunamadı" description="" icon={<FileSearch size={28} aria-hidden />} />
                  ) : (
                    <table className="cari-table">
                      <thead>
                        <tr>
                          <th>İŞLEM TARİHİ & SAATİ</th>
                          <th className="cari-table-center">İŞLEM TÜRÜ</th>
                          <th className="cari-table-center">ÖDEME YÖNTEMİ</th>
                          <th className="cari-table-center">TUTAR</th>
                          <th>İŞLEM SORUMLUSU</th>
                          <th>AÇIKLAMA</th>
                          <th>İŞLEMLER</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOdemeler.map((o) => {
                          const row = (o as unknown) as Record<string, unknown>;
                          const d = getPayRowDisplay(row);
                          const tarihStr = d.transactionDate ? (() => { try { const date = new Date(d.transactionDate); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return '—'; } })() : '—';
                          const yontem = formatOdemeYontemiDisplay(d.paymentMethod);
                          return (
                          <tr key={String(row.id ?? o.id ?? Math.random())}>
                            <td data-label="İşlem Tarihi & Saati">{tarihStr}</td>
                            <td data-label="İşlem Türü" className="cari-table-center"><span className={String(d.transactionType).toLowerCase() === 'tahsilat' ? 'badge-turtahsilat' : 'badge-turodeme'}>{String(d.transactionType).toLowerCase() === 'tahsilat' ? 'TAHSİLAT' : 'ÖDEME'}</span></td>
                            <td data-label="Ödeme Yöntemi" className="cari-table-center">{yontem}</td>
                            <td data-label="Tutar" className="cari-table-center">{d.amount != null ? formatCurrency(Number(d.amount)) : '—'}</td>
                            <td data-label="İşlem Sorumlusu">{d.responsiblePerson.trim() || '—'}</td>
                            <td data-label="Açıklama">{d.aciklama.trim() || '(Açıklama Yok)'}</td>
                            <td data-label="İşlemler">
                              <div className="islem-ikonlar">
                                <button type="button" className="islem-ikon duzenle-ikon" data-tooltip="Düzenle" aria-label="Düzenle" onClick={() => { odemeFormDirtyRef.current = false; setEditingOdeme(o as PartnerOdeme); const amt = d.amount ?? row.amount ?? row.tutar ?? (o as PartnerOdeme).tutar ?? (o as PartnerOdeme).amount; setOdemeTutar(amt != null ? formatTLDisplayValue(Number(amt)) : ''); setOdemeDrawerOpen(true); }}>
                                  <Pencil size={16} aria-hidden />
                                </button>
                                <button type="button" className="islem-ikon sil-ikon" data-tooltip="Sil" aria-label="Sil" onClick={() => handlePartnerOdemeSil(o)}>
                                  <Trash2 size={16} aria-hidden />
                                </button>
                              </div>
                            </td>
                          </tr>
                          ); })}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {exportMenuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setExportMenuOpen(false)} />
      )}

      {odemeDrawerOpen &&
        createPortal(
          <div
            className="cari-drawer-overlay"
                  onClick={(e) => { if (e.target === e.currentTarget) requestCloseOdemeDrawer(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cari-odeme-title"
          >
            <div className="cari-drawer" onClick={(e) => e.stopPropagation()}>
              <div className="partner-modal-drawer-header">
                <h2 id="cari-odeme-title" className="partner-modal-drawer-title">
                  {editingOdeme ? 'Ödeme veya Tahsilat Düzenle' : 'Ödeme veya Tahsilat Ekle'}
                </h2>
                <button
                  type="button"
                  className="partner-modal-drawer-close"
                  onClick={requestCloseOdemeDrawer}
                  aria-label="Kapat"
                >
                  <X size={22} aria-hidden />
                </button>
              </div>
              <form
                ref={partnerOdemeFormRef}
                key={editingOdeme ? `edit-${editingOdeme.id}` : 'new'}
                className="partner-modal-drawer-body cari-drawer-form-musteri-stil"
                onSubmit={handlePartnerOdemeSubmit}
              >
                <div className="input-alan">
                  <div className="input-grup">
                    <label className="input-label">İŞLEM TARİHİ & SAATİ</label>
                    <input
                      type="datetime-local"
                      name="transaction_date"
                      required
                      defaultValue={editingOdeme ? formatDateTimeLocal(editingOdeme.transaction_date ?? editingOdeme.islem_tarihi_saati ?? editingOdeme.islem_tarihi) : formatDateTimeLocal(new Date().toISOString())}
                    />
                  </div>
                </div>
                <div className="input-alan">
                  <div className="input-grup">
                    <label className="input-label">İŞLEM TİPİ</label>
                    <select name="islem_tipi" required defaultValue={editingOdeme ? String(editingOdeme.transaction_type ?? '') : ''}>
                      <option value="">Seçin</option>
                      <option value="odeme">Ödeme</option>
                      <option value="tahsilat">Tahsilat</option>
                    </select>
                  </div>
                </div>
                <div className="input-alan">
                  <div className="input-grup">
                    <label className="input-label">ÖDEME YÖNTEMİ</label>
                    <select name="odeme" required defaultValue={normalizeOdemeYontemiForDb(editingOdeme?.odeme_yontemi ?? editingOdeme?.payment_method ?? '') || 'nakit'}>
                      <option value="">Seçin</option>
                      <option value="nakit">NAKİT</option>
                      <option value="havale_eft">HAVALE/EFT</option>
                      <option value="pos">POS</option>
                    </select>
                  </div>
                </div>
                <div className="input-alan">
                  <div className="input-grup">
                    <label className="input-label">TUTAR</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={odemeTutar}
                      onChange={(e) => { odemeFormDirtyRef.current = true; setOdemeTutar(formatTutarInputLive(e.target.value)); }}
                      onKeyDown={(e) => formatTutarInputKeyDown(e, odemeTutar)}
                      onBlur={() => setOdemeTutar(formatTLDisplayValue(parseTL(odemeTutar)))}
                      className="cari-drawer-tutar-input"
                      required
                      aria-label="Tutar"
                    />
                  </div>
                </div>
                <div className="input-alan">
                  <div className="input-grup">
                    <label className="input-label">İŞLEM SORUMLUSU</label>
                    <input
                      type="text"
                      name="responsible_person"
                      placeholder="İsim Soyisim"
                      required
                      defaultValue={editingOdeme ? (editingOdeme.odeme_yapan_kisi ?? editingOdeme.responsible_person ?? '') : ''}
                    />
                  </div>
                </div>
                <div className="input-alan">
                  <div className="input-grup">
                    <label className="input-label">AÇIKLAMA</label>
                    <textarea
                      name="description"
                      placeholder="Açıklama yazınız..."
                      rows={3}
                      defaultValue={editingOdeme ? (editingOdeme.aciklama ?? editingOdeme.description ?? '') : ''}
                    />
                  </div>
                </div>
                <div className="alt-alan">
                  <div className="butonlar">
                    <button
                      type="button"
                      className="secondary-button btn-vazgec"
                      onClick={requestCloseOdemeDrawer}
                    >
                      VAZGEÇ
                    </button>
                    <button type="submit" className="primary-button btn-kaydet">
                      KAYDET
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
