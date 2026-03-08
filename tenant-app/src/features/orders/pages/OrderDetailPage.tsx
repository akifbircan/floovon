import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { ErrorState } from '../../../shared/components/ErrorState';
import { EmptyState } from '../../../shared/components/EmptyState';
import { usePageAnimations } from '../../../shared/hooks/usePageAnimations';
import { arsivleOrganizasyonKart, teslimEtSiparis, arsivleSiparis } from '../../dashboard/api/siparisActions';
import { deliverAllOrdersInKart } from '../../dashboard/api';
import { showToast, showToastInteractive } from '../../../shared/utils/toastUtils';
import { Lightbox, type LightboxImage } from '../../../shared/components/Lightbox';
import { createPortal } from 'react-dom';
import { Archive, Pencil, SquareCheck, Eye, Tag, ArrowLeftCircle, X, FileSearch, CheckCircle, FileDown } from 'lucide-react';
import { SiparisEditModal } from '../../dashboard/components/SiparisEditModal';
import { ArsivSebepModal } from '../../dashboard/components/ArsivSebepModal';
import { WhatsAppPhoneSelectorModal } from '../../dashboard/components/WhatsAppPhoneSelectorModal';
import { WhatsAppQRModal } from '../../dashboard/components/WhatsAppQRModal';
import { TeslimFotoModal } from '../../dashboard/components/TeslimFotoModal';
import { ImzaModal } from '../../dashboard/components/ImzaModal';
import { useExport } from '../../dashboard/hooks/useExport';
import { downloadTableAsExcel } from '../../dashboard/utils/exportUtils';
import { useWhatsAppShare } from '../../dashboard/hooks/useWhatsAppShare';
import { uploadTeslimFotolari, deleteTeslimFoto } from '../../dashboard/api/teslimFotoApi';
import type { Order, OrganizasyonKart as DashboardOrganizasyonKart } from '../../dashboard/types';
import { getApiBaseUrl } from '../../../lib/runtime';
import { formatPhoneNumber, formatOdemeYontemiDisplay, formatTL } from '../../../shared/utils/formatUtils';
import '../../../styles/order-detail-page.css';
import { invalidateOrganizasyonKartQueries } from '../../../lib/invalidateQueries';
import { broadcastInvalidation } from '../../../lib/crossTabInvalidate';
import { usePlan } from '../../../app/providers/PlanProvider';
import { apiClient } from '../../../lib/api';
import { sendTeslimEdildiWhatsApp, getTeslimKisiFromKart } from '../../dashboard/utils/whatsappMessageUtils';

function getFileNameFromPath(path: string | undefined | null): string {
  if (!path || typeof path !== 'string') return '';
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
}

/** Index’teki sipariş kartıyla aynı: fetch + blob ile dosya indir. Sunucu HTML dönerse (404/SPA) doğrudan link kullan. */
function triggerDownload(downloadUrl: string, fileName: string): void {
  fetch(downloadUrl, { credentials: 'include', mode: 'cors' })
    .then((res) => {
      if (!res.ok) {
        directDownloadFallback(downloadUrl, fileName);
        return null;
      }
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html')) {
        directDownloadFallback(downloadUrl, fileName);
        return null;
      }
      return res.blob();
    })
    .then((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'dosya';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    })
    .catch(() => {
      directDownloadFallback(downloadUrl, fileName);
    });
}

function directDownloadFallback(downloadUrl: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = fileName || 'dosya';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** API Siparis → Dashboard Order (SiparisEditModal için) */
function siparisToOrder(s: Siparis, organizasyonId: number): Order {
  const musteriAdi = s.musteri_isim_soyisim ?? s.musteri_unvan ?? s.musteri_adi ?? '';
  const tutar = s.siparis_tutari ?? s.tutar ?? s.toplam_tutar ?? 0;
  const durum = normalizeSiparisDurum(s.status ?? s.durum);
  return {
    id: s.id,
    organizasyon_id: organizasyonId,
    musteriAdi,
    musteriUnvani: s.musteri_unvan,
    telefon: s.siparis_veren_telefon ?? '',
    tarih: '',
    durum: durum === 'teslim' ? 'teslim' : durum === 'iptal' ? 'iptal' : 'bekliyor',
    teslimSaati: s.teslim_saati ?? s.teslim_saat ?? '',
    urun: s.siparis_urun ?? s.urun ?? '',
    tutar: Number(tutar),
    odemeYontemi: s.odeme_yontemi,
    aracRandevuSaat: s.arac_randevu_saat,
    partnerFirmaAdi: s.partner_firma_adi,
    partnerSiparisTuru: s.partner_siparis_turu,
    teslimKisisi: s.teslim_kisisi,
    teslimKisisiTelefon: s.teslim_kisisi_telefon,
    urunYazisi: s.urun_yazisi,
    acikAdres: s.acik_adres,
    teslimIl: s.teslim_il,
    teslimIlce: s.teslim_ilce,
    mahalle: s.mahalle,
    notes: s.notes,
    secilenUrunYaziDosyasi: s.secilen_urun_yazi_dosyasi,
    _raw: s,
  } as Order;
}

interface OrganizasyonKart {
  id: number;
  kart_tur?: 'organizasyon' | 'aracsusleme' | 'ozelgun' | 'ozelsiparis' | 'ciceksepeti';
  kart_turu?: string;
  kart_etiket?: string;
  alt_tur?: string;
  kart_gorsel?: string;
  mahalle?: string;
  adres?: string;
  acik_adres?: string;
  organizasyon_il?: string;
  organizasyon_ilce?: string;
  teslim_ilce?: string;
  teslim_il?: string;
  organizasyon_sahibi?: string;
  organizasyon_sahibi_telefon?: string;
  teslim_kisisi?: string;
  teslim_kisisi_telefon?: string;
  teslim_tarihi?: string;
  teslim_tarih?: string;
  teslim_saat?: string;
  teslim_saati?: string;
  siparis_sayisi?: number;
}

interface Siparis {
  id: number;
  kart_sira?: number;
  musteri_adi?: string;
  musteri_isim_soyisim?: string;
  musteri_unvan?: string;
  siparis_veren_telefon?: string;
  teslim_kisisi?: string;
  teslim_kisisi_telefon?: string;
  urun?: string;
  siparis_urun?: string;
  urun_gorsel?: string;
  product_gorsel?: string;
  urun_yazisi?: string;
  secilen_urun_yazi_dosyasi?: string;
  teslim_saati?: string;
  teslim_saat?: string;
  arac_randevu_saat?: string;
  partner_firma_adi?: string;
  partner_siparis_turu?: 'verilen' | 'alinan';
  odeme_yontemi?: string;
  tutar?: number;
  siparis_tutari?: number;
  toplam_tutar?: number;
  durum?: 'aktif' | 'teslim' | 'iptal';
  status?: string;
  acik_adres?: string;
  teslim_il?: string;
  teslim_ilce?: string;
  mahalle?: string;
  notes?: string;
  /** Detay popup için API'den gelebilen alanlar */
  siparis_kodu?: string;
  musteri_email?: string;
  teslim_tarih?: string;
  organizasyon_teslim_tarih?: string;
  organizasyon_teslim_saat?: string;
  ekstra_ucret_tutari?: number;
  created_at?: string;
  arsivli?: boolean | number;
  arac_markamodel?: string;
  arac_renk?: string;
  arac_plaka?: string;
  /** Müşteri adres (API’den gelebilir) */
  musteri_neighborhood?: string;
  musteri_address?: string;
  musteri_district?: string;
  musteri_city?: string;
}

function normalizeKartTur(kart_turu?: string): 'organizasyon' | 'aracsusleme' | 'ozelgun' | 'ozelsiparis' {
  if (!kart_turu) return 'organizasyon';
  const t = String(kart_turu).toLowerCase();
  if (t.includes('araç') || t.includes('arac') || t === 'aracsusleme') return 'aracsusleme';
  if (t.includes('çiçek') || t.includes('cicek') || t === 'ciceksepeti') return 'ozelgun'; // Çiçek Sepeti: özel gün detay mantığı (teslim saati, imza)
  if (t.includes('özel gün') || t.includes('ozel gun') || t === 'ozelgun') return 'ozelgun';
  if (t.includes('özel sipariş') || t.includes('ozel siparis') || t === 'ozelsiparis') return 'ozelsiparis';
  return 'organizasyon';
}

function normalizeSiparisDurum(status?: string | null): 'aktif' | 'teslim' | 'iptal' {
  if (!status) return 'aktif';
  const s = String(status).toLowerCase();
  if (s === 'teslim' || s === 'teslim_edildi' || s === 'teslim edildi') return 'teslim';
  if (s === 'iptal' || s === 'arsivlendi' || s === 'arşivlendi') return 'iptal';
  return 'aktif';
}

/** Sipariş detay popup: tarih metni (örn. "12.03.2025 Pazartesi") */
function formatTeslimTarihDisplay(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'long' });
  } catch {
    return '—';
  }
}

/** Sipariş detay popup: durum metni */
function formatSiparisDurumDisplay(s: Siparis): string {
  if (s.arsivli === 1 || String(s.arsivli) === '1' || s.arsivli === true) return 'Arşivlendi';
  const status = (s.status ?? s.durum ?? '').toString().toLowerCase();
  if (status === 'teslim' || status === 'teslim_edildi') return 'Teslim Edildi';
  if (status === 'beklemede') return 'Beklemede';
  if (status === 'hazirlaniyor') return 'Hazırlanıyor';
  if (status === 'yolda') return 'Yolda';
  if (status === 'iptal' || status === 'arsivlendi') return 'Arşivlendi';
  return status || 'İşlemde';
}


interface Foto {
  id: number;
  url: string;
  aciklama?: string;
}

/**
 * Sipariş Kart Detay sayfası
 * UI-map gereksinimlerine göre düzenlendi
 * Sol panel: Organizasyon bilgileri + Aksiyonlar + Foto galeri
 * Sağ panel: Siparişler tablosu
 */
export const OrderDetailPage: React.FC = () => {
  usePageAnimations('orders');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [siparisDetayOpen, setSiparisDetayOpen] = useState(false);
  const [siparisDetaySiparis, setSiparisDetaySiparis] = useState<Siparis | null>(null);
  /** Popup açıldığında GET /siparis-kartlar/:id ile çekilen sipariş (siparis_kodu dahil) */
  const [siparisDetayFetched, setSiparisDetayFetched] = useState<Siparis | null>(null);
  const [siparisEditOpen, setSiparisEditOpen] = useState(false);
  const [siparisEditOrder, setSiparisEditOrder] = useState<Order | null>(null);
  const [arsivSebepOpen, setArsivSebepOpen] = useState(false);
  const [arsivSiparis, setArsivSiparis] = useState<Siparis | null>(null);
  const [whatsAppQRModalOpen, setWhatsAppQRModalOpen] = useState(false);
  /** WhatsApp bağlı değilken "Tümünü teslim et" tıklandığında saklanır; bağlanınca deliverAllOrdersInKart çalıştırılır */
  const [pendingTumunuTeslimEt, setPendingTumunuTeslimEt] = useState<{ kartId: number; orgKart: DashboardOrganizasyonKart } | null>(null);
  /** Tekil teslim edildi tıklandı ama WhatsApp bağlı değildi – önce QR açıldı; bağlanınca flowType'a göre foto/imza modal veya direct teslim + mesaj */
  const [pendingTeslimWhatsApp, setPendingTeslimWhatsApp] = useState<{ order: Order; orgKart: DashboardOrganizasyonKart; teslimKisi: string; siparisTeslimKisisiBaskasi?: string; fotoPath?: string; flowType?: 'foto' | 'imza' | 'direct'; siparis?: Siparis } | null>(null);
  /** WhatsApp listesi paylaş / müşteri şablonu gönder tıklandığında bağlantı yoksa QR açılır; bağlanınca bu mode ile paylaşım tetiklenir */
  const [pendingShareMode, setPendingShareMode] = useState<'list' | 'template' | null>(null);
  /** Index ile aynı akış: organizasyon → teslim foto, özel/özel gün → imza */
  const [teslimFotoModalOpen, setTeslimFotoModalOpen] = useState(false);
  const [imzaModalOpen, setImzaModalOpen] = useState(false);
  const [teslimEdilecekSiparis, setTeslimEdilecekSiparis] = useState<Siparis | null>(null);

  const fotoInputRef = useRef<HTMLInputElement | null>(null);
  const onTeslimFotoRef = useRef<(e: React.ChangeEvent<HTMLInputElement>) => void>(() => {});

  const { isBaslangicPlan } = usePlan();
  const { handlePrintKunye } = useExport();
  const { shareOrganizasyonKart, showPhoneSelector, contacts: whatsappContacts, sendToContact, setShowPhoneSelector, phoneSelectorTitle } = useWhatsAppShare();

  // Organizasyon kartı detayı
  const { data: organizasyonKart, isLoading: kartLoading, error: kartError } = useQuery({
    queryKey: ['organizasyon-kart-detail', id],
    queryFn: async () => {
      try {
        return await apiRequest<OrganizasyonKart>(`/organizasyon-kartlar/${id}`, {
          method: 'GET',
        });
      } catch (err) {
        console.error('Organizasyon kart detay yükleme hatası:', err);
        throw err;
      }
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  // Siparişler
  const { data: siparisler, isLoading: siparislerLoading } = useQuery({
    queryKey: ['organizasyon-siparisler', id],
    queryFn: async () => {
      try {
        const result = await apiRequest<Siparis[]>(`/siparis-kartlar/organizasyon/${id}`, {
          method: 'GET',
        });
        return Array.isArray(result) ? result : [];
      } catch (err) {
        console.error('Siparişler yükleme hatası:', err);
        return [];
      }
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  // Fotoğraflar
  const { data: fotograflar } = useQuery({
    queryKey: ['organizasyon-fotograflar', id],
    queryFn: async () => {
      try {
        // apiRequest otomatik olarak ApiResponse'dan data'yı çıkarıyor
        // Backend { success: true, data: string[] } döndürürse, apiRequest direkt string[] döndürür
        const paths = await apiRequest<string[]>(`/organizasyon-kartlar/${id}/teslim-fotolar`, {
          method: 'GET',
        });
        
        if (!Array.isArray(paths) || paths.length === 0) {
          return [];
        }
        
        // Path'leri tam URL'ye çevir
        const { getUploadUrl } = await import('../../../shared/utils/urlUtils');
        
        return paths.map((path, index) => {
          // Path zaten tam URL ise direkt kullan
          if (path.startsWith('http://') || path.startsWith('https://')) {
            return {
              id: index + 1,
              url: path,
              aciklama: `Teslim Fotoğrafı ${index + 1}`,
            };
          }
          
          // getUploadUrl kullan - otomatik olarak doğru backend base URL'i ekler
          const fullUrl = getUploadUrl(path);
          
          return {
            id: index + 1,
            url: fullUrl,
            aciklama: `Teslim Fotoğrafı ${index + 1}`,
          };
        });
      } catch (err) {
        console.error('Fotoğraflar yükleme hatası:', err);
        return [];
      }
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const teslimEdilenSayisi = siparisler?.filter((s) => normalizeSiparisDurum(s.status ?? s.durum) === 'teslim').length || 0;
  const toplamSiparisSayisi = siparisler?.length || 0;

  /** API bazen { data: row } döner; tek satırlık row'u al */
  const getRawKart = () => {
    if (!organizasyonKart) return null;
    const raw = (organizasyonKart as any).data ?? organizasyonKart;
    return raw && typeof raw === 'object' ? raw : organizasyonKart;
  };

  /** Mevcut sayfa organizasyon kartını dashboard tipine map eder (künye + WhatsApp için) */
  const getKartForKunye = (): DashboardOrganizasyonKart | null => {
    const raw = getRawKart();
    if (!raw || !id) return null;
    return {
      id: raw.id ?? organizasyonKart!.id,
      kart_tur: kartTur,
      kart_tur_display: kartTurDisplay,
      alt_tur: raw.alt_tur ?? (organizasyonKart as any).alt_tur,
      mahalle: (raw.mahalle ?? raw.organizasyon_mahalle ?? (organizasyonKart as any).mahalle) as any,
      organizasyon_mahalle: (raw.organizasyon_mahalle ?? raw.mahalle ?? (organizasyonKart as any).organizasyon_mahalle ?? (organizasyonKart as any).mahalle) as any,
      acik_adres: (raw.adres ?? raw.organizasyon_acik_adres ?? raw.acik_adres ?? (organizasyonKart as any).adres ?? (organizasyonKart as any).acik_adres) as any,
      organizasyon_acik_adres: (raw.organizasyon_acik_adres ?? raw.adres ?? raw.acik_adres ?? (organizasyonKart as any).acik_adres) as any,
      organizasyon_il: (raw.organizasyon_il ?? raw.il ?? raw.teslim_il ?? (organizasyonKart as any).organizasyon_il ?? (organizasyonKart as any).il) as any,
      organizasyon_ilce: (raw.organizasyon_ilce ?? raw.ilce ?? raw.teslim_ilce ?? (organizasyonKart as any).organizasyon_ilce ?? (organizasyonKart as any).ilce) as any,
      organizasyon_teslimat_konumu: (raw.organizasyon_teslimat_konumu ?? raw.teslimat_konumu ?? (organizasyonKart as any).organizasyon_teslimat_konumu) as any,
      teslim_kisisi: (raw.organizasyon_sahibi ?? raw.teslim_kisisi ?? raw.organizasyon_teslim_kisisi ?? (organizasyonKart as any).organizasyon_sahibi ?? (organizasyonKart as any).teslim_kisisi) as any,
      teslim_kisisi_telefon: (raw.organizasyon_sahibi_telefon ?? raw.teslim_kisisi_telefon ?? (organizasyonKart as any).organizasyon_sahibi_telefon ?? (organizasyonKart as any).teslim_kisisi_telefon) as any,
      teslim_tarih: raw.teslim_tarihi ?? raw.teslim_tarih ?? (organizasyonKart as any).teslim_tarihi ?? (organizasyonKart as any).teslim_tarih,
      teslim_saat: raw.teslim_saati ?? raw.teslim_saat ?? (organizasyonKart as any).teslim_saati ?? (organizasyonKart as any).teslim_saat,
    } as DashboardOrganizasyonKart;
  };

  const handleExport = (type: 'excel' | 'print') => {
    if (type === 'excel') {
      try {
        const list = siparisler ?? [];
        const data = list.map((s) => ({
          'Sipariş No': s.id,
          'Sipariş Kodu': (s as any).siparis_kodu ?? '',
          'Müşteri': s.musteri_isim_soyisim ?? s.musteri_unvan ?? s.musteri_adi ?? '',
          'Ürün': s.siparis_urun ?? s.urun ?? '',
          'Tutar': s.siparis_tutari ?? s.tutar ?? s.toplam_tutar ?? '',
          'Teslim Saati': s.teslim_saati ?? s.teslim_saat ?? '',
          'Durum': s.status ?? s.durum ?? '',
          'Ödeme Yöntemi': s.odeme_yontemi ?? '',
        }));
        if (data.length === 0) {
          showToast('warning', 'Dışa aktarılacak sipariş yok.');
          setExportMenuOpen(false);
          return;
        }
        downloadTableAsExcel(data, `Siparis-Kart-${id}-Siparisler`);
        showToast('success', 'Excel dosyası indirildi.');
      } catch (e: any) {
        showToast('error', e?.message ?? 'Excel dışa aktarılamadı.');
      }
    } else if (type === 'print') {
      const kart = getKartForKunye();
      if (kart) handlePrintKunye(kart);
      else showToast('warning', 'Yazdırılacak kart bilgisi bulunamadı');
    }
    setExportMenuOpen(false);
  };

  const runTumunuTeslimEtFlow = async (kartId: number, orgKart: DashboardOrganizasyonKart) => {
    try {
      const result = await deliverAllOrdersInKart(kartId, orgKart, { sendWhatsApp: isBaslangicPlan !== true });
      if (result.basarili > 0 || result.basarisiz === 0) {
        showToast('success', result.message || 'Tüm siparişler teslim edildi');
        invalidateOrganizasyonKartQueries(queryClient, kartId);
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] }),
          queryClient.refetchQueries({ queryKey: ['organizasyon-siparisler', id] }),
          queryClient.refetchQueries({ queryKey: ['siparis-kartlar', kartId] }),
        ]);
        broadcastInvalidation([['organizasyon-kartlar']]);
      }
      if (result.basarisiz > 0) showToast('warning', result.message);
      if (result.basarili === 0 && result.basarisiz > 0) showToast('error', result.message || 'Tümünü teslim et işlemi başarısız');
    } catch (error: any) {
      console.error('Tümünü teslim etme hatası:', error);
      showToast('error', error?.message || 'Siparişler teslim edilirken bir hata oluştu.');
    }
  };

  const handleWhatsAppConnectedFromDetail = async () => {
    setWhatsAppQRModalOpen(false);
    if (pendingTumunuTeslimEt) {
      const { kartId, orgKart } = pendingTumunuTeslimEt;
      setPendingTumunuTeslimEt(null);
      await runTumunuTeslimEtFlow(kartId, orgKart);
    }
    if (pendingTeslimWhatsApp) {
      const pending = pendingTeslimWhatsApp;
      setPendingTeslimWhatsApp(null);
      const { order, orgKart, teslimKisi, siparisTeslimKisisiBaskasi, fotoPath, flowType, siparis } = pending;
      if (flowType === 'foto' && siparis) {
        setTeslimEdilecekSiparis(siparis);
        setTeslimFotoModalOpen(true);
        return;
      }
      if (flowType === 'imza' && siparis) {
        setTeslimEdilecekSiparis(siparis);
        setImzaModalOpen(true);
        return;
      }
      if (flowType === 'direct') {
        try {
          await teslimEtSiparis(order.id);
          showToast('success', 'Sipariş teslim edildi olarak işaretlendi');
          invalidateOrganizasyonKartQueries(queryClient, id);
          await Promise.all([
            queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] }),
            queryClient.refetchQueries({ queryKey: ['organizasyon-siparisler', id] }),
            queryClient.refetchQueries({ queryKey: ['siparis-kartlar', Number(id)] }),
          ]);
          broadcastInvalidation([['organizasyon-kartlar'], ['organizasyon-siparisler', id], ['siparis-kartlar', Number(id)]]);
          await sendTeslimEdildiWhatsApp(order, orgKart, teslimKisi);
        } catch (e) {
          console.error(e);
          showToast('error', 'İşlem sırasında bir hata oluştu');
        }
        return;
      }
      try {
        await sendTeslimEdildiWhatsApp(order, orgKart, teslimKisi, siparisTeslimKisisiBaskasi, fotoPath);
      } catch {
        // WhatsApp gönderimi başarısız olsa bile teslim işlemi başarılı kalmalı
      }
    }
    if (pendingShareMode) {
      const mode = pendingShareMode;
      setPendingShareMode(null);
      const kart = getKartForKunye();
      if (kart && siparislerAsOrder) {
        shareOrganizasyonKart(kart, siparislerAsOrder, { mode });
      }
    }
  };

  const handleTumunuTeslimEt = () => {
    if (!id || !organizasyonKart) return;
    showToastInteractive({
      title: 'Tüm Siparişleri Teslim Et',
      message: 'Bu organizasyon kartındaki tüm siparişleri teslim edildi olarak işaretlemek istediğinize emin misiniz? WhatsApp mesajları gönderilecektir.',
      confirmText: 'Evet, tümünü teslim et',
      cancelText: 'İptal',
      onConfirm: async () => {
        const kartId = Number(id);
        const orgKart = getKartForKunye() ?? (organizasyonKart as unknown as DashboardOrganizasyonKart);
        if (isBaslangicPlan !== true) {
          let isWhatsAppConnected = false;
          let statusConnecting = false;
          try {
            const statusResponse = await apiClient.get('/whatsapp/status');
            const s = statusResponse.data;
            isWhatsAppConnected = !!(s?.installed && s?.isReady && s?.isAuthenticated && s?.lastDisconnectReason !== 'LOGOUT');
            statusConnecting = s?.status === 'connecting';
          } catch (_) {}
          if (!isWhatsAppConnected) {
            if (statusConnecting) {
              showToast('info', 'Bağlantı yeniden kuruluyor… Lütfen birkaç saniye bekleyip tekrar deneyin.');
              return;
            }
            setPendingTumunuTeslimEt({ kartId, orgKart });
            setWhatsAppQRModalOpen(true);
            return;
          }
        }
        await runTumunuTeslimEtFlow(kartId, orgKart);
      },
    });
  };


  const handleKartArsivle = () => {
    if (!id) return;
    showToastInteractive({
      title: 'Kartı Arşivle',
      message: 'Bu kartı arşivlemek istediğinize emin misiniz?',
      confirmText: 'Evet, Arşivle',
      cancelText: 'İptal',
      onConfirm: async () => {
        try {
          await arsivleOrganizasyonKart(Number(id));
          showToast('success', 'Kart başarıyla arşivlendi');
          invalidateOrganizasyonKartQueries(queryClient, id);
          navigate('/');
        } catch (error) {
          console.error('Kart arşivleme hatası:', error);
          showToast('error', 'Kart arşivlenirken bir hata oluştu.');
        }
      },
    });
  };

  const openSiparisDetay = (siparis: Siparis) => {
    setSiparisDetaySiparis(siparis);
    setSiparisDetayFetched(null);
    setSiparisDetayOpen(true);
  };

  // Detay popup açıkken ilgili siparişi backend’den çek (siparis_kodu dahil)
  useEffect(() => {
    if (!siparisDetayOpen || !siparisDetaySiparis?.id) return;
    let cancelled = false;
    apiRequest<Siparis>(`/siparis-kartlar/${siparisDetaySiparis.id}`, { method: 'GET' })
      .then((data) => {
        if (!cancelled && data && typeof data === 'object') setSiparisDetayFetched(data as Siparis);
      })
      .catch(() => { if (!cancelled) setSiparisDetayFetched(null); });
    return () => { cancelled = true; };
  }, [siparisDetayOpen, siparisDetaySiparis?.id]);
  const openSiparisEdit = (siparis: Siparis) => {
    if (!id) return;
    setSiparisEditOrder(siparisToOrder(siparis, Number(id)));
    setSiparisEditOpen(true);
  };
  /** Index ile aynı akış: önce WhatsApp kontrolü; bağlı değilse QR aç. Sonra organizasyon → foto, özel/özel gün → imza, diğerleri → onay toast + teslim + WhatsApp */
  const handleTeslimEt = async (siparis: Siparis) => {
    if (!id || !organizasyonKart) return;
    const kartTur = normalizeKartTur((organizasyonKart as any).kart_turu ?? (organizasyonKart as any).kart_tur);
    const orgKart = getKartForKunye() ?? (organizasyonKart as unknown as DashboardOrganizasyonKart);
    const order = siparisToOrder(siparis, Number(id));
    const teslimKisi = getTeslimKisiFromKart(organizasyonKart as any);

    // Index gibi: önce WhatsApp kontrolü; bağlı değilse QR aç (toast/foto/imza sonra)
    if (isBaslangicPlan !== true) {
      let isWhatsAppConnected = false;
      let statusConnecting = false;
      try {
        const statusResponse = await apiClient.get('/whatsapp/status');
        const s = statusResponse.data;
        isWhatsAppConnected = !!(s?.installed && s?.isReady && s?.isAuthenticated && s?.lastDisconnectReason !== 'LOGOUT');
        statusConnecting = s?.status === 'connecting';
      } catch (_) {}
      if (!isWhatsAppConnected) {
        if (statusConnecting) {
          showToast('info', 'Bağlantı yeniden kuruluyor… Lütfen birkaç saniye bekleyip tekrar deneyin.');
          return;
        }
        const flowType: 'foto' | 'imza' | 'direct' = kartTur === 'organizasyon' ? 'foto' : (kartTur === 'ozelgun' || kartTur === 'ozelsiparis') ? 'imza' : 'direct';
        setPendingTeslimWhatsApp({
          order,
          orgKart,
          teslimKisi,
          flowType,
          siparis: flowType === 'foto' || flowType === 'imza' ? siparis : undefined,
        });
        setWhatsAppQRModalOpen(true);
        return;
      }
    }

    // WhatsApp bağlı (veya başlangıç planı): index ile aynı akış
    if (kartTur === 'organizasyon') {
      setTeslimEdilecekSiparis(siparis);
      setTeslimFotoModalOpen(true);
      return;
    }
    if (kartTur === 'ozelgun' || kartTur === 'ozelsiparis') {
      setTeslimEdilecekSiparis(siparis);
      setImzaModalOpen(true);
      return;
    }

    // Araç süsleme ve diğerleri: onay toast → teslim + WhatsApp
    showToastInteractive({
      title: 'Sipariş Teslim Et',
      message: 'Bu siparişi teslim edildi olarak işaretlemek istediğinize emin misiniz?',
      confirmText: 'Evet, teslim edildi',
      cancelText: 'İptal',
      onConfirm: async () => {
        try {
          await teslimEtSiparis(siparis.id);
          showToast('success', 'Sipariş teslim edildi olarak işaretlendi');
          invalidateOrganizasyonKartQueries(queryClient, id);
          await Promise.all([
            queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] }),
            queryClient.refetchQueries({ queryKey: ['organizasyon-siparisler', id] }),
            queryClient.refetchQueries({ queryKey: ['siparis-kartlar', Number(id)] }),
          ]);
          broadcastInvalidation([['organizasyon-kartlar'], ['organizasyon-siparisler', id], ['siparis-kartlar', Number(id)]]);

          // Index ile uyumlu: WhatsApp bağlıysa teslim mesajı gönder, değilse QR popup açıp bağlanınca gönder (mesaj verisi ortak utils’ten)
          if (isBaslangicPlan !== true && orgKart) {
            try {
              await sendTeslimEdildiWhatsApp(order, (getKartForKunye() ?? organizasyonKart) as any, teslimKisi);
            } catch {
              // WhatsApp hatası teslimi bozmasın
            }
          }
        } catch (e) {
          console.error(e);
          showToast('error', 'İşlem sırasında bir hata oluştu');
        }
      },
    });
  };
  const openArsivSebep = (siparis: Siparis) => {
    setArsivSiparis(siparis);
    setArsivSebepOpen(true);
  };
  const onArsivSebepConfirm = async (sebep: string) => {
    setArsivSebepOpen(false);
    if (!arsivSiparis) return;
    try {
      await arsivleSiparis(arsivSiparis.id, sebep, undefined, isCiceksepeti);
      showToast('success', 'Sipariş arşivlendi');
      invalidateOrganizasyonKartQueries(queryClient, id);
      queryClient.invalidateQueries({ queryKey: ['archived-orders'] });
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] }),
        queryClient.refetchQueries({ queryKey: ['organizasyon-siparisler', id] }),
        queryClient.refetchQueries({ queryKey: ['siparis-kartlar', id] }),
        queryClient.refetchQueries({ queryKey: ['archived-orders'] }),
      ]);
      broadcastInvalidation([
        ['organizasyon-kartlar'],
        ['organizasyon-siparisler', id],
        ['siparis-kartlar', id],
        ['archived-orders'],
      ]);
    } catch (e) {
      console.error(e);
      showToast('error', 'Sipariş arşivlenirken bir hata oluştu');
    }
    setArsivSiparis(null);
  };

  const openYeniSiparis = () => {
    if (!id) return;
    const newOrder: Order = {
      id: 0,
      organizasyon_id: Number(id),
      musteriAdi: '',
      telefon: '',
      tarih: '',
      durum: 'bekliyor',
      teslimSaati: '',
      urun: '',
      tutar: 0,
    } as Order;
    setSiparisEditOrder(newOrder);
    setSiparisEditOpen(true);
  };
  const onSiparisEditSuccess = async () => {
    invalidateOrganizasyonKartQueries(queryClient, id);
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['organizasyon-kart-detail', id] }),
      queryClient.refetchQueries({ queryKey: ['organizasyon-siparisler', id] }),
      queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] }),
      queryClient.refetchQueries({ queryKey: ['siparis-kartlar', id] }),
    ]);
    setSiparisEditOpen(false);
    setSiparisEditOrder(null);
  };

  const onTeslimFotoFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files || []);
    (e.target as HTMLInputElement).value = '';
    const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    const files = rawFiles.filter((f) => IMAGE_TYPES.includes(f.type));
    if (!files.length || !id) return;
    try {
      await uploadTeslimFotolari(Number(id), files, {});
      invalidateOrganizasyonKartQueries(queryClient, id);
      showToast('success', 'Fotoğraf başarıyla yüklendi.');
    } catch (err) {
      console.error('Teslim fotoğrafı yükleme hatası:', err);
      showToast('error', 'Fotoğraf yüklenirken hata oluştu.');
    }
  }, [id, queryClient]);

  onTeslimFotoRef.current = onTeslimFotoFileChange;

  // Input'u React ağacı dışında oluştur - accept YOK (Chrome SafeBrowsing gecikmesini önler)
  useEffect(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none;';
    fotoInputRef.current = input;
    document.body.appendChild(input);
    return () => {
      if (input.parentNode) input.parentNode.removeChild(input);
      fotoInputRef.current = null;
    };
  }, []);

  const triggerFotoInput = useCallback(() => {
    const input = fotoInputRef.current;
    if (!input) return;
    input.onchange = (e) => {
      onTeslimFotoRef.current(e as unknown as React.ChangeEvent<HTMLInputElement>);
      input.onchange = null;
      input.value = '';
    };
    // setTimeout(0): React event handler'dan çık, ana thread'i serbest bırak - dialog daha hızlı açılır
    setTimeout(() => input.click(), 0);
  }, []);

  const siparislerAsOrder = React.useMemo(() => {
    if (!id || !siparisler) return [];
    return siparisler.map((s) => siparisToOrder(s, Number(id)));
  }, [siparisler, id]);

  const openWhatsappList = async () => {
    const kart = getKartForKunye();
    if (!kart) { showToast('warning', 'Kart bilgisi bulunamadı'); return; }
    let isWhatsAppConnected = false;
    try {
      const statusResponse = await apiClient.get('/whatsapp/status');
      const s = statusResponse.data;
      isWhatsAppConnected = !!(s?.installed && s?.isReady && s?.isAuthenticated && s?.lastDisconnectReason !== 'LOGOUT');
    } catch (_) {}
    if (!isWhatsAppConnected) {
      setPendingShareMode('list');
      setWhatsAppQRModalOpen(true);
      return;
    }
    shareOrganizasyonKart(kart, siparislerAsOrder, { mode: 'list' });
  };
  const openWhatsappTemplate = async () => {
    const kart = getKartForKunye();
    if (!kart) { showToast('warning', 'Kart bilgisi bulunamadı'); return; }
    let isWhatsAppConnected = false;
    try {
      const statusResponse = await apiClient.get('/whatsapp/status');
      const s = statusResponse.data;
      isWhatsAppConnected = !!(s?.installed && s?.isReady && s?.isAuthenticated && s?.lastDisconnectReason !== 'LOGOUT');
    } catch (_) {}
    if (!isWhatsAppConnected) {
      setPendingShareMode('template');
      setWhatsAppQRModalOpen(true);
      return;
    }
    shareOrganizasyonKart(kart, siparislerAsOrder, { mode: 'template' });
  };

  if (kartLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (kartError || !organizasyonKart) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ErrorState
          title="Organizasyon kartı bulunamadı"
          message={kartError instanceof Error ? kartError.message : 'Kart detayları yüklenemedi'}
        />
      </div>
    );
  }

  const kartTur = normalizeKartTur(organizasyonKart.kart_turu ?? organizasyonKart.kart_tur);
  const rawKartTur = String(organizasyonKart.kart_turu ?? organizasyonKart.kart_tur ?? '').toLowerCase();
  const isCiceksepeti = rawKartTur.includes('çiçek') || rawKartTur.includes('cicek') || rawKartTur === 'ciceksepeti';
  const kartTurDisplay = isCiceksepeti
    ? 'Çiçek Sepeti'
    : ({ organizasyon: 'Organizasyon', aracsusleme: 'Araç Süsleme', ozelgun: 'Özel Gün', ozelsiparis: 'Özel Sipariş' }[kartTur] || (organizasyonKart.kart_turu ?? 'Organizasyon'));

  /* Tablo kolonları organizasyon tipine göre: Özel Gün/Özel Sipariş = TESLİM SAATİ; Araç Süsleme = RANDEVU SAATİ; Organizasyon = ikisi de gizli */
  const showTeslimSaati = kartTur === 'ozelgun' || kartTur === 'ozelsiparis';
  const showRandevuSaati = kartTur === 'aracsusleme';
  const showTeslimKisisi = kartTur === 'ozelgun' || kartTur === 'ozelsiparis';
  const showAracBilgileri = kartTur === 'aracsusleme';
  const musteriColumnLabel = kartTur === 'aracsusleme' ? 'SAHİBİ & ARAÇ ÜZERİ YAZILAR' : 'MÜŞTERİ & ÜRÜN YAZISI';

  const backendBase = getApiBaseUrl().replace(/\/api\/?$/, '');
  const kartGorselUrl = organizasyonKart.kart_gorsel
    ? (organizasyonKart.kart_gorsel.startsWith('http')
        ? organizasyonKart.kart_gorsel
        : `${backendBase}${organizasyonKart.kart_gorsel.startsWith('/') ? organizasyonKart.kart_gorsel : '/' + organizasyonKart.kart_gorsel}`)
    : '';

  return (
    <div className="kart-detay-bg-alan min-h-screen">
      <div className="kart-detay-container">
        <div className="dashboard-header">
          <div className="baslik-alan">
            <div className="geri-don">
              <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
                <ArrowLeftCircle size={20} strokeWidth={2} aria-hidden />
                Siparişlere Geri Dön
              </a>
            </div>
            <div className="butonlar">
              <div className={`buton-disa-aktar clickdropdown order-detail-export-dropdown ${exportMenuOpen ? 'is-open' : ''}`}>
                <div className="btn-baslik">
                  <i className="icon-dashboard-disa-aktar" aria-hidden />
                  Dışa Aktar
                </div>
                <div className="dosya-tur clickdropbtn" onClick={() => setExportMenuOpen(!exportMenuOpen)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setExportMenuOpen(!exportMenuOpen)}>
                  .xls
                  <i className="fa-solid fa-chevron-down" aria-hidden />
                </div>
                {exportMenuOpen && (
                  <div className="dosya-tur-content clickdropdown-content">
                    <div className="liste-baslik">Listeyi Dışa Aktar</div>
                    <button type="button" className="btn-disa-aktar" onClick={() => handleExport('excel')}>
                      <i className="icon-disa-aktar-excel" aria-hidden />
                      Excel'e Aktar
                    </button>
                    <button type="button" className="btn-yazdir" onClick={() => handleExport('print')}>
                      <i className="icon-disa-aktar-yazdir" aria-hidden />
                      Yazdır
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="organizasyon-detaylar">
          <div className="sol-detay-alan">
            <div className="buton-alan">
              {!isCiceksepeti && (
              <button type="button" className="sp-kart-btn sp-kart-btn-primary" onClick={openYeniSiparis}>
                <i className="icon-sp-kart-detay-btn-yeni-siparis" aria-hidden />
                <span>Yeni Sipariş Oluştur</span>
              </button>
              )}
              <button
                type="button"
                className="sp-kart-btn"
                onClick={openWhatsappList}
                disabled={!siparislerAsOrder.length}
                title={!siparislerAsOrder.length ? 'Sipariş olmadığı için paylaşılamaz' : 'Whatsapp listesi paylaş'}
              >
                <i className="icon-sp-kart-detay-btn-wp-listesi-paylas" aria-hidden />
                <span>Whatsapp Listesi Paylaş</span>
              </button>
              <button type="button" className="sp-kart-btn" onClick={openWhatsappTemplate}>
                <i className="icon-sp-kart-detay-btn-musteri-wp-sablon" aria-hidden />
                <span>Müşteri Sipariş Şablonu Gönder</span>
              </button>
            </div>

            <div className={`organizasyon-kutu orgkart ${kartTur}`}>
              <div className="organizasyon-bilgileri">
                <div className="wrapper">
                  {organizasyonKart.kart_gorsel && (
                    <div className="kart-gorsel" data-lightbox-grup>
                      <img src={kartGorselUrl} alt="Kart Görseli" onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }} />
                    </div>
                  )}
                  <div className="org-bilgiler-wrapper">
                    <div className="kart-header-turler">
                      <span className="kart-tur">
                        {isCiceksepeti ? (
                          <img src="/assets/cicek-sepeti/cicek-sepeti.svg" alt="Çiçek Sepeti" className="kart-tur-ciceksepeti-logo" />
                        ) : (
                          kartTurDisplay
                        )}
                      </span>
                      {organizasyonKart.alt_tur && <span className="kart-alt-tur">{organizasyonKart.alt_tur}</span>}
                      {organizasyonKart.kart_etiket && (
                        <span className="kart-etiket">
                          <Tag className="kart-etiket-icon" aria-hidden />
                          {(organizasyonKart.kart_etiket || '').toLocaleUpperCase('tr-TR')}
                        </span>
                      )}
                    </div>
                    {kartTur === 'organizasyon' ? (
                      <div className="org-adres-bilgileri">
                        <div className="konum">{organizasyonKart.mahalle ?? '—'}</div>
                        <div className="acik-adres">{(organizasyonKart.adres ?? organizasyonKart.acik_adres) ?? '—'}</div>
                        <div className="ilce-il">
                          {(organizasyonKart.organizasyon_ilce ?? organizasyonKart.teslim_ilce) && (organizasyonKart.organizasyon_il ?? organizasyonKart.teslim_il)
                            ? `${organizasyonKart.organizasyon_ilce ?? organizasyonKart.teslim_ilce}/${organizasyonKart.organizasyon_il ?? organizasyonKart.teslim_il}`
                            : (organizasyonKart.organizasyon_ilce ?? organizasyonKart.teslim_ilce ?? organizasyonKart.organizasyon_il ?? organizasyonKart.teslim_il) ?? '—'}
                        </div>
                      </div>
                    ) : (
                      <div className="kart-aciklama">
                        {kartTur === 'aracsusleme' && (
                          <>Araç randevuları için sipariş kartları üzerindeki <span>randevu saatini dikkate alınız</span></>
                        )}
                        {kartTur === 'ozelsiparis' && !isCiceksepeti && (
                          <>Özel siparişler için sipariş kartları üzerindeki <span>teslim saatini dikkate alınız</span></>
                        )}
                        {(kartTur === 'ozelgun' || isCiceksepeti) && (
                          <>{isCiceksepeti ? 'Çiçek Sepeti' : 'Özel gün'} siparişleri için sipariş kartları üzerindeki <span>teslim saatini dikkate alınız</span></>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="wrapper">
                  <div className="sahip-ve-zaman">
                    {kartTur === 'organizasyon' && (
                      <div className="organizasyon-sahibi">
                        <i className="ikon icon-organizasyon-sahibi" aria-hidden />
                        <div className="organizasyon-bilgiler-wrapper">
                          <div className="baslik">Organizasyon Sahibi</div>
                          <div className="isim-soyisim">{(organizasyonKart.organizasyon_sahibi ?? organizasyonKart.teslim_kisisi) ?? '—'}</div>
                          {(organizasyonKart.organizasyon_sahibi_telefon ?? organizasyonKart.teslim_kisisi_telefon) ? (
                            <div className="siparis-veren-telefon">
                              <i className="icon-telefon" aria-hidden />
                              <a href={`tel:${(organizasyonKart.organizasyon_sahibi_telefon ?? organizasyonKart.teslim_kisisi_telefon)?.replace(/\D/g, '')}`} data-telefon>{formatPhoneNumber(organizasyonKart.organizasyon_sahibi_telefon ?? organizasyonKart.teslim_kisisi_telefon)}</a>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                    <div className="teslim-zaman">
                      <i className="ikon icon-teslim-tarihi-ve-saati" aria-hidden />
                      <div className="organizasyon-teslim-bilgileri-wrapper">
                        <div className="baslik">
                          {kartTur === 'aracsusleme' ? 'Randevu Tarihi' : kartTur === 'ozelgun' || kartTur === 'ozelsiparis' ? 'Teslimat Tarihi' : 'Teslimat Tarihi & Saati'}
                        </div>
                        <div className="tarih">
                          {(organizasyonKart.teslim_tarihi ?? organizasyonKart.teslim_tarih)
                            ? new Date(String(organizasyonKart.teslim_tarihi ?? organizasyonKart.teslim_tarih)).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long' })
                            : '—'}
                        </div>
                        {kartTur === 'organizasyon' && (
                          <div className="teslim-saat">
                            <div className="saat-icerik">
                              <span className="saat-etiket">Saat</span>
                              <span className="saat-veri">{(organizasyonKart.teslim_saati ?? organizasyonKart.teslim_saat ?? '') || '—'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="galeri-container">
              <div className="teslim-edilen-siparis-foto-galeri">
                <div className="headerbox">
                  <h3 className="title">
                    Teslim Edilen Siparişler Foto Galeri
                    {(fotograflar?.length ?? 0) > 0 && (
                      <span className="page-title-badge">{fotograflar?.length ?? 0}</span>
                    )}
                  </h3>
                  <button
                    type="button"
                    className="btn-yeni-resim-ekle"
                    onClick={triggerFotoInput}
                  >
                    <i className="fa-solid fa-image" aria-hidden />
                    Yeni Fotoğraf Ekle
                  </button>
                </div>
                {!fotograflar || fotograflar.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', fontSize: '13px', color: 'var(--gray-basic)' }}>Henüz fotoğraf eklenmemiş</div>
                ) : (
                  <div className="galeri-grid">
                    {fotograflar.map((foto, index) => (
                      <img
                        key={`teslim-foto-${foto.id || index}`}
                        src={foto.url}
                        alt={foto.aciklama || 'Fotoğraf'}
                        onClick={() => { setLightboxIndex(organizasyonKart.kart_gorsel ? index + 1 : index); setLightboxOpen(true); }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          showToastInteractive({
                            title: 'Fotoğrafı Sil',
                            message: 'Bu fotoğrafı silmek istediğinize emin misiniz?',
                            confirmText: 'Evet, Sil',
                            cancelText: 'İptal',
                            onConfirm: async () => {
                              try {
                                await deleteTeslimFoto(Number(id), index);
                                invalidateOrganizasyonKartQueries(queryClient, id);
                                showToast('success', 'Fotoğraf silindi.');
                              } catch (err: any) {
                                showToast('error', err?.message ?? 'Fotoğraf silinirken hata oluştu.');
                              }
                            },
                          });
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="72" height="72"%3E%3Crect fill="%23ddd" width="72" height="72"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="10"%3E?%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="sag-detay-alan">
            <div className="siparis-listesi">
              <div className="header">
                <h2 className="title">Sipariş Listesi</h2>
                <div className="sag-butonlar">
                  <button
                    type="button"
                    className="tumu-teslim-edildi"
                    disabled={(siparisler?.length ?? 0) === 0}
                    onClick={() => {
                      if ((siparisler?.length ?? 0) === 0) return;
                      handleTumunuTeslimEt();
                    }}
                    title="Tümünü Teslim Edildi İşaretle"
                  >
                    <CheckCircle size={16} strokeWidth={2} aria-hidden />
                    <span>Tümünü Teslim Edildi İşaretle</span>
                  </button>
                  {(siparisler?.length ?? 0) > 0 && (
                    <div className="toplam-siparis" title="Teslim Edilen ve Toplam Siparişler">
                      <i className="icon-toplam-siparis" aria-hidden />
                      <span>{teslimEdilenSayisi}/{toplamSiparisSayisi}</span>
                    </div>
                  )}
                </div>
              </div>

              {siparislerLoading ? (
                <div className="siparis-listesi-icerik siparis-listesi-loading"><LoadingSpinner /></div>
              ) : !siparisler || siparisler.length === 0 ? (
                <div className="siparis-listesi-icerik siparis-listesi-empty">
                  <EmptyState variant="soft" title="Bu kartta sipariş bulunmamaktadır" description="" icon={<FileSearch size={28} aria-hidden />} />
                </div>
              ) : (
                <div className="siparisler-tablo-alan">
                  <table className="siparis-kart-detay-tablosu">
                    <thead id="tablo-basliklar">
                      <tr>
                        <th className="th-sp-no">SP. NO</th>
                        <th className="th-siparis-urun">SİPARİŞ ÜRÜN</th>
                        <th className="th-arac-bilgileri" style={{ display: showAracBilgileri ? 'table-cell' : 'none' }}>ARAÇ BİLGİLERİ</th>
                        <th className="th-musteri-ve-urun-yazisi">{musteriColumnLabel}</th>
                        <th className="th-teslim-saati" style={{ display: showTeslimSaati ? 'table-cell' : 'none' }}>TESLİM SAATİ</th>
                        <th className="th-teslim-kisisi" style={{ display: showTeslimKisisi ? 'table-cell' : 'none' }}>TESLİM KİŞİSİ</th>
                        <th className="th-randevu-saati" style={{ display: showRandevuSaati ? 'table-cell' : 'none' }}>RANDEVU SAATİ</th>
                        <th className="th-partner">PARTNER SİPARİŞİ</th>
                        <th className="th-odeme">ÖDEME</th>
                        <th className="th-teslim-durum">SİPARİŞ DURUMU</th>
                        <th className="th-islem">İŞLEMLER</th>
                      </tr>
                    </thead>
                    <tbody>
                      {siparisler.map((siparis) => {
                        const urunAdi = siparis.siparis_urun ?? siparis.urun;
                        const urunGorsel = siparis.product_gorsel ?? siparis.urun_gorsel;
                        const tutar = siparis.siparis_tutari ?? siparis.tutar ?? siparis.toplam_tutar;
                        const musteriAdi = siparis.musteri_isim_soyisim ?? siparis.musteri_unvan ?? siparis.musteri_adi ?? '—';
                        const durum = normalizeSiparisDurum(siparis.status ?? siparis.durum);
                        const teslimSaati = siparis.teslim_saat ?? siparis.teslim_saati;
                        return (
                        <tr key={siparis.id} className="tablo-satir">
                          <td data-label="SP. NO">#{siparis.kart_sira ?? siparis.id}</td>
                          <td data-label="Sipariş Ürün" className="td-siparis-urun">
                            <div className="siparis-urun-hucre">
                              {isCiceksepeti ? (
                                <div className="siparis-urun-gorsel siparis-urun-ciceksepeti-emblemi">
                                  <img src="/assets/cicek-sepeti/sp-urun-ciceksepeti.png" alt="" />
                                </div>
                              ) : urunGorsel ? (
                                <div className="siparis-urun-gorsel">
                                  <img src={urunGorsel.startsWith('http') ? urunGorsel : `${backendBase}${urunGorsel.startsWith('/') ? urunGorsel : '/' + urunGorsel}`} alt="" />
                                </div>
                              ) : null}
                              <div className="siparis-urun-bilgi">
                                <span className="siparis-urun-adi">{urunAdi ?? '—'}</span>
                                {tutar != null && (
                                  <span className="siparis-urun-fiyat">+{formatTL(Number(tutar))}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td data-label="Araç Bilgileri" className="td-arac-bilgileri" style={{ display: showAracBilgileri ? 'table-cell' : 'none' }}>
                            {showAracBilgileri ? (
                              <div className="siparis-arac-bilgileri-hucre">
                                {siparis.arac_plaka ? <span className="siparis-arac-plaka">{siparis.arac_plaka}</span> : null}
                                {siparis.arac_markamodel ? <span className="siparis-arac-marka-model">{siparis.arac_markamodel}</span> : null}
                                {siparis.arac_renk ? <span className="siparis-arac-renk">{siparis.arac_renk}</span> : null}
                                {!siparis.arac_plaka && !siparis.arac_markamodel && !siparis.arac_renk ? '—' : null}
                              </div>
                            ) : null}
                          </td>
                          <td data-label={musteriColumnLabel} className="td-musteri-ve-urun-yazisi">
                            <div className="siparis-musteri-adi"><strong>{musteriAdi}</strong></div>
                            {siparis.siparis_veren_telefon ? (
                              <div className="siparis-musteri-telefon">{formatPhoneNumber(siparis.siparis_veren_telefon)}</div>
                            ) : null}
                            {siparis.secilen_urun_yazi_dosyasi ? (() => {
                              const dosyaPath = siparis.secilen_urun_yazi_dosyasi;
                              const dosyaUrl = dosyaPath.startsWith('http') ? dosyaPath : `${backendBase}${dosyaPath.startsWith('/') ? '' : '/'}${dosyaPath}`;
                              const dosyaAdi = getFileNameFromPath(dosyaPath) || dosyaPath;
                              return (
                              <div className="siparis-urun-yazisi siparis-urun-yazi-dosyasi">
                                <span className="siparis-urun-yazi-dosya-label">
                                  <FileDown size={14} aria-hidden className="siparis-urun-yazi-dosya-ikon" />
                                  <a
                                    href={dosyaUrl}
                                    download={dosyaAdi}
                                    title="Ürün yazısı dosyasını indir"
                                    className="siparis-urun-yazi-dosya-link"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); triggerDownload(dosyaUrl, dosyaAdi); }}
                                  >{dosyaAdi}</a>
                                </span>
                              </div>
                              );
                            })() : siparis.urun_yazisi ? (
                              <div className="siparis-urun-yazisi">{siparis.urun_yazisi}</div>
                            ) : null}
                          </td>
                          <td data-label="Teslim Saati" className="td-teslim-saati" style={{ display: showTeslimSaati ? 'table-cell' : 'none' }}>{teslimSaati ?? '—'}</td>
                          <td data-label="Teslim Kişisi" className="td-teslim-kisisi" style={{ display: showTeslimKisisi ? 'table-cell' : 'none' }}>
                            {showTeslimKisisi ? (
                              <div className="siparis-teslim-kisi-hucre">
                                <span className="siparis-teslim-kisi-adi">{siparis.teslim_kisisi ?? '—'}</span>
                                {siparis.teslim_kisisi_telefon ? (
                                  <span className="siparis-teslim-kisi-telefon">{formatPhoneNumber(siparis.teslim_kisisi_telefon)}</span>
                                ) : null}
                              </div>
                            ) : '—'}
                          </td>
                          <td data-label="Randevu Saati" className="td-randevu-saati" style={{ display: showRandevuSaati ? 'table-cell' : 'none' }}>{siparis.arac_randevu_saat ?? '—'}</td>
                          <td data-label="Partner Siparişi" className="td-partner">
                            {siparis.partner_firma_adi ? (
                              <div className={siparis.partner_siparis_turu === 'alinan' ? 'partner-alinan-siparisi' : 'partner-verilen-siparisi'}>
                                <span className="partner-firma">{siparis.partner_firma_adi}</span>
                                {siparis.partner_siparis_turu && <span className="partner-tur">{siparis.partner_siparis_turu === 'alinan' ? 'Alınan sipariş' : 'Verilen sipariş'}</span>}
                              </div>
                            ) : (
                              <span className="partner-yok" title="Bu sipariş partner siparişi değil">(Partner siparişi değil)</span>
                            )}
                          </td>
                          <td data-label="Ödeme">{formatOdemeYontemiDisplay(siparis.odeme_yontemi)}</td>
                          <td data-label="Sipariş Durumu" className="td-teslim-durum">
                            {durum === 'teslim' && <span className="teslim-durum-box">TESLİM</span>}
                            {durum === 'aktif' && <span className="aktif-durum-box">AKTİF</span>}
                            {durum === 'iptal' && <span className="beklemede-durum-box">İPTAL</span>}
                          </td>
                          <td data-label="İşlemler" id="islem" className="td-islem">
                            {durum === 'teslim' ? (
                              <div className="teslim-edildi-bilgi-mesaji">
                                <i className="icon-kart-menu-tumu-teslim-edildi" aria-hidden />
                                <span>Sipariş ile ilgili işlemleri Arşiv Siparişler sayfasından yapabilirsiniz.</span>
                              </div>
                            ) : (
                              <div className="islem-ikonlar">
                                <button
                                  type="button"
                                  className="islem-ikon detay-ikon"
                                  data-tooltip="Sipariş Detayları"
                                  aria-label="Sipariş Detayları"
                                  onClick={() => openSiparisDetay(siparis)}
                                >
                                  <Eye size={16} aria-hidden />
                                </button>
                                {!isCiceksepeti && (
                                <button
                                  type="button"
                                  className="islem-ikon duzenle-ikon"
                                  data-tooltip="Siparişi Düzenle"
                                  aria-label="Siparişi Düzenle"
                                  onClick={() => openSiparisEdit(siparis)}
                                >
                                  <Pencil size={16} aria-hidden />
                                </button>
                                )}
                                <button
                                  type="button"
                                  className="islem-ikon teslimedildi-ikon"
                                  data-tooltip="Teslim Edildi İşaretle"
                                  aria-label="Teslim Edildi İşaretle"
                                  onClick={() => handleTeslimEt(siparis)}
                                >
                                  <SquareCheck size={16} aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  className="islem-ikon arsivle-ikon"
                                  data-tooltip="Siparişi Arşivle"
                                  aria-label="Siparişi Arşivle"
                                  onClick={() => openArsivSebep(siparis)}
                                >
                                  <Archive size={16} aria-hidden />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ); })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Lightbox
        isOpen={lightboxOpen}
        images={(() => {
          const images: LightboxImage[] = [];
          if (kartGorselUrl) images.push({ src: kartGorselUrl, alt: 'Kart Görseli' });
          if (fotograflar?.length) images.push(...fotograflar.map(f => ({ src: f.url, alt: f.aciklama || 'Teslim Fotoğrafı', title: f.aciklama })));
          return images;
        })()}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
        enableZoom={true}
        enableSwipe={true}
      />

      {/* Click outside to close export menu */}
      {exportMenuOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setExportMenuOpen(false)}
        />
      )}

      {/* Sipariş Detay Popup — body’ye portal ile render (header/sidebar altında), iki sütunlu detay */}
      {siparisDetayOpen && siparisDetaySiparis && (() => {
        const s = siparisDetayFetched ?? siparisDetaySiparis;
        const siparisKodu = (String((s as any).siparis_kodu ?? s.siparis_kodu ?? '').trim() || String(s.kart_sira ?? s.id));
        const teslimTarihRaw = s.teslim_tarih ?? s.organizasyon_teslim_tarih;
        const teslimTarihStr = formatTeslimTarihDisplay(teslimTarihRaw);
        const teslimSaatiStr = (s.teslim_saat ?? s.teslim_saati ?? s.organizasyon_teslim_saat ?? s.arac_randevu_saat) || '—';
        const teslimTarihiSaatStr = teslimTarihStr !== '—' && teslimSaatiStr !== '—' ? `${teslimTarihStr}, Saat ${teslimSaatiStr}` : teslimTarihStr !== '—' ? teslimTarihStr : teslimSaatiStr;
        const urunAdi = s.siparis_urun ?? s.urun ?? '—';
        const urunGorsel = s.product_gorsel ?? s.urun_gorsel;
        const isCiceksepeti = (s as any).kart_tur === 'Çiçek Sepeti';
        const siparisTutari = Number(s.siparis_tutari ?? s.tutar ?? 0) || 0;
        const ekstraUcret = Number(s.ekstra_ucret_tutari ?? 0) || 0;
        const toplamTutar = Number(s.toplam_tutar) || siparisTutari + ekstraUcret;
        const teslimAdresParts = [s.mahalle, s.acik_adres, s.teslim_ilce, s.teslim_il].filter(Boolean);
        const teslimAdresStr = teslimAdresParts.length > 0 ? teslimAdresParts.join(', ') : '—';
        const musteriAdresParts = [s.musteri_neighborhood, s.musteri_address, s.musteri_district, s.musteri_city].filter(Boolean);
        const musteriAdresStr = musteriAdresParts.length > 0 ? musteriAdresParts.join(', ') : '—';
        const olusturulmaStr = s.created_at ? (() => {
          try {
            const d = new Date(s.created_at);
            return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
          } catch { return '—'; }
        })() : '—';
        const imgSrc = isCiceksepeti
          ? '/assets/cicek-sepeti/sp-urun-ciceksepeti.png'
          : (urunGorsel
            ? (urunGorsel.startsWith('http') ? urunGorsel : `${backendBase}${urunGorsel.startsWith('/') ? urunGorsel : '/' + urunGorsel}`)
            : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="56" height="56"%3E%3Crect fill="%23f0f0f0" width="56" height="56"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="10"%3E?%3C/text%3E%3C/svg%3E');
        const dosyaUrl = s.secilen_urun_yazi_dosyasi
          ? (s.secilen_urun_yazi_dosyasi.startsWith('http') ? s.secilen_urun_yazi_dosyasi : `${backendBase}${s.secilen_urun_yazi_dosyasi.startsWith('/') ? '' : '/'}${s.secilen_urun_yazi_dosyasi}`)
          : '';
        const overlay = (
          <div className="siparis-detay-overlay" role="dialog" aria-modal="true" aria-labelledby="siparis-detay-title" onClick={() => { setSiparisDetayFetched(null); setSiparisDetayOpen(false); }}>
            <div className="siparis-detay-popup" onClick={(e) => e.stopPropagation()}>
              <div className="siparis-detay-header">
                <h2 id="siparis-detay-title" className="siparis-detay-title">Sipariş Detayları</h2>
                <button type="button" className="siparis-detay-close" onClick={() => { setSiparisDetayFetched(null); setSiparisDetayOpen(false); }} aria-label="Kapat">
                  <X size={20} />
                </button>
              </div>
              <div className="siparis-detay-content">
                <div className="siparis-detay-main">
                  <div className="siparis-detay-left">
                    <div className="siparis-detay-siparis-no">
                      <span>Sipariş Kodu:</span>
                      <strong>{siparisKodu}</strong>
                    </div>
                    <div className="siparis-detay-teslim-zaman">
                      <div className="teslim-zaman-info">
                        <span className="teslim-zaman-label">Teslim Zamanı</span>
                        <span className="teslim-tarih">{teslimTarihiSaatStr}</span>
                      </div>
                    </div>
                    <div className="siparis-detay-urun-section">
                      <div className="urun-image">
                        <img src={imgSrc} alt={urunAdi} />
                      </div>
                      <div className="urun-info">
                        <div className="urun-name">{urunAdi}</div>
                        <div className="urun-price">
                          <span>Sipariş Tutarı:</span>
                          <strong>{siparisTutari > 0 ? formatTL(siparisTutari) : '—'}</strong>
                        </div>
                      </div>
                    </div>
                    <div className="siparis-detay-info-section">
                      <h4>Sipariş Bilgileri</h4>
                      <div className="info-row">
                        <span className="info-label">Ürün Yazısı</span>
                        <span className="info-value siparis-detay-urun-yazi-value">
                          {s.urun_yazisi ? (
                            <span>{s.urun_yazisi}</span>
                          ) : s.secilen_urun_yazi_dosyasi && dosyaUrl ? (
                            <span className="siparis-detay-urun-yazi-dosya-label">
                              <FileDown size={16} aria-hidden className="siparis-detay-urun-yazi-icon" />
                              Dosya: <a
                                href={dosyaUrl}
                                download={getFileNameFromPath(s.secilen_urun_yazi_dosyasi) || s.secilen_urun_yazi_dosyasi}
                                title="Ürün yazısı dosyasını indir"
                                className="siparis-detay-urun-yazi-dosya-link"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); triggerDownload(dosyaUrl, getFileNameFromPath(s.secilen_urun_yazi_dosyasi) || s.secilen_urun_yazi_dosyasi || ''); }}
                              >{getFileNameFromPath(s.secilen_urun_yazi_dosyasi) || s.secilen_urun_yazi_dosyasi}</a>
                            </span>
                          ) : (
                            '—'
                          )}
                        </span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Miktar</span>
                        <span className="info-value">1</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Ekstra Ücret</span>
                        <span className="info-value">{ekstraUcret > 0 ? formatTL(ekstraUcret) : '—'}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Toplam Tutar</span>
                        <span className="info-value">{toplamTutar > 0 ? formatTL(toplamTutar) : '—'}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Ödeme Yöntemi</span>
                        <span className="info-value">{formatOdemeYontemiDisplay(s.odeme_yontemi)}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Sipariş Durumu</span>
                        <span className="info-value">{formatSiparisDurumDisplay(s)}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Oluşturulma</span>
                        <span className="info-value">{olusturulmaStr}</span>
                      </div>
                      {s.notes && (
                        <div className="info-row full-width">
                          <span className="info-label">Not</span>
                          <span className="info-value">{s.notes}</span>
                        </div>
                      )}
                    </div>
                    {s.partner_firma_adi && (
                      <div className="siparis-detay-info-section">
                        <h4>Partner Bilgileri</h4>
                        <div className="info-row">
                          <span className="info-label">Partner Firma</span>
                          <span className="info-value">{s.partner_firma_adi}</span>
                        </div>
                      </div>
                    )}
                    {(s.arac_randevu_saat || s.arac_markamodel || s.arac_renk || s.arac_plaka) && (
                      <div className="siparis-detay-info-section">
                        <h4>Araç Bilgileri</h4>
                        {s.arac_randevu_saat && (
                          <div className="info-row">
                            <span className="info-label">Randevu Saati</span>
                            <span className="info-value">{s.arac_randevu_saat}</span>
                          </div>
                        )}
                        {s.arac_markamodel && (
                          <div className="info-row">
                            <span className="info-label">Marka / Model</span>
                            <span className="info-value">{s.arac_markamodel}</span>
                          </div>
                        )}
                        {(s.arac_renk || s.arac_plaka) && (
                          <div className="info-row">
                            <span className="info-label">Renk / Plaka</span>
                            <span className="info-value">{[s.arac_renk, s.arac_plaka].filter(Boolean).join(' / ') || '—'}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="siparis-detay-right">
                    <div className="siparis-detay-info-sections">
                      <div className="siparis-detay-info-section">
                        <h4>Müşteri Bilgileri</h4>
                        <div className="info-row">
                          <span className="info-label">Müşteri Adı</span>
                          <span className="info-value">{s.musteri_isim_soyisim ?? s.musteri_unvan ?? s.musteri_adi ?? '—'}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Telefon</span>
                          <span className="info-value">{s.siparis_veren_telefon ? formatPhoneNumber(s.siparis_veren_telefon) : '—'}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">E-posta</span>
                          <span className="info-value">{s.musteri_email || '—'}</span>
                        </div>
                        <div className="info-row full-width">
                          <span className="info-label">Adres</span>
                          <span className="info-value">{musteriAdresStr !== '—' ? musteriAdresStr : teslimAdresStr}</span>
                        </div>
                      </div>
                      <div className="siparis-detay-info-section teslimat-wrapper">
                        <h4>Teslimat Bilgileri</h4>
                        <div className="info-row">
                          <span className="info-label">Teslim Tarihi</span>
                          <span className="info-value">{teslimTarihStr}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Teslim Saati</span>
                          <span className="info-value">{teslimSaatiStr}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Teslim Kişisi</span>
                          <span className="info-value">{s.teslim_kisisi || '—'}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Teslim Telefon</span>
                          <span className="info-value">{s.teslim_kisisi_telefon ? formatPhoneNumber(s.teslim_kisisi_telefon) : '—'}</span>
                        </div>
                        <div className="info-row full-width">
                          <span className="info-label">Teslim Adresi</span>
                          <span className="info-value">{teslimAdresStr}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="siparis-detay-footer">
                <button type="button" className="siparis-detay-btn-close" onClick={() => { setSiparisDetayFetched(null); setSiparisDetayOpen(false); }}>Kapat</button>
              </div>
            </div>
          </div>
        );
        return createPortal(overlay, document.body);
      })()}

      <SiparisEditModal
        isOpen={siparisEditOpen}
        order={siparisEditOrder}
        onClose={() => { setSiparisEditOpen(false); setSiparisEditOrder(null); }}
        onSuccess={onSiparisEditSuccess}
      />

      <ArsivSebepModal
        isOpen={arsivSebepOpen}
        tip="siparis"
        onCancel={() => { setArsivSebepOpen(false); setArsivSiparis(null); }}
        onConfirm={onArsivSebepConfirm}
      />

      {showPhoneSelector && (
        <WhatsAppPhoneSelectorModal
          isOpen={true}
          contacts={whatsappContacts}
          title="Sipariş listesinin gönderileceği Whatsapp gönderim numarasını seçin"
          onSelect={(phone) => sendToContact(phone)}
          onClose={() => setShowPhoneSelector(false)}
        />
      )}

      <WhatsAppQRModal
        isOpen={whatsAppQRModalOpen}
        onClose={() => {
          setWhatsAppQRModalOpen(false);
          setPendingTumunuTeslimEt(null);
          setPendingTeslimWhatsApp(null);
          setPendingShareMode(null);
        }}
        onConnected={handleWhatsAppConnectedFromDetail}
      />

      {/* Teslim Foto Modal - organizasyon kartlarında tek sipariş teslim (index ile aynı akış) */}
      <TeslimFotoModal
        isOpen={teslimFotoModalOpen && !!teslimEdilecekSiparis}
        organizasyonId={Number(id) || 0}
        onClose={() => {
          setTeslimFotoModalOpen(false);
          setTeslimEdilecekSiparis(null);
        }}
        onSkip={async () => {
          setTeslimFotoModalOpen(false);
          if (!teslimEdilecekSiparis?.id || !id || !organizasyonKart) {
            setTeslimEdilecekSiparis(null);
            return;
          }
          const orgKart = getKartForKunye() ?? (organizasyonKart as unknown as DashboardOrganizasyonKart);
          try {
            await teslimEtSiparis(teslimEdilecekSiparis.id);
            showToast('success', 'Sipariş teslim edildi olarak işaretlendi');
            invalidateOrganizasyonKartQueries(queryClient, id);
            await Promise.all([
              queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] }),
              queryClient.refetchQueries({ queryKey: ['organizasyon-siparisler', id] }),
              queryClient.refetchQueries({ queryKey: ['siparis-kartlar', Number(id)] }),
            ]);
            broadcastInvalidation([['organizasyon-kartlar'], ['organizasyon-siparisler', id], ['siparis-kartlar', Number(id)]]);
            if (isBaslangicPlan !== true) {
              const order = siparisToOrder(teslimEdilecekSiparis, Number(id));
              const teslimKisi = getTeslimKisiFromKart(organizasyonKart as any);
              let isWhatsAppConnected = false;
              let statusConnecting = false;
              try {
                const statusResponse = await apiClient.get('/whatsapp/status');
                const s = statusResponse.data;
                isWhatsAppConnected = !!(s?.installed && s?.isReady && s?.isAuthenticated && s?.lastDisconnectReason !== 'LOGOUT');
                statusConnecting = s?.status === 'connecting';
              } catch (_) {}
              if (isWhatsAppConnected) {
                try {
                  await sendTeslimEdildiWhatsApp(order, (getKartForKunye() ?? organizasyonKart) as any, teslimKisi);
                } catch {
                  // WhatsApp hatası teslimi bozmasın
                }
              } else if (!statusConnecting) {
                setPendingTeslimWhatsApp({ order, orgKart, teslimKisi });
                setWhatsAppQRModalOpen(true);
              }
            }
          } catch (e: any) {
            console.error(e);
            showToast('error', e?.message || 'Teslim işlemi başarısız');
          }
          setTeslimEdilecekSiparis(null);
        }}
        onPhotoSelected={async (file: File) => {
          if (!teslimEdilecekSiparis?.id || !id || !organizasyonKart) {
            setTeslimFotoModalOpen(false);
            setTeslimEdilecekSiparis(null);
            return;
          }
          const orgKart = getKartForKunye() ?? (organizasyonKart as unknown as DashboardOrganizasyonKart);
          setTeslimFotoModalOpen(false);
          try {
            const uploadResult = await uploadTeslimFotolari(Number(id), [file], {
              customerId: teslimEdilecekSiparis.id?.toString() || '',
              customerUnvan: teslimEdilecekSiparis.musteri_isim_soyisim ?? teslimEdilecekSiparis.musteri_unvan ?? teslimEdilecekSiparis.musteri_adi ?? '',
            });
            await teslimEtSiparis(teslimEdilecekSiparis.id);
            showToast('success', 'Sipariş teslim edildi olarak işaretlendi');
            invalidateOrganizasyonKartQueries(queryClient, id);
            await Promise.all([
              queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] }),
              queryClient.refetchQueries({ queryKey: ['organizasyon-siparisler', id] }),
              queryClient.refetchQueries({ queryKey: ['siparis-kartlar', Number(id)] }),
            ]);
            broadcastInvalidation([['organizasyon-kartlar'], ['organizasyon-siparisler', id], ['siparis-kartlar', Number(id)]]);
            if (isBaslangicPlan !== true) {
              const order = siparisToOrder(teslimEdilecekSiparis, Number(id));
              const teslimKisi = getTeslimKisiFromKart(organizasyonKart as any);
              const fotoPath = uploadResult.files?.[0]?.path;
              let isWhatsAppConnected = false;
              let statusConnecting = false;
              try {
                const statusResponse = await apiClient.get('/whatsapp/status');
                const s = statusResponse.data;
                isWhatsAppConnected = !!(s?.installed && s?.isReady && s?.isAuthenticated && s?.lastDisconnectReason !== 'LOGOUT');
                statusConnecting = s?.status === 'connecting';
              } catch (_) {}
              if (isWhatsAppConnected) {
                try {
                  await sendTeslimEdildiWhatsApp(order, (getKartForKunye() ?? organizasyonKart) as any, teslimKisi, undefined, fotoPath);
                } catch {
                  // WhatsApp hatası teslimi bozmasın
                }
              } else if (!statusConnecting) {
                setPendingTeslimWhatsApp({ order, orgKart, teslimKisi, fotoPath });
                setWhatsAppQRModalOpen(true);
              }
            }
          } catch (e: any) {
            console.error(e);
            showToast('error', e?.message || 'İşlem başarısız');
          }
          setTeslimEdilecekSiparis(null);
        }}
      />

      {/* İmza Modal - özel sipariş / özel gün kartlarında tek sipariş teslim (index ile aynı akış) */}
      <ImzaModal
        isOpen={imzaModalOpen && !!teslimEdilecekSiparis}
        defaultTeslimKisi={teslimEdilecekSiparis?.teslim_kisisi ?? (getRawKart() as any)?.teslim_kisisi ?? (getRawKart() as any)?.organizasyon_sahibi ?? ''}
        onClose={() => {
          setImzaModalOpen(false);
          setTeslimEdilecekSiparis(null);
        }}
        onConfirm={async (teslimKisi: string, imzaData: string | null) => {
          if (!teslimEdilecekSiparis?.id || !id || !organizasyonKart) {
            setImzaModalOpen(false);
            setTeslimEdilecekSiparis(null);
            return;
          }
          const orgKart = getKartForKunye() ?? (organizasyonKart as unknown as DashboardOrganizasyonKart);
          const defaultTeslimKisi = (getRawKart() as any)?.teslim_kisisi ?? (getRawKart() as any)?.organizasyon_sahibi ?? teslimEdilecekSiparis.teslim_kisisi ?? '';
          const teslimTuru = teslimKisi === defaultTeslimKisi ? 'kendisi' : 'baskasi';
          const siparisTeslimKisisiBaskasi = teslimTuru === 'baskasi' ? teslimKisi : undefined;
          setImzaModalOpen(false);
          try {
            const archivePayload: {
              teslim_kisisi?: string;
              teslim_turu?: 'kendisi' | 'baskasi';
              siparis_teslim_kisisi_baskasi?: string;
              teslim_imza_data?: string;
            } = {
              teslim_turu: teslimTuru,
              siparis_teslim_kisisi_baskasi: siparisTeslimKisisiBaskasi ?? undefined,
              teslim_imza_data: imzaData ?? undefined,
            };
            if (teslimTuru === 'kendisi') {
              archivePayload.teslim_kisisi = (getRawKart() as any)?.teslim_kisisi ?? teslimKisi;
            }
            await arsivleSiparis(teslimEdilecekSiparis.id, 'Teslim Edildi', archivePayload);
            showToast('success', 'Sipariş teslim edildi olarak işaretlendi');
            invalidateOrganizasyonKartQueries(queryClient, id);
            await Promise.all([
              queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] }),
              queryClient.refetchQueries({ queryKey: ['organizasyon-siparisler', id] }),
              queryClient.refetchQueries({ queryKey: ['siparis-kartlar', Number(id)] }),
            ]);
            broadcastInvalidation([['organizasyon-kartlar'], ['organizasyon-siparisler', id], ['siparis-kartlar', Number(id)]]);
            if (isBaslangicPlan !== true) {
              const order = siparisToOrder(teslimEdilecekSiparis, Number(id));
              const gercekTeslimKisi = teslimTuru === 'kendisi' ? ((getRawKart() as any)?.teslim_kisisi || teslimKisi) : teslimKisi;
              let isWhatsAppConnected = false;
              let statusConnecting = false;
              try {
                const statusResponse = await apiClient.get('/whatsapp/status');
                const s = statusResponse.data;
                isWhatsAppConnected = !!(s?.installed && s?.isReady && s?.isAuthenticated && s?.lastDisconnectReason !== 'LOGOUT');
                statusConnecting = s?.status === 'connecting';
              } catch (_) {}
              if (isWhatsAppConnected) {
                try {
                  await sendTeslimEdildiWhatsApp(order, (getKartForKunye() ?? organizasyonKart) as any, gercekTeslimKisi, siparisTeslimKisisiBaskasi);
                } catch {
                  // WhatsApp hatası teslimi bozmasın
                }
              } else if (!statusConnecting) {
                setPendingTeslimWhatsApp({ order, orgKart, teslimKisi: gercekTeslimKisi, siparisTeslimKisisiBaskasi });
                setWhatsAppQRModalOpen(true);
              }
            }
          } catch (e: any) {
            console.error(e);
            showToast('error', e?.message || 'İşlem başarısız');
          }
          setTeslimEdilecekSiparis(null);
        }}
      />
    </div>
  );
};

