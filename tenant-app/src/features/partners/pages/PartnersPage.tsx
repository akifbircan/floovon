import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { ErrorState } from '../../../shared/components/ErrorState';
import { EmptyState } from '../../../shared/components/EmptyState';
import { usePageAnimations } from '../../../shared/hooks/usePageAnimations';
import { formatPhoneNumber, formatIlceIlDisplay, formatTL } from '../../../shared/utils/formatUtils';
import { showToast, showToastInteractive } from '../../../shared/utils/toastUtils';
import { SearchInput } from '../../../shared/components/SearchInput';
import { Pencil, Trash2, TurkishLira } from 'lucide-react';
import { TableSortHeader } from '../../../shared/components/TableSortHeader';
import { getPrintLogoMarkup, openPrintWindow, downloadTableAsExcel, buildPrintHtml, getPrintDateDDMMYYYY } from '../../dashboard/utils/exportUtils';
import { invalidatePartnerQueries } from '../../../lib/invalidateQueries';
import { YeniPartnerModal } from '@/features/dashboard/components/YeniPartnerModal';
import { getUploadUrl } from '../../../shared/utils/urlUtils';

interface Partner {
  id: number;
  partner_kodu?: string;
  partner_firma_adi?: string;
  firma_adi?: string;
  partner_logo?: string;
  partner_telefon?: string;
  partner_eposta?: string;
  partner_acik_adres?: string;
  partner_yetkili_kisi?: string;
  partner_il?: string;
  partner_ilce?: string;
  partner_mahalle?: string;
  toplam_siparis?: number;
  bakiye?: number;
}

/**
 * Partner Firmalar sayfası – Müşteriler sayfası ile aynı yapı
 * Sol liste + Sağ detay paneli; ekle/düzenle sağdan açılan modal ile
 */
export const PartnersPage: React.FC = () => {
  usePageAnimations('partners');
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [yeniPartnerModalOpen, setYeniPartnerModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

  const { data: partners, isLoading, error } = useQuery({
    queryKey: ['partners'],
    queryFn: async () => {
      try {
        const result = await apiRequest<Partner[]>('/partner-firmalar', { method: 'GET' });
        return Array.isArray(result) ? result : [];
      } catch (err) {
        if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 404) {
          return [];
        }
        console.error('Partner firmalar yükleme hatası:', err);
        return [];
      }
    },
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const filteredPartners = useMemo(() => {
    if (!partners?.length) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter(
      (p) =>
        (p.partner_kodu ?? '').toLowerCase().includes(q) ||
        (p.partner_firma_adi ?? p.firma_adi ?? '').toLowerCase().includes(q) ||
        (p.partner_yetkili_kisi ?? '').toLowerCase().includes(q) ||
        (p.partner_telefon ?? '').includes(q) ||
        (p.partner_eposta ?? '').toLowerCase().includes(q)
    );
  }, [partners, searchQuery]);

  const sortedPartners = useMemo(() => {
    const data = [...filteredPartners];
    if (!sortField) return data;
    return data.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'kod': cmp = (a.partner_kodu ?? '').localeCompare(b.partner_kodu ?? ''); break;
        case 'firma': cmp = (a.partner_firma_adi || a.firma_adi || '').localeCompare(b.partner_firma_adi || b.firma_adi || ''); break;
        case 'yetkili': cmp = (a.partner_yetkili_kisi ?? '').localeCompare(b.partner_yetkili_kisi ?? ''); break;
        case 'telefon': cmp = (a.partner_telefon ?? '').localeCompare(b.partner_telefon ?? ''); break;
        case 'eposta': cmp = (a.partner_eposta ?? '').localeCompare(b.partner_eposta ?? ''); break;
        default: return 0;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredPartners, sortField, sortDir]);

  const handleSort = (field: string, dir: 'asc' | 'desc') => {
    setSortField(field);
    setSortDir(dir);
  };

  const selectedPartner = useMemo(
    () => partners?.find((p) => p.id === selectedPartnerId) || null,
    [partners, selectedPartnerId]
  );

  const { data: cariOzet } = useQuery({
    queryKey: ['partner-cari-ozet-inline', selectedPartnerId],
    queryFn: async () => {
      if (!selectedPartnerId) return null;
      try {
        const result = await apiRequest<{
          siparis_sayisi?: number;
          toplam_siparis?: number;
          toplam_alacak?: number;
          toplam_tahsilat?: number;
          toplam_odeme?: number;
          bakiye?: number;
        }>(`/partner-firmalar/${selectedPartnerId}/cari-ozet`, { method: 'GET' });
        return result;
      } catch {
        return null;
      }
    },
    enabled: !!selectedPartnerId,
    staleTime: 2 * 60 * 1000,
  });

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
          title="Partner firmalar yüklenemedi"
          message={error instanceof Error ? error.message : 'Bilinmeyen hata'}
        />
      </div>
    );
  }

  const handleExport = async (type: 'excel' | 'print') => {
    if (type === 'excel') {
      try {
        const list = filteredPartners ?? [];
        const data = list.map((p) => ({
          'Partner Kodu': p.partner_kodu ?? p.id,
          'Firma Adı': (p.partner_firma_adi || p.firma_adi) ?? '',
          'Yetkili Kişi': p.partner_yetkili_kisi ?? '',
          'Telefon': p.partner_telefon ? formatPhoneNumber(p.partner_telefon) : '',
          'E-posta': p.partner_eposta ?? '',
          'Adres': [p.partner_mahalle, p.partner_acik_adres, formatIlceIlDisplay(p.partner_ilce, p.partner_il)].filter(Boolean).join(', ') || '',
        }));
        downloadTableAsExcel(data, 'Partner-Firmalar');
        showToast('success', 'Excel dosyası indirildi.');
      } catch (e: any) {
        showToast('error', e?.message ?? 'Excel dışa aktarılamadı.');
      }
    } else {
      await handlePartnersPrint();
    }
    setExportMenuOpen(false);
  };

  const printHint = (text: string) => `<span class="print-hint">${text}</span>`;
  const handlePartnersPrint = async () => {
    const list = filteredPartners ?? [];
    const unvan = (p: Partner) => p.partner_firma_adi || p.firma_adi || `Partner #${p.id}`;
    const yetkiliStr = (p: Partner) =>
      p.partner_yetkili_kisi?.trim() || printHint('(Yetkili kişi eklenmemiş)');
    const telStr = (p: Partner) =>
      p.partner_telefon ? formatPhoneNumber(p.partner_telefon) : printHint('(Telefon eklenmemiş)');
    const epostaStr = (p: Partner) =>
      p.partner_eposta?.trim() || printHint('(E-posta eklenmemiş)');
    const adresStr = (p: Partner) => {
      const parts = [
        p.partner_mahalle || null,
        (p.partner_acik_adres || '').trim() || null,
        formatIlceIlDisplay(p.partner_ilce, p.partner_il) || null,
      ].filter(Boolean);
      return parts.length ? parts.join(', ') : printHint('(Adres eklenmemiş)');
    };
    const logoPrintCell = (p: Partner) => {
      if (p.partner_logo) {
        const logoUrl = getUploadUrl(p.partner_logo);
        return `<img src="${logoUrl}" alt="" class="print-partner-logo" />`;
      }
      return '—';
    };
    const rows = list
      .map(
        (p) => `
        <tr>
          <td class="print-td-logo">${logoPrintCell(p)}</td>
          <td>${p.partner_kodu ?? p.id}</td>
          <td><strong>${unvan(p)}</strong><br/>${yetkiliStr(p)}</td>
          <td>${adresStr(p)}</td>
          <td>${telStr(p)}<br/>${epostaStr(p)}</td>
        </tr>`
      )
      .join('');
    const title = 'Partner Firmalar';
    const logoMarkup = await getPrintLogoMarkup();
    const tableHeaders = '<th>Logo</th><th>Partner Kodu</th><th>Firma Adı & Yetkili</th><th>Adres</th><th>İletişim</th>';
    const html = buildPrintHtml(title, logoMarkup, '', tableHeaders, rows);
    openPrintWindow(html, `${title} – ${getPrintDateDDMMYYYY()}`, '');
  };

  const handleNewPartnerClick = () => {
    setEditingPartner(null);
    setYeniPartnerModalOpen(true);
  };

  const emptyLabel = (key: string) => (
    <span className="page-empty-hint">{key}</span>
  );

  return (
    <div
      className="page-wrapper min-h-screen flex flex-col md:flex-row"
      onClick={() => setSelectedPartnerId(null)}
    >
      <div className="page-panel-sol w-full md:w-1/2 lg:w-2/5" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 md:p-6">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="page-title">
                Partner Firmalar {filteredPartners.length > 0 && <span className="page-title-badge">{filteredPartners.length}</span>}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleNewPartnerClick} className="page-btn-yeni">
                + Yeni Partner Firma Ekle
              </button>
              <div
                className={`buton-disa-aktar clickdropdown page-export-dropdown ${exportMenuOpen ? 'is-open' : ''}`}
              >
                <div className="btn-baslik">
                  <i className="icon-dashboard-disa-aktar" />
                  Dışa Aktar
                </div>
                <div className="dosya-tur clickdropbtn" onClick={() => setExportMenuOpen(!exportMenuOpen)}>
                  .xls
                  <i className="fa-solid fa-chevron-down" />
                  {exportMenuOpen && (
                    <div className="dosya-tur-content clickdropdown-content">
                      <div className="liste-baslik">Partner Firmaları Dışa Aktar</div>
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

          <div className="mb-6">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Partner firma ara..."
              className="page-search-input"
              aria-label="Partner ara"
            />
          </div>

          {!filteredPartners.length ? (
            <EmptyState
              title={partners?.length ? 'Arama sonucu bulunamadı' : 'Görüntülenecek partner firma bulunamadı'}
              description={partners?.length ? 'Farklı bir arama terimi deneyin.' : 'Henüz partner firma kaydı bulunmamaktadır.'}
            />
          ) : (
            <div className="partners-table-wrapper">
              <div className="partners-table-scroll table-scrollbar">
                <table className="w-full partners-table">
                  <thead>
                    <tr>
                      <th className="partners-th-logo">Logo</th>
                      <TableSortHeader field="kod" label="Partner Kodu" currentSort={sortField} sortDirection={sortDir} onSort={handleSort} />
                      <TableSortHeader field="firma" label="Partner Ünvanı & Yetkili Kişi" currentSort={sortField} sortDirection={sortDir} onSort={handleSort} />
                      <TableSortHeader field="telefon" label="İletişim Bilgileri" currentSort={sortField} sortDirection={sortDir} onSort={handleSort} />
                      <th className="text-center">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPartners.map((partner) => {
                      const unvan = partner.partner_firma_adi || partner.firma_adi || `Partner #${partner.id}`;
                      const yetkili = partner.partner_yetkili_kisi || '-';
                      const formattedPhone = partner.partner_telefon
                        ? formatPhoneNumber(partner.partner_telefon)
                        : '';
                      const phoneDigits = partner.partner_telefon
                        ? partner.partner_telefon.toString().replace(/\D/g, '')
                        : '';
                      const telHref =
                        phoneDigits && phoneDigits.length >= 10
                          ? `tel:+90${phoneDigits.slice(-10)}`
                          : undefined;
                      const logoUrl = partner.partner_logo ? getUploadUrl(partner.partner_logo) : '';
                      return (
                        <tr
                          key={partner.id}
                          className={`partners-table-row ${selectedPartnerId === partner.id ? 'partners-table-row-selected' : ''}`}
                          onClick={() => setSelectedPartnerId(partner.id)}
                          data-table-row
                        >
                          <td className="partners-td-logo" data-label="Logo">
                            {logoUrl ? (
                              <img
                                src={logoUrl}
                                alt=""
                                className="partners-table-logo"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const pl = e.currentTarget.nextElementSibling as HTMLElement | null;
                                  if (pl) pl.style.display = 'inline';
                                }}
                              />
                            ) : null}
                            <span
                              className="partners-table-logo-placeholder"
                              style={{ display: logoUrl ? 'none' : 'inline' }}
                            >
                              —
                            </span>
                          </td>
                          <td className="partners-td-code" data-label="Partner Kodu">
                            {partner.partner_kodu || partner.id}
                          </td>
                          <td data-label="Partner Ünvanı & Yetkili Kişi">
                            <div className="partners-cell-stack">
                              <span className="partners-cell-unvan">{unvan}</span>
                              <span className="partners-cell-sub">
                                {yetkili !== '-' ? yetkili : emptyLabel('(Yetkili kişi eklenmemiş)')}
                              </span>
                            </div>
                          </td>
                          <td data-label="İletişim Bilgileri">
                            <div className="partners-cell-stack">
                              {formattedPhone ? (
                                <a
                                  href={telHref}
                                  className="partners-link"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {formattedPhone}
                                </a>
                              ) : (
                                <span className="partners-cell-sub">{emptyLabel('(Telefon eklenmemiş)')}</span>
                              )}
                              {partner.partner_eposta ? (
                                <a
                                  href={`mailto:${partner.partner_eposta}`}
                                  className="partners-link partners-cell-sub"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {partner.partner_eposta}
                                </a>
                              ) : (
                                <span className="partners-cell-sub">{emptyLabel('(E-posta eklenmemiş)')}</span>
                              )}
                            </div>
                          </td>
                          <td className="text-center" data-label="İşlemler">
                            <div className="flex items-center justify-end">
                              <div className="islem-ikonlar">
                                <button
                                  type="button"
                                  className="islem-ikon duzenle-ikon"
                                  data-tooltip="Partnerı Düzenle"
                                  title="Düzenle"
                                  aria-label="Düzenle"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPartnerId(partner.id);
                                    setEditingPartner(partner);
                                    setYeniPartnerModalOpen(true);
                                  }}
                                >
                                  <Pencil size={16} aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  className="islem-ikon sil-ikon"
                                  data-tooltip="Partnerı Sil"
                                  title="Sil"
                                  aria-label="Sil"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const ad = partner.partner_firma_adi || partner.firma_adi || `Partner #${partner.id}`;
                                    showToastInteractive({
                                      title: 'Partner Sil',
                                      message: `${ad} partner firmasını silmek istediğinize emin misiniz?`,
                                      confirmText: 'Evet, Sil',
                                      cancelText: 'İptal',
                                      onConfirm: async () => {
                                        try {
                                          await apiRequest(`/partner-firmalar/${partner.id}`, {
                                            method: 'DELETE',
                                          });
                                          showToast('success', 'Partner firma silindi');
                                          invalidatePartnerQueries(queryClient, partner.id);
                                          if (selectedPartnerId === partner.id) {
                                            setSelectedPartnerId(null);
                                          }
                                        } catch (err: any) {
                                          showToast('error', err?.message || 'Partner firma silinemedi');
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

      {/* Sağ Detay Paneli – masaüstünde yan panel, mobilde modal (portal ile body'de, overlay üstte) */}
      {(!isMobile || selectedPartnerId) && (() => {
        const panelContent = (
            <div className="page-panel-sag-inner">
              <div className="partners-detail-header mb-4 flex items-center justify-between flex-shrink-0">
                <h2 className="partners-detail-title">Partner Firma Detayları</h2>
                <div className="flex items-center gap-2">
                  {selectedPartner && (
                    <button
                      type="button"
                      className="partners-btn-duzenle"
                      onClick={() => {
                        setEditingPartner(selectedPartner);
                        setYeniPartnerModalOpen(true);
                      }}
                    >
                      <Pencil size={16} aria-hidden />
                      <span>Düzenle</span>
                    </button>
                  )}
                  {selectedPartnerId && (
                    <button
                      type="button"
                      onClick={() => setSelectedPartnerId(null)}
                      className="partners-close-detail md:hidden"
                      aria-label="Kapat"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {!selectedPartner ? (
            <div className="page-empty-detail">
              <div className="page-empty-detail-inner">
                <i className="icon-sm-i-partner mx-auto mb-3 block" aria-hidden />
                <p className="page-empty-detail-text">
                  Partner firma detaylarını görüntülemek için listeden bir partner firma seçiniz.
                </p>
              </div>
            </div>
          ) : (
            <div className="partners-detail-card" data-card-item>
              <div className="partners-detail-card-top custom-scrollbar">
                <div className="partners-detail-block partners-detail-block-sep partners-detail-cari">
                  <div className="partners-detail-cari-row">
                    <div className="partners-detail-cari-cell">
                      <span className="partners-detail-label">Alınan Toplam Sipariş</span>
                      <span className="partners-detail-value">
                        {cariOzet?.siparis_sayisi ?? cariOzet?.toplam_siparis ?? selectedPartner.toplam_siparis ?? 0}
                      </span>
                    </div>
                    <div className="partners-detail-cari-cell">
                      <span className="partners-detail-label">Verilen Toplam Sipariş</span>
                      <span className="partners-detail-value">
                        {0}
                      </span>
                    </div>
                  </div>
                  <div className="partners-detail-cari-row">
                    <div className="partners-detail-cari-cell">
                      <span className="partners-detail-label">Kalan Bakiye</span>
                      <span
                        className={`partners-detail-value partners-detail-bakiye ${
                          (cariOzet?.bakiye ?? selectedPartner.bakiye ?? 0) >= 0
                            ? 'partners-detail-bakiye-pozitif'
                            : 'partners-detail-bakiye-negatif'
                        }`}
                      >
                        {formatTL(cariOzet?.bakiye ?? selectedPartner.bakiye ?? 0)}
                      </span>
                    </div>
                  </div>
                  {selectedPartner && (
                    <button
                      type="button"
                      className="partners-btn-cari partners-btn-cari-inline"
                      onClick={() => navigate(`/partner-firmalar-cari/${selectedPartner.id}`)}
                    >
                      <TurkishLira size={16} aria-hidden />
                      <span>Partner Cari Hesabı</span>
                    </button>
                  )}
                </div>

                {selectedPartner.partner_logo && (
                  <div className="partners-detail-logo-wrap">
                    <img
                      src={getUploadUrl(selectedPartner.partner_logo)}
                      alt=""
                      className="partners-detail-logo"
                      onError={(e) => e.currentTarget.style.display = 'none'}
                    />
                  </div>
                )}

                <div className="partners-detail-block partners-detail-block-sep">
                  <p className="partners-detail-label">Firma Adı & Yetkili Kişi</p>
                  <p className="partners-detail-value partners-detail-unvan">
                    {(selectedPartner.partner_firma_adi || selectedPartner.firma_adi)?.trim() ||
                      emptyLabel('(Firma adı eklenmemiş)')}
                  </p>
                  <p className="partners-detail-value partners-detail-yetkili">
                    {selectedPartner.partner_yetkili_kisi?.trim() ||
                      emptyLabel('(Yetkili kişi eklenmemiş)')}
                  </p>
                </div>

                <p className="partners-detail-label">Adres Bilgileri</p>
                <div className="partners-detail-address-line partners-detail-block-sep">
                  {[
                    selectedPartner.partner_mahalle || null,
                    (selectedPartner.partner_acik_adres || '').trim() || null,
                    formatIlceIlDisplay(selectedPartner.partner_ilce, selectedPartner.partner_il) || null,
                  ]
                    .filter(Boolean)
                    .join(', ') || emptyLabel('(Adres bilgisi eklenmemiş)')}
                </div>
              </div>
            </div>
          )}
            </div>
        );
        const panel = (
          <div
            className={`page-panel-sag w-full md:w-1/2 lg:w-3/5 ${isMobile && selectedPartnerId ? 'page-panel-sag--as-modal' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            {panelContent}
          </div>
        );
        if (isMobile && selectedPartnerId) {
          return createPortal(
            <>
              <div
                className="page-detail-modal-backdrop"
                onClick={() => setSelectedPartnerId(null)}
                aria-hidden
              />
              {panel}
            </>,
            document.body
          );
        }
        return panel;
      })()}

      {exportMenuOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setExportMenuOpen(false)}
        />
      )}

      <YeniPartnerModal
        isOpen={yeniPartnerModalOpen}
        mode={editingPartner ? 'edit' : 'create'}
        partner={editingPartner ?? undefined}
        onClose={() => {
          setYeniPartnerModalOpen(false);
          setEditingPartner(null);
        }}
        onSuccess={() => {
          invalidatePartnerQueries(queryClient, editingPartner?.id);
          setYeniPartnerModalOpen(false);
          setEditingPartner(null);
        }}
      />
    </div>
  );
};
