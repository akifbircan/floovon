import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import type { WeekDate } from '../hooks/useWeekDates';
import { getPrevWeekString, getNextWeekString, getCurrentWeekString } from '../../../shared/utils/dateUtils';

interface DashboardHeaderProps {
  dateRangeText?: string;
  selectedWeek?: string;
  weekDates?: WeekDate[];
  onWeekChange?: (week: string) => void;
  /** Mobil: arama kutusu değeri (search + butonlar aynı kapsayıcıda mobile-baslik-alan üstünde) */
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onSearch?: (query: string) => void;
  onSicakSatis?: () => void;
  onSort?: (sortType: string) => void;
  onExport?: (exportType: 'excel' | 'pdf' | 'print') => void;
  onCicekSepeti?: () => void;
  onYeniKart?: () => void;
  onYeniMusteri?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onAracTakipClick?: () => void;
}

/**
 * Dashboard header - Eski HTML yapısına göre güncellendi
 * Alt header bar: Tarih aralığı + butonlar (Sıcak Satış, Kartları Sırala, Dışa Aktar)
 */
const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  dateRangeText,
  selectedWeek,
  weekDates = [],
  onWeekChange,
  searchQuery = '',
  onSearchChange,
  onSicakSatis,
  onSort,
  onExport,
  onCicekSepeti,
  onYeniKart,
  onYeniMusteri,
}) => {
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Sort dropdown dışına tıklandıysa kapat
      if (sortMenuOpen && sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setSortMenuOpen(false);
      }
      
      // Export dropdown dışına tıklandıysa kapat
      if (exportMenuOpen && exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };

    if (sortMenuOpen || exportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sortMenuOpen, exportMenuOpen]);

  const handleSort = (sortType: string) => {
    onSort?.(sortType);
    setSortMenuOpen(false);
  };

  const handleExport = (exportType: 'excel' | 'pdf' | 'print') => {
    onExport?.(exportType);
    setExportMenuOpen(false);
  };

  return (
    <div className="dashboard-header-mobile">
      {/* Masaüstü Başlık Alanı - Tarih + Butonlar */}
      <div className="baslik-alan">
        <div className="baslik-tarih-ve-aciklama">
          {dateRangeText && (
            <>
              <div className="baslik-tarih">{dateRangeText}</div>
              <div className="baslik-tarih-aciklama">tarihleri arasındaki siparişleriniz:</div>
            </>
          )}
        </div>

        <div className="butonlar">
          {/* Sıcak Satış Butonu */}
          {onSicakSatis && (
            <button
              className="btn-sicak-satis-button"
              id="btnSicakSatis"
              data-tooltip="Sıcak Satış Ekle"
              data-tooltip-pos="bottom"
              onClick={onSicakSatis}
              aria-label="Sıcak Satış Ekle"
            >
              <i className="fas fa-fire"></i>
              <span className="btn-text">Sıcak Satış</span>
            </button>
          )}

          {/* Kartları Sırala Dropdown */}
          {onSort && (
            <div 
              ref={sortDropdownRef}
              className={`clickdropdown ${sortMenuOpen ? 'dropdown-open' : ''}`} 
              id="sortBy" 
              style={{ position: 'relative', zIndex: 9999 }}
            >
              <div
                className="buton-sirala clickdropbtn"
                onClick={() => setSortMenuOpen(!sortMenuOpen)}
                title="Kartları Sırala"
                data-tooltip="Kartları Sırala"
                data-tooltip-pos="bottom"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSortMenuOpen(!sortMenuOpen); } }}
              >
                <i className="fas fa-sort-amount-down"></i>
                <span className="btn-text">Kartları Sırala</span>
                {sortMenuOpen && (
                  <div className="siparis-sirala clickdropdown-content" style={{ display: 'block' }}>
                    <div className="liste-baslik">Sipariş Kartlarını Sırala</div>
                    <span id="sirala-alfabetik" onClick={() => handleSort('organizasyon-turu')}>
                      Organizasyon Türü
                    </span>
                    <span id="sirala-saat" onClick={() => handleSort('teslim-saati')}>
                      Teslim Saati
                    </span>
                    <span id="sirala-tarih" onClick={() => handleSort('teslim-tarihi')}>
                      Teslim Tarihi
                    </span>
                    <span id="sirala-sayi" onClick={() => handleSort('siparis-sayisi')}>
                      Sipariş Sayısı
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dışa Aktar Dropdown */}
          {onExport && (
            <div 
              ref={exportDropdownRef}
              className="buton-disa-aktar clickdropdown" 
              style={{ position: 'relative', zIndex: 9999 }}
            >
              <div className="btn-baslik">
                <i className="icon-dashboard-disa-aktar"></i>
                Dışa Aktar
              </div>
              <div
                className="dosya-tur clickdropbtn"
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
              >
                .xls
                <i className="fa-solid fa-chevron-down"></i>
                {exportMenuOpen && (
                  <div className="dosya-tur-content clickdropdown-content" style={{ display: 'block' }}>
                    <div className="liste-baslik">Siparişleri Dışa Aktar</div>
                    <button className="btn-disa-aktar" id="excel-aktar" onClick={() => handleExport('excel')}>
                      <i className="icon-disa-aktar-excel"></i>
                      Excel'e Aktar
                    </button>
                    <button className="btn-yazdir" id="yazdir" onClick={() => handleExport('print')}>
                      <i className="icon-disa-aktar-yazdir"></i>
                      Yazdır
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Çiçek Sepeti Entegrasyonu */}
          {onCicekSepeti && (
            <button
              onClick={onCicekSepeti}
              className="ciceksepeti-integration-btn"
              data-tooltip="Çiçek Sepeti vb. entegratör siparişlerini kontrol edin"
              data-tooltip-pos="bottom"
            >
              <i className="fa-solid fa-arrows-rotate"></i>
            </button>
          )}

          {/* Yeni Kart Oluştur Butonu */}
          {onYeniKart && (
            <div className="top-tooltip" data-tooltip="Yeni Kart Oluştur" data-tooltip-pos="bottom">
              <button
                className="btn-yeni-kart-ekle"
                data-value="Yeni Kart Oluştur"
                type="button"
                onClick={onYeniKart}
              >
                <i className="icon-btn-yeni-kart"></i>
              </button>
            </div>
          )}

          {/* Yeni Müşteri Ekle Butonu */}
          {onYeniMusteri && (
            <div className="top-tooltip" data-tooltip="Müşteri Ekle" data-tooltip-pos="bottom">
              <button
                className="btn-yeni-musteri-ekle"
                data-value="Müşteri Ekle"
                type="button"
                onClick={onYeniMusteri}
              >
                <i className="icon-sm-i-musteriler"></i>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobil: aynı kapsayıcıda searchbox + olustur-butonlar (üstte) ve mobile-baslik-alan (altta), taşma yok */}
      {weekDates.length >= 7 && selectedWeek && onWeekChange && (
        <div className="mobile-search-ve-baslik-wrapper">
          <div className="mobile-search-ve-butonlar">
            <div className="web-search">
              <div className="search-box-title">
                <i className="icon-search"></i>
                <input
                  className="web-search-input"
                  type="search"
                  placeholder="Siparişlerde arayın..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="search-input-clear"
                    onClick={() => onSearchChange?.('')}
                    aria-label="Temizle"
                  >
                    <i className="icon-btn-kapat" aria-hidden />
                  </button>
                )}
              </div>
            </div>
            <div className="olustur-butonlar">
              {onYeniKart && (
                <div className="top-tooltip" data-tooltip="Yeni Kart" data-tooltip-pos="bottom">
                  <button className="btn-yeni-kart-ekle" type="button" onClick={onYeniKart}>
                    <i className="icon-btn-yeni-kart"></i>
                  </button>
                </div>
              )}
              {onYeniMusteri && (
                <div className="top-tooltip" data-tooltip="Müşteri Ekle" data-tooltip-pos="bottom">
                  <button className="btn-yeni-musteri-ekle" type="button" onClick={onYeniMusteri}>
                    <i className="icon-sm-i-musteriler"></i>
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="mobile-baslik-alan">
            <div className="mobile-baslik-metin">
              <button
                type="button"
                className="mobile-baslik-metin-ikon"
                onClick={() => onWeekChange?.(getCurrentWeekString())}
                aria-label="Bu haftaya git"
                title="Bu haftaya git"
              >
                <Calendar size={20} strokeWidth={2} />
              </button>
              <div
                className="mobile-baslik-metin-tarihler"
                role="button"
                tabIndex={0}
                onClick={() => window.dispatchEvent(new CustomEvent('floovon-open-week-picker'))}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.dispatchEvent(new CustomEvent('floovon-open-week-picker')); } }}
                aria-label="Hafta seç"
                title="Hafta seçmek için tıklayın"
              >
                <div className="mobile-baslik-ay">
                  {MONTH_NAMES[weekDates[0].date.getMonth()]} {weekDates[0].date.getFullYear()}
                </div>
                <div className="mobile-baslik-hafta-ilk">{weekDates[0].displayDate}</div>
                <div className="mobile-baslik-hafta-son">{weekDates[6].displayDate}</div>
              </div>
            </div>
            <div className="mobile-baslik-nav">
              <button
                type="button"
                className="mobile-baslik-nav-btn"
                onClick={() => onWeekChange(getPrevWeekString(selectedWeek))}
                aria-label="Önceki hafta"
              >
                <ChevronLeft size={22} strokeWidth={2} />
              </button>
              <button
                type="button"
                className="mobile-baslik-nav-btn"
                onClick={() => onWeekChange(getNextWeekString(selectedWeek))}
                aria-label="Sonraki hafta"
              >
                <ChevronRight size={22} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

