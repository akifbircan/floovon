import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import '../styles/reports-page.css';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { EmptyState } from '../../../shared/components/EmptyState';
import AnimatedCounter from '../../../shared/components/AnimatedCounter';
import { usePageAnimations } from '../../../shared/hooks/usePageAnimations';
import { showToast, showToastInteractive } from '../../../shared/utils/toastUtils';
import { getPrintLogoAndFooter, openPrintWindow, downloadTableAsExcel, buildPrintHtml, getPrintDateDDMMYYYY } from '../../dashboard/utils/exportUtils';
import { formatPhoneNumber, formatTL, parseTL, formatTutarInputLive, formatTutarInputKeyDown, formatTLDisplayValue } from '../../../shared/utils/formatUtils';
import { Eye, Pencil, Trash2, TurkishLira, Banknote, Wallet, Flame, Users, ShoppingCart, TrendingUp, Calculator, ChevronDown } from 'lucide-react';
import { TableSortHeader } from '../../../shared/components/TableSortHeader';
import { useTheme } from '../../../shared/hooks/useTheme';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';

interface SatisRaporu {
  id: string;
  tarih: string;
  fisNo: string;
  satisTuru: string;
  musteri: string;
  urun: string;
  miktar: number;
  tutar: number;
  organizasyonBilgisi?: string | null;
  isSicakSatis?: boolean;
  sicakSatisId?: number;
}

const SATIS_TURU_LABELS: Record<string, string> = {
  nakit: 'NAKİT',
  pos: 'POS',
  havale_eft: 'HAVALE/EFT',
  havale: 'HAVALE/EFT',
  eft: 'HAVALE/EFT',
  musteri_cari: 'CARİ HESAP',
  cari: 'CARİ HESAP',
  sicak_satis: 'Sıcak Satış',
};

/** Tüm satış türleri – chart'ta her zaman gösterilir (veri olsun olmasın) */
const TUM_SATIS_TURLERI_CHART = ['NAKİT', 'POS', 'HAVALE/EFT', 'CARİ HESAP', 'Sıcak Satış'] as const;

function normalizeSatisTuru(val: string): string {
  const v = (val || '').toLowerCase().trim();
  if (v === 'havale' || v === 'eft' || v === 'havale_eft') return 'havale_eft';
  if (v === 'cari' || v === 'musteri_cari' || v.includes('cari') || v.includes('hesap')) return 'musteri_cari';
  if (v === 'pos' || v.includes('pos') || v.includes('kredi') || v.includes('kart')) return 'pos';
  return v || 'nakit';
}

export const ReportsPage: React.FC = () => {
  usePageAnimations('reports');
  const isDark = useTheme();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'satis' | 'musteri'>('satis');
  const [baslangicTarihi, setBaslangicTarihi] = useState('');
  const [bitisTarihi, setBitisTarihi] = useState('');
  const [satisTuruFilter, setSatisTuruFilter] = useState<string>('tumunu');
  const [urunFilter, setUrunFilter] = useState<string>('tumunu');
  const [musteriFilter, setMusteriFilter] = useState<string>('tumunu');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [sortSatisField, setSortSatisField] = useState<string | null>(null);
  const [sortSatisDir, setSortSatisDir] = useState<'asc' | 'desc'>('asc');
  const [sortMusteriField, setSortMusteriField] = useState<string | null>(null);
  const [sortMusteriDir, setSortMusteriDir] = useState<'asc' | 'desc'>('asc');
  const [detayModal, setDetayModal] = useState<SatisRaporu | null>(null);
  const [duzenleModal, setDuzenleModal] = useState<SatisRaporu | null>(null);
  const [duzenleForm, setDuzenleForm] = useState({ urunAdi: '', adet: 1, fiyat: '', satisTuru: 'nakit' });

  const { data: sicakSatislar = [], isLoading: loadingSicak } = useQuery({
    queryKey: ['sicak-satislar'],
    queryFn: async () => {
      const res = await apiRequest<unknown>('/sicak-satislar', { method: 'GET' });
      return Array.isArray(res) ? res : [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: archivedSiparisler = [], isLoading: loadingArchived } = useQuery({
    queryKey: ['siparis-kartlar-archived'],
    queryFn: async () => {
      const res = await apiRequest<unknown>('/siparis-kartlar/archived', { method: 'GET' });
      const data = Array.isArray(res) ? res : [];
      return (data as Record<string, unknown>[]).filter((s) => {
        const t = parseFloat(String(s.siparis_tutari || s.toplam_tutar || 0));
        return t > 0;
      });
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: musteriRaporlariRaw = [], isLoading: loadingMusteri } = useQuery({
    queryKey: ['musteri-raporlari'],
    queryFn: async () => {
      const res = await apiRequest<unknown>('/musteri-raporlari', { method: 'GET' });
      return Array.isArray(res) ? res : [];
    },
    staleTime: 2 * 60 * 1000,
    enabled: activeTab === 'musteri',
  });

  const satisRaporlari = useMemo(() => {
    const sicak: SatisRaporu[] = (sicakSatislar as Record<string, unknown>[]).map((s, i) => {
      const created = s.created_at ? new Date(s.created_at as string) : new Date();
      const tarih = created.toLocaleDateString('tr-TR') + ' ' + created.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      let musteri = 'Sıcak Satış';
      if (s.aciklama && String(s.aciklama).includes('Teslim Edilen Sipariş')) {
        const m = String(s.aciklama).match(/Teslim Edilen Sipariş\s*-\s*(.+)/);
        if (m?.[1]) musteri = m[1].trim();
      }
      return {
        id: `ss_${s.id || i}`,
        tarih,
        fisNo: `SS-${new Date().getFullYear()}-${String(s.id || i).padStart(6, '0')}`,
        satisTuru: normalizeSatisTuru((s.satis_turu as string) || 'nakit'),
        musteri,
        urun: (s.urun_adi as string) || 'Bilinmeyen',
        miktar: Number(s.miktar) || 1,
        tutar: Math.min(parseFloat(String(s.tutar || 0)), 10000),
        isSicakSatis: true,
        sicakSatisId: s.id as number,
      };
    });

    const siparis: SatisRaporu[] = (archivedSiparisler as Record<string, unknown>[]).map((s, i) => {
      const teslim = s.teslim_tarih || s.arsivleme_tarih || s.created_at;
      const d = teslim ? new Date(teslim as string) : new Date();
      const tarih = d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const odeme = (s.odeme_yontemi as string) || '';
      const odemeLower = odeme.toLowerCase();
      let satisTuru = 'nakit';
      if (odemeLower.includes('sicak') || odemeLower.includes('sıcak')) satisTuru = 'nakit';
      else if (odemeLower.includes('pos') || odemeLower.includes('kredi') || odemeLower.includes('kart')) satisTuru = 'pos';
      else if (odemeLower.includes('havale') || odemeLower.includes('eft')) satisTuru = 'havale_eft';
      else if (odemeLower.includes('cari') || odemeLower.includes('hesap')) satisTuru = 'musteri_cari';
      const musteri = (s.musteri_unvan as string) || (s.musteri_isim_soyisim as string) || 'Bilinmeyen';
      const urun = (s.siparis_urun as string) || (s.urun_yazisi as string) || 'Bilinmeyen';
      const tutar = s.toplam_tutar ? parseFloat(String(s.toplam_tutar)) : (parseFloat(String(s.siparis_tutari || 0)) + parseFloat(String(s.ekstra_ucret_tutari || 0)));
      let orgBilgi: string | null = null;
      const orgTur = s.organizasyon_kart_tur as string;
      if (orgTur) {
        const teslimKisi = (s.teslim_kisisi as string) || (s.organizasyon_teslim_kisisi as string) || '';
        orgBilgi = teslimKisi ? `${orgTur}\n${teslimKisi}` : orgTur;
      }
      return {
        id: `sip_${s.id || i}`,
        tarih,
        fisNo: `SP-${new Date().getFullYear()}-${String(s.id || i).padStart(6, '0')}`,
        satisTuru,
        musteri,
        urun,
        miktar: 1,
        tutar: Math.min(tutar, 10000),
        organizasyonBilgisi: orgBilgi,
        isSicakSatis: false,
      };
    });

    return [...sicak, ...siparis];
  }, [sicakSatislar, archivedSiparisler]);

  const musteriRaporlari = useMemo(() => {
    const raw = Array.isArray(musteriRaporlariRaw) ? musteriRaporlariRaw : [];
    return raw.map((m: Record<string, unknown>) => ({
      musteri: (m.musteri_unvan as string) || (m.musteri_isim_soyisim as string) || '—',
      telefon: formatPhoneNumber((m.phone as string) || ''),
      siparis_sayisi: Number(m.siparis_sayisi) || 0,
      toplam_kazanc: parseFloat(String(m.toplam_kazanc || 0)),
      ortalama_tutar: parseFloat(String(m.ortalama_tutar || 0)),
      son_siparis: (m.son_siparis_tarihi ?? m.son_siparis) ? new Date(String(m.son_siparis_tarihi ?? m.son_siparis)).toLocaleDateString('tr-TR') : '—',
    }));
  }, [musteriRaporlariRaw]);

  const filteredSatis = useMemo(() => {
    let data = [...satisRaporlari];
    if (baslangicTarihi) {
      data = data.filter((r) => {
        const [gun, ay, yil] = r.tarih.split(' ')[0].split('.');
        const itemDate = `${yil}-${ay.padStart(2, '0')}-${gun.padStart(2, '0')}`;
        return itemDate >= baslangicTarihi;
      });
    }
    if (bitisTarihi) {
      data = data.filter((r) => {
        const [gun, ay, yil] = r.tarih.split(' ')[0].split('.');
        const itemDate = `${yil}-${ay.padStart(2, '0')}-${gun.padStart(2, '0')}`;
        return itemDate <= bitisTarihi;
      });
    }
    if (satisTuruFilter && satisTuruFilter !== 'tumunu') {
      if (satisTuruFilter === 'sicak_satis') {
        data = data.filter((r) => r.isSicakSatis);
      } else {
        data = data.filter((r) => r.satisTuru === satisTuruFilter);
      }
    }
    if (urunFilter && urunFilter !== 'tumunu') {
      data = data.filter((r) => r.urun === urunFilter);
    }
    return data;
  }, [satisRaporlari, baslangicTarihi, bitisTarihi, satisTuruFilter, urunFilter]);

  const filteredMusteri = useMemo(() => {
    let data = [...musteriRaporlari];
    if (musteriFilter && musteriFilter !== 'tumunu') {
      data = data.filter((r) => r.musteri === musteriFilter);
    }
    return data;
  }, [musteriRaporlari, musteriFilter]);

  const sortedSatis = useMemo(() => {
    const data = [...filteredSatis];
    if (!sortSatisField) return data;
    return data.sort((a, b) => {
      let cmp = 0;
      switch (sortSatisField) {
        case 'tarih': cmp = a.tarih.localeCompare(b.tarih); break;
        case 'fisNo': cmp = a.fisNo.localeCompare(b.fisNo); break;
        case 'satisTuru': cmp = a.satisTuru.localeCompare(b.satisTuru); break;
        case 'musteri': cmp = a.musteri.localeCompare(b.musteri); break;
        case 'urun': cmp = a.urun.localeCompare(b.urun); break;
        case 'miktar': cmp = a.miktar - b.miktar; break;
        case 'tutar': cmp = a.tutar - b.tutar; break;
        default: return 0;
      }
      return sortSatisDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredSatis, sortSatisField, sortSatisDir]);

  const sortedMusteri = useMemo(() => {
    const data = [...filteredMusteri];
    if (!sortMusteriField) return data;
    return data.sort((a, b) => {
      let cmp = 0;
      switch (sortMusteriField) {
        case 'musteri': cmp = a.musteri.localeCompare(b.musteri); break;
        case 'telefon': cmp = (a.telefon || '').localeCompare(b.telefon || ''); break;
        case 'siparis_sayisi': cmp = a.siparis_sayisi - b.siparis_sayisi; break;
        case 'toplam_kazanc': cmp = a.toplam_kazanc - b.toplam_kazanc; break;
        case 'ortalama_tutar': cmp = a.ortalama_tutar - b.ortalama_tutar; break;
        case 'son_siparis': cmp = (a.son_siparis || '').localeCompare(b.son_siparis || ''); break;
        default: return 0;
      }
      return sortMusteriDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredMusteri, sortMusteriField, sortMusteriDir]);

  const musteriListesi = useMemo(() => {
    const set = new Set<string>();
    musteriRaporlari.forEach((r) => set.add(r.musteri));
    return Array.from(set).sort();
  }, [musteriRaporlari]);

  const urunListesi = useMemo(() => {
    const set = new Set<string>();
    satisRaporlari.forEach((r) => set.add(r.urun));
    return Array.from(set).sort();
  }, [satisRaporlari]);

  const toplamIslem = filteredSatis.length;
  const handleSatisSort = (field: string, dir: 'asc' | 'desc') => {
    setSortSatisField(field);
    setSortSatisDir(dir);
  };
  const handleMusteriSort = (field: string, dir: 'asc' | 'desc') => {
    setSortMusteriField(field);
    setSortMusteriDir(dir);
  };
  const toplamCiro = filteredSatis.reduce((s, r) => s + r.tutar, 0);
  const sicakToplam = filteredSatis.filter((r) => r.isSicakSatis).reduce((s, r) => s + r.tutar, 0);
  const kanalGruplari = useMemo(() => {
    const g: Record<string, number> = {};
    filteredSatis.forEach((r) => {
      g[r.satisTuru] = (g[r.satisTuru] || 0) + r.tutar;
    });
    return g;
  }, [filteredSatis]);
  const enFazlaKanal = Object.entries(kanalGruplari).sort((a, b) => b[1] - a[1])[0];

  const toplamMusteri = filteredMusteri.length;
  const toplamSiparis = filteredMusteri.reduce((s, r) => s + r.siparis_sayisi, 0);
  const toplamKazanc = filteredMusteri.reduce((s, r) => s + r.toplam_kazanc, 0);
  const ortalamaTutar = toplamMusteri > 0 ? toplamKazanc / toplamMusteri : 0;

  const handleClearFilters = useCallback(() => {
    setBaslangicTarihi('');
    setBitisTarihi('');
    setSatisTuruFilter('tumunu');
    setUrunFilter('tumunu');
    setMusteriFilter('tumunu');
  }, []);

  const handleExport = async (type: 'excel' | 'print') => {
    const escape = (s: string) => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (type === 'print') {
      try {
        const { logoMarkup, footerHtml } = await getPrintLogoAndFooter();
        const dateShort = getPrintDateDDMMYYYY();
        if (activeTab === 'satis') {
          const rows = filteredSatis.map(
            (r) =>
              `<tr><td>${escape(r.tarih)}</td><td>${escape(r.fisNo)}</td><td>${escape(SATIS_TURU_LABELS[r.satisTuru] || r.satisTuru)}</td><td>${escape(r.musteri)}</td><td>${escape(r.urun)}</td><td class="print-td-center">${r.miktar}</td><td class="print-td-center">${formatTL(r.tutar)}</td></tr>`
          );
          const html = buildPrintHtml(
            'Satış Raporları',
            logoMarkup,
            footerHtml,
            '<th>Tarih/Saat</th><th>Fiş No</th><th>Satış Türü</th><th>Müşteri</th><th>Ürün/Hizmet</th><th class="print-th-center">Miktar</th><th class="print-th-center">Tutar</th>',
            rows.join('')
          );
          openPrintWindow(html, `Satış Raporları – ${dateShort}`, '');
        } else {
          const rows = filteredMusteri.map(
            (r) =>
              `<tr><td>${escape(r.musteri)}</td><td>${escape(r.telefon)}</td><td class="print-td-center">${r.siparis_sayisi}</td><td class="print-td-center">${formatTL(r.toplam_kazanc)}</td><td class="print-td-center">${formatTL(r.ortalama_tutar)}</td></tr>`
          );
          const html = buildPrintHtml(
            'Müşteri Raporları',
            logoMarkup,
            footerHtml,
            '<th>Müşteri</th><th>Telefon</th><th class="print-th-center">Sipariş Sayısı</th><th class="print-th-center">Toplam Kazanç</th><th class="print-th-center">Ortalama Tutar</th>',
            rows.join('')
          );
          openPrintWindow(html, `Müşteri Raporları – ${dateShort}`, '');
        }
      } catch (e) {
        showToast('error', 'Yazdırma hazırlanırken hata oluştu');
        console.error('Print error:', e);
      }
      setExportMenuOpen(false);
      return;
    }
    if (type === 'excel') {
      try {
        if (activeTab === 'satis') {
          const data = filteredSatis.map((r) => ({
            'Tarih/Saat': r.tarih,
            'Fiş No': r.fisNo,
            'Satış Türü': SATIS_TURU_LABELS[r.satisTuru] || r.satisTuru,
            Müşteri: r.musteri,
            'Ürün/Hizmet': r.urun,
            Miktar: r.miktar,
            Tutar: formatTL(r.tutar),
          }));
          if (!data.length) {
            showToast('warning', 'Dışa aktarılacak veri yok');
            setExportMenuOpen(false);
            return;
          }
          downloadTableAsExcel(data, 'Satis-Raporlari');
          showToast('success', 'Excel indirildi');
        } else {
          const data = filteredMusteri.map((r) => ({
            Müşteri: r.musteri,
            Telefon: r.telefon,
            'Sipariş Sayısı': r.siparis_sayisi,
            'Toplam Kazanç': formatTL(r.toplam_kazanc),
            'Ortalama Tutar': formatTL(r.ortalama_tutar),
          }));
          if (!data.length) {
            showToast('warning', 'Dışa aktarılacak veri yok');
            setExportMenuOpen(false);
            return;
          }
          downloadTableAsExcel(data, 'Musteri-Raporlari');
          showToast('success', 'Excel indirildi');
        }
      } catch (e) {
        showToast('error', (e as Error)?.message || 'Excel dışa aktarılamadı');
        console.error('Excel export error:', e);
      }
      setExportMenuOpen(false);
    }
  };

  const handleDeleteSicakSatis = (id: number) => {
    showToastInteractive({
      title: 'Sıcak Satış Sil',
      message: 'Bu sıcak satışı silmek istediğinize emin misiniz?',
      confirmText: 'Evet, Sil',
      cancelText: 'İptal',
      isWarning: true,
      onConfirm: async () => {
        try {
          await apiRequest(`/sicak-satislar/${id}`, { method: 'DELETE' });
          showToast('success', 'Sıcak satış silindi');
          queryClient.invalidateQueries({ queryKey: ['sicak-satislar'] });
        } catch (e) {
          showToast('error', (e as Error)?.message || 'Silinemedi');
        }
      },
    });
  };

  const handleDuzenleKaydet = async () => {
    if (!duzenleModal?.sicakSatisId) return;
    const fiyatNum = parseTL(duzenleForm.fiyat);
    if (fiyatNum <= 0) {
      showToast('warning', 'Geçerli bir fiyat giriniz');
      return;
    }
    try {
      await apiRequest(`/sicak-satislar/${duzenleModal.sicakSatisId}`, {
        method: 'PUT',
        data: {
          urun_adi: duzenleForm.urunAdi,
          miktar: duzenleForm.adet,
          tutar: fiyatNum,
          satis_turu: duzenleForm.satisTuru,
        },
      });
      showToast('success', 'Sıcak satış güncellendi');
      queryClient.invalidateQueries({ queryKey: ['sicak-satislar'] });
      setDuzenleModal(null);
    } catch (e) {
      showToast('error', (e as Error)?.message || 'Güncellenemedi');
    }
  };

  const openDuzenle = (r: SatisRaporu) => {
    if (!r.isSicakSatis || !r.sicakSatisId) return;
    setDuzenleModal(r);
    setDuzenleForm({ urunAdi: r.urun, adet: r.miktar, fiyat: formatTLDisplayValue(r.tutar) || '', satisTuru: r.satisTuru });
  };

  const sorguMetni = useMemo(() => {
    if (!baslangicTarihi && !bitisTarihi) return 'Tarih aralığı seçiniz';
    const start = baslangicTarihi ? new Date(baslangicTarihi).toLocaleDateString('tr-TR') : '';
    const end = bitisTarihi ? new Date(bitisTarihi).toLocaleDateString('tr-TR') : '';
    if (start && end) return `${start} - ${end} arasındaki satışlar`;
    if (start) return `${start} tarihinden itibaren`;
    return `${end} tarihine kadar`;
  }, [baslangicTarihi, bitisTarihi]);

  const isLoading = (activeTab === 'satis' && (loadingSicak || loadingArchived)) || (activeTab === 'musteri' && loadingMusteri);

  const satisChartData = useMemo(() => {
    const tarihGruplar: Record<string, Record<string, number>> = {};
    filteredSatis.forEach((r) => {
      const tarih = r.tarih.split(' ')[0];
      if (!tarihGruplar[tarih]) tarihGruplar[tarih] = {};
      if (r.isSicakSatis) {
        const key = 'Sıcak Satış';
        if (!tarihGruplar[tarih][key]) tarihGruplar[tarih][key] = 0;
        tarihGruplar[tarih][key] += r.tutar;
      } else {
        const satisTuruAdi = SATIS_TURU_LABELS[r.satisTuru] || r.satisTuru;
        if (!tarihGruplar[tarih][satisTuruAdi]) tarihGruplar[tarih][satisTuruAdi] = 0;
        tarihGruplar[tarih][satisTuruAdi] += r.tutar;
      }
    });
    const sortedDates = Object.keys(tarihGruplar).sort((a, b) => {
      const [ga, ma, ya] = a.split('.');
      const [gb, mb, yb] = b.split('.');
      return new Date(`${ya}-${ma}-${ga}`).getTime() - new Date(`${yb}-${mb}-${gb}`).getTime();
    });
    const allTurler = [...TUM_SATIS_TURLERI_CHART];
    const series = allTurler.map((tur) => ({
      name: tur,
      data: sortedDates.map((tarih) => ({ x: tarih, y: tarihGruplar[tarih][tur] || 0 })),
    }));
    // Y ekseni için max değer: her tarih için tüm serilerin toplamı (stacked chart)
    const maxPerDate = sortedDates.reduce((acc, tarih) => {
      const sum = allTurler.reduce((s, tur) => s + (tarihGruplar[tarih][tur] || 0), 0);
      return Math.max(acc, sum);
    }, 0);
    const rawMax = Math.ceil((maxPerDate || 1000) * 1.15);
    const yAxisMax = rawMax < 10000 ? Math.ceil(rawMax / 500) * 500 : Math.ceil(rawMax / 1000) * 1000;
    return { series, sortedDates, yAxisMax };
  }, [filteredSatis]);

  const musteriChartData = useMemo(() => {
    const top10 = [...filteredMusteri]
      .filter((m) => m.siparis_sayisi > 0)
      .sort((a, b) => b.siparis_sayisi - a.siparis_sayisi)
      .slice(0, 10);
    return {
      labels: top10.map((m) => (m.musteri.length > 25 ? m.musteri.slice(0, 25) + '…' : m.musteri)),
      series: top10.map((m) => m.siparis_sayisi),
    };
  }, [filteredMusteri]);

  const satisChartOptions: ApexOptions = useMemo(() => ({
    chart: {
      type: 'area',
      height: 400,
      fontFamily: 'Euclid Circular B, Arial, sans-serif',
      toolbar: { show: false },
      zoom: { enabled: false },
      background: 'transparent',
    },
    theme: { mode: isDark ? 'dark' : 'light' },
    plotOptions: { area: { fillTo: 'origin' } },
    stroke: { curve: 'smooth', width: 2 },
    xaxis: {
      type: 'category',
      title: { text: '(Tarihlere Göre Toplam Satış Rakamları)', style: { color: 'var(--gray-subtle-dark)', fontSize: '12px', fontWeight: 700 } },
      labels: { style: { colors: ['var(--gray-subtle-dark)'], fontSize: '12px' } },
    },
    yaxis: {
      min: 0,
      max: satisChartData.yAxisMax,
      tickAmount: 5,
      title: { text: 'Toplam Satış (TL)', style: { color: 'var(--gray-subtle-dark)', fontSize: '12px', fontWeight: 700 } },
      labels: {
        style: { colors: ['var(--gray-subtle-dark)'] },
        formatter: (v: number) => formatTL(v),
      },
    },
    legend: { position: 'right', offsetY: 40 },
    dataLabels: { enabled: false },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      y: { formatter: (v: number) => formatTL(v) },
    },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.1, stops: [0, 100] } },
    colors: ['#FF6B35', '#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#F44336'],
    responsive: [{ breakpoint: 600, options: { chart: { height: 300 }, legend: { position: 'bottom' } } }],
  }), [satisChartData.yAxisMax, isDark]);

  const musteriChartOptions: ApexOptions = useMemo(() => ({
    chart: { type: 'bar', height: 400, fontFamily: 'Euclid Circular B, Arial, sans-serif', toolbar: { show: false }, background: 'transparent' },
    theme: { mode: isDark ? 'dark' : 'light' },
    plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 4 } },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 2, colors: ['transparent'] },
    xaxis: {
      categories: musteriChartData.labels,
      title: { text: 'Müşteriler', style: { color: 'var(--gray-subtle-dark)', fontSize: '12px', fontWeight: 700 } },
      labels: { style: { colors: ['var(--gray-subtle-dark)'], fontSize: '11px' }, rotate: -45 },
    },
    yaxis: {
      title: { text: 'Sipariş Sayısı', style: { color: 'var(--gray-subtle-dark)', fontSize: '12px', fontWeight: 700 } },
      labels: { style: { colors: ['var(--gray-subtle-dark)'] } },
    },
    fill: { opacity: 1 },
    colors: ['#2196F3'],
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      y: { formatter: (v: number) => v + ' Sipariş' },
    },
    responsive: [{ breakpoint: 600, options: { chart: { height: 300 }, xaxis: { labels: { rotate: -90 } } } }],
  }), [musteriChartData.labels, isDark]);

  return (
    <div className="page-wrapper page-wrapper--full flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden p-6">
      <div className="reports-panel-inner flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Başlık + Yatay Tablar + Dışa Aktar */}
        <div className="reports-header-bar mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="reports-tabs-horizontal flex gap-1">
                <button
                  type="button"
                  className={`reports-tab-btn ${activeTab === 'satis' ? 'active' : ''}`}
                  onClick={() => setActiveTab('satis')}
                >
                  Satış Raporları
                </button>
                <button
                  type="button"
                  className={`reports-tab-btn ${activeTab === 'musteri' ? 'active' : ''}`}
                  onClick={() => setActiveTab('musteri')}
                >
                  Müşteri Raporları
                </button>
              </div>
            </div>
            <div className={`buton-disa-aktar clickdropdown page-export-dropdown ${exportMenuOpen ? 'is-open' : ''}`}>
              <div className="btn-baslik">
                <i className="icon-dashboard-disa-aktar" />
                Dışa Aktar
              </div>
              <div className="dosya-tur clickdropbtn" onClick={() => setExportMenuOpen(!exportMenuOpen)}>
                .xls
                <ChevronDown size={12} />
              </div>
              {exportMenuOpen && (
                <div className="dosya-tur-content clickdropdown-content">
                  <div className="liste-baslik">Raporu Dışa Aktar</div>
                  <hr />
                  <button type="button" className="btn-disa-aktar" onClick={() => void handleExport('excel')}>
                    <i className="icon-disa-aktar-excel" />
                    Excel'e Aktar
                  </button>
                  <button type="button" className="btn-yazdir" onClick={() => void handleExport('print')}>
                    <i className="icon-disa-aktar-yazdir" />
                    Yazdır
                  </button>
                </div>
              )}
            </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-auto">
            {activeTab === 'satis' && (
              <div className="reports-content">
                <div className="reports-filtreler">
                  <div className="flex items-center gap-2">
                    <label htmlFor="startDate">BAŞLANGIÇ TARİHİ:</label>
                    <input id="startDate" type="date" value={baslangicTarihi} onChange={(e) => setBaslangicTarihi(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="endDate">BİTİŞ TARİHİ:</label>
                    <input id="endDate" type="date" value={bitisTarihi} onChange={(e) => setBitisTarihi(e.target.value)} min={baslangicTarihi} />
                  </div>
                  <div className="flex items-center gap-2">
                    <label>SATIŞ TÜRÜ:</label>
                    <select value={satisTuruFilter} onChange={(e) => setSatisTuruFilter(e.target.value)}>
                      <option value="tumunu">Tümü</option>
                      <option value="sicak_satis">Sıcak Satış</option>
                      <option value="nakit">Nakit</option>
                      <option value="havale_eft">Havale/EFT</option>
                      <option value="pos">POS</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="urunFilter" className="whitespace-nowrap">ÜRÜN:</label>
                    <select id="urunFilter" value={urunFilter} onChange={(e) => setUrunFilter(e.target.value)}>
                      <option value="tumunu">Tümü</option>
                      {urunListesi.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <button type="button" className="btn-filtre-reset" onClick={handleClearFilters}>
                    Filtreleri Temizle
                  </button>
                </div>

                <div className="reports-sorgu-baslik">
                  <i className="icon-input-tarih" />
                  <span>{sorguMetni}</span>
                </div>

                <div className="istatistikler">
                    <div className="bilgi-box">
                      <div className="baslik">Toplam İşlem</div>
                      <div className="bilgi-alan">
                        <TurkishLira size={20} className="bilgi-alan-icon" />
                        <div className="bilgiler">
                          <span className="bilgi-baslik">Satış Yapılan Toplam</span>
                          <span className="bilgi-icerik">
                            <AnimatedCounter value={toplamIslem} suffix="İşlem" delay={0.1} />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="bilgi-box">
                      <div className="baslik">Toplam Ciro</div>
                      <div className="bilgi-alan">
                        <Banknote size={20} className="bilgi-alan-icon" />
                        <div className="bilgiler">
                          <span className="bilgi-baslik">Geçerli Dönem Toplamı</span>
                          <span className="bilgi-icerik">
                            <AnimatedCounter value={toplamCiro} format="currency" decimals={2} delay={0.2} />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="bilgi-box">
                      <div className="baslik">En Fazla Giriş Olan Satış Türü</div>
                      <div className="bilgi-alan">
                        <Wallet size={20} className="bilgi-alan-icon" />
                        <div className="bilgiler">
                          <span className="bilgi-baslik">{enFazlaKanal ? SATIS_TURU_LABELS[enFazlaKanal[0]] || enFazlaKanal[0] : '—'}</span>
                          <span className="bilgi-icerik">
                            <AnimatedCounter value={enFazlaKanal ? enFazlaKanal[1] : 0} format="currency" decimals={2} delay={0.3} />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="bilgi-box">
                      <div className="baslik">Sıcak Satışlar Toplamı</div>
                      <div className="bilgi-alan">
                        <Flame size={20} className="bilgi-alan-icon" />
                        <div className="bilgiler">
                          <span className="bilgi-baslik">Toplam Sıcak Satış</span>
                          <span className="bilgi-icerik">
                            <AnimatedCounter value={sicakToplam} format="currency" decimals={2} delay={0.4} />
                          </span>
                        </div>
                      </div>
                    </div>
                </div>

                {satisChartData.series.length > 0 && satisChartData.sortedDates.length > 0 && (
                  <div className="chart-satis-raporlar reports-chart-box">
                    <Chart
                      key={`satis-chart-${isDark ? 'dark' : 'light'}`}
                      type="area"
                      height={400}
                      options={satisChartOptions}
                      series={satisChartData.series}
                    />
                  </div>
                )}

                <div className="reports-table-wrapper">
                    {isLoading ? (
                      <div className="p-8 text-center">
                        <LoadingSpinner size="md" />
                      </div>
                    ) : !filteredSatis.length ? (
                      <EmptyState title="Seçilen tarih aralığı için rapor verisi bulunamadı" description="" />
                    ) : (
                      <div className="reports-table-scroll table-scrollbar">
                        <table className="w-full reports-table">
                          <thead>
                            <tr>
                              <TableSortHeader field="tarih" label="TARİH/SAAT" currentSort={sortSatisField} sortDirection={sortSatisDir} onSort={handleSatisSort} />
                              <TableSortHeader field="fisNo" label="FİŞ NO" currentSort={sortSatisField} sortDirection={sortSatisDir} onSort={handleSatisSort} />
                              <TableSortHeader field="satisTuru" label="SATIŞ TÜRÜ" currentSort={sortSatisField} sortDirection={sortSatisDir} onSort={handleSatisSort} />
                              <TableSortHeader field="musteri" label="MÜŞTERİ" currentSort={sortSatisField} sortDirection={sortSatisDir} onSort={handleSatisSort} />
                              <TableSortHeader field="urun" label="ÜRÜN/HİZMET" currentSort={sortSatisField} sortDirection={sortSatisDir} onSort={handleSatisSort} />
                              <TableSortHeader field="miktar" label="MİKTAR" currentSort={sortSatisField} sortDirection={sortSatisDir} onSort={handleSatisSort} />
                              <TableSortHeader field="tutar" label="TUTAR" currentSort={sortSatisField} sortDirection={sortSatisDir} onSort={handleSatisSort} />
                              <th className="reports-th-islem">İŞLEMLER</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedSatis.map((r) => (
                              <tr key={r.id} className="reports-table-row">
                                <td data-label="Tarih/Saat">{r.tarih}</td>
                                <td data-label="Fiş No">{r.fisNo}</td>
                                <td data-label="Satış Türü">
                                  <span className={`status-badge reports-satis-turu-${r.satisTuru}`}>
                                    {SATIS_TURU_LABELS[r.satisTuru] || r.satisTuru}
                                  </span>
                                </td>
                                <td data-label="Müşteri">
                                  {r.musteri === 'Sıcak Satış' ? (
                                    <span className="status-badge reports-satis-turu-sicak_satis">Sıcak Satış</span>
                                  ) : (
                                    r.musteri
                                  )}
                                </td>
                                <td data-label="Ürün/Hizmet">{r.urun}</td>
                                <td data-label="Miktar">{r.miktar}</td>
                                <td data-label="Tutar" style={{ fontWeight: 600 }}>{formatTL(r.tutar)}</td>
                                <td className="reports-td-islem" data-label="İşlemler">
                                  <div className="islem-ikonlar">
                                    <button
                                      type="button"
                                      className="islem-ikon detay-ikon"
                                      data-tooltip="Satış Detayları"
                                      aria-label="Satış Detayları"
                                      onClick={() => setDetayModal(r)}
                                    >
                                      <Eye size={14} />
                                    </button>
                                    {r.isSicakSatis && r.sicakSatisId && (
                                      <>
                                        <button
                                          type="button"
                                          className="islem-ikon duzenle-ikon"
                                          data-tooltip="Düzenle"
                                          aria-label="Düzenle"
                                          onClick={() => openDuzenle(r)}
                                        >
                                          <Pencil size={14} />
                                        </button>
                                        <button
                                          type="button"
                                          className="islem-ikon sil-ikon"
                                          data-tooltip="Sil"
                                          aria-label="Sil"
                                          onClick={() => handleDeleteSicakSatis(r.sicakSatisId!)}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                </div>

                {filteredSatis.length > 0 && (
                  <div className="reports-pagination">
                    <div className="reports-pagination-info">Toplam {filteredSatis.length} kayıt</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'musteri' && (
              <div className="reports-content">
                <div className="reports-filtreler">
                  <div className="flex items-center gap-2">
                    <label htmlFor="musteriStartDate">BAŞLANGIÇ TARİHİ:</label>
                    <input id="musteriStartDate" type="date" value={baslangicTarihi} onChange={(e) => setBaslangicTarihi(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="musteriEndDate">BİTİŞ TARİHİ:</label>
                    <input id="musteriEndDate" type="date" value={bitisTarihi} onChange={(e) => setBitisTarihi(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="musteriFilter">MÜŞTERİ:</label>
                    <select id="musteriFilter" value={musteriFilter} onChange={(e) => setMusteriFilter(e.target.value)}>
                      <option value="tumunu">Tümü</option>
                      {musteriListesi.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <button type="button" className="btn-filtre-reset" onClick={handleClearFilters}>
                    Filtreleri Temizle
                  </button>
                </div>

                <div className="reports-sorgu-baslik">
                  <i className="icon-input-tarih" />
                  <span>{sorguMetni}</span>
                </div>

                <div className="istatistikler">
                    <div className="bilgi-box">
                      <div className="baslik">Toplam Müşteri</div>
                      <div className="bilgi-alan">
                        <Users size={20} className="bilgi-alan-icon" />
                        <div className="bilgiler">
                          <span className="bilgi-baslik">Kayıtlı Müşteri Sayısı</span>
                          <span className="bilgi-icerik">
                            <AnimatedCounter value={toplamMusteri} suffix="Müşteri" delay={0.1} />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="bilgi-box">
                      <div className="baslik">Toplam Sipariş</div>
                      <div className="bilgi-alan">
                        <ShoppingCart size={20} className="bilgi-alan-icon" />
                        <div className="bilgiler">
                          <span className="bilgi-baslik">Toplam Sipariş</span>
                          <span className="bilgi-icerik">
                            <AnimatedCounter value={toplamSiparis} suffix="Sipariş" delay={0.2} />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="bilgi-box">
                      <div className="baslik">Toplam Kazanç</div>
                      <div className="bilgi-alan">
                        <TrendingUp size={20} className="bilgi-alan-icon" />
                        <div className="bilgiler">
                          <span className="bilgi-baslik">Geçerli Dönem Toplamı</span>
                          <span className="bilgi-icerik">
                            <AnimatedCounter value={toplamKazanc} format="currency" decimals={2} delay={0.3} />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="bilgi-box">
                      <div className="baslik">Ortalama Tutar</div>
                      <div className="bilgi-alan">
                        <Calculator size={20} className="bilgi-alan-icon" />
                        <div className="bilgiler">
                          <span className="bilgi-baslik">Müşteri Başına Ortalama</span>
                          <span className="bilgi-icerik">
                            <AnimatedCounter value={ortalamaTutar} format="currency" decimals={2} delay={0.4} />
                          </span>
                        </div>
                      </div>
                    </div>
                </div>

                {musteriChartData.series.length > 0 && (
                  <div className="chart-musteri-raporlar reports-chart-box">
                    <Chart
                      key={`musteri-chart-${isDark ? 'dark' : 'light'}`}
                      type="bar"
                      height={400}
                      options={musteriChartOptions}
                      series={[{ name: 'Sipariş Sayısı', data: musteriChartData.series }]}
                    />
                  </div>
                )}

                <div className="reports-table-wrapper">
                    {isLoading ? (
                      <div className="p-8 text-center">
                        <LoadingSpinner size="md" />
                      </div>
                    ) : !filteredMusteri.length ? (
                      <EmptyState title="Seçilen tarih aralığı için rapor verisi bulunamadı" description="" />
                    ) : (
                      <div className="reports-table-scroll table-scrollbar">
                        <table className="w-full reports-table reports-table-musteri">
                          <thead>
                            <tr>
                              <TableSortHeader field="musteri" label="MÜŞTERİ" currentSort={sortMusteriField} sortDirection={sortMusteriDir} onSort={handleMusteriSort} />
                              <TableSortHeader field="telefon" label="TELEFON" currentSort={sortMusteriField} sortDirection={sortMusteriDir} onSort={handleMusteriSort} />
                              <TableSortHeader field="siparis_sayisi" label="SİPARİŞ SAYISI" currentSort={sortMusteriField} sortDirection={sortMusteriDir} onSort={handleMusteriSort} align="center" />
                              <TableSortHeader field="toplam_kazanc" label="TOPLAM KAZANÇ" currentSort={sortMusteriField} sortDirection={sortMusteriDir} onSort={handleMusteriSort} align="center" />
                              <TableSortHeader field="ortalama_tutar" label="ORTALAMA TUTAR" currentSort={sortMusteriField} sortDirection={sortMusteriDir} onSort={handleMusteriSort} align="center" />
                              <TableSortHeader field="son_siparis" label="SON SİPARİŞ" currentSort={sortMusteriField} sortDirection={sortMusteriDir} onSort={handleMusteriSort} align="center" />
                            </tr>
                          </thead>
                          <tbody>
                            {sortedMusteri.map((r, i) => (
                              <tr key={i} className="reports-table-row">
                                <td data-label="Müşteri" style={{ fontWeight: 600 }}>{r.musteri}</td>
                                <td data-label="Telefon">{r.telefon}</td>
                                <td data-label="Sipariş Sayısı">{r.siparis_sayisi}</td>
                                <td data-label="Toplam Kazanç" style={{ fontWeight: 600 }}>{formatTL(r.toplam_kazanc)}</td>
                                <td data-label="Ortalama Tutar">{formatTL(r.ortalama_tutar)}</td>
                                <td data-label="Son Sipariş">{r.son_siparis}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                </div>

                {filteredMusteri.length > 0 && (
                  <div className="reports-pagination">
                    <div className="reports-pagination-info">Toplam {filteredMusteri.length} kayıt</div>
                  </div>
                )}
              </div>
            )}
          </div>
      </div>

      {/* Satış Detay Modal - portal ile body'ye render */}
      {detayModal && createPortal(
        <div className="rapor-detay-overlay" onClick={() => setDetayModal(null)}>
          <div className="rapor-detay-popup" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="popup-title text-lg font-semibold">Satış Detayları</h3>
              <button type="button" className="btn-close-form p-2" onClick={() => setDetayModal(null)}>
                <i className="icon-btn-kapat" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="detay-item flex justify-between"><span className="detay-label text-gray-500">Fiş No:</span><span className="detay-value">{detayModal.fisNo}</span></div>
              <div className="detay-item flex justify-between"><span className="detay-label text-gray-500">Tarih/Saat:</span><span className="detay-value">{detayModal.tarih}</span></div>
              <div className="detay-item flex justify-between"><span className="detay-label text-gray-500">Satış Türü:</span><span className="detay-value">{SATIS_TURU_LABELS[detayModal.satisTuru] || detayModal.satisTuru}</span></div>
              <div className="detay-item flex justify-between"><span className="detay-label text-gray-500">Müşteri:</span><span className="detay-value">{detayModal.musteri}</span></div>
              <div className="detay-item flex justify-between"><span className="detay-label text-gray-500">Ürün/Hizmet:</span><span className="detay-value">{detayModal.urun}</span></div>
              {detayModal.organizasyonBilgisi && (
                <div className="detay-item flex justify-between"><span className="detay-label text-gray-500">Organizasyon:</span><span className="detay-value whitespace-pre-line text-right">{detayModal.organizasyonBilgisi}</span></div>
              )}
              <div className="detay-item flex justify-between"><span className="detay-label text-gray-500">Miktar:</span><span className="detay-value">{detayModal.miktar}</span></div>
              <div className="detay-item flex justify-between"><span className="detay-label text-gray-500">Tutar:</span><span className="detay-value font-medium">{formatTL(detayModal.tutar)}</span></div>
            </div>
            <div style={{ marginTop: 24 }}>
              <button type="button" className="secondary-button w-full" onClick={() => setDetayModal(null)}>KAPAT</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Sıcak Satış Düzenle Modal - index SicakSatisModal ile aynı yapı, portal ile body'ye render */}
      {duzenleModal && createPortal(
        <div className="sicak-satis-overlay show" onClick={() => setDuzenleModal(null)}>
          <div className="sicak-satis-popup" onClick={(e) => e.stopPropagation()}>
            <div className="header-alan">
              <div className="sicak-satis-modal-baslik">
                <Flame size={20} aria-hidden />
                Sıcak Satış Düzenle
                <div className="sicak-satis-modal-subtitle">
                  Sıcak satış bilgilerini düzenleyin
                </div>
              </div>
              <button type="button" className="btn-close-form" onClick={() => setDuzenleModal(null)} aria-label="Kapat">
                <i className="icon-btn-kapat" aria-hidden />
              </button>
            </div>
            <form className="sicak-satis-form" onSubmit={(e) => { e.preventDefault(); handleDuzenleKaydet(); }} noValidate>
              <div className="form-group">
                <label htmlFor="duzenleUrunAdi">Ürün Adı</label>
                <input type="text" id="duzenleUrunAdi" value={duzenleForm.urunAdi} onChange={(e) => setDuzenleForm((p) => ({ ...p, urunAdi: e.target.value }))} placeholder="Ürün adını yazınız" required />
              </div>
              <div className="form-group-wrapper">
                <div className="form-group">
                  <label htmlFor="duzenleAdet">Adet</label>
                  <input type="number" id="duzenleAdet" min={1} max={999} value={duzenleForm.adet} onChange={(e) => setDuzenleForm((p) => ({ ...p, adet: parseInt(e.target.value, 10) || 1 }))} placeholder="1" required />
                </div>
                <div className="form-group">
                  <label htmlFor="duzenleFiyat">Ürün Fiyatı</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    id="duzenleFiyat"
                    value={duzenleForm.fiyat}
                    onChange={(e) => setDuzenleForm((p) => ({ ...p, fiyat: formatTutarInputLive(e.target.value) }))}
                    onKeyDown={(e) => formatTutarInputKeyDown(e, duzenleForm.fiyat)}
                    onBlur={() => setDuzenleForm((p) => ({ ...p, fiyat: formatTLDisplayValue(parseTL(p.fiyat)) }))}
                    placeholder="0,00"
                    className="tl-input"
                    required
                    aria-label="Ürün fiyatı (TL)"
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="duzenleSatisTuru">Satış Türü Seçiniz</label>
                <select id="duzenleSatisTuru" value={duzenleForm.satisTuru} onChange={(e) => setDuzenleForm((p) => ({ ...p, satisTuru: e.target.value as 'nakit' | 'havale_eft' | 'pos' }))} required>
                  <option value="nakit">Nakit</option>
                  <option value="havale_eft">Havale/EFT</option>
                  <option value="pos">POS</option>
                </select>
              </div>
            </form>
            <div className="butonlar">
              <button type="button" className="secondary-button btn-vazgec" onClick={() => setDuzenleModal(null)}>VAZGEÇ</button>
              <button type="button" className="primary-button btn-guncelle" onClick={handleDuzenleKaydet}>GÜNCELLE</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {exportMenuOpen && <div className="fixed inset-0 z-10" onClick={() => setExportMenuOpen(false)} aria-hidden />}
    </div>
  );
};
