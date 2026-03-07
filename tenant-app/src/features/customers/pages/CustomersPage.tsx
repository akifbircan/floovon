import React, { useEffect, useMemo, useState } from 'react';

const MOBILE_BREAKPOINT = 767;
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const handler = () => setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { ErrorState } from '../../../shared/components/ErrorState';
import { EmptyState } from '../../../shared/components/EmptyState';
import { usePageAnimations } from '../../../shared/hooks/usePageAnimations';
import {
  formatPhoneNumber,
  formatIlceIlDisplay,
  fixUploadUrl,
  formatTL,
} from '../../../shared/utils/formatUtils';
import { showToast, showToastInteractive } from '../../../shared/utils/toastUtils';
import { YeniMusteriModal } from '../../dashboard/components/YeniMusteriModal';
import { SearchInput } from '../../../shared/components/SearchInput';
import { FileText, Info, Pencil, Copy, TurkishLira, Trash2 } from 'lucide-react';
import { TableSortHeader } from '../../../shared/components/TableSortHeader';
import { getPrintLogoMarkup, openPrintWindow, downloadTableAsExcel, buildPrintHtml, getPrintDateDDMMYYYY } from '../../dashboard/utils/exportUtils';
import { invalidateCustomerQueries } from '../../../lib/invalidateQueries';

interface Customer {
  id: number;
  musteri_kodu?: string;
  musteri_unvani?: string;
  musteri_ad_soyad?: string;
  musteri_telefon?: string;
  musteri_eposta?: string;
  musteri_acik_adres?: string;
   // Eski veriler için olası alan
  musteri_adres?: string;
  musteri_mahalle?: string;
  musteri_ilce?: string;
  musteri_il?: string;
  musteri_tipi?: string;
  musteri_vergi_kimlik_numarasi?: string;
  musteri_vergi_dairesi?: string;
  musteri_grubu?: string;
  yetkili_kisi?: string;
  musteri_urun_yazisi?: string;
  musteri_urun_yazi_dosyalar?: string | { path: string; originalname?: string; size?: number }[];
  toplam_siparis?: number;
  son_siparis_tarihi?: string;
  orderCount?: number;
  bakiye?: number;
}

/**
 * Müşteriler sayfası
 * UI-map gereksinimlerine göre düzenlendi
 * Sol liste + Sağ detay paneli yapısı
 */
export const CustomersPage: React.FC = () => {
  usePageAnimations('customers');
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [customerFiles, setCustomerFiles] = useState<
    { path: string; originalname?: string; size?: number }[]
  >([]);
  const [yeniMusteriModalOpen, setYeniMusteriModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Müşteri ürün yazısı dosyalarını gerçekten indirir (sekmede açılmasını engeller)
  const triggerFileDownload = async (downloadUrl: string, fileName: string) => {
    try {
      const res = await fetch(downloadUrl, { credentials: 'include', mode: 'cors' });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'dosya';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fetch/CORS başarısız olursa, yine de indirmeyi dene (tarayıcıya bırak)
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName || 'dosya';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleFileDownloadClick = async (
    e: React.MouseEvent<HTMLAnchorElement>,
    downloadUrl: string,
    fileName: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    await triggerFileDownload(downloadUrl, fileName);
  };

  const { data: customers, isLoading, error } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      try {
        const result = await apiRequest<Customer[]>('/customers', { method: 'GET' });
        return Array.isArray(result) ? result : [];
      } catch (err) {
        if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 404) {
          return [];
        }
        console.error('Müşteriler yükleme hatası:', err);
        return [];
      }
    },
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  /** Arama: client-side filtreleme (API her tuşta çağrılmaz, kilitlenme olmaz) */
  const filteredCustomers = useMemo(() => {
    if (!customers?.length) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        (c.musteri_kodu ?? '').toLowerCase().includes(q) ||
        (c.musteri_unvani ?? '').toLowerCase().includes(q) ||
        (c.musteri_ad_soyad ?? '').toLowerCase().includes(q) ||
        (c.yetkili_kisi ?? '').toLowerCase().includes(q) ||
        (c.musteri_telefon ?? '').includes(q) ||
        (c.musteri_eposta ?? '').toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  const sortedCustomers = useMemo(() => {
    const data = [...filteredCustomers];
    if (!sortField) return data;
    return data.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'kod': cmp = (a.musteri_kodu ?? '').localeCompare(b.musteri_kodu ?? ''); break;
        case 'tipi': cmp = (a.musteri_tipi ?? '').localeCompare(b.musteri_tipi ?? ''); break;
        case 'grubu': cmp = (a.musteri_grubu ?? '').localeCompare(b.musteri_grubu ?? ''); break;
        case 'unvan': cmp = (a.musteri_unvani ?? '').localeCompare(b.musteri_unvani ?? ''); break;
        case 'telefon': cmp = (a.musteri_telefon ?? '').localeCompare(b.musteri_telefon ?? ''); break;
        case 'eposta': cmp = (a.musteri_eposta ?? '').localeCompare(b.musteri_eposta ?? ''); break;
        default: return 0;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredCustomers, sortField, sortDir]);

  const handleSort = (field: string, dir: 'asc' | 'desc') => {
    setSortField(field);
    setSortDir(dir);
  };

  const selectedCustomer = useMemo(
    () => customers?.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  // Cari özet (toplam sipariş ve bakiye)
  const { data: cariOzet } = useQuery({
    queryKey: ['customer-cari-ozet-inline', selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return null;
      try {
        const result = await apiRequest<{
          toplam_alacak: number;
          toplam_tahsilat: number;
          bakiye: number;
          toplam_siparis_sayisi?: number;
        }>(`/customers/${selectedCustomerId}/cari-ozet`, { method: 'GET' });
        return result;
      } catch {
        return null;
      }
    },
    enabled: !!selectedCustomerId,
    staleTime: 2 * 60 * 1000,
  });

  // Seçili müşteri değiştiğinde ürün yazı dosyalarını yükle
  useEffect(() => {
    const loadFiles = async () => {
      if (!selectedCustomer) {
        setCustomerFiles([]);
        return;
      }
      try {
        const result = await apiRequest<any>(
          `/customers/${selectedCustomer.id}/urun-yazi-dosyalari`,
          { method: 'GET' }
        );
        const files = Array.isArray((result as any)?.data)
          ? (result as any).data
          : Array.isArray(result)
          ? (result as any)
          : [];
        setCustomerFiles(
          files.map((f: any) => ({
            path: f.path,
            originalname: f.originalname,
            size: f.size,
          }))
        );
      } catch {
        setCustomerFiles([]);
      }
    };

    void loadFiles();
  }, [selectedCustomer]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ErrorState
          title="Müşteriler yüklenemedi"
          message={error instanceof Error ? error.message : 'Bilinmeyen hata'}
        />
      </div>
    );
  }

  const handleExport = async (type: 'excel' | 'print') => {
    if (type === 'excel') {
      try {
        const list = filteredCustomers ?? [];
        const data = list.map((c) => ({
          'Müşteri No': c.musteri_kodu ?? c.id,
          'Müşteri Tipi': c.musteri_tipi === 'kurumsal' ? 'Kurumsal' : c.musteri_tipi === 'bireysel' ? 'Bireysel' : '',
          'Müşteri Grubu': c.musteri_grubu ?? '',
          'Ünvan': c.musteri_unvani ?? '',
          'Yetkili Kişi': c.yetkili_kisi ?? c.musteri_ad_soyad ?? '',
          'Telefon': c.musteri_telefon ? formatPhoneNumber(c.musteri_telefon) : '',
          'E-posta': c.musteri_eposta ?? '',
        }));
        downloadTableAsExcel(data, 'Musteriler');
        showToast('success', 'Excel dosyası indirildi.');
      } catch (e: any) {
        showToast('error', e?.message ?? 'Excel dışa aktarılamadı.');
      }
    } else if (type === 'print') {
      await handleCustomersPrint();
    }
    setExportMenuOpen(false);
  };

  /** Yazdır: işletme logosu + müşteri tablosu; boş alanlarda hint (sayfa ile aynı) */
  const printHint = (text: string) => `<span class="print-hint">${text}</span>`;
  const handleCustomersPrint = async () => {
    const list = filteredCustomers ?? [];
    const tipiStr = (c: Customer) =>
      c.musteri_tipi === 'kurumsal' ? 'Kurumsal' : c.musteri_tipi === 'bireysel' ? 'Bireysel' : printHint('(Müşteri tipi eklenmemiş)');
    const grubuStr = (c: Customer) => c.musteri_grubu?.trim() || printHint('(Müşteri grubu eklenmemiş)');
    const unvan = (c: Customer) => c.musteri_unvani || `Müşteri #${c.id}`;
    const yetkiliStr = (c: Customer) => {
      const v = c.yetkili_kisi || c.musteri_ad_soyad || c.musteri_unvani;
      return v?.trim() || printHint('(Yetkili kişi eklenmemiş)');
    };
    const telStr = (c: Customer) =>
      c.musteri_telefon ? formatPhoneNumber(c.musteri_telefon) : printHint('(Telefon bilgisi eklenmemiş)');
    const epostaStr = (c: Customer) =>
      c.musteri_eposta?.trim() || printHint('(E-posta bilgisi eklenmemiş)');
    const rows = list
      .map(
        (c) => `
        <tr>
          <td>${c.musteri_kodu ?? c.id}</td>
          <td>${tipiStr(c)}</td>
          <td>${grubuStr(c)}</td>
          <td><strong>${unvan(c)}</strong><br/>${yetkiliStr(c)}</td>
          <td>${telStr(c)}<br/>${epostaStr(c)}</td>
        </tr>`
      )
      .join('');
    const title = 'Müşteriler';
    const logoMarkup = await getPrintLogoMarkup();
    const tableHeaders = '<th>Müşteri No</th><th>Müşteri Tipi</th><th>Müşteri Grubu</th><th>Müşteri Ünvanı & Yetkili Kişi</th><th>İletişim Bilgileri</th>';
    const html = buildPrintHtml(title, logoMarkup, '', tableHeaders, rows);
    openPrintWindow(html, `${title} – ${getPrintDateDDMMYYYY()}`, '');
  };

  const handleNewCustomerClick = () => {
    setEditingCustomer(null);
    setYeniMusteriModalOpen(true);
  };

  const handleFileUpload = async (file: File, customer: Customer) => {
    if (!customer.id || !customer.musteri_unvani) {
      showToast('error', 'Müşteri bilgileri eksik, dosya yüklenemedi');
      return;
    }
    try {
      setUploadingFile(true);
      const params = new URLSearchParams({
        customerId: String(customer.id),
        customerUnvan: customer.musteri_unvani || customer.musteri_ad_soyad || 'musteri',
        fileName: file.name || 'urun-yazisi',
      });
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/customers/upload-file?${params.toString()}`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        showToast('error', json?.message || 'Dosya yüklenemedi');
        return;
      }

      // Yükleme sonrası güncel listeyi backend'den tekrar al (mevcut dosyalar kaybolmasın)
      try {
        const listRes = await apiRequest<any>(`/customers/${customer.id}/urun-yazi-dosyalari`, { method: 'GET' });
        const list = Array.isArray((listRes as any)?.data) ? (listRes as any).data : Array.isArray(listRes) ? listRes : [];
        setCustomerFiles(
          list.map((f: any) => ({
            path: f.path,
            originalname: f.originalname,
            size: f.size,
          }))
        );
      } catch {
        const files = Array.isArray(json.files) ? json.files : [];
        setCustomerFiles(
          files.map((f: any) => ({
            path: f.path,
            originalname: f.originalname,
            size: f.size,
          }))
        );
      }
      showToast('success', 'Dosya yüklendi');
    } catch (err: any) {
      console.error('Müşteri dosya yükleme hatası:', err);
      showToast('error', err?.message || 'Dosya yüklenemedi');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteFile = (file: { path: string; originalname?: string }, customer: Customer) => {
    const pathSegment = file.path?.split('/').pop() || file.path || '';
    const displayName = file.originalname || pathSegment || 'dosya';
    showToastInteractive({
      title: 'Dosya Sil',
      message: `${displayName} dosyasını silmek istiyor musunuz?`,
      confirmText: 'Evet, Sil',
      cancelText: 'İptal',
      onConfirm: async () => {
        try {
          await apiRequest(`/customers/${customer.id}/files`, {
            method: 'DELETE',
            params: { fileName: pathSegment },
          });
          setCustomerFiles((prev) => prev.filter((f) => f.path !== file.path));
          showToast('success', 'Dosya silindi');
        } catch (err: any) {
          showToast('error', err?.message || 'Dosya silinemedi');
        }
      },
    });
  };

  /** Boş alan metni: variable gri renkte gösterilecek */
  const emptyLabel = (key: string) => (
    <span className="page-empty-hint">{key}</span>
  );

  return (
    <div
      className="page-wrapper min-h-screen flex flex-col md:flex-row"
      onClick={() => setSelectedCustomerId(null)}
    >
      {/* Sol Liste Alanı */}
      <div className="page-panel-sol w-full md:w-1/2 lg:w-2/5" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 md:p-6">
          {/* Header - Yeni Müşteri Ekle önce, Dışa Aktar en sağda */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="page-title">
                Müşteriler {filteredCustomers.length > 0 && <span className="page-title-badge">{filteredCustomers.length}</span>}
              </h1>
            </div>
            <div className="flex items-center gap-2">
                <button
                type="button"
                onClick={handleNewCustomerClick}
                className="page-btn-yeni"
              >
                + Yeni Müşteri Ekle
              </button>
              <div
                className={`buton-disa-aktar clickdropdown page-export-dropdown ${exportMenuOpen ? 'is-open' : ''}`}
              >
                <div className="btn-baslik">
                  <i className="icon-dashboard-disa-aktar" />
                  Dışa Aktar
                </div>
                <div
                  className="dosya-tur clickdropbtn"
                  onClick={() => setExportMenuOpen(!exportMenuOpen)}
                >
                  .xls
                  <i className="fa-solid fa-chevron-down" />
                {exportMenuOpen && (
                    <div className="dosya-tur-content clickdropdown-content">
                      <div className="liste-baslik">Müşterileri Dışa Aktar</div>
                      <button type="button" className="btn-disa-aktar" onClick={() => handleExport('excel')}>
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
            </div>
          </div>

          {/* Arama - ortak SearchInput: ESC sıfırlar, çarpı ile temizleme */}
          <div className="mb-6">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Müşteri ara..."
              className="page-search-input"
              aria-label="Müşteri ara"
            />
          </div>

          {/* Customers List */}
          {!filteredCustomers.length ? (
            <EmptyState
              title={customers?.length ? 'Arama sonucu bulunamadı' : 'Görüntülenecek müşteri bulunamadı'}
              description={customers?.length ? 'Farklı bir arama terimi deneyin.' : 'Henüz müşteri kaydı bulunmamaktadır.'}
            />
          ) : (
            <div className="customers-table-wrapper">
              <div className="customers-table-scroll table-scrollbar">
                <table className="w-full customers-table">
                  <thead>
                    <tr>
                      <TableSortHeader field="kod" label="Müşteri No" currentSort={sortField} sortDirection={sortDir} onSort={handleSort} />
                      <TableSortHeader field="tipi" label="Müşteri Tipi" currentSort={sortField} sortDirection={sortDir} onSort={handleSort} />
                      <TableSortHeader field="grubu" label="Müşteri Grubu" currentSort={sortField} sortDirection={sortDir} onSort={handleSort} className="customers-th-grubu" />
                      <TableSortHeader field="unvan" label="Müşteri Ünvanı & Yetkili Kişi" currentSort={sortField} sortDirection={sortDir} onSort={handleSort} />
                      <TableSortHeader field="telefon" label="İletişim Bilgileri" currentSort={sortField} sortDirection={sortDir} onSort={handleSort} />
                      <th className="text-center">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCustomers.map((customer) => {
                      const unvan = customer.musteri_unvani || `Müşteri #${customer.id}`;
                      const yetkili =
                        customer.yetkili_kisi || customer.musteri_ad_soyad || customer.musteri_unvani || '-';
                      const formattedPhone = customer.musteri_telefon
                        ? formatPhoneNumber(customer.musteri_telefon)
                        : '';
                      const phoneDigits = customer.musteri_telefon
                        ? customer.musteri_telefon.toString().replace(/\D/g, '')
                        : '';
                      const telHref =
                        phoneDigits && phoneDigits.length >= 10
                          ? `tel:+90${phoneDigits.slice(-10)}`
                          : undefined;
                      const tipi =
                        customer.musteri_tipi === 'kurumsal'
                          ? 'Kurumsal'
                          : customer.musteri_tipi === 'bireysel'
                            ? 'Bireysel'
                            : null;
                      return (
                        <tr
                          key={customer.id}
                          className={`customers-table-row ${selectedCustomerId === customer.id ? 'customers-table-row-selected' : ''}`}
                          onClick={() => setSelectedCustomerId(customer.id)}
                          data-table-row
                        >
                          <td className="customers-td-code" data-label="Müşteri No">
                            {customer.musteri_kodu || customer.id}
                          </td>
                          <td className="customers-td-tipi" data-label="Müşteri Tipi">
                            {tipi ?? emptyLabel('(Müşteri tipi eklenmemiş)')}
                          </td>
                          <td className="customers-td-grubu" data-label="Müşteri Grubu">
                            {customer.musteri_grubu?.trim()
                              ? customer.musteri_grubu
                              : emptyLabel('(Müşteri grubu eklenmemiş)')}
                          </td>
                          <td data-label="Müşteri Ünvanı & Yetkili Kişi">
                            <div className="customers-cell-stack">
                              <span className="customers-cell-unvan">{unvan}</span>
                              <span className="customers-cell-sub">
                                {yetkili !== '-' ? yetkili : emptyLabel('(Yetkili kişi eklenmemiş)')}
                              </span>
                            </div>
                          </td>
                          <td data-label="İletişim Bilgileri">
                            <div className="customers-cell-stack">
                              {formattedPhone ? (
                                <a
                                  href={telHref}
                                  className="customers-link"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {formattedPhone}
                                </a>
                              ) : (
                                <span className="customers-cell-sub">{emptyLabel('(Telefon bilgisi eklenmemiş)')}</span>
                              )}
                              {customer.musteri_eposta ? (
                                <a
                                  href={`mailto:${customer.musteri_eposta}`}
                                  className="customers-link customers-cell-sub"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {customer.musteri_eposta}
                                </a>
                              ) : (
                                <span className="customers-cell-sub">{emptyLabel('(E-posta bilgisi eklenmemiş)')}</span>
                              )}
                            </div>
                          </td>
                          <td className="text-center" data-label="İşlemler">
                            <div className="flex items-center justify-end">
                              <div className="islem-ikonlar">
                                <button
                                  type="button"
                                  className="islem-ikon duzenle-ikon"
                                  data-tooltip="Müşteriyi Düzenle"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCustomerId(customer.id);
                                    setEditingCustomer(customer);
                                    setYeniMusteriModalOpen(true);
                                  }}
                                >
                                  <Pencil size={16} aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  className="islem-ikon sil-ikon"
                                  data-tooltip="Müşteriyi Sil"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const ad =
                                      customer.musteri_unvani ||
                                      customer.musteri_ad_soyad ||
                                      `Müşteri #${customer.id}`;
                                    showToastInteractive({
                                      title: 'Müşteri Sil',
                                      message: `${ad} müşterisini silmek istediğinize emin misiniz?`,
                                      confirmText: 'Evet, Sil',
                                      cancelText: 'İptal',
                                      onConfirm: async () => {
                                        try {
                                          await apiRequest(`/customers/${customer.id}`, {
                                            method: 'DELETE',
                                          });
                                          showToast('success', 'Müşteri silindi');
                                          invalidateCustomerQueries(queryClient, customer.id);
                                          if (selectedCustomerId === customer.id) {
                                            setSelectedCustomerId(null);
                                          }
                                        } catch (err: any) {
                                          showToast(
                                            'error',
                                            err?.message || 'Müşteri silinemedi'
                                          );
                                        }
                                      },
                                    });
                                  }}
                            >
                                  <Trash2 size={16} aria-hidden />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sağ Detay Paneli – masaüstünde yan panel, mobilde modal */}
      {(!isMobile || selectedCustomerId) && (
        <>
          {isMobile && selectedCustomerId && (
            <div
              className="page-detail-modal-backdrop"
              onClick={() => setSelectedCustomerId(null)}
              aria-hidden
            />
          )}
          <div
            className={`page-panel-sag w-full md:w-1/2 lg:w-3/5 ${isMobile && selectedCustomerId ? 'page-panel-sag--as-modal' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="page-panel-sag-inner">
              <div className="customers-detail-header mb-4 flex items-center justify-between flex-shrink-0">
                <h2 className="customers-detail-title">Müşteri Detayları</h2>
                <div className="flex items-center gap-2">
                  {selectedCustomer && (
                    <button
                      type="button"
                      className="customers-btn-duzenle"
                      onClick={() => {
                        setEditingCustomer(selectedCustomer);
                        setYeniMusteriModalOpen(true);
                      }}
                    >
                      <Pencil size={16} aria-hidden />
                      <span>Müşteriyi Düzenle</span>
                    </button>
                  )}
                  {selectedCustomerId && (
                    <button
                      type="button"
                      onClick={() => setSelectedCustomerId(null)}
                      className="customers-close-detail md:hidden"
                      aria-label="Kapat"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {!selectedCustomer ? (
            <div className="page-empty-detail">
              <div className="page-empty-detail-inner">
                <i className="icon-sm-i-musteriler mx-auto mb-3 block" id="ikon" />
                <p className="page-empty-detail-text">
                  Müşteri detaylarını görüntülemek için listeden bir müşteri seçiniz.
                    </p>
                  </div>
                  </div>
          ) : (
            <div className="customers-detail-card" data-card-item>
              <div className="customers-detail-card-top custom-scrollbar">
                {/* Toplam Sipariş & Kalan Bakiye - en üstte, alan genişliğinde yarı yarıya */}
                <div className="customers-detail-block customers-detail-block-sep customers-detail-cari">
                  <div className="customers-detail-cari-row">
                    <div className="customers-detail-cari-cell">
                      <span className="customers-detail-label">Toplam Sipariş</span>
                      <span className="customers-detail-value">
                        {cariOzet?.toplam_siparis_sayisi ?? selectedCustomer.toplam_siparis ?? selectedCustomer.orderCount ?? 0}
                      </span>
                    </div>
                    <div className="customers-detail-cari-cell">
                      <span className="customers-detail-label">Kalan Bakiye</span>
                      <span className={`customers-detail-value customers-detail-bakiye ${(cariOzet?.bakiye ?? selectedCustomer.bakiye ?? 0) >= 0 ? 'customers-detail-bakiye-pozitif' : 'customers-detail-bakiye-negatif'}`}>
                        {formatTL(cariOzet?.bakiye ?? selectedCustomer.bakiye ?? 0)}
                      </span>
                    </div>
                  </div>
                  {selectedCustomer && (
                    <button
                      type="button"
                      className="customers-btn-cari customers-btn-cari-inline"
                      onClick={() => navigate(`/musteriler-cari/${selectedCustomer.id}`)}
                    >
                      <TurkishLira size={16} aria-hidden />
                      <span>Müşteri Cari Hesabı</span>
                    </button>
                  )}
                </div>

                {/* Müşteri Unvanı & Yetkili Kişi - tek başlık, ünvan büyük punto */}
                <div className="customers-detail-block customers-detail-block-sep">
                  <p className="customers-detail-label">Müşteri Unvanı & Yetkili Kişi</p>
                  <p className="customers-detail-value customers-detail-unvan">
                    {selectedCustomer.musteri_unvani?.trim() || emptyLabel('(Müşteri ünvanı eklenmemiş)')}
                  </p>
                  <p className="customers-detail-value customers-detail-yetkili">
                    {selectedCustomer.yetkili_kisi?.trim() || selectedCustomer.musteri_ad_soyad?.trim()
                      ? selectedCustomer.yetkili_kisi || selectedCustomer.musteri_ad_soyad
                      : emptyLabel('(Yetkili kişi eklenmemiş)')}
                  </p>
              </div>

                {/* Adres Bilgileri */}
                <p className="customers-detail-label">Adres Bilgileri</p>
                <div className="customers-detail-address-line customers-detail-block-sep">
                  {[
                    selectedCustomer.musteri_mahalle || null,
                    (selectedCustomer.musteri_acik_adres || selectedCustomer.musteri_adres || '').trim() || null,
                    formatIlceIlDisplay(selectedCustomer.musteri_ilce, selectedCustomer.musteri_il) || null,
                  ]
                    .filter(Boolean)
                    .join(', ') || emptyLabel('(Adres bilgisi eklenmemiş)')}
                    </div>

                {/* Vergi Kimlik Bilgileri */}
                <p className="customers-detail-label">Vergi Kimlik Bilgileri</p>
                {(selectedCustomer.musteri_vergi_dairesi || selectedCustomer.musteri_vergi_kimlik_numarasi) ? (
                  <div className="customers-detail-vergi customers-detail-block-sep">
                    <span>{selectedCustomer.musteri_vergi_dairesi}</span>
                    <span>{selectedCustomer.musteri_vergi_kimlik_numarasi}</span>
                  </div>
                ) : (
                  <p className="customers-detail-value customers-detail-block-sep">
                    {emptyLabel('(Vergi bilgisi eklenmemiş)')}
                  </p>
              )}

                {/* Müşterinin ürün yazısı bilgisi + kopyala */}
                <div className="customers-detail-urun-yazisi-wrap customers-detail-block-sep">
                  <div className="customers-detail-urun-yazisi-head">
                    <p className="customers-detail-label">Müşteri Ürün Yazısı Bilgisi</p>
                    <button
                      type="button"
                      className="customers-detail-copy-btn"
                      onClick={() => {
                        const text = (selectedCustomer as any).musteri_urun_yazisi?.trim() || '';
                        if (text) {
                          navigator.clipboard.writeText(text).then(
                            () => showToast('success', 'Ürün yazısı panoya kopyalandı'),
                            () => showToast('error', 'Kopyalama başarısız')
                          );
                        } else {
                          showToast('info', 'Kopyalanacak ürün yazısı yok');
                        }
                      }}
                      title="Panoya kopyala"
                      aria-label="Ürün yazısını kopyala"
                    >
                      <Copy size={16} aria-hidden />
                    </button>
                  </div>
                  <p className="customers-detail-value customers-detail-urun-yazisi">
                    {(selectedCustomer as any).musteri_urun_yazisi?.trim() ||
                      emptyLabel('(Ürün yazısı eklenmemiş)')}
                      </p>
                </div>
              </div>

              {/* Yüklenen Dosyalar - space-between ile aşağıda */}
              <div className="customers-detail-files">
                <div className="customers-detail-files-head flex items-center justify-between">
                  <h3 className="customers-detail-files-title">
                    Yüklenen Dosyalar{customerFiles.length > 0 ? ` (${customerFiles.length} Dosya)` : ''}
                  </h3>
                  <button
                    type="button"
                    className="urun-yazisi-yukle urun-yazisi-yukle-label"
                    data-tooltip="Yeni dosya ekle"
                    data-tooltip-pos="top"
                    onClick={() => {
                      if (uploadingFile || !selectedCustomer) return;
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '*/*';
                      input.onchange = (e: Event) => {
                        const target = e.target as HTMLInputElement;
                        const file = target.files?.[0];
                        if (file && selectedCustomer) {
                          void handleFileUpload(file, selectedCustomer);
                        }
                      };
                      input.click();
                    }}
                  >
                    <span>+</span>
                    <span className="urun-yazisi-yukle-text">Dosya Ekle</span>
                  </button>
                </div>

                {customerFiles.length === 0 ? (
                  <p className="customers-detail-files-empty">
                    <Info size={18} className="customers-detail-files-empty-icon" aria-hidden />
                    Müşteriye ait ürün yazı dosyası eklenmemiş.
                  </p>
                ) : (
                  <div className="customers-detail-files-list table-scrollbar">
                    <ul className="text-sm">
                      {customerFiles.map((file) => {
                        const pathSegment = file.path?.split('/').pop() || file.path;
                        const displayName = file.originalname || pathSegment || 'dosya';
                        const downloadUrl = fixUploadUrl(file.path);
                        return (
                          <li key={file.path} className="customers-detail-file-item">
                            <FileText size={14} className="customers-detail-file-icon" aria-hidden />
                            <a
                              href={downloadUrl}
                              download={displayName}
                              className="customers-link truncate flex-1 min-w-0"
                              title={`İndir: ${displayName}`}
                              onClick={(e) => void handleFileDownloadClick(e, downloadUrl, displayName)}
                            >
                              {displayName}
                            </a>
                            <span className="customers-detail-file-meta">
                              {typeof file.size === 'number' && (
                                <span className="customers-detail-file-size">
                                  {(file.size / 1024).toFixed(1)} KB
                                </span>
                              )}
                              <button
                                type="button"
                                className="customers-detail-file-delete"
                                title="Dosyayı sil"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteFile(file, selectedCustomer);
                              }}
                              >
                                <Trash2 size={14} aria-hidden />
                              </button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
            </div>
          </div>
        </>
      )}

      {/* Click outside to close export menu (seçimi temizlemeden) */}
      {exportMenuOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={(e) => {
            e.stopPropagation();
            setExportMenuOpen(false);
          }}
        />
      )}
      <YeniMusteriModal
        isOpen={yeniMusteriModalOpen}
        mode={editingCustomer ? 'edit' : 'create'}
        customer={
          editingCustomer
            ? {
                id: editingCustomer.id,
                musteri_unvani: editingCustomer.musteri_unvani,
                musteri_ad_soyad: editingCustomer.musteri_ad_soyad,
                musteri_telefon: editingCustomer.musteri_telefon,
                musteri_eposta: editingCustomer.musteri_eposta,
                musteri_acik_adres: editingCustomer.musteri_acik_adres,
                musteri_il: editingCustomer.musteri_il,
                musteri_ilce: editingCustomer.musteri_ilce,
                musteri_mahalle: editingCustomer.musteri_mahalle,
                musteri_tipi: editingCustomer.musteri_tipi as 'bireysel' | 'kurumsal' | undefined,
                musteri_grubu: editingCustomer.musteri_grubu,
                musteri_vergi_kimlik_numarasi: editingCustomer.musteri_vergi_kimlik_numarasi,
                musteri_vergi_dairesi: editingCustomer.musteri_vergi_dairesi,
                musteri_urun_yazisi: (editingCustomer as any).musteri_urun_yazisi,
              }
            : undefined
        }
        onClose={() => {
          setYeniMusteriModalOpen(false);
          setEditingCustomer(null);
        }}
        onSuccess={() => {
          invalidateCustomerQueries(queryClient, editingCustomer?.id);
          setYeniMusteriModalOpen(false);
          setEditingCustomer(null);
        }}
      />
    </div>
  );
};

