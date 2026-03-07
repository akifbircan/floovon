import React, { useMemo, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { ErrorState } from '../../../shared/components/ErrorState';
import { EmptyState } from '../../../shared/components/EmptyState';
import { usePageAnimations } from '../../../shared/hooks/usePageAnimations';
import { showToast, showToastInteractive } from '../../../shared/utils/toastUtils';
import { broadcastInvalidation } from '../../../lib/crossTabInvalidate';
import { SearchInput } from '../../../shared/components/SearchInput';
import { formatPhoneNumber, formatOdemeYontemiDisplay, formatAddressDisplay, formatTL } from '../../../shared/utils/formatUtils';
import { Eye, Calendar, CalendarDays, CalendarCheck, RotateCcw, X } from 'lucide-react';
import '../../../styles/arsiv-siparisler.css';

/** Backend'den gelen arşivlenmiş sipariş kartı */
interface ArchivedOrder {
  id: number;
  organizasyon_kart_id?: number;
  musteri_unvan?: string;
  musteri_isim_soyisim?: string;
  siparis_veren_telefon?: string;
  teslim_kisisi?: string;
  teslim_kisisi_telefon?: string;
  siparis_urun?: string;
  urun_yazisi?: string;
  siparis_tutari?: number;
  ekstra_ucret_tutari?: number;
  toplam_tutar?: number;
  odeme_yontemi?: string;
  teslim_tarih?: string;
  teslim_saat?: string;
  organizasyon_teslim_saat?: string; /* organizasyon kartından */
  acik_adres?: string;
  teslim_il?: string;
  teslim_ilce?: string;
  teslim_mahalle?: string;
  arsivleme_sebebi?: string;
  arsivleme_tarih?: string;
  partner_firma_adi?: string;
  partner_siparis_turu?: string;
  organizasyon_kart_tur?: string;
  kart_tur?: string; /* backend alias */
  organizasyon_kart_etiket?: string;
  org_mahalle?: string;
  org_acik_adres?: string;
  organizasyon_teslimat_konumu?: string;
  siparis_teslim_kisisi_baskasi?: string;
  arsivli?: number | boolean | null;
  status?: string; /* aktif | teslim_edildi - teslim edilmiş olanlar geri yüklenemez */
  /** Özel sipariş/özel gün teslim edildi imza görseli (base64 data URL) */
  teslim_imza_data?: string | null;
}

/** "Teslim Edildi" arşiv sebebi: hover'da imza tooltip, tıklamada imza popup (eski sistemle uyumlu) */
function TeslimEdildiSebepCell({
  arsivlemeSebebi,
  teslimImzaData,
  teslimKisi,
}: {
  arsivlemeSebebi: string | undefined;
  teslimImzaData: string | null | undefined;
  teslimKisi: string;
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const linkRef = useRef<HTMLSpanElement>(null);

  const isTeslimEdildiWithImza = (arsivlemeSebebi === 'Teslim Edildi' || arsivlemeSebebi === 'teslim-edildi') && teslimImzaData && teslimImzaData.trim();

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    if (!isTeslimEdildiWithImza) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top });
  }, [isTeslimEdildiWithImza]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isTeslimEdildiWithImza) setPopupOpen(true);
  }, [isTeslimEdildiWithImza]);

  if (!isTeslimEdildiWithImza) {
    return <>{arsivlemeSebebi || <span className="td-empty">—</span>}</>;
  }

  const displayKisi = teslimKisi || 'Bilinmiyor';
  const imzaSrc = (teslimImzaData || '').trim();

  return (
    <>
      <span
        ref={linkRef}
        className="teslim-edildi-sebep-link"
        role="button"
        tabIndex={0}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPopupOpen(true); } }}
        title="Teslim imzasını görmek için tıklayın"
      >
        {arsivlemeSebebi}
      </span>
      {tooltip && createPortal(
        <div
          className="teslim-edildi-imza-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="teslim-edildi-imza-tooltip-kisi">{displayKisi}</div>
          <img src={imzaSrc} alt="Teslim imzası" className="teslim-edildi-imza-tooltip-img" />
        </div>,
        document.body
      )}
      {popupOpen && createPortal(
        <div
          className="imza-popup-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="imza-popup-title"
          onClick={() => setPopupOpen(false)}
        >
          <div className="imza-popup" onClick={(e) => e.stopPropagation()}>
            <div className="imza-popup-header">
              <h3 id="imza-popup-title">Teslim İmzası</h3>
              <button type="button" className="imza-popup-close" onClick={() => setPopupOpen(false)} aria-label="Kapat">
                <X size={20} />
              </button>
            </div>
            <div className="imza-popup-content">
              <div className="imza-teslim-kisi">
                <strong>Teslim Alan Kişi:</strong>
                <span>{displayKisi}</span>
              </div>
              <div className="imza-gorsel-wrapper">
                <img src={imzaSrc} alt="Teslim İmzası" />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

/** Backend Türkçe veya slug değerini filtre slug'ına çevirir */
function normalizeOrgTurToSlug(val: string | undefined): string {
  const v = String(val || '').trim();
  const vLower = v.toLowerCase();
  const ascii = vLower.replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/\s/g, '');
  if (vLower === 'organizasyon' || vLower === 'düğün' || vLower === 'dugun' || ascii === 'organizasyon') return 'organizasyon';
  if (vLower === 'aracsusleme' || ascii === 'aracsusleme') return 'aracsusleme';
  if (vLower === 'ozelgun' || ascii === 'ozelgun') return 'ozelgun';
  if (vLower === 'ozelsiparis' || ascii === 'ozelsiparis') return 'ozelsiparis';
  return ascii || vLower;
}

function maybeEmpty(val: string): React.ReactNode {
  return val === '—' ? <span className="td-empty">—</span> : val;
}

function getHaftaBaslangic(d: Date): string {
  const daysSinceMonday = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - daysSinceMonday);
  return monday.toISOString().slice(0, 10);
}

function getHaftaBitis(d: Date): string {
  const hb = new Date(getHaftaBaslangic(d));
  hb.setDate(hb.getDate() + 6);
  return hb.toISOString().slice(0, 10);
}

function formatTarihUzun(val: string | undefined): string {
  if (!val) return 'Bilinmeyen Tarih';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    const gun = d.getDate();
    const ay = AYLAR[d.getMonth()];
    const yil = d.getFullYear();
    const gunler = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const gunAdi = gunler[d.getDay()];
    return `${gun} ${ay} ${yil} ${gunAdi}`;
  } catch {
    return val;
  }
}

function formatTarihKisa(val: string | undefined): string {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('tr-TR');
  } catch {
    return val;
  }
}

/**
 * Arşiv Siparişler sayfası
 * Gruplama: Ay/Yıl > Hafta > Organizasyon > Sipariş satırları
 */
export const OrdersPage: React.FC = () => {
  usePageAnimations('orders');
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [organizasyonTuruFilter, setOrganizasyonTuruFilter] = useState<string>('all');
  const [arsivSebebiFilter, setArsivSebebiFilter] = useState<string>('all');

  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ['archived-orders'],
    queryFn: async () => {
      try {
        const result = await apiRequest<ArchivedOrder[] | { data?: ArchivedOrder[] }>('/siparis-kartlar/archived', {
          method: 'GET',
        });
        const arr = Array.isArray(result) ? result : (result?.data ?? []);
        return Array.isArray(arr) ? arr : [];
      } catch (err) {
        if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 404) {
          return [];
        }
        throw err;
      }
    },
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const orders: ArchivedOrder[] = Array.isArray(rawData) ? rawData : [];

  const filteredOrders = useMemo(() => {
    let list = [...orders];
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter((o) => {
        const musteri = (o.musteri_unvan || o.musteri_isim_soyisim || '').toLowerCase();
        const telefon = (o.siparis_veren_telefon || '').toLowerCase();
        const urun = (o.siparis_urun || o.urun_yazisi || '').toLowerCase();
        const adres = (o.acik_adres || o.org_mahalle || o.organizasyon_teslimat_konumu || '').toLowerCase();
        const sebep = (o.arsivleme_sebebi || '').toLowerCase();
        return musteri.includes(q) || telefon.includes(q) || urun.includes(q) || adres.includes(q) || sebep.includes(q);
      });
    }
    if (dateFilter) {
      list = list.filter((o) => {
        const d = o.teslim_tarih || o.arsivleme_tarih;
        if (!d) return false;
        const orderDate = new Date(d);
        const orderDateStr = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`;
        return orderDateStr === dateFilter;
      });
    }
    if (organizasyonTuruFilter !== 'all') {
      list = list.filter((o) => {
        const raw = o.organizasyon_kart_tur || o.kart_tur || '';
        const orderSlug = normalizeOrgTurToSlug(raw);
        return orderSlug === organizasyonTuruFilter.toLowerCase().trim();
      });
    }
    if (arsivSebebiFilter !== 'all') {
      list = list.filter((o) => (o.arsivleme_sebebi || '') === arsivSebebiFilter);
    }
    return list;
  }, [orders, searchQuery, dateFilter, organizasyonTuruFilter, arsivSebebiFilter]);

  const arsivSebepleri = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.arsivleme_sebebi) set.add(o.arsivleme_sebebi);
    });
    return Array.from(set).sort();
  }, [orders]);

  /** Gruplama: Ay/Yıl > Hafta > Organizasyon > Siparişler */
  const groupedData = useMemo(() => {
    const ayYilMap: Record<string, Record<string, ArchivedOrder[]>> = {};
    for (const o of filteredOrders) {
      const tarihStr = o.teslim_tarih || o.arsivleme_tarih;
      if (!tarihStr) continue;
      const d = new Date(tarihStr);
      if (isNaN(d.getTime())) continue;
      const ayYil = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const haftaKey = getHaftaBaslangic(d);
      if (!ayYilMap[ayYil]) ayYilMap[ayYil] = {};
      if (!ayYilMap[ayYil][haftaKey]) ayYilMap[ayYil][haftaKey] = [];
      ayYilMap[ayYil][haftaKey].push(o);
    }
    return ayYilMap;
  }, [filteredOrders]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setDateFilter('');
    setOrganizasyonTuruFilter('all');
    setArsivSebebiFilter('all');
  };

  const handleGeriGetir = (order: ArchivedOrder) => {
    showToastInteractive({
      title: 'Siparişi Geri Yükle',
      message: `"${order.musteri_unvan || order.musteri_isim_soyisim || 'Sipariş'}" arşivden geri yüklensin mi?`,
      confirmText: 'Evet, Geri Yükle',
      cancelText: 'İptal',
      onConfirm: async () => {
        try {
          await apiRequest(`/siparis-kartlar/${order.id}/unarchive`, { method: 'PATCH' });
          showToast('success', 'Sipariş arşivden geri yüklendi');
          const orgId = order.organizasyon_kart_id ?? (order as any).organizasyon_id;
          const orgIdStr = orgId != null ? String(orgId) : null;
          queryClient.invalidateQueries({ queryKey: ['archived-orders'] });
          queryClient.invalidateQueries({ queryKey: ['organizasyon-kartlar'] });
          queryClient.invalidateQueries({ queryKey: ['siparis-kartlar'] });
          if (orgIdStr) {
            queryClient.invalidateQueries({ queryKey: ['organizasyon-siparisler', orgIdStr] });
            queryClient.invalidateQueries({ queryKey: ['organizasyon-kart-detail', orgIdStr] });
          }
          await Promise.all([
            queryClient.refetchQueries({ queryKey: ['archived-orders'] }),
            queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] }),
            queryClient.refetchQueries({ queryKey: ['siparis-kartlar'] }),
            ...(orgIdStr ? [
              queryClient.refetchQueries({ queryKey: ['organizasyon-siparisler', orgIdStr] }),
              queryClient.refetchQueries({ queryKey: ['organizasyon-kart-detail', orgIdStr] }),
            ] : []),
          ]);
          broadcastInvalidation([
            ['archived-orders'],
            ['organizasyon-kartlar'],
            ['siparis-kartlar'],
            ...(orgIdStr ? [['organizasyon-siparisler', orgIdStr], ['organizasyon-kart-detail', orgIdStr]] : []),
          ]);
        } catch (err: unknown) {
          const e = err as any;
          if (e?.status === 404) {
            showToast('error', 'Sipariş arşivde bulunamadı veya zaten geri yüklenmiş.');
          } else {
            showToast('error', e?.message || 'İşlem başarısız');
          }
        }
      },
    });
  };

  const tutarHesapla = (o: ArchivedOrder) => {
    const t = o.toplam_tutar ?? (Number(o.siparis_tutari || 0) + Number(o.ekstra_ucret_tutari || 0));
    return t;
  };

  const getOrganizasyonGrupKey = (o: ArchivedOrder): string => {
    const tur = o.organizasyon_kart_tur || o.kart_tur || '';
    const tarihFormatted = formatTarihUzun(o.teslim_tarih || o.arsivleme_tarih);
    const konum = o.organizasyon_teslimat_konumu || o.org_mahalle || o.teslim_mahalle || '';

    if (tur === 'aracsusleme') {
      return `${tarihFormatted} - Araç Süsleme`;
    }
    if (tur === 'ozelgun' || tur === 'ozelsiparis') {
      const turAdi = tur === 'ozelgun' ? 'Özel Gün' : 'Özel Sipariş';
      const etiket = o.organizasyon_kart_etiket || '';
      return etiket ? `${tarihFormatted} - ${turAdi} - ${etiket}` : `${tarihFormatted} - ${turAdi}`;
    }
    const turAdi = tur === 'organizasyon' ? 'Düğün' : tur || 'Organizasyon';
    return `${tarihFormatted} - ${turAdi} - ${konum || 'Belirtilmemiş'}`;
  };

  const getOrganizasyonDisplayParts = (o: ArchivedOrder): string[] => {
    const turRaw = o.organizasyon_kart_tur || o.kart_tur || '';
    const tur = turRaw
      ? (turRaw === 'organizasyon' ? 'Düğün' :
         turRaw === 'aracsusleme' ? 'Araç Süsleme' :
         turRaw === 'ozelgun' ? 'Özel Gün' :
         turRaw === 'ozelsiparis' ? 'Özel Sipariş' : turRaw)
      : '';
    const konum = o.organizasyon_teslimat_konumu || o.org_mahalle || '';
    const sahip = o.teslim_kisisi || o.musteri_unvan || o.musteri_isim_soyisim || '';
    return [tur, sahip, konum].filter(Boolean);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper min-h-screen flex flex-col p-6">
        <ErrorState
          title="Arşiv siparişleri yüklenemedi"
          message={error instanceof Error ? error.message : 'Bilinmeyen hata'}
        />
      </div>
    );
  }

  const ayYilEntries = Object.entries(groupedData).sort(([a], [b]) => b.localeCompare(a));

  return (
    <div className="page-wrapper page-wrapper--full flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden p-6">
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div>
          <h1 className="page-title">
            Arşivlenen Siparişler
            {filteredOrders.length > 0 && (
              <span className="page-title-badge">{filteredOrders.length}</span>
            )}
          </h1>
        </div>

        <div className="arsiv-baslik-alan">
          <div className="arsiv-filtreler">
            <div className="arsiv-filtre-item">
              <label htmlFor="arsiv-date">TARİH:</label>
              <input
                id="arsiv-date"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
            <div className="arsiv-filtre-item">
              <label htmlFor="arsiv-org-tur">ORGANİZASYON TÜRÜ:</label>
              <select
                id="arsiv-org-tur"
                value={organizasyonTuruFilter}
                onChange={(e) => setOrganizasyonTuruFilter(e.target.value)}
              >
                <option value="all">Tümü</option>
                <option value="organizasyon">Organizasyon</option>
                <option value="aracsusleme">Araç Süsleme</option>
                <option value="ozelgun">Özel Gün</option>
                <option value="ozelsiparis">Özel Sipariş</option>
              </select>
            </div>
            <div className="arsiv-filtre-item">
              <label htmlFor="arsiv-sebep">ARŞİV SEBEBİ:</label>
              <select
                id="arsiv-sebep"
                value={arsivSebebiFilter}
                onChange={(e) => setArsivSebebiFilter(e.target.value)}
              >
                <option value="all">Tümü</option>
                {arsivSebepleri.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={handleClearFilters} className="arsiv-btn-filtre-reset">
              Filtreleri Temizle
            </button>
          </div>
          <div className="arsiv-sag-alan arsiv-search-wrapper">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Arşiv içerisinde arayın"
              className="page-search-input"
              aria-label="Arşiv ara"
            />
          </div>
        </div>

        {!filteredOrders.length ? (
          <EmptyState
            title={orders.length ? 'Arama sonucu bulunamadı' : 'Arşivlenen kart bulunamadı'}
            description={orders.length ? 'Farklı filtreler deneyin.' : 'Farklı tarihlerde sorgulama yapabilirsiniz.'}
          />
        ) : (
          <div className="arsiv-table-wrapper flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="arsiv-table-scroll table-scrollbar flex-1 min-h-0 overflow-auto">
              <table className="arsiv-tablosu">
                <thead>
                  <tr>
                    <th>TARİH</th>
                    <th>TESLİM SAATİ</th>
                    <th>ORGANİZASYON</th>
                    <th>SİPARİŞ VEREN KİŞİ</th>
                    <th>TESLİM EDİLECEK KİŞİ</th>
                    <th>ADRES</th>
                    <th>ÜRÜN</th>
                    <th>TUTAR VE EK ÜCRETLER</th>
                    <th>ÖDEME TÜRÜ</th>
                    <th>PARTNER</th>
                    <th>ARŞİV SEBEBİ</th>
                    <th>İŞLEMLER</th>
                  </tr>
                </thead>
                <tbody>
                  {ayYilEntries.map(([ayYil, haftalar]) => {
                    const [yil, ay] = ayYil.split('-');
                    const ayAdi = ay && yil
                      ? `${AYLAR[parseInt(ay) - 1] || ay} ${yil}`
                      : ayYil;

                    return (
                      <React.Fragment key={ayYil}>
                        <tr className="baslik-satiri">
                          <td colSpan={12} className="grup-baslik ay">
                            <span className="grup-baslik-inner">
                              <Calendar size={16} />
                              {ayAdi}
                            </span>
                          </td>
                        </tr>
                        {Object.entries(haftalar)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([haftaKey, siparisler]) => {
                            const hb = new Date(haftaKey);
                            const hbStr = `${hb.getDate()} ${AYLAR[hb.getMonth()]} ${GUNLER[hb.getDay()]}`;
                            const hbitis = getHaftaBitis(hb);
                            const hbitisD = new Date(hbitis);
                            const hbitisStr = `${hbitisD.getDate()} ${AYLAR[hbitisD.getMonth()]} ${GUNLER[hbitisD.getDay()]}`;

                            return (
                              <React.Fragment key={haftaKey}>
                                <tr className="baslik-satiri">
                                  <td colSpan={12} className="hafta-baslik">
                                    <span className="grup-baslik-inner">
                                      <CalendarDays size={14} />
                                      {hbStr} - {hbitisStr}
                                    </span>
                                  </td>
                                </tr>
                                {(() => {
                                  const orgGruplari: Record<string, ArchivedOrder[]> = {};
                                  siparisler.forEach((o) => {
                                    const key = getOrganizasyonGrupKey(o);
                                    if (!orgGruplari[key]) orgGruplari[key] = [];
                                    orgGruplari[key].push(o);
                                  });
                                  return Object.entries(orgGruplari).map(([grupBaslik, liste]) => {
                                    const orgKartId = liste[0]?.organizasyon_kart_id;
                                    return (
                                      <React.Fragment key={grupBaslik}>
                                        <tr className="baslik-satiri">
                                          <td colSpan={12} className="grup-baslik organizasyon">
                                            <div className="grup-baslik-icerik">
                                              <span className="grup-baslik-metin">
                                                <CalendarCheck size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
                                                {grupBaslik}
                                              </span>
                                              {orgKartId && (
                                                <Link
                                                  to={`/siparis-kart-detay/${orgKartId}`}
                                                  className="detay-buton"
                                                  title="Sipariş Detayları"
                                                >
                                                  <Eye size={14} /> Sipariş Detayları
                                                </Link>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                        {liste.map((o) => (
                                          <tr key={o.id} className="grup-satir-row">
                                            <td data-label="Tarih">{maybeEmpty(formatTarihKisa(o.teslim_tarih || o.arsivleme_tarih))}</td>
                                            <td data-label="Teslim Saati">{o.teslim_saat || o.organizasyon_teslim_saat || <span className="td-empty">—</span>}</td>
                                            <td data-label="Organizasyon">
                                              {(() => {
                                                const parts = getOrganizasyonDisplayParts(o);
                                                if (!parts.length) return maybeEmpty('');
                                                return (
                                                  <div className="arsiv-org-hucre">
                                                    {parts.map((p, i) => (
                                                      <span key={i} className="arsiv-org-hucre-satir">{p}</span>
                                                    ))}
                                                  </div>
                                                );
                                              })()}
                                            </td>
                                            <td data-label="Sipariş Veren Kişi">
                                              <div className="td-icerik">
                                                <span>{o.musteri_unvan || o.musteri_isim_soyisim || <span className="td-empty">—</span>}</span>
                                                {o.siparis_veren_telefon && (
                                                  <small>{formatPhoneNumber(o.siparis_veren_telefon)}</small>
                                                )}
                                              </div>
                                            </td>
                                            <td data-label="Teslim Edilecek Kişi">
                                              <div className="td-icerik">
                                                <span>{o.siparis_teslim_kisisi_baskasi ? `(Başkası) ${o.siparis_teslim_kisisi_baskasi}` : (o.teslim_kisisi || <span className="td-empty">—</span>)}</span>
                                                {o.teslim_kisisi_telefon && (
                                                  <small>{formatPhoneNumber(o.teslim_kisisi_telefon)}</small>
                                                )}
                                              </div>
                                            </td>
                                            <td data-label="Adres">
                                              <div className="td-icerik">
                                                {o.organizasyon_teslimat_konumu && <span style={{ fontWeight: 600 }}>{formatAddressDisplay(o.organizasyon_teslimat_konumu)}</span>}
                                                <span>{formatAddressDisplay(o.org_mahalle || o.teslim_mahalle) || o.acik_adres || <span className="td-empty">—</span>}</span>
                                              </div>
                                            </td>
                                            <td data-label="Ürün">{o.siparis_urun || o.urun_yazisi || <span className="td-empty">—</span>}</td>
                                            <td data-label="Tutar">
                                              {tutarHesapla(o) > 0
                                                ? formatTL(tutarHesapla(o))
                                                : <span className="td-empty">—</span>}
                                            </td>
                                            <td data-label="Ödeme Türü">{maybeEmpty(formatOdemeYontemiDisplay(o.odeme_yontemi))}</td>
                                            <td data-label="Partner">
                                              <div className="td-icerik">
                                                {o.partner_siparis_turu && (
                                                  <small>{o.partner_siparis_turu === 'verilen' ? 'Partnere Verilen' : 'Partnerden Gelen'}</small>
                                                )}
                                                {o.partner_firma_adi || <span className="td-empty">—</span>}
                                              </div>
                                            </td>
                                            <td data-label="Arşiv Sebebi">
                                              <TeslimEdildiSebepCell
                                                arsivlemeSebebi={o.arsivleme_sebebi}
                                                teslimImzaData={o.teslim_imza_data}
                                                teslimKisi={o.siparis_teslim_kisisi_baskasi || o.teslim_kisisi || ''}
                                              />
                                            </td>
                                            <td data-label="İşlemler">
                                              <button
                                                type="button"
                                                className="arsiv-geri-getir-btn"
                                                onClick={() => handleGeriGetir(o)}
                                                title="Arşivden geri yükle"
                                              >
                                                <RotateCcw size={14} />
                                                Geri Yükle
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      </React.Fragment>
                                    );
                                  });
                                })()}
                              </React.Fragment>
                            );
                          })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
