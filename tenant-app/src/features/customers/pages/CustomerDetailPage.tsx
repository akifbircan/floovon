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
import { formatTL, formatTLDisplayValue, parseTL, formatTutarInputLive, formatTutarInputKeyDown, formatPhoneNumber, cleanPhoneForDatabase, formatOdemeYontemiDisplay, normalizeOdemeYontemiForDb } from '../../../shared/utils/formatUtils';
import { formatDateTimeShort } from '../../../shared/utils/dateUtils';
import { getUploadUrl } from '../../../shared/utils/urlUtils';
import { SearchInput } from '../../../shared/components/SearchInput';
import { X, ArrowLeftCircle, Pencil, Trash2, FileDown, Mail, ListChecks, CircleDollarSign, Plus, XCircle, FileSearch, Eye, FileCheck, Send, Clock, FileText } from 'lucide-react';
import { getPrintLogoAndFooter, openPrintWindow, generateCariPrintHTMLWithHeader, downloadTableAsExcel, getPrintDateDDMMYYYY } from '../../dashboard/utils/exportUtils';
import { invalidateCustomerCariQueries } from '../../../lib/invalidateQueries';
import { getApiBaseUrl } from '../../../lib/runtime';

interface CustomerDetail {
  id: number;
  musteri_kodu?: string;
  musteri_unvani?: string;
  musteri_ad_soyad?: string;
  musteri_telefon?: string;
  musteri_eposta?: string;
  musteri_acik_adres?: string;
  musteri_tipi?: string;
  toplam_siparis?: number;
  orderCount?: number;
  toplam_tutar?: number;
  bakiye?: number;
  son_siparis_tarihi?: string;
  kayit_tarihi?: string;
  created_at?: string;
}

interface CustomerOrder {
  id: number;
  tarih?: string;
  durum?: string;
  tutar?: number;
  urun?: string;
  adet?: number;
  urun_fiyati?: number;
  fatura_no?: string;
  fatura_durumu?: string;
  siparis_kodu?: string;
  olusturma_tarihi?: string;
  siparis_urun?: string;
  siparis_tutari?: number;
  toplam_tutar?: number;
  miktar?: number;
  birim_fiyat?: number;
  fatura_durumu_text?: string;
  urun_gorsel?: string;
  product_gorsel?: string;
  organizasyon_kart_etiket?: string;
  organizasyon_konum?: string;
  organizasyon_teslim_tarih?: string;
  organizasyon_kart_id?: number;
  organizasyon_kart_tur?: string;
  organizasyon_alt_tur?: string;
  kart_tur?: string;
  kart_turu?: string;
  kart_tur_display?: string;
  alt_tur?: string;
  organizasyon_sahibi?: string;
  organizasyon_teslim_kisisi?: string;
  teslim_kisisi?: string;
  acik_adres?: string;
  teslimat_adresi?: string;
  mahalle?: string;
  teslim_mahalle?: string;
  organizasyon_mahalle?: string;
  kart_alt_tur?: string;
  alt_kart_tur?: string;
  organizasyon_kart?: Record<string, unknown>;
  [key: string]: unknown;
}

interface Tahsilat {
  id: number;
  islem_tarihi?: string;
  islem_tarihi_saati?: string;
  islem_saati?: string;
  odeme_yontemi?: string;
  tutar?: number;
  tahsil_edilen_tutar?: number;
  odeme_yapan_kisi?: string;
  tahsilat_yapan_kisi?: string;
  aciklama?: string;
  makbuz_no?: string;
  tahsilat_makbuz_no?: string;
  durum?: string;
}

interface Fatura {
  id: number;
  fatura_no: string;
  tarih?: string;
  fatura_tarihi?: string;
  tutar: number;
  kdv?: number;
  kdv_tutari?: number;
  genel_toplam: number;
  durum: string;
  siparisler?: number[];
  siparis_idler?: string;
}

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

/** Tahsilat satırından alan değeri al (API/DB farklı key isimleri veya casing için) */
function getTahsilatField(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  for (const [k, v] of Object.entries(row)) {
    if (v != null && String(v).trim() !== '' && keys.some((key) => key.toLowerCase() === k.toLowerCase())) return String(v).trim();
  }
  return '';
}

/** Tahsilat/fatura durum: kesildi → Kesildi, iptal → İptal vb. */
function formatDurumDisplay(val: string | undefined | null): string {
  if (val == null || String(val).trim() === '') return '—';
  const v = String(val).toLowerCase().trim();
  if (v === 'kesildi') return 'Kesildi';
  if (v === 'iptal') return 'İptal';
  if (v === 'gonderildi') return 'Gönderildi';
  if (v === 'ödendi' || v === 'odendi') return 'Ödendi';
  if (v === 'beklemede') return 'Beklemede';
  return val.trim().charAt(0).toUpperCase() + val.trim().slice(1).toLowerCase();
}

/**
 * Müşteri Cari Hesap – Sol 25% (bilgi + özet), Sağ 75% (tablar tablo üstünde), Tahsilat formu sağdan drawer
 */
export const CustomerDetailPage: React.FC = () => {
  usePageAnimations('customers');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'siparisler' | 'tahsilatlar' | 'faturalar'>('siparisler');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [tahsilatDrawerOpen, setTahsilatDrawerOpen] = useState(false);
  const [tahsilatTutar, setTahsilatTutar] = useState('');
  const [editingTahsilat, setEditingTahsilat] = useState<Tahsilat | null>(null);
  const [tahsilatForFatura, setTahsilatForFatura] = useState<Fatura | null>(null);
  const [faturaDurumModal, setFaturaDurumModal] = useState<Fatura | null>(null);
  const [faturaKesOrder, setFaturaKesOrder] = useState<CustomerOrder | null>(null);
  const [topluFaturaKesOpen, setTopluFaturaKesOpen] = useState(false);
  const [topluFaturaSecilenIds, setTopluFaturaSecilenIds] = useState<number[]>([]);
  const [tableSearchByTab, setTableSearchByTab] = useState<Record<'siparisler' | 'tahsilatlar' | 'faturalar', string>>({
    siparisler: '',
    tahsilatlar: '',
    faturalar: '',
  });
  const tahsilatFormRef = useRef<HTMLFormElement>(null);
  const tahsilatFormDirtyRef = useRef(false);

  useEffect(() => {
    if (!faturaDurumModal) return;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('.fatura-durum-dropdown') || t.closest('.fatura-status-ikon')) return;
      setFaturaDurumModal(null);
    };
    document.addEventListener('click', close, true);
    return () => document.removeEventListener('click', close, true);
  }, [faturaDurumModal]);

  useEffect(() => {
    if (!tahsilatDrawerOpen) return;
    const form = tahsilatFormRef.current;
    if (!form) return;
    const markDirty = () => { tahsilatFormDirtyRef.current = true; };
    form.addEventListener('input', markDirty);
    form.addEventListener('change', markDirty);
    return () => {
      form.removeEventListener('input', markDirty);
      form.removeEventListener('change', markDirty);
    };
  }, [tahsilatDrawerOpen]);

  const handleExport = async (type: 'excel' | 'print') => {
    if (type === 'excel') {
      try {
        let data: Record<string, unknown>[] = [];
        const unvan = (customer?.musteri_unvani || customer?.musteri_ad_soyad || 'Cari').replace(/[^\w\u00C0-\u024F\s\-]/gi, '');
        const tabLabel = activeTab === 'siparisler' ? 'Siparisler' : activeTab === 'tahsilatlar' ? 'Tahsilatlar' : 'Faturalar';
        if (activeTab === 'siparisler' && filteredOrders?.length) {
          data = (filteredOrders as CustomerOrder[]).map((o) => {
            const raw = (o as unknown) as Record<string, unknown>;
            const t = o.tarih ?? o.olusturma_tarihi ?? raw.created_at;
            const urun = o.urun ?? o.siparis_urun ?? raw.siparis_urun ?? '';
            const adet = o.adet ?? o.miktar ?? raw.miktar ?? raw.adet ?? '1';
            const tutar = o.tutar ?? o.siparis_tutari ?? o.toplam_tutar ?? raw.siparis_tutari ?? raw.toplam_tutar ?? raw.tutar;
            return { 'Sipariş Kodu': o.siparis_kodu ?? raw.siparis_kodu ?? '', Tarih: t ? new Date(String(t)).toLocaleString('tr-TR') : '', Ürün: String(urun), Adet: adet, 'Toplam Tutar': tutar != null ? Number(tutar) : '', 'Fatura Durumu': o.fatura_durumu ?? o.fatura_durumu_text ?? raw.fatura_durumu ?? '' };
          });
        } else if (activeTab === 'tahsilatlar' && filteredTahsilatlar?.length) {
          data = (filteredTahsilatlar as Tahsilat[]).map((t) => {
            const tr = (t as unknown) as Record<string, unknown>;
            const islemTarihi = t.islem_tarihi ?? t.islem_tarihi_saati;
            const tutar = t.tutar ?? tr.tahsil_edilen_tutar ?? tr.amount;
            return { 'İşlem Tarihi': islemTarihi ? new Date(String(islemTarihi)).toLocaleString('tr-TR') : '', 'Ödeme Yöntemi': t.odeme_yontemi ?? tr.payment_method ?? '', Tutar: tutar != null ? Number(tutar) : '', 'Ödeme Yapan': t.odeme_yapan_kisi ?? '', Açıklama: t.aciklama ?? '', 'Makbuz No': t.makbuz_no ?? t.tahsilat_makbuz_no ?? '' };
          });
        } else if (activeTab === 'faturalar' && filteredFaturalar?.length) {
          data = (filteredFaturalar as Fatura[]).map((f) => {
            const fr = (f as unknown) as Record<string, unknown>;
            const tutar = f.tutar ?? (fr.toplam_tutar as number);
            const genelToplam = f.genel_toplam ?? fr.genel_toplam ?? tutar;
            return { 'Fatura No': f.fatura_no ?? '', Tarih: f.fatura_tarihi ? new Date(String(f.fatura_tarihi)).toLocaleDateString('tr-TR') : '', Tutar: tutar != null ? Number(tutar) : '', KDV: f.kdv ?? fr.kdv_orani ?? '', 'Genel Toplam': genelToplam != null ? Number(genelToplam) : '', Durum: f.durum ?? '' };
          });
        }
        if (data.length === 0) {
          showToast('warning', 'Dışa aktarılacak veri yok. Önce listeyi görüntüleyin.');
          setExportMenuOpen(false);
          return;
        }
        downloadTableAsExcel(data, `Musteri-Cari-${unvan}-${tabLabel}`);
        showToast('success', 'Excel dosyası indirildi.');
      } catch (e: any) {
        showToast('error', e?.message ?? 'Excel dışa aktarılamadı.');
      }
    } else {
      try {
        const { logoMarkup, footerHtml } = await getPrintLogoAndFooter();
        const unvan = customer?.musteri_unvani || customer?.musteri_ad_soyad || '';
        const yetkiliStr = customer?.musteri_ad_soyad && customer?.musteri_unvani ? customer.musteri_ad_soyad : (customer?.musteri_ad_soyad || customer?.musteri_unvani || '');
        const telefonStr = customer?.musteri_telefon ? formatPhoneNumber(customer.musteri_telefon) : '';
        const docTitle = unvan ? `Cari – ${unvan}` : 'Cari Hesap Dökümü';
        let rows = '';
        let tableHeaders = '';
        const badgeLabelMusteri = activeTab === 'siparisler' ? 'MÜŞTERİ > CARİ HESAP DÖKÜMÜ > SİPARİŞLER' : activeTab === 'tahsilatlar' ? 'MÜŞTERİ > CARİ HESAP DÖKÜMÜ > TAHSİLATLAR' : 'MÜŞTERİ > CARİ HESAP DÖKÜMÜ > FATURALAR';
        if (activeTab === 'siparisler' && filteredOrders?.length) {
          tableHeaders = '<tr><th>Sipariş Kodu</th><th>Tarih</th><th>Ürün</th><th>Organizasyon Bilgileri</th><th>Adet</th><th>Ürün Fiyatı</th><th>Toplam Tutar</th><th>Fatura Bilgileri</th><th>Fatura Durumu</th></tr>';
          rows = (filteredOrders as CustomerOrder[]).map((o) => {
            const raw = (o as unknown) as Record<string, unknown>;
            const t = o.tarih ?? o.olusturma_tarihi ?? raw.created_at;
            const urun = o.urun ?? o.siparis_urun ?? raw.siparis_urun ?? '';
            const adet = o.adet ?? o.miktar ?? raw.miktar ?? raw.adet ?? '1';
            const tutar = o.tutar ?? o.siparis_tutari ?? o.toplam_tutar ?? raw.siparis_tutari ?? raw.toplam_tutar ?? raw.tutar;
            const fiyat = o.urun_fiyati ?? o.birim_fiyat ?? raw.birim_fiyat ?? raw.urun_fiyati ?? (tutar != null && Number(adet) > 0 ? Number(tutar) / Number(adet) : null);
            const orderIdStr = String(o.id);
            const kesildiFromFatura = faturalar?.some((f) => (f.durum || '').toLowerCase() !== 'iptal' && (f.siparis_idler || '').split(',').map((x: string) => x.trim()).filter(Boolean).includes(orderIdStr));
            const durum = o.fatura_durumu ?? o.fatura_durumu_text ?? raw.fatura_durumu ?? ((o.fatura_no ?? raw.fatura_no) || kesildiFromFatura ? 'Kesildi' : 'Kesilmedi');
            const kartTurRaw = raw.organizasyon_kart_tur ?? o.organizasyon_kart_tur ?? raw.kart_tur ?? raw.kart_turu;
            const kartTur = normalizeKartTur(typeof kartTurRaw === 'string' ? kartTurRaw : String(raw.kart_tur_display ?? o.kart_tur_display ?? ''));
            const kartTurDisplay = (typeof o.kart_tur_display === 'string' ? o.kart_tur_display : null) ?? (typeof raw.kart_tur_display === 'string' ? raw.kart_tur_display : null) ?? getKartTurDisplay(kartTur);
            const altTurVal = raw.organizasyon_alt_tur ?? o.organizasyon_alt_tur ?? raw.alt_tur ?? raw.alt_kart_tur ?? raw.kart_alt_tur;
            let altTurStr = typeof altTurVal === 'string' ? altTurVal.trim() : (altTurVal != null ? String(altTurVal).trim() : '');
            const displayForAlt = (o.kart_tur_display ?? raw.kart_tur_display) as string | undefined;
            if (!altTurStr && displayForAlt) { const parts = String(displayForAlt).split(/\s*[-–—]\s*/); if (parts.length > 1) altTurStr = parts.slice(1).join(' - ').trim(); }
            const mahalleVal = raw.mahalle ?? o.mahalle ?? raw.organizasyon_mahalle ?? raw.teslim_mahalle;
            const mahalleStr = typeof mahalleVal === 'string' ? mahalleVal.trim() : (mahalleVal != null ? String(mahalleVal).trim() : '');
            const teslimatKonumu = raw.organizasyon_konum ?? o.organizasyon_konum ?? raw.organizasyon_teslimat_konumu ?? raw.teslimat_adresi;
            const teslimatKonumuStr = typeof teslimatKonumu === 'string' ? teslimatKonumu.trim() : (teslimatKonumu != null ? String(teslimatKonumu).trim() : '');
            const orgSahibiStr = typeof (raw.organizasyon_sahibi ?? o.organizasyon_sahibi) === 'string' ? String(raw.organizasyon_sahibi ?? o.organizasyon_sahibi).trim() : '';
            const teslimKisisiStr = typeof (raw.organizasyon_teslim_kisisi ?? o.organizasyon_teslim_kisisi ?? raw.teslim_kisisi) === 'string' ? String(raw.organizasyon_teslim_kisisi ?? o.organizasyon_teslim_kisisi ?? raw.teslim_kisisi).trim() : '';
            let primaryKonum: string; let secondaryContent: string;
            if (kartTur === 'aracsusleme') {
              const aracParts = [(raw.arac_markamodel ?? o.arac_markamodel), (raw.arac_renk ?? o.arac_renk), (raw.arac_plaka ?? o.arac_plaka)].filter(Boolean).map((x) => String(x).trim());
              primaryKonum = aracParts.length ? aracParts.join(', ') : '—';
              secondaryContent = typeof (raw.musteri_unvan ?? o.musteri_unvan) === 'string' ? String(raw.musteri_unvan ?? o.musteri_unvan).trim() : '—';
            } else {
              primaryKonum = teslimatKonumuStr || mahalleStr || '—';
              secondaryContent = [orgSahibiStr, teslimKisisiStr].filter(Boolean).join(' · ') || '—';
            }
            const orgParts = [kartTurDisplay, altTurStr || null, primaryKonum, secondaryContent].filter(Boolean);
            const orgCell = orgParts.length ? orgParts.join('<br>') : '—';
            const faturaNoPrint = o.fatura_no ?? raw.fatura_no ?? raw.fatura_kodu ?? (kesildiFromFatura ? 'Kesildi' : '—');
            const siparisKoduPrint = (o.siparis_kodu ?? raw.siparis_kodu) != null ? String(o.siparis_kodu ?? raw.siparis_kodu) : '—';
            return `<tr><td>${siparisKoduPrint}</td><td>${t ? new Date(String(t)).toLocaleString('tr-TR') : '—'}</td><td>${String(urun)}</td><td class="print-org-cell">${orgCell}</td><td>${adet}</td><td>${fiyat != null && !Number.isNaN(Number(fiyat)) ? Number(fiyat).toFixed(2) : '—'} TL</td><td>${tutar != null ? Number(tutar).toFixed(2) : '—'} TL</td><td>${faturaNoPrint}</td><td>${String(durum)}</td></tr>`;
          }).join('');
        } else if (activeTab === 'tahsilatlar' && filteredTahsilatlar?.length) {
          tableHeaders = '<tr><th>İşlem Tarihi</th><th>Ödeme Yöntemi</th><th>Tutar</th><th>Ödeme Yapan</th><th>Açıklama</th><th>Makbuz No</th></tr>';
          rows = (filteredTahsilatlar as Tahsilat[]).map((t) => {
            const tr = (t as unknown) as Record<string, unknown>;
            const islemTarihi = t.islem_tarihi ?? t.islem_tarihi_saati;
            const tutar = t.tutar ?? tr.tahsil_edilen_tutar ?? tr.amount;
            return `<tr><td>${islemTarihi ? new Date(String(islemTarihi)).toLocaleString('tr-TR') : '—'}</td><td>${t.odeme_yontemi ?? tr.payment_method ?? '—'}</td><td>${tutar != null ? Number(tutar).toFixed(2) : '—'} TL</td><td>${t.odeme_yapan_kisi ?? '—'}</td><td>${t.aciklama ?? '—'}</td><td>${t.makbuz_no ?? t.tahsilat_makbuz_no ?? '—'}</td></tr>`;
          }).join('');
        } else if (activeTab === 'faturalar' && filteredFaturalar?.length) {
          tableHeaders = '<tr><th>Fatura No</th><th>Tarih</th><th>Tutar</th><th>KDV</th><th>Genel Toplam</th><th>Durum</th></tr>';
          rows = (filteredFaturalar as Fatura[]).map((f) => {
            const fr = (f as unknown) as Record<string, unknown>;
            const tutar = f.tutar ?? (fr.toplam_tutar as number);
            const kdvDisplay = f.kdv != null ? f.kdv : (fr.kdv_orani as string | number);
            const genelToplam = f.genel_toplam ?? fr.genel_toplam ?? tutar;
            return `<tr><td>${f.fatura_no ?? '—'}</td><td>${f.fatura_tarihi ? new Date(String(f.fatura_tarihi)).toLocaleDateString('tr-TR') : '—'}</td><td>${tutar != null ? Number(tutar).toFixed(2) : '—'} TL</td><td>${kdvDisplay != null ? String(kdvDisplay) : '—'}</td><td>${genelToplam != null ? Number(genelToplam).toFixed(2) : '—'} TL</td><td>${f.durum ?? '—'}</td></tr>`;
          }).join('');
        }
        if (!rows) {
          showToast('warning', 'Yazdırılacak veri bulunamadı. Önce listeyi görüntüleyin.');
          setExportMenuOpen(false);
          return;
        }
        const tableContent = `<table><thead>${tableHeaders}</thead><tbody>${rows}</tbody></table>`;
        const html = generateCariPrintHTMLWithHeader(
          { badgeLabel: badgeLabelMusteri, unvan, yetkili: yetkiliStr, telefon: telefonStr, eposta: customer?.musteri_eposta ?? '', currentDate: getPrintDateDDMMYYYY(), footerHtml },
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

  const { data: customer, isLoading: customerLoading, error: customerError } = useQuery({
    queryKey: ['customer-detail', id],
    queryFn: async () => {
      try {
        return await apiRequest<CustomerDetail>(`/customers/${id}`, { method: 'GET' });
      } catch (err) {
        console.error('Müşteri detay yükleme hatası:', err);
        throw err;
      }
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const { data: cariOzet } = useQuery({
    queryKey: ['customer-cari-ozet', id],
    queryFn: async () => {
      try {
        return await apiRequest<{
          toplam_alacak: number;
          toplam_tahsilat: number;
          bakiye: number;
        }>(`/customers/${id}/cari-ozet`, { method: 'GET' });
      } catch (err) {
        return { toplam_alacak: 0, toplam_tahsilat: 0, bakiye: 0 };
      }
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['customer-orders', id],
    queryFn: async () => {
      try {
        const result = await apiRequest<CustomerOrder[] | { data?: CustomerOrder[] }>(`/customers/${id}/siparisler?includeFaturaKesilmis=true`, { method: 'GET' });
        if (Array.isArray(result)) return result;
        if (result && typeof result === 'object' && 'data' in result && Array.isArray((result as { data: CustomerOrder[] }).data)) return (result as { data: CustomerOrder[] }).data;
        return [];
      } catch (err) {
        return [];
      }
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const { data: tahsilatlar, isLoading: tahsilatlarLoading } = useQuery({
    queryKey: ['customer-tahsilatlar', id],
    queryFn: async () => {
      try {
        const result = await apiRequest<Tahsilat[] | { data?: Tahsilat[] }>(`/customers/${id}/tahsilatlar`, { method: 'GET' });
        if (Array.isArray(result)) return result;
        if (result && typeof result === 'object' && 'data' in result && Array.isArray((result as { data: Tahsilat[] }).data)) return (result as { data: Tahsilat[] }).data;
        return [];
      } catch (err) {
        return [];
      }
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const { data: faturalar, isLoading: faturalarLoading } = useQuery({
    queryKey: ['customer-faturalar', id],
    queryFn: async () => {
      try {
        const result = await apiRequest<Fatura[] | { data?: Fatura[] }>(`/customers/${id}/faturalar`, { method: 'GET' });
        if (Array.isArray(result)) return result;
        if (result && typeof result === 'object' && 'data' in result && Array.isArray((result as { data: Fatura[] }).data)) return (result as { data: Fatura[] }).data;
        return [];
      } catch (err) {
        return [];
      }
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const searchLowerSiparisler = (tableSearchByTab.siparisler || '').trim().toLowerCase();
  const filteredOrders = useMemo(() => {
    if (!orders?.length) return [];
    if (!searchLowerSiparisler) return orders;
    return orders.filter((o) => {
      const raw = o as Record<string, unknown>;
      const orgKart = (raw.organizasyon_kart ?? o.organizasyon_kart) as Record<string, unknown> | undefined;
      const siparisKodu = String(o.siparis_kodu ?? raw.siparis_kodu ?? '').toLowerCase();
      const urun = String(o.urun ?? o.siparis_urun ?? raw.siparis_urun ?? '').toLowerCase();
      const faturaNo = String(o.fatura_no ?? raw.fatura_no ?? '').toLowerCase();
      const idStr = String(o.id ?? '').toLowerCase();
      const orgEtiket = String(raw.organizasyon_kart_etiket ?? orgKart?.organizasyon_kart_etiket ?? orgKart?.kart_etiket ?? '').toLowerCase();
      const konumVal = raw.organizasyon_konum ?? o.organizasyon_konum ?? orgKart?.organizasyon_konum ?? raw.organizasyon_teslimat_konumu ?? raw.teslimat_adresi ?? raw.acik_adres ?? '';
      const org = [orgEtiket, String(konumVal).toLowerCase()].join(' ');
      const tarih = (o.tarih ?? o.olusturma_tarihi ?? raw.created_at ?? raw.teslim_tarih ?? raw.organizasyon_teslim_tarih) ? new Date(String(o.tarih ?? o.olusturma_tarihi ?? raw.created_at ?? raw.teslim_tarih ?? raw.organizasyon_teslim_tarih)).toLocaleString('tr-TR').toLowerCase() : '';
      const adetStr = String(o.adet ?? o.miktar ?? raw.miktar ?? raw.adet ?? raw.quantity ?? '').toLowerCase();
      const tutarVal = o.tutar ?? o.siparis_tutari ?? o.toplam_tutar ?? raw.siparis_tutari ?? raw.toplam_tutar ?? raw.tutar;
      const tutarStr = tutarVal != null ? String(tutarVal).toLowerCase() : '';
      const fiyatVal = o.urun_fiyati ?? o.birim_fiyat ?? raw.birim_fiyat ?? raw.urun_fiyati;
      const fiyatStr = fiyatVal != null ? String(fiyatVal).toLowerCase() : '';
      const kartTurRaw = raw.organizasyon_kart_tur ?? o.organizasyon_kart_tur ?? orgKart?.organizasyon_kart_tur ?? orgKart?.kart_tur ?? raw.kart_tur ?? raw.kart_turu;
      const kartTurStr = String(kartTurRaw ?? '').toLowerCase();
      const altTurVal = orgKart?.alt_tur ?? orgKart?.organizasyon_alt_tur ?? raw.organizasyon_alt_tur ?? o.organizasyon_alt_tur ?? raw.alt_tur ?? raw.alt_tur_display ?? raw.alt_kart_tur ?? raw.kart_alt_tur ?? raw.organizasyon_alt_tur_display ?? raw.sub_tur ?? raw.alt_kart_turu;
      const altTurStr = String(altTurVal ?? '').toLowerCase();
      const konum = String(konumVal).toLowerCase();
      const mahalle = String(raw.mahalle ?? o.mahalle ?? raw.organizasyon_mahalle ?? raw.teslim_mahalle ?? orgKart?.mahalle ?? '').toLowerCase();
      const il = String(raw.organizasyon_il ?? o.organizasyon_il ?? raw.teslim_il ?? orgKart?.organizasyon_il ?? '').toLowerCase();
      const ilce = String(raw.organizasyon_ilce ?? o.organizasyon_ilce ?? raw.teslim_ilce ?? orgKart?.organizasyon_ilce ?? '').toLowerCase();
      const sahip = String(raw.organizasyon_sahibi ?? o.organizasyon_sahibi ?? raw.organizasyon_sahip ?? orgKart?.organizasyon_sahip ?? '').toLowerCase();
      const teslimKisi = String(raw.organizasyon_teslim_kisisi ?? o.organizasyon_teslim_kisisi ?? raw.teslim_kisisi ?? orgKart?.organizasyon_teslim_kisisi ?? '').toLowerCase();
      const aracMarka = String(raw.arac_markamodel ?? o.arac_markamodel ?? '').toLowerCase();
      const aracRenk = String(raw.arac_renk ?? o.arac_renk ?? '').toLowerCase();
      const aracPlaka = String(raw.arac_plaka ?? o.arac_plaka ?? '').toLowerCase();
      const musteriUnvan = String(raw.musteri_unvan ?? o.musteri_unvan ?? raw.musteri_unvani ?? o.musteri_unvani ?? '').toLowerCase();
      const orderIdStr = String(o.id);
      const kesildiFromFatura = faturalar?.some((f) => (f.durum || '').toLowerCase() !== 'iptal' && (f.siparis_idler || '').split(',').map((x: string) => x.trim()).filter(Boolean).includes(orderIdStr));
      const durumStr = String(o.fatura_durumu ?? o.fatura_durumu_text ?? raw.fatura_durumu ?? ((o.fatura_no ?? raw.fatura_no) || kesildiFromFatura ? 'Kesildi' : 'Kesilmedi')).toLowerCase();
      const combined = [siparisKodu, urun, faturaNo, idStr, org, tarih, adetStr, tutarStr, fiyatStr, kartTurStr, altTurStr, konum, mahalle, il, ilce, sahip, teslimKisi, aracMarka, aracRenk, aracPlaka, musteriUnvan, durumStr].join(' ');
      return combined.includes(searchLowerSiparisler);
    });
  }, [orders, searchLowerSiparisler, faturalar]);
  const searchLowerTahsilatlar = (tableSearchByTab.tahsilatlar || '').trim().toLowerCase();
  const filteredTahsilatlar = useMemo(() => {
    if (!tahsilatlar?.length) return [];
    if (!searchLowerTahsilatlar) return tahsilatlar;
    return tahsilatlar.filter((t) => {
      const tr = t as unknown as Record<string, unknown>;
      const islemTarihi = String(t.islem_tarihi ?? t.islem_tarihi_saati ?? tr.transaction_date ?? tr.islem_tarihi_saati ?? '').toLowerCase();
      const islemSaati = String(t.islem_saati ?? tr.islem_saati ?? '').toLowerCase();
      const yontem = String(t.odeme_yontemi ?? tr.payment_method ?? tr.odeme_yontemi ?? '').toLowerCase();
      const kisi = String(t.odeme_yapan_kisi ?? tr.odeme_yapan_kisi ?? '').toLowerCase();
      const tahsilatYapan = String(t.tahsilat_yapan_kisi ?? tr.tahsilat_yapan_kisi ?? '').toLowerCase();
      const aciklama = String(t.aciklama ?? tr.aciklama ?? '').toLowerCase();
      const makbuz = String(t.makbuz_no ?? t.tahsilat_makbuz_no ?? tr.makbuz_no ?? tr.tahsilat_makbuz_no ?? '').toLowerCase();
      const tutarStr = (t.tutar ?? t.tahsil_edilen_tutar ?? tr.amount ?? tr.tahsil_edilen_tutar ?? '').toString().toLowerCase();
      const durumStr = String((tr as { durum?: string }).durum ?? t.durum ?? '').toLowerCase();
      const idStr = String(t.id ?? '').toLowerCase();
      const combined = [islemTarihi, islemSaati, yontem, kisi, tahsilatYapan, aciklama, makbuz, tutarStr, durumStr, idStr].join(' ');
      return combined.includes(searchLowerTahsilatlar);
    });
  }, [tahsilatlar, searchLowerTahsilatlar]);
  const searchLowerFaturalar = (tableSearchByTab.faturalar || '').trim().toLowerCase();
  const filteredFaturalar = useMemo(() => {
    if (!faturalar?.length) return [];
    if (!searchLowerFaturalar) return faturalar;
    return faturalar.filter((f) => {
      const fr = f as unknown as Record<string, unknown>;
      const no = String(f.fatura_no ?? fr.fatura_no ?? '').toLowerCase();
      const tutarStr = String(f.tutar ?? fr.tutar ?? '').toLowerCase();
      const genelStr = String(f.genel_toplam ?? fr.genel_toplam ?? '').toLowerCase();
      const durum = String(f.durum ?? fr.durum ?? '').toLowerCase();
      const tarihVal = f.fatura_tarihi ?? f.tarih ?? fr.fatura_tarihi ?? fr.tarih;
      const tarihStr = tarihVal ? new Date(String(tarihVal)).toLocaleDateString('tr-TR').toLowerCase() : '';
      const kdvStr = String(f.kdv ?? fr.kdv ?? fr.kdv_tutari ?? fr.kdv_orani ?? '').toLowerCase();
      const siparisIdlerRaw = f.siparisler ?? fr.siparis_idler ?? fr.siparis_idler ?? '';
      const siparisIdlerStr = typeof siparisIdlerRaw === 'string' ? siparisIdlerRaw : Array.isArray(siparisIdlerRaw) ? siparisIdlerRaw.join(' ') : String(siparisIdlerRaw);
      const idStr = String(f.id ?? '').toLowerCase();
      const combined = [no, tutarStr, genelStr, durum, tarihStr, kdvStr, siparisIdlerStr.toLowerCase(), idStr].join(' ');
      return combined.includes(searchLowerFaturalar);
    });
  }, [faturalar, searchLowerFaturalar]);

  const faturaKesilmisSiparisIdleri = useMemo(() => {
    const set = new Set<string>();
    (faturalar ?? []).forEach((f) => {
      if ((f.durum || '').toLowerCase() === 'iptal') return;
      const raw = (f.siparis_idler ?? (f as unknown as Record<string, unknown>).siparis_idler ?? '') as string;
      raw.split(',').map((x: string) => x.trim()).filter(Boolean).forEach((sid) => set.add(sid));
    });
    return set;
  }, [faturalar]);

  const ordersWithoutFatura = useMemo(() => {
    if (!orders?.length) return [];
    return orders.filter((o) => !faturaKesilmisSiparisIdleri.has(String(o.id)));
  }, [orders, faturaKesilmisSiparisIdleri]);

  if (customerLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (customerError || !customer) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ErrorState
          title="Müşteri bulunamadı"
          message={customerError instanceof Error ? customerError.message : 'Müşteri detayları yüklenemedi'}
        />
      </div>
    );
  }

  const toplamAlacak = cariOzet?.toplam_alacak ?? customer.toplam_tutar ?? 0;
  const toplamTahsilat = cariOzet?.toplam_tahsilat ?? 0;
  const bakiye = cariOzet?.bakiye ?? customer.bakiye ?? 0;
  const unvan = customer.musteri_unvani || customer.musteri_ad_soyad || `Müşteri #${customer.id}`;
  const yetkili = customer.musteri_ad_soyad && customer.musteri_unvani ? customer.musteri_ad_soyad : (customer.musteri_ad_soyad || customer.musteri_unvani || '—');

  const formatCurrency = (n: number | undefined | null): string => {
    if (n === undefined || n === null || Number.isNaN(Number(n))) return '—';
    return formatTL(n);
  };

  const openTahsilatDrawerForAdd = () => {
    setEditingTahsilat(null);
    setTahsilatTutar('');
    setTahsilatDrawerOpen(true);
  };

  const openTahsilatDrawerForEdit = (t: Tahsilat) => {
    tahsilatFormDirtyRef.current = false;
    setEditingTahsilat(t);
    const tutarVal = t.tahsil_edilen_tutar ?? t.tutar;
    setTahsilatTutar(tutarVal != null ? formatTLDisplayValue(Number(tutarVal)) : '');
    setTahsilatDrawerOpen(true);
  };

  const closeTahsilatDrawer = () => {
    tahsilatFormDirtyRef.current = false;
    setTahsilatDrawerOpen(false);
    setEditingTahsilat(null);
    setTahsilatForFatura(null);
    setTahsilatTutar('');
  };

  const requestCloseTahsilatDrawer = () => {
    if (tahsilatFormDirtyRef.current) {
      showToastInteractive({
        title: 'Değişiklikleri Kaydet',
        message: 'Kaydedilmeyen değişiklikler var! Değişiklikleri kaydetmek istiyor musunuz?',
        confirmText: 'Evet, Kaydet',
        cancelText: 'İptal',
        onConfirm: async () => {
          (window as unknown as { closeInteractiveToastIfOpen?: () => void }).closeInteractiveToastIfOpen?.();
          if (tahsilatFormRef.current) {
            const form = tahsilatFormRef.current;
            if (form.checkValidity()) {
              form.requestSubmit();
            } else {
              form.reportValidity();
            }
          }
        },
        onCancel: () => {
          (window as unknown as { closeInteractiveToastIfOpen?: () => void }).closeInteractiveToastIfOpen?.();
          closeTahsilatDrawer();
        },
      });
    } else {
      closeTahsilatDrawer();
    }
  };

  const formatDateTimeLocalForInput = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null || val === '') return '';
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

  const handleTahsilatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !tahsilatFormRef.current) return;
    const form = tahsilatFormRef.current;
    
    // HTML5 validation kontrolü - geçersizse tarayıcı kendi mesajını gösterir
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    
    const fd = new FormData(form);
    const islemTarihiSaati = fd.get('islem_tarihi_saati') as string;
    const odemeYontemi = normalizeOdemeYontemiForDb((fd.get('odeme_yontemi') as string) || 'nakit');
    const odemeYapanKisi = (fd.get('odeme_yapan_kisi') as string) || '';
    const tahsilatYapanKisi = (fd.get('tahsilat_yapan_kisi') as string) || '';
    const aciklama = (fd.get('aciklama') as string) || '';
    const tahsil_edilen_tutar = parseTL(tahsilatTutar);
    
    // Tutar kontrolü (parse edilebilir mi?)
    if (Number.isNaN(tahsil_edilen_tutar) || tahsil_edilen_tutar <= 0) {
      showToast('warning', 'Lütfen geçerli bir tutar girin.');
      return;
    }
    const islem_tarihi_saati = new Date(islemTarihiSaati).toISOString().slice(0, 19).replace('T', ' ');
      const tahsilat_makbuz_no = ((editingTahsilat?.tahsilat_makbuz_no ?? editingTahsilat?.makbuz_no ?? (fd.get('tahsilat_makbuz_no') as string) ?? '').trim()) || `T-${Date.now()}`;
    const payload = {
      islem_tarihi_saati,
      odeme_yontemi: odemeYontemi,
      tahsil_edilen_tutar,
      odeme_yapan_kisi: odemeYapanKisi || null,
      tahsilat_yapan_kisi: tahsilatYapanKisi || null,
      aciklama: tahsilatForFatura ? `${tahsilatForFatura.fatura_no} tahsilatı` : (aciklama || null),
      tahsilat_makbuz_no,
      ...(tahsilatForFatura && { fatura_id: tahsilatForFatura.id, fatura_no: tahsilatForFatura.fatura_no }),
    };
    try {
      if (editingTahsilat) {
        await apiRequest(`/customers/${id}/tahsilatlar/${editingTahsilat.id}`, { method: 'PUT', data: payload });
        showToast('success', 'Tahsilat güncellendi.');
      } else {
        await apiRequest(`/customers/${id}/tahsilatlar`, { method: 'POST', data: payload });
        showToast('success', 'Tahsilat eklendi.');
      }
      invalidateCustomerCariQueries(queryClient, id);
      closeTahsilatDrawer();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'İşlem başarısız.');
    }
  };

  const handleTahsilatSil = (t: Tahsilat) => {
    showToastInteractive({
      title: 'Tahsilat Sil',
      message: 'Bu tahsilatı silmek istediğinize emin misiniz?',
      confirmText: 'Evet, Sil',
      cancelText: 'İptal',
      onConfirm: async () => {
        if (!id) return;
        try {
          await apiRequest(`/customers/${id}/tahsilatlar/${t.id}`, { method: 'DELETE' });
          showToast('success', 'Tahsilat silindi.');
          invalidateCustomerCariQueries(queryClient, id);
        } catch (err) {
          showToast('error', err instanceof Error ? err.message : 'Tahsilat silinemedi.');
        }
      },
    });
  };

  const handleFaturaIptal = (f: Fatura) => {
    showToastInteractive({
      title: 'Fatura İptal',
      message: `${f.fatura_no} numaralı faturayı iptal etmek istediğinize emin misiniz?`,
      confirmText: 'Evet, İptal',
      cancelText: 'İptal',
      onConfirm: async () => {
        if (!id) return;
        try {
          await apiRequest(`/customers/${id}/faturalar/${f.id}/durum`, { method: 'PUT', data: { durum: 'iptal' } });
          showToast('success', 'Fatura iptal edildi.');
          invalidateCustomerCariQueries(queryClient, id);
          setFaturaDurumModal(null);
        } catch (err) {
          showToast('error', err instanceof Error ? err.message : 'Fatura iptal edilemedi.');
        }
      },
    });
  };

  const FATURA_DURUM_OPTIONS = [
    { value: 'kesildi', label: 'Kesildi', Icon: FileCheck },
    { value: 'gonderildi', label: 'Gönderildi', Icon: Send },
    { value: 'odendi', label: 'Tamamı Tahsil Edildi', Icon: CircleDollarSign },
    { value: 'beklemede', label: 'Beklemede', Icon: Clock },
    { value: 'taslak', label: 'Taslak', Icon: FileText },
    { value: 'iptal', label: 'İptal', Icon: XCircle },
  ];

  const handleFaturaPdf = async (f: Fatura) => {
    const tenantId = localStorage.getItem('floovon_tenant_id');
    if (!id || !tenantId) {
      showToast('error', 'Oturum bilgisi bulunamadı.');
      return;
    }
    const base = getApiBaseUrl();
    const pdfUrl = `${base}/tenants/${tenantId}/customers/${id}/faturalar/${f.id}/pdf`;
    const fileName = `Fatura-${(f.fatura_no || f.id || 'fatura').toString().replace(/[/\\?%*:|"]/g, '-')}.pdf`;
    try {
      const res = await fetch(pdfUrl, { credentials: 'include', mode: 'cors' });
      if (!res.ok) throw new Error('Fatura alınamadı.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('success', 'Fatura indirildi.');
    } catch {
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('success', 'Fatura indirildi.');
    }
  };

  const handleFaturaMail = (f: Fatura) => {
    showToastInteractive({
      title: 'Fatura Gönder',
      message: `${f.fatura_no} numaralı faturayı "${unvan}" müşterisine e-posta ile göndermek istiyor musunuz?`,
      confirmText: 'Evet',
      cancelText: 'İptal',
      onConfirm: async () => {
        if (!id) return;
        try {
          await apiRequest(`/customers/${id}/faturalar/${f.id}/durum`, { method: 'PUT', data: { durum: 'gonderildi' } });
          showToast('success', 'Fatura gönderildi olarak işaretlendi.');
          invalidateCustomerCariQueries(queryClient, id);
        } catch (err) {
          showToast('error', err instanceof Error ? err.message : 'Güncellenemedi.');
        }
      },
    });
  };

  const handleFaturaDurumGuncelle = async (f: Fatura, yeniDurum: string) => {
    if (!id) return;
    try {
      await apiRequest(`/customers/${id}/faturalar/${f.id}/durum`, { method: 'PUT', data: { durum: yeniDurum } });
      showToast('success', 'Fatura durumu güncellendi.');
      invalidateCustomerCariQueries(queryClient, id);
      setFaturaDurumModal(null);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Güncellenemedi.');
    }
  };

  const openTahsilatForFatura = (f: Fatura) => {
    setTahsilatForFatura(f);
    setEditingTahsilat(null);
    setTahsilatTutar(f.genel_toplam != null ? formatTLDisplayValue(Number(f.genel_toplam)) : '');
    setTahsilatDrawerOpen(true);
  };

  const handleFaturaKesSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!id || !faturaKesOrder) return;
    const form = e.currentTarget;
    const faturaNo = (form.querySelector('[name="fatura_no"]') as HTMLInputElement)?.value?.trim();
    const faturaTarihi = (form.querySelector('[name="fatura_tarihi"]') as HTMLInputElement)?.value?.trim();
    const kdvOrani = parseFloat((form.querySelector('[name="kdv_orani"]') as HTMLInputElement)?.value ?? '20') || 20;
    const tutar = Number(faturaKesOrder.siparis_tutari ?? faturaKesOrder.toplam_tutar ?? faturaKesOrder.tutar ?? 0);
    const kdvTutari = (tutar * kdvOrani) / 100;
    const genelToplam = tutar + kdvTutari;
    const tenantId = localStorage.getItem('floovon_tenant_id');
    if (!tenantId || !faturaNo || !faturaTarihi) {
      showToast('error', 'Fatura no ve tarih zorunludur.');
      return;
    }
    try {
      await apiRequest(`/tenants/${tenantId}/customers/${id}/faturalar`, {
        method: 'POST',
        data: {
          fatura_no: faturaNo,
          fatura_tarihi: faturaTarihi,
          siparis_idler: String(faturaKesOrder.id),
          tutar,
          kdv_orani: kdvOrani,
          kdv_tutari: kdvTutari,
          genel_toplam: genelToplam,
          durum: 'kesildi',
        },
      });
      showToast('success', 'Fatura kesildi.');
      invalidateCustomerCariQueries(queryClient, id);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['customer-orders', id] }),
        queryClient.refetchQueries({ queryKey: ['customer-faturalar', id] }),
      ]);
      setFaturaKesOrder(null);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Fatura kesilemedi.');
    }
  };

  const handleTopluFaturaKesSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!id || !topluFaturaSecilenIds.length) {
      showToast('error', 'En az bir sipariş seçin.');
      return;
    }
    const form = e.currentTarget;
    const faturaNo = (form.querySelector('[name="toplu_fatura_no"]') as HTMLInputElement)?.value?.trim();
    const faturaTarihi = (form.querySelector('[name="toplu_fatura_tarihi"]') as HTMLInputElement)?.value?.trim();
    const kdvOrani = parseFloat((form.querySelector('[name="toplu_kdv_orani"]') as HTMLInputElement)?.value ?? '20') || 20;
    const tenantId = localStorage.getItem('floovon_tenant_id');
    if (!tenantId || !faturaNo || !faturaTarihi) {
      showToast('error', 'Fatura no ve tarih zorunludur.');
      return;
    }
    const secilenOrders = (orders ?? []).filter((o) => topluFaturaSecilenIds.includes(o.id));
    const tutar = secilenOrders.reduce((sum, o) => sum + Number(o.siparis_tutari ?? o.toplam_tutar ?? o.tutar ?? 0), 0);
    const kdvTutari = (tutar * kdvOrani) / 100;
    const genelToplam = tutar + kdvTutari;
    try {
      await apiRequest(`/tenants/${tenantId}/customers/${id}/faturalar`, {
        method: 'POST',
        data: {
          fatura_no: faturaNo,
          fatura_tarihi: faturaTarihi,
          siparis_idler: topluFaturaSecilenIds.join(','),
          tutar,
          kdv_orani: kdvOrani,
          kdv_tutari: kdvTutari,
          genel_toplam: genelToplam,
          durum: 'kesildi',
        },
      });
      showToast('success', 'Toplu fatura kesildi.');
      invalidateCustomerCariQueries(queryClient, id);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['customer-orders', id] }),
        queryClient.refetchQueries({ queryKey: ['customer-faturalar', id] }),
      ]);
      setTopluFaturaKesOpen(false);
      setTopluFaturaSecilenIds([]);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Toplu fatura kesilemedi.');
    }
  };

  const openTopluFaturaKes = () => {
    setTopluFaturaSecilenIds([]);
    setTopluFaturaKesOpen(true);
  };

  const toggleTopluFaturaSiparis = (orderId: number) => {
    setTopluFaturaSecilenIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const topluFaturaSelectAll = () => {
    if (!ordersWithoutFatura.length) return;
    const allIds = ordersWithoutFatura.map((o) => o.id);
    setTopluFaturaSecilenIds((prev) => (prev.length === allIds.length ? [] : allIds));
  };

  return (
    <div className="cari-page">
      <aside className="cari-sol">
        <div className="geri-don">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/musteriler'); }}>
            <ArrowLeftCircle size={20} strokeWidth={2} aria-hidden />
            Müşteriler Geri Dön
          </a>
        </div>
        <h1 className="cari-baslik">Müşteri Cari Hesap</h1>

        <div className="cari-kart musteri-cari-kart">
          <div className="musteri-cari-bilgileri">
            <div className="musteri-cari-unvan">{unvan}</div>
            <div className="musteri-cari-yetkili">{yetkili}</div>
            <div className="musteri-cari-iletisim">
              {customer.musteri_telefon ? (() => {
                const digits = cleanPhoneForDatabase(customer.musteri_telefon).replace(/^90/, '');
                const tenDigits = digits.length > 10 ? digits.slice(-10) : digits;
                return (
                  <a href={`tel:+90${tenDigits}`} className="musteri-cari-link musteri-cari-tel">
                    {formatPhoneNumber(customer.musteri_telefon)}
                  </a>
                );
              })() : null}
              {customer.musteri_eposta ? (
                <a href={`mailto:${customer.musteri_eposta}`} className="musteri-cari-link musteri-cari-eposta">
                  {customer.musteri_eposta}
                </a>
              ) : null}
              {!customer.musteri_telefon && !customer.musteri_eposta && '—'}
            </div>
          </div>
        </div>

        <div className="cari-ozet-row cari-ozet-stacked">
          <div className="cari-ozet-box">
            <span>Toplam Alacak</span>
            <span className="cari-ozet-deger">{formatTL(toplamAlacak)}</span>
          </div>
          <div className="cari-ozet-box">
            <span>Toplam Tahsilat</span>
            <span className="cari-ozet-deger">{formatCurrency(toplamTahsilat)}</span>
          </div>
          <div className={`cari-ozet-box ${bakiye >= 0 ? 'bakiye-pozitif' : 'bakiye-negatif'}`}>
            <span>Bakiye</span>
            <span className="cari-ozet-deger">{formatCurrency(bakiye)}</span>
          </div>
        </div>

        <button
          type="button"
          className="cari-tahsilat-btn"
          onClick={openTahsilatDrawerForAdd}
        >
          Müşteriye Tahsilat Ekle
        </button>
      </aside>

        {/* Sağ panel – 75%, tablar + tablo */}
        <div className="cari-sag">
        <div className="cari-sag-inner">
          <div className="cari-tabs">
            <button
              type="button"
              className={`cari-tab ${activeTab === 'siparisler' ? 'active' : ''}`}
              onClick={() => setActiveTab('siparisler')}
            >
              Siparişler
            </button>
            <button
              type="button"
              className={`cari-tab ${activeTab === 'tahsilatlar' ? 'active' : ''}`}
              onClick={() => setActiveTab('tahsilatlar')}
            >
              Tahsilatlar
            </button>
            <button
              type="button"
              className={`cari-tab ${activeTab === 'faturalar' ? 'active' : ''}`}
              onClick={() => setActiveTab('faturalar')}
            >
              Faturalar
            </button>
          </div>

          <div className="cari-tablo-alan">
            <div className="cari-tablo-header">
              <h2 className="cari-tablo-baslik">
                {activeTab === 'siparisler' && `Siparişler (${filteredOrders?.length ?? 0} Sipariş)`}
                {activeTab === 'tahsilatlar' && 'Tahsilatlar'}
                {activeTab === 'faturalar' && 'Faturalar'}
              </h2>
              <div className="cari-tablo-toolbar">
                <SearchInput
                  value={tableSearchByTab[activeTab]}
                  onChange={(v) => setTableSearchByTab((prev) => ({ ...prev, [activeTab]: v }))}
                  placeholder={
                    activeTab === 'siparisler'
                      ? 'Siparişler içerisinde arayın'
                      : activeTab === 'tahsilatlar'
                        ? 'Tahsilatlar içerisinde arayın'
                        : 'Faturalar içerisinde arayın'
                  }
                  className="musteri-cari-search-input"
                  aria-label="Tablo ara"
                />
                {activeTab === 'faturalar' && ordersWithoutFatura.length > 0 && (
                  <button
                    type="button"
                    className="primary-button cari-toplu-fatura-kes-btn"
                    onClick={openTopluFaturaKes}
                  >
                    <ListChecks size={18} aria-hidden />
                    Toplu Fatura Kes
                  </button>
                )}
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
              {activeTab === 'siparisler' && (
                <>
                  {ordersLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <LoadingSpinner />
                    </div>
                  ) : !filteredOrders?.length ? (
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
                          <th>FATURA BİLGİLERİ</th>
                          <th>FATURA DURUMU</th>
                          <th>İŞLEMLER</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map((order) => {
                          const raw = order as Record<string, unknown>;
                          const tarih = order.tarih ?? order.olusturma_tarihi ?? raw.created_at ?? raw.teslim_tarih ?? raw.organizasyon_teslim_tarih;
                          const urun = order.urun ?? order.siparis_urun ?? raw.siparis_urun ?? raw.urun;
                          const urunGorsel = order.urun_gorsel ?? order.product_gorsel ?? (raw.urun_gorsel as string | undefined) ?? (raw.product_gorsel as string | undefined);
                          const adetNum = order.adet ?? order.miktar ?? raw.miktar ?? raw.adet ?? (raw.quantity as number | undefined);
                          const adet = adetNum != null && adetNum !== '' ? String(adetNum) : '1';
                          const tutar = order.tutar ?? order.siparis_tutari ?? order.toplam_tutar ?? raw.siparis_tutari ?? raw.toplam_tutar ?? raw.tutar;
                          const fiyat = order.urun_fiyati ?? order.birim_fiyat ?? raw.birim_fiyat ?? raw.urun_fiyati ?? (tutar != null && adet !== '—' && Number(adet) > 0 ? Number(tutar) / Number(adet) : null);
                          const faturaNoVal = order.fatura_no ?? raw.fatura_no;
                          const orderIdStr = String(order.id);
                          const kesildiFromFatura = faturalar?.some((f) => (f.durum || '').toLowerCase() !== 'iptal' && (f.siparis_idler || '').split(',').map((x: string) => x.trim()).filter(Boolean).includes(orderIdStr));
                          const faturaNoFromList = kesildiFromFatura && faturalar
                            ? (faturalar.find((f) => (f.durum || '').toLowerCase() !== 'iptal' && (f.siparis_idler || '').split(',').map((x: string) => x.trim()).filter(Boolean).includes(orderIdStr))?.fatura_no ?? '')
                            : '';
                          const faturaNoDisplay = faturaNoVal || faturaNoFromList || '';
                          const faturaDurum = order.fatura_durumu ?? order.fatura_durumu_text ?? raw.fatura_durumu ?? (faturaNoDisplay || kesildiFromFatura ? 'Kesildi' : 'Kesilmedi');
                          const kartTurRaw = raw.organizasyon_kart_tur ?? order.organizasyon_kart_tur ?? raw.kart_tur ?? raw.kart_turu ?? order.kart_tur ?? order.kart_turu;
                          const kartTurStr = typeof kartTurRaw === 'string' ? kartTurRaw : String(raw.kart_tur_display ?? order.kart_tur_display ?? kartTurRaw ?? '');
                          const kartTur = normalizeKartTur(kartTurStr || undefined);
                          const kartTurDisplay = (typeof order.kart_tur_display === 'string' ? order.kart_tur_display : null) ?? (typeof raw.kart_tur_display === 'string' ? raw.kart_tur_display : null) ?? getKartTurDisplay(kartTur);
                          const r = raw as Record<string, unknown>;
                          const orgKart = (r.organizasyon_kart ?? order.organizasyon_kart) as Record<string, unknown> | undefined;
                          const altTurVal = orgKart?.alt_tur ?? orgKart?.organizasyon_alt_tur ?? r.organizasyon_alt_tur ?? order.organizasyon_alt_tur ?? r.alt_tur ?? order.alt_tur ?? r.alt_tur_display ?? r.alt_kart_tur ?? order.kart_alt_tur ?? r.kart_alt_tur ?? order.alt_kart_tur ?? r.organizasyon_alt_tur_display ?? r.sub_tur ?? r.alt_kart_turu;
                          let altTurStr = typeof altTurVal === 'string' ? altTurVal.trim() : (altTurVal != null ? String(altTurVal).trim() : '');
                          const displayForAlt = (typeof order.kart_tur_display === 'string' ? order.kart_tur_display : null) ?? (typeof raw.kart_tur_display === 'string' ? raw.kart_tur_display : null) ?? (orgKart?.kart_tur_display as string) ?? '';
                          if (!altTurStr && displayForAlt) {
                            const parts = String(displayForAlt).split(/\s*[-–—]\s*/);
                            if (parts.length > 1) altTurStr = parts.slice(1).join(' - ').trim();
                          }
                          const mahalleVal = orgKart?.mahalle ?? r.mahalle ?? order.mahalle ?? order.teslim_mahalle ?? order.organizasyon_mahalle ?? r.organizasyon_mahalle ?? r.teslim_mahalle ?? r.org_mahalle;
                          const mahalleStr = typeof mahalleVal === 'string' ? mahalleVal.trim() : (mahalleVal != null ? String(mahalleVal).trim() : '');
                          const teslimatKonumu = raw.organizasyon_konum ?? order.organizasyon_konum ?? raw.organizasyon_teslimat_konumu ?? order.organizasyon_konum ?? raw.teslimat_adresi ?? order.teslimat_adresi ?? raw.acik_adres ?? order.acik_adres;
                          const teslimatKonumuStr = typeof teslimatKonumu === 'string' ? teslimatKonumu.trim() : (teslimatKonumu != null ? String(teslimatKonumu).trim() : '');
                          const orgSahibi = raw.organizasyon_sahibi ?? order.organizasyon_sahibi;
                          const orgSahibiStr = typeof orgSahibi === 'string' ? orgSahibi.trim() : (orgSahibi != null ? String(orgSahibi).trim() : '');
                          const teslimKisisiVal = raw.organizasyon_teslim_kisisi ?? order.organizasyon_teslim_kisisi ?? raw.teslim_kisisi ?? order.teslim_kisisi;
                          const teslimKisisiStr = typeof teslimKisisiVal === 'string' ? teslimKisisiVal.trim() : (teslimKisisiVal != null ? String(teslimKisisiVal).trim() : '');
                          const musteriUnvanVal = raw.musteri_unvan ?? order.musteri_unvan ?? raw.musteri_unvani ?? order.musteri_unvani;
                          const musteriUnvanStr = typeof musteriUnvanVal === 'string' ? musteriUnvanVal.trim() : (musteriUnvanVal != null ? String(musteriUnvanVal).trim() : '');
                          let primaryKonum: string;
                          let secondaryContent: string;
                          if (kartTur === 'aracsusleme') {
                            const aracMarkaModel = (raw.arac_markamodel ?? order.arac_markamodel) as string | undefined;
                            const aracRenk = (raw.arac_renk ?? order.arac_renk) as string | undefined;
                            const aracPlaka = (raw.arac_plaka ?? order.arac_plaka) as string | undefined;
                            const aracParts = [aracMarkaModel, aracRenk, aracPlaka].filter(Boolean).map((x) => (typeof x === 'string' ? x.trim() : String(x).trim()));
                            primaryKonum = aracParts.length ? aracParts.join(', ') : '—';
                            secondaryContent = musteriUnvanStr || '—';
                          } else {
                            primaryKonum = teslimatKonumuStr || mahalleStr || '—';
                            secondaryContent = [orgSahibiStr, teslimKisisiStr].filter(Boolean).join(' · ') || '—';
                          }
                          return (
                          <tr key={order.id}>
                            <td data-label="Sipariş Kodu">{(order.siparis_kodu ?? raw.siparis_kodu) ? String(order.siparis_kodu ?? raw.siparis_kodu) : '—'}</td>
                            <td data-label="Tarih-Saat">
                              {tarih ? formatDateTimeShort(tarih) : '—'}
                            </td>
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
                                  <span className="kart-tur">{kartTurDisplay}</span>
                                  {altTurStr?.trim() ? <span className="kart-alt-tur">{altTurStr}</span> : null}
                                </div>
                                <div className="cari-org-icerik">
                                  <div className="cari-org-primary">{primaryKonum}</div>
                                  <div className="cari-org-secondary">
                                    {secondaryContent}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td data-label="Adet">{adet}</td>
                            <td data-label="Ürün Fiyatı">{fiyat != null && !Number.isNaN(Number(fiyat)) ? `${Number(fiyat).toFixed(2)} TL` : (tutar != null ? `${Number(tutar).toFixed(2)} TL` : '—')}</td>
                            <td data-label="Toplam Tutar">{tutar != null ? formatCurrency(Number(tutar)) : '—'}</td>
                            <td data-label="Fatura Bilgileri">
                              {faturaNoDisplay ? (
                                String(faturaNoDisplay)
                              ) : (
                                <button type="button" className="btn-fatura-kes-mini" onClick={() => setFaturaKesOrder(order)} title="Bu sipariş için fatura kes">
                                  <Plus size={14} aria-hidden /> Fatura Kes
                                </button>
                              )}
                            </td>
                            <td data-label="Fatura Durumu">{faturaDurum != null && String(faturaDurum).trim() !== '' ? String(faturaDurum) : '—'}</td>
                            <td data-label="İşlemler">
                              <div className="islem-ikonlar">
                                <button
                                  type="button"
                                  className="islem-ikon"
                                  data-tooltip="Sipariş detayına git"
                                  aria-label="Sipariş detayına git"
                                  onClick={() => {
                                    const orgKartId = (raw.organizasyon_kart_id ?? order.organizasyon_kart_id) != null
                                      ? Number(raw.organizasyon_kart_id ?? order.organizasyon_kart_id)
                                      : order.id;
                                    navigate(`/siparis-kart-detay/${orgKartId}`);
                                  }}
                                >
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

              {activeTab === 'tahsilatlar' && (
                <>
                  {tahsilatlarLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <LoadingSpinner />
                    </div>
                  ) : !filteredTahsilatlar?.length ? (
                    <EmptyState variant="soft" title="Görüntülenecek tahsilat bulunamadı" description="" icon={<FileSearch size={28} aria-hidden />} />
                  ) : (
                    <table className="cari-table">
                      <thead>
                        <tr>
                          <th>İŞLEM TARİHİ & SAATİ</th>
                          <th>ÖDEME YÖNTEMİ</th>
                          <th>TAHSİL EDİLEN TUTAR</th>
                          <th>ÖDEME YAPAN KİŞİ</th>
                          <th>TAHSİLAT YAPAN KİŞİ</th>
                          <th>AÇIKLAMA</th>
                          <th>MAKBUZ NO</th>
                          <th>DURUM</th>
                          <th>İŞLEMLER</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTahsilatlar.map((t) => {
                          const tr = (t as unknown) as Record<string, unknown>;
                          const islemTarihi = t.islem_tarihi ?? t.islem_tarihi_saati ?? tr.islem_tarihi_saati ?? tr.transaction_date;
                          const tutar = t.tutar ?? t.tahsil_edilen_tutar ?? tr.tahsil_edilen_tutar ?? tr.amount;
                          const tarihStr = islemTarihi ? formatDateTimeShort(islemTarihi) : '—';
                          const aciklamaStr = getTahsilatField(tr, 'aciklama', 'description') || (t.aciklama ?? (tr.aciklama as string) ?? '') || '—';
                          const makbuzStr = getTahsilatField(tr, 'tahsilat_makbuz_no', 'makbuz_no') || (t.makbuz_no ?? t.tahsilat_makbuz_no ?? (tr.makbuz_no as string) ?? (tr.tahsilat_makbuz_no as string) ?? '') || '—';
                          const durumStr = getTahsilatField(tr, 'durum', 'status') || (t.durum ?? (tr.durum as string) ?? '') || '—';
                          return (
                          <tr key={t.id}>
                            <td data-label="İşlem Tarihi & Saati">
                              {tarihStr}
                              {t.islem_saati ? ` ${t.islem_saati}` : ''}
                            </td>
                            <td data-label="Ödeme Yöntemi">{formatOdemeYontemiDisplay((t.odeme_yontemi ?? tr.payment_method) as string)}</td>
                            <td data-label="Tahsil Edilen Tutar">{tutar != null ? formatCurrency(Number(tutar)) : '—'}</td>
                            <td data-label="Ödeme Yapan Kişi">{t.odeme_yapan_kisi ?? (tr.odeme_yapan_kisi as string) ?? '—'}</td>
                            <td data-label="Tahsilat Yapan Kişi">{t.tahsilat_yapan_kisi ?? (tr.tahsilat_yapan_kisi as string) ?? '—'}</td>
                            <td data-label="Açıklama">{aciklamaStr}</td>
                            <td data-label="Makbuz No">{makbuzStr}</td>
                            <td data-label="Durum">{formatDurumDisplay(durumStr === '—' ? undefined : durumStr)}</td>
                            <td data-label="İşlemler">
                              <div className="islem-ikonlar">
                                <button type="button" className="islem-ikon duzenle-ikon" data-tooltip="Düzenle" aria-label="Düzenle" onClick={() => openTahsilatDrawerForEdit(t)}>
                                  <Pencil size={16} aria-hidden />
                                </button>
                                <button type="button" className="islem-ikon sil-ikon" data-tooltip="Sil" aria-label="Sil" onClick={() => handleTahsilatSil(t)}>
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

              {activeTab === 'faturalar' && (
                <>
                  {faturalarLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <LoadingSpinner />
                    </div>
                  ) : !faturalar || faturalar.length === 0 ? (
                    <EmptyState variant="soft" title="Görüntülenecek fatura bulunamadı" description="" icon={<FileSearch size={28} aria-hidden />} />
                  ) : (
                    <table className="cari-table">
                      <thead>
                        <tr>
                          <th>FATURA NO</th>
                          <th>TARİH</th>
                          <th>SİPARİŞLER</th>
                          <th>TUTAR</th>
                          <th>KDV</th>
                          <th>GENEL TOPLAM</th>
                          <th>DURUM</th>
                          <th>FATURA İŞLEMLERİ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFaturalar.map((f) => {
                          const fr = (f as unknown) as Record<string, unknown>;
                          const tarih = f.tarih ?? fr.fatura_tarihi;
                          const siparisIdler = f.siparisler ?? fr.siparis_idler;
                          const siparisMetin = Array.isArray(siparisIdler)
                            ? `${siparisIdler.length} sipariş`
                            : typeof siparisIdler === 'string' && siparisIdler.trim()
                              ? `${siparisIdler.split(',').map((id: string) => id.trim()).filter(Boolean).length} sipariş`
                              : '—';
                          const tutar = f.tutar ?? fr.tutar;
                          const kdv = f.kdv ?? fr.kdv_tutari ?? fr.kdv_orani;
                          const genelToplam = f.genel_toplam ?? fr.genel_toplam;
                          const durum = f.durum ?? fr.durum;
                          return (
                          <tr key={f.id}>
                            <td data-label="Fatura No">{f.fatura_no ?? fr.fatura_no ?? '—'}</td>
                            <td data-label="Tarih">{tarih ? new Date(String(tarih)).toLocaleDateString('tr-TR') : '—'}</td>
                            <td data-label="Siparişler">{siparisMetin}</td>
                            <td data-label="Tutar">{tutar != null ? formatCurrency(Number(tutar)) : '—'}</td>
                            <td data-label="KDV">{kdv != null ? `${Number(kdv).toFixed(2)} TL` : '—'}</td>
                            <td data-label="Genel Toplam">{genelToplam != null ? formatCurrency(Number(genelToplam)) : '—'}</td>
                            <td data-label="Durum">{formatDurumDisplay(durum != null ? String(durum) : undefined)}</td>
                            <td data-label="Fatura İşlemleri" style={{ position: 'relative' }}>
                              <div className="islem-ikonlar">
                                <button type="button" className="islem-ikon fatura-pdf-ikon" data-tooltip="Faturayı indir" aria-label="PDF" onClick={() => handleFaturaPdf(f)}>
                                  <FileDown size={16} aria-hidden />
                                </button>
                                <button type="button" className="islem-ikon fatura-mail-ikon" data-tooltip="E-posta gönder" aria-label="Mail" onClick={() => handleFaturaMail(f)}>
                                  <Mail size={16} aria-hidden />
                                </button>
                                <button type="button" className="islem-ikon fatura-status-ikon" data-tooltip="Durum güncelle" aria-label="Durum" onClick={() => setFaturaDurumModal(faturaDurumModal?.id === f.id ? null : f)}>
                                  <ListChecks size={16} aria-hidden />
                                </button>
                                {(f.durum ?? (fr.durum as string))?.toLowerCase() !== 'iptal' && (
                                  <button type="button" className="islem-ikon fatura-collect-ikon" data-tooltip="Ödeme al" aria-label="Tahsilat" onClick={() => openTahsilatForFatura(f)}>
                                    <CircleDollarSign size={16} aria-hidden />
                                  </button>
                                )}
                                <button type="button" className="islem-ikon iptal-ikon" data-tooltip="Faturayı iptal et" aria-label="İptal" onClick={() => handleFaturaIptal(f)}>
                                  <XCircle size={16} aria-hidden />
                                </button>
                              </div>
                              {faturaDurumModal?.id === f.id && (
                                <div className="fatura-durum-dropdown">
                                  {FATURA_DURUM_OPTIONS.map((opt) => {
                                    const OptIcon = opt.Icon;
                                    return (
                                      <button key={opt.value} type="button" className="fatura-durum-option" onClick={() => handleFaturaDurumGuncelle(f, opt.value)}>
                                        <OptIcon size={16} aria-hidden />
                                        <span>{opt.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                          );
                        })}
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
        <div
          className="fixed inset-0 z-10"
          onClick={() => setExportMenuOpen(false)}
        />
      )}

      {/* Fatura Kes modal (tekil sipariş) – ortada, header/sidebar altında */}
      {faturaKesOrder &&
        createPortal(
          <div
            className="cari-drawer-overlay cari-fatura-kes-overlay"
            data-modal-backdrop
            role="dialog"
            aria-modal="true"
            aria-labelledby="cari-fatura-kes-title"
            onClick={() => setFaturaKesOrder(null)}
          >
            <div className="cari-fatura-kes-modal" onClick={(e) => e.stopPropagation()}>
              <div className="partner-modal-drawer-header">
                <h2 id="cari-fatura-kes-title" className="partner-modal-drawer-title">Fatura Kes</h2>
                <button type="button" className="partner-modal-drawer-close" onClick={() => setFaturaKesOrder(null)} aria-label="Kapat">
                  <X size={22} aria-hidden />
                </button>
              </div>
              <form className="cari-fatura-kes-form cari-drawer-form-musteri-stil" onSubmit={handleFaturaKesSubmit}>
                <p className="cari-fatura-kes-siparis">Sipariş #{faturaKesOrder.id} – {faturaKesOrder.siparis_urun ?? faturaKesOrder.urun ?? '—'} – {formatCurrency(Number(faturaKesOrder.siparis_tutari ?? faturaKesOrder.toplam_tutar ?? faturaKesOrder.tutar ?? 0))}</p>
                <div className="input-alan">
                  <div className="input-grup">
                    <label className="input-label">FATURA NO</label>
                    <input name="fatura_no" type="text" required defaultValue={`BF-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000) + 1).padStart(3, '0')}`} />
                  </div>
                </div>
                <div className="input-alan">
                  <div className="input-grup">
                    <label className="input-label">FATURA TARİHİ</label>
                    <input name="fatura_tarihi" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                  </div>
                </div>
                <div className="input-alan">
                  <div className="input-grup">
                    <label className="input-label">KDV ORANI (%)</label>
                    <input name="kdv_orani" type="number" min={0} max={100} step={1} defaultValue={20} />
                  </div>
                </div>
                <div className="alt-alan">
                  <div className="butonlar">
                    <button type="button" className="secondary-button btn-vazgec" onClick={() => setFaturaKesOrder(null)}>VAZGEÇ</button>
                    <button type="submit" className="primary-button btn-kaydet">KAYDET</button>
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Toplu Fatura Kes modal */}
      {topluFaturaKesOpen &&
        createPortal(
          <div
            className="cari-drawer-overlay cari-fatura-kes-overlay"
            data-modal-backdrop
            role="dialog"
            aria-modal="true"
            aria-labelledby="cari-toplu-fatura-kes-title"
            onClick={() => { setTopluFaturaKesOpen(false); setTopluFaturaSecilenIds([]); }}
          >
            <div className="cari-fatura-kes-modal cari-toplu-fatura-kes-modal" onClick={(e) => e.stopPropagation()}>
              <div className="partner-modal-drawer-header">
                <h2 id="cari-toplu-fatura-kes-title" className="partner-modal-drawer-title">Toplu Fatura Kes</h2>
                <button type="button" className="partner-modal-drawer-close" onClick={() => { setTopluFaturaKesOpen(false); setTopluFaturaSecilenIds([]); }} aria-label="Kapat">
                  <X size={22} aria-hidden />
                </button>
              </div>
              <form className="cari-fatura-kes-form cari-drawer-form-musteri-stil" onSubmit={handleTopluFaturaKesSubmit}>
                <p className="cari-fatura-kes-siparis">Fatura kesilmemiş siparişlerden seçim yapın. Seçilen siparişler tek faturada birleştirilir.</p>
                <div className="cari-toplu-fatura-list-wrap">
                  <div className="cari-toplu-fatura-list-header">
                    <button type="button" className="cari-toplu-fatura-select-all" onClick={topluFaturaSelectAll}>
                      {topluFaturaSecilenIds.length === ordersWithoutFatura.length ? 'Seçimi kaldır' : 'Tümünü seç'}
                    </button>
                    <span className="cari-toplu-fatura-secilen">{topluFaturaSecilenIds.length} sipariş seçildi</span>
                  </div>
                  <ul className="cari-toplu-fatura-list">
                    {ordersWithoutFatura.map((o) => {
                      const tutar = Number(o.siparis_tutari ?? o.toplam_tutar ?? o.tutar ?? 0);
                      const urun = o.siparis_urun ?? o.urun ?? '—';
                      const secili = topluFaturaSecilenIds.includes(o.id);
                      return (
                        <li key={o.id} className="cari-toplu-fatura-item">
                          <label className="cari-toplu-fatura-item-label">
                            <input
                              type="checkbox"
                              checked={secili}
                              onChange={() => toggleTopluFaturaSiparis(o.id)}
                            />
                            <span className="cari-toplu-fatura-item-text">#{o.id} – {urun} – {formatCurrency(tutar)}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="input-alan">
                  <div className="input-grup">
                    <label className="input-label">FATURA NO</label>
                    <input name="toplu_fatura_no" type="text" required defaultValue={`BF-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000) + 1).padStart(3, '0')}`} />
                  </div>
                </div>
                <div className="input-alan">
                  <div className="input-grup">
                    <label className="input-label">FATURA TARİHİ</label>
                    <input name="toplu_fatura_tarihi" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                  </div>
                </div>
                <div className="input-alan">
                  <div className="input-grup">
                    <label className="input-label">KDV ORANI (%)</label>
                    <input name="toplu_kdv_orani" type="number" min={0} max={100} step={1} defaultValue={20} />
                  </div>
                </div>
                <div className="alt-alan">
                  <div className="butonlar">
                    <button type="button" className="secondary-button btn-vazgec" onClick={() => { setTopluFaturaKesOpen(false); setTopluFaturaSecilenIds([]); }}>VAZGEÇ</button>
                    <button type="submit" className="primary-button btn-kaydet" disabled={topluFaturaSecilenIds.length === 0}>FATURA KES</button>
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Tahsilat drawer – sağdan açılır */}
      {tahsilatDrawerOpen &&
        createPortal(
          <div
            className="cari-drawer-overlay"
            onClick={(e) => { if (e.target === e.currentTarget) requestCloseTahsilatDrawer(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cari-tahsilat-title"
          >
            <div className="cari-drawer" onClick={(e) => e.stopPropagation()}>
              <div className="partner-modal-drawer-header">
                <h2 id="cari-tahsilat-title" className="partner-modal-drawer-title">
                  {editingTahsilat ? 'Müşteri Tahsilatını Düzenle' : tahsilatForFatura ? `${tahsilatForFatura.fatura_no} için Tahsilat` : 'Müşteriye Tahsilat Ekle'}
                </h2>
                <button
                  type="button"
                  className="partner-modal-drawer-close"
                  onClick={requestCloseTahsilatDrawer}
                  aria-label="Kapat"
                >
                  <X size={22} aria-hidden />
                </button>
              </div>
              <form
                ref={tahsilatFormRef}
                key={editingTahsilat ? `edit-${editingTahsilat.id}` : 'new'}
                className="partner-modal-drawer-body cari-drawer-form-musteri-stil"
                onSubmit={handleTahsilatSubmit}
              >
                <div className="input-alan">
                  <div className="input-grup">
                    <label className="input-label">İŞLEM TARİHİ & SAATİ SEÇİN</label>
                    <input
                      type="datetime-local"
                      name="islem_tarihi_saati"
                      required
                      defaultValue={editingTahsilat ? formatDateTimeLocalForInput(editingTahsilat.islem_tarihi_saati ?? ((editingTahsilat as unknown) as Record<string, unknown>).islem_tarihi as string) : formatDateTimeLocalForInput(new Date().toISOString())}
                    />
                  </div>
                </div>
                <div className="input-alan">
                  <div className="input-grup">
                    <label className="input-label">ÖDEME YÖNTEMİ</label>
                    <select name="odeme_yontemi" required defaultValue={normalizeOdemeYontemiForDb(editingTahsilat?.odeme_yontemi ?? '') || 'nakit'}>
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
                      value={tahsilatTutar}
                      onChange={(e) => { tahsilatFormDirtyRef.current = true; setTahsilatTutar(formatTutarInputLive(e.target.value)); }}
                      onKeyDown={(e) => formatTutarInputKeyDown(e, tahsilatTutar)}
                      onBlur={() => setTahsilatTutar(formatTLDisplayValue(parseTL(tahsilatTutar)))}
                      className="cari-drawer-tutar-input"
                      required
                      aria-label="Tutar"
                    />
                  </div>
                </div>
                <div className="input-alan">
                  <div className="input-grup">
                    <label className="input-label">MAKBUZ NO (opsiyonel)</label>
                    <input
                      type="text"
                      name="tahsilat_makbuz_no"
                      placeholder="Makbuz no"
                      defaultValue={editingTahsilat?.tahsilat_makbuz_no ?? editingTahsilat?.makbuz_no ?? ''}
                    />
                  </div>
                </div>
                <div className="input-alan">
                  <div className="input-grup">
                    <label className="input-label">ÖDEME YAPAN KİŞİ</label>
                    <input type="text" name="odeme_yapan_kisi" placeholder="İsim Soyisim yazınız" required defaultValue={editingTahsilat?.odeme_yapan_kisi ?? ''} />
                  </div>
                </div>
                <div className="input-alan">
                  <div className="input-grup">
                    <label className="input-label">TAHSİLAT YAPAN KİŞİ</label>
                    <input type="text" name="tahsilat_yapan_kisi" placeholder="Tahsilat yapan kişi adı" required defaultValue={editingTahsilat?.tahsilat_yapan_kisi ?? ''} />
                  </div>
                </div>
                <div className="input-alan">
                  <div className="input-grup">
                    <label className="input-label">AÇIKLAMA</label>
                    <textarea name="aciklama" placeholder="Açıklama yazınız..." rows={3} required defaultValue={editingTahsilat?.aciklama ?? ''} />
                  </div>
                </div>
                <div className="alt-alan">
                  <div className="butonlar">
                    <button type="button" className="secondary-button btn-vazgec" onClick={closeTahsilatDrawer}>
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
