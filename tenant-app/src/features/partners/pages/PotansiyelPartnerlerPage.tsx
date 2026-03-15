import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { getKonumAyarlari } from '../../dashboard/api/formActions';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { ErrorState } from '../../../shared/components/ErrorState';
import { EmptyState } from '../../../shared/components/EmptyState';
import { SearchInput } from '../../../shared/components/SearchInput';
import { usePageAnimations } from '../../../shared/hooks/usePageAnimations';
import { formatPhoneNumber } from '../../../shared/utils/formatUtils';
import { getUploadUrl } from '../../../shared/utils/urlUtils';
import { getPrintLogoMarkup, openPrintWindow, downloadTableAsExcel, buildPrintHtml, getPrintDateDDMMYYYY } from '../../dashboard/utils/exportUtils';
import { showToast } from '../../../shared/utils/toastUtils';
import { Phone, Mail, MapPinCheck, Handshake, Flower } from 'lucide-react';
import { TableSortHeader } from '../../../shared/components/TableSortHeader';
import '../styles/potansiyel-partnerler.css';

/** Backend partner_firmalar alanları */
interface PotansiyelPartner {
  id: number;
  partner_firma_adi?: string;
  firma_adi?: string;
  partner_yetkili_kisi?: string;
  yetkili_kisi?: string;
  partner_il?: string;
  il?: string;
  partner_ilce?: string;
  ilce?: string;
  partner_telefon?: string;
  telefon?: string;
  partner_eposta?: string;
  email?: string;
  partner_logo?: string;
  logo?: string;
}

/**
 * Potansiyel Partnerler sayfası
 * Arşiv Siparişler / Müşteriler ile aynı yapı
 */
export const PotansiyelPartnerlerPage: React.FC = () => {
  usePageAnimations('partners');
  const [searchQuery, setSearchQuery] = useState('');
  const [ilFilter, setIlFilter] = useState<string>('');
  const [ilceFilter, setIlceFilter] = useState<string>('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data: konum } = useQuery({
    queryKey: ['ayarlar-konum'],
    queryFn: getKonumAyarlari,
    staleTime: 5 * 60 * 1000,
  });

  const { data: partners, isLoading, error } = useQuery({
    queryKey: ['partner-firmalar'],
    queryFn: async () => {
      try {
        const result = await apiRequest<PotansiyelPartner[] | { data?: PotansiyelPartner[] }>('/partner-firmalar', {
          method: 'GET',
        });
        const arr = Array.isArray(result) ? result : (result?.data ?? []);
        return Array.isArray(arr) ? arr : [];
      } catch (err) {
        if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 404) {
          return [];
        }
        console.error('Potansiyel partnerler yükleme hatası:', err);
        throw err;
      }
    },
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const getIl = (p: PotansiyelPartner) => p.partner_il || p.il || '';
  const getIlce = (p: PotansiyelPartner) => p.partner_ilce || p.ilce || '';
  const getTelefon = (p: PotansiyelPartner) => p.partner_telefon || p.telefon || '';
  const getEmail = (p: PotansiyelPartner) => p.partner_eposta || p.email || '';
  const getLogo = (p: PotansiyelPartner) => p.partner_logo || p.logo || '';
  const getYetkili = (p: PotansiyelPartner) => p.partner_yetkili_kisi || p.yetkili_kisi || '';
  const getFirmaAdi = (p: PotansiyelPartner) => p.partner_firma_adi || p.firma_adi || '';

  const filteredPartners = useMemo(() => {
    if (!partners?.length) return [];
    let list = [...partners];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          getFirmaAdi(p).toLowerCase().includes(q) ||
          getYetkili(p).toLowerCase().includes(q) ||
          getTelefon(p).includes(q) ||
          getEmail(p).toLowerCase().includes(q) ||
          getIl(p).toLowerCase().includes(q) ||
          getIlce(p).toLowerCase().includes(q)
      );
    }
    if (ilFilter) list = list.filter((p) => getIl(p) === ilFilter);
    if (ilceFilter) list = list.filter((p) => getIlce(p) === ilceFilter);
    return list;
  }, [partners, searchQuery, ilFilter, ilceFilter]);

  const sortedPartners = useMemo(() => {
    const data = [...filteredPartners];
    if (!sortField) return data;
    return data.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'partner': cmp = getFirmaAdi(a).localeCompare(getFirmaAdi(b)); break;
        case 'yetkili': cmp = getYetkili(a).localeCompare(getYetkili(b)); break;
        case 'il': cmp = getIl(a).localeCompare(getIl(b)); break;
        case 'ilce': cmp = getIlce(a).localeCompare(getIlce(b)); break;
        case 'telefon': cmp = getTelefon(a).localeCompare(getTelefon(b)); break;
        case 'email': cmp = getEmail(a).localeCompare(getEmail(b)); break;
        default: return 0;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredPartners, sortField, sortDir]);

  const handleSort = (field: string, dir: 'asc' | 'desc') => {
    setSortField(field);
    setSortDir(dir);
  };

  const iller = useMemo(() => {
    const set = new Set<string>();
    partners?.forEach((p) => {
      const il = getIl(p).trim();
      if (il) set.add(il);
    });
    return Array.from(set).sort();
  }, [partners]);

  const ilceler = useMemo(() => {
    if (!ilFilter) return [];
    const set = new Set<string>();
    partners?.forEach((p) => {
      if (getIl(p) === ilFilter) {
        const ilce = getIlce(p).trim();
        if (ilce) set.add(ilce);
      }
    });
    return Array.from(set).sort();
  }, [partners, ilFilter]);

  /** Türkçe karşılaştırma için normalize (eski yapıdaki gibi) */
  const normalizeTr = (s: string) =>
    (s || '')
      .toLowerCase()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/İ/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .trim();

  const cicekciIl = (konum?.il_adi || '').trim();
  const cicekciIlce = (konum?.ilce_adi || '').trim();

  const hasFilter = !!(searchQuery.trim() || ilFilter || ilceFilter);

  /** Filtreleme yapıldığında bilgi alanları filteredPartners'a göre güncellenir */
  const toplamPartner = hasFilter ? filteredPartners.length : (partners?.length || 0);
  const sehirdekiPartner = ilFilter
    ? (filteredPartners.filter((p) => normalizeTr(getIl(p)) === normalizeTr(ilFilter)).length || 0)
    : cicekciIl
      ? (filteredPartners.filter((p) => normalizeTr(getIl(p)) === normalizeTr(cicekciIl)).length || 0)
      : toplamPartner;
  const ilcedekiPartner = ilceFilter
    ? (filteredPartners.filter((p) => normalizeTr(getIlce(p)) === normalizeTr(ilceFilter)).length || 0)
    : ilFilter
      ? sehirdekiPartner
      : cicekciIl && cicekciIlce
        ? (filteredPartners.filter(
            (p) =>
              normalizeTr(getIl(p)) === normalizeTr(cicekciIl) &&
              normalizeTr(getIlce(p)) === normalizeTr(cicekciIlce)
          ).length || 0)
        : 0;

  const handleClearFilters = () => {
    setSearchQuery('');
    setIlFilter('');
    setIlceFilter('');
  };

  const handleExport = async (type: 'excel' | 'print') => {
    if (type === 'excel') {
      try {
        const list = filteredPartners ?? [];
        const data = list.map((p) => ({
          'Partner': getFirmaAdi(p),
          'Yetkili Kişi': getYetkili(p),
          'İl': getIl(p),
          'İlçe': getIlce(p),
          'Telefon': getTelefon(p) ? formatPhoneNumber(getTelefon(p)) : '',
          'E-posta': getEmail(p) ?? '',
        }));
        downloadTableAsExcel(data, 'Partner-Firmalar');
        showToast('success', 'Excel dosyası indirildi.');
      } catch (e: unknown) {
        showToast('error', (e as Error)?.message ?? 'Excel dışa aktarılamadı.');
      }
    } else {
      await handlePotansiyelPrint();
    }
    setExportMenuOpen(false);
  };

  const printHint = (text: string) => `<span class="print-hint">${text}</span>`;
  const handlePotansiyelPrint = async () => {
    const list = filteredPartners ?? [];
    const unvan = (p: PotansiyelPartner) => getFirmaAdi(p) || `Partner #${p.id}`;
    const yetkiliStr = (p: PotansiyelPartner) =>
      getYetkili(p)?.trim() || printHint('(Yetkili kişi eklenmemiş)');
    const telStr = (p: PotansiyelPartner) =>
      getTelefon(p) ? formatPhoneNumber(getTelefon(p)) : printHint('(Telefon eklenmemiş)');
    const epostaStr = (p: PotansiyelPartner) =>
      getEmail(p)?.trim() || printHint('(E-posta eklenmemiş)');
    const ilStr = (p: PotansiyelPartner) => getIl(p) || '—';
    const ilceStr = (p: PotansiyelPartner) => getIlce(p) || '—';
    const logoPrintCell = (p: PotansiyelPartner) => {
      const logo = getLogo(p);
      if (logo) {
        const logoUrl = getUploadUrl(logo);
        return `<img src="${logoUrl}" alt="" class="print-partner-logo" />`;
      }
      return '—';
    };
    const rows = list
      .map(
        (p) => `
        <tr>
          <td class="print-td-logo">${logoPrintCell(p)}</td>
          <td><strong>${unvan(p)}</strong><br/>${yetkiliStr(p)}</td>
          <td>${ilStr(p)}</td>
          <td>${ilceStr(p)}</td>
          <td>${telStr(p)}<br/>${epostaStr(p)}</td>
        </tr>`
      )
      .join('');
    const title = 'Potansiyel Partnerler';
    const logoMarkup = await getPrintLogoMarkup();
    const tableHeaders = '<th>Logo</th><th>Partner & Yetkili</th><th>İl</th><th>İlçe</th><th>İletişim</th>';
    const html = buildPrintHtml(title, logoMarkup, '', tableHeaders, rows);
    openPrintWindow(html, `${title} – ${getPrintDateDDMMYYYY()}`, '');
  };

  const emptyCell = <span className="td-empty">—</span>;

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
          title="Potansiyel partnerler yüklenemedi"
          message={error instanceof Error ? error.message : 'Bilinmeyen hata'}
        />
      </div>
    );
  }

  return (
    <div className="page-wrapper page-wrapper--full flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden p-6">
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="page-title">
              Sistemdeki Potansiyel Partnerler
              {filteredPartners.length > 0 && (
                <span className="page-title-badge">{filteredPartners.length}</span>
              )}
            </h1>
            <p className="potansiyel-sorgu-bilgi">
              Sistemde kayıtlı, farklı şehirlerdeki çiçekçiler ile siparişleriniz için iletişime geçebilirsiniz.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
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
          </div>
        </div>

        {/* Filtreler + Search sağda */}
        <div className="potansiyel-baslik-alan">
          <div className="potansiyel-filtreler">
            <div className="potansiyel-filtre-item">
              <label htmlFor="potansiyel-il">İL:</label>
              <select
                id="potansiyel-il"
                value={ilFilter}
                onChange={(e) => {
                  setIlFilter(e.target.value);
                  setIlceFilter('');
                }}
              >
                <option value="">Tüm İller</option>
                {iller.map((il) => (
                  <option key={il} value={il}>
                    {il}
                  </option>
                ))}
              </select>
            </div>
            <div className="potansiyel-filtre-item">
              <label htmlFor="potansiyel-ilce">İLÇE:</label>
              <select
                id="potansiyel-ilce"
                value={ilceFilter}
                onChange={(e) => setIlceFilter(e.target.value)}
                disabled={!ilFilter}
              >
                <option value="">Tüm İlçeler</option>
                {ilceler.map((ilce) => (
                  <option key={ilce} value={ilce}>
                    {ilce}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" onClick={handleClearFilters} className="potansiyel-btn-filtre-reset">
              Filtreleri Temizle
            </button>
          </div>
          <div className="potansiyel-sag-alan potansiyel-search-wrapper">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Partner adı, yetkili kişi veya telefon ara..."
              className="page-search-input"
              aria-label="Potansiyel partner ara"
            />
          </div>
        </div>

        {/* İstatistik Kartları - Partner Firmalar sayıları (ikon solda) */}
        <div className="potansiyel-istatistik-grid">
          <div className="potansiyel-istatistik-kart">
            <div className="potansiyel-istatistik-row">
              <div className="potansiyel-istatistik-icon">
                <MapPinCheck size={24} />
              </div>
              <div>
                <div className="potansiyel-istatistik-sayi">{toplamPartner}</div>
                <div className="potansiyel-istatistik-label">
                  {hasFilter ? 'Filtrelenen Partner Firmalar' : 'Türkiye Geneli Partner Firmalar'}
                </div>
              </div>
            </div>
          </div>
          <div className="potansiyel-istatistik-kart">
            <div className="potansiyel-istatistik-row">
              <div className="potansiyel-istatistik-icon">
                <Handshake size={24} />
              </div>
              <div>
                <div className="potansiyel-istatistik-sayi">{sehirdekiPartner}</div>
                <div className="potansiyel-istatistik-label">
                  {ilFilter
                    ? `${ilFilter} şehrindeki Partner Firmalar`
                    : cicekciIl
                      ? `${cicekciIl} şehrindeki Partner Firmalar`
                      : "Türkiye'deki Partner Firmalar"}
                </div>
              </div>
            </div>
          </div>
          <div className="potansiyel-istatistik-kart">
            <div className="potansiyel-istatistik-row">
              <div className="potansiyel-istatistik-icon">
                <Flower size={24} />
              </div>
              <div>
                <div className="potansiyel-istatistik-sayi">{ilcedekiPartner}</div>
                <div className="potansiyel-istatistik-label">
                  {ilceFilter
                    ? `${ilceFilter} ilçesindeki Partner Firmalar`
                    : ilFilter
                      ? `${ilFilter} şehrindeki tüm ilçelerdeki Partner Firmalar`
                      : cicekciIlce
                        ? `${cicekciIlce} ilçesindeki Partner Firmalar`
                        : 'İlçedeki Partner Firmalar'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Partnerler Tablosu */}
        {!filteredPartners.length ? (
          <EmptyState
            title={partners?.length ? 'Arama sonucu bulunamadı' : 'Görüntülenecek partner bulunamadı'}
            description={partners?.length ? 'Farklı filtrelerle sorgulama yapabilirsiniz.' : 'Sistemde henüz potansiyel partner kaydı bulunmamaktadır.'}
          />
        ) : (
          <div className="potansiyel-table-wrapper flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="potansiyel-table-scroll table-scrollbar flex-1 min-h-0 overflow-auto">
              <table className="potansiyel-tablosu">
                <thead>
                  <tr>
                    <th className="potansiyel-td-logo">Logo</th>
                    <TableSortHeader field="partner" label="PARTNER" currentSort={sortField} sortDirection={sortDir} onSort={handleSort} />
                    <TableSortHeader field="yetkili" label="YETKİLİ KİŞİ" currentSort={sortField} sortDirection={sortDir} onSort={handleSort} />
                    <TableSortHeader field="il" label="İL" currentSort={sortField} sortDirection={sortDir} onSort={handleSort} />
                    <TableSortHeader field="ilce" label="İLÇE" currentSort={sortField} sortDirection={sortDir} onSort={handleSort} />
                    <TableSortHeader field="telefon" label="TELEFON" currentSort={sortField} sortDirection={sortDir} onSort={handleSort} />
                    <TableSortHeader field="email" label="E-POSTA" currentSort={sortField} sortDirection={sortDir} onSort={handleSort} />
                    <th className="potansiyel-th-islem">İŞLEMLER</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPartners.map((partner) => {
                    const firmaAdi = getFirmaAdi(partner);
                    const telefon = getTelefon(partner);
                    const email = getEmail(partner);
                    const logo = getLogo(partner);
                    const telefonFormatted = telefon ? formatPhoneNumber(telefon) : null;
                    const phoneDigits = telefon ? telefon.replace(/\D/g, '') : '';
                    const telHref = phoneDigits && phoneDigits.length >= 10
                      ? `tel:+90${phoneDigits.slice(-10)}`
                      : telefon ? `tel:${telefon}` : '';
                    return (
                      <tr key={partner.id} className="potansiyel-table-row" data-table-row>
                        <td className="potansiyel-td-logo" data-label="Logo">
                          {logo ? (
                            <img
                              src={getUploadUrl(logo)}
                              alt={firmaAdi}
                              className="potansiyel-table-logo"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <span className="td-empty">—</span>
                          )}
                        </td>
                        <td data-label="Partner">
                          <span className="potansiyel-firma-adi">{firmaAdi || emptyCell}</span>
                        </td>
                        <td data-label="Yetkili Kişi">{getYetkili(partner) || emptyCell}</td>
                        <td data-label="İl">{getIl(partner) || emptyCell}</td>
                        <td data-label="İlçe">{getIlce(partner) || emptyCell}</td>
                        <td data-label="Telefon">
                          {telefon ? (
                            <a href={telHref} className="potansiyel-link">
                              {telefonFormatted || telefon}
                            </a>
                          ) : (
                            emptyCell
                          )}
                        </td>
                        <td data-label="E-posta">
                          {email ? (
                            <a href={`mailto:${email}`} className="potansiyel-link">
                              {email}
                            </a>
                          ) : (
                            emptyCell
                          )}
                        </td>
                        <td className="potansiyel-td-islem" data-label="İşlemler">
                          <div className="flex items-center justify-center">
                            <div className="islem-ikonlar">
                              {telefon && (
                                <a
                                  href={telHref}
                                  className="islem-ikon telefon-ikon"
                                  title="Telefon Et"
                                  data-tooltip="Telefon Et"
                                  aria-label="Telefon Et"
                                >
                                  <Phone size={16} aria-hidden />
                                </a>
                              )}
                              {email && (
                                <a
                                  href={`mailto:${email}`}
                                  className="islem-ikon eposta-ikon"
                                  title="E-posta Gönder"
                                  data-tooltip="E-posta Gönder"
                                  aria-label="E-posta Gönder"
                                >
                                  <Mail size={16} aria-hidden />
                                </a>
                              )}
                              {!telefon && !email && emptyCell}
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
  );
};

export default PotansiyelPartnerlerPage;
