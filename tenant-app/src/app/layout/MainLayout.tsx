import React, { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Header } from './Header';
import { Navbar } from './Navbar';
import { MobileNavbar } from './MobileNavbar';
import { PhoneLandscapeWarning } from './PhoneLandscapeWarning';

interface MainLayoutProps {
  children: ReactNode;
}

/** Raporlar sayfasından çıkınca body'de kalan ApexCharts tooltip/overlay'ı kaldır (diğer sayfalarda chart flash'ı önler) */
function removeApexChartsLeftovers() {
  const main = document.querySelector('[data-main-content]');
  document.querySelectorAll('body > .apexcharts-tooltip, body > [id*="apexcharts"], body > div[class*="apexcharts"]').forEach((el) => {
    if (el && main && !main.contains(el)) el.remove();
  });
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  useEffect(() => {
    if (!location.pathname.startsWith('/raporlar')) removeApexChartsLeftovers();
  }, [location.pathname]);

  // Tooltip sistemini başlat
  useEffect(() => {
    // Script yüklenene kadar bekle
    const initTooltip = () => {
      if (typeof (window as any).initUnifiedTooltipSystem === 'function') {
        (window as any).initUnifiedTooltipSystem();
      } else {
        // Script henüz yüklenmemişse, biraz bekle ve tekrar dene
        setTimeout(initTooltip, 100);
      }
    };
    
    // İlk kontrol
    initTooltip();
  }, []);

  // Ürün yazısı / yazi-not alanlarına tıklanınca panoya kopyala (mevcut showCopyAlert + createToast)
  useEffect(() => {
    const handleCopyClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('.urun-yazisi, .yazi-not.copy-text');
      if (!target) return;
      const text = (target as HTMLElement).textContent?.trim();
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        if (typeof (window as any).showCopyAlert === 'function') {
          (window as any).showCopyAlert('Ürün yazısı panoya kopyalandı!', text);
        } else if (typeof (window as any).createToast === 'function') {
          (window as any).createToast('success', 'Panoya kopyalandı');
        }
      }).catch(() => {
        if (typeof (window as any).createToast === 'function') {
          (window as any).createToast('error', 'Kopyalanamadı');
        }
      });
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener('click', handleCopyClick, true);
    return () => document.removeEventListener('click', handleCopyClick, true);
  }, []);

  // ✅ KRİTİK: Dark mode'da sayfa geçişlerinde background rengini ayarla
  // Not: Inline style kullanmıyoruz, CSS variable kullanıyoruz
  useEffect(() => {
    // CSS variable'lar zaten globals.css'te tanımlı, ekstra bir şey yapmaya gerek yok
    // Sadece dark mode class'ının doğru uygulandığından emin olalım
  }, [children]);

  // Çiçek Sepeti: ciceksepeti.js tek sefer yükle, container yukarıda – ayarlar veya dashboard’da toast görünsün
  useEffect(() => {
    const win = window as any;
    if (win.ciceksepetiIntegration) return;
    if (typeof win.CiceksepetiFloovonIntegration === 'function') {
      win.ciceksepetiIntegration = new win.CiceksepetiFloovonIntegration();
    }
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('ciceksepetiRouteChange', { detail: { pathname: location.pathname } }));
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex overflow-hidden">
      {/* Sidebar - Sol tarafta, sayfanın başından sonuna kadar */}
      <Navbar />
      
      {/* Sağ taraf - Header ve Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Sidebar'ın yanında, tam genişlikte */}
        <Header />
        
        {/* Main Content - Header'ın altında */}
        <main className="flex-1 overflow-auto pb-16 md:pb-0" data-main-content>
          {children}
        </main>
      </div>
      
      {/* Mobile Navbar - Sadece mobilde görünür */}
      <MobileNavbar />

      {/* Telefon yatay: "Lütfen dikey kullanın" uyarısı (portal ile body'de) */}
      <PhoneLandscapeWarning />
      
      {/* Toast container: ciceksepeti.js index.html'de yüklenince ensureToastContainer() ile body'de oluşturulur; aşağıdaki modal React'ta kalır */}
      {/* Çiçek Sepeti sipariş detay modal – toast'taki siparişe tıklanınca açılır; SİPARİŞİ ONAYLA ile organizasyon kartı oluşur (ciceksepeti.js) */}
      <div id="ciceksepetiModal" className="ciceksepeti-modal-overlay" style={{ display: 'none' }}>
        <div className="ciceksepeti-modal">
          <div className="ciceksepeti-modal-header">
            <div className="ciceksepeti-modal-header-content">
              <div className="ciceksepeti-modal-header-title">
                <img src="/assets/cicek-sepeti/cicek-sepeti.svg" alt="Çiçeksepeti" className="ciceksepeti-modal-logo" />
                <span className="ciceksepeti-modal-title">Sipariş Detayları</span>
              </div>
              <button type="button" id="ciceksepetiModalKapat" className="ciceksepeti-modal-close" aria-label="Kapat">
                <i className="icon-btn-kapat" />
              </button>
            </div>
            <div className="ciceksepeti-modal-header-right">
              <a href="#" className="ciceksepeti-panel-link">Siparişi çiçeksepeti panelinde görüntüle <i className="fas fa-external-link-alt" /></a>
            </div>
          </div>
          <div className="ciceksepeti-modal-content">
            <div className="ciceksepeti-modal-main">
              <div className="ciceksepeti-modal-left">
                <div className="ciceksepeti-siparis-no">
                  <span>Sipariş No:</span>
                  <strong id="modal-siparis-no">-</strong>
                </div>
                <div className="ciceksepeti-teslim-zaman">
                  <div className="teslim-zaman-badge">
                    <i className="icon-teslim-tarihi-ve-saati" />
                    <div className="teslim-zaman-info">
                      <span>Teslim Zamanı:</span>
                      <span className="teslim-tarih" id="modal-teslim-tarih">-</span>
                    </div>
                  </div>
                </div>
                <div className="ciceksepeti-urun-section">
                  <div className="urun-image">
                    <img id="modal-urun-image" src="/assets/cicek-sepeti/sp-urun-ciceksepeti.png" alt="Ürün" />
                  </div>
                  <div className="urun-info">
                    <div className="urun-name" id="modal-urun-name">-</div>
                    <div className="urun-price">
                      <span>Sipariş Tutarı:</span>
                      <strong id="modal-urun-price">-</strong>
                    </div>
                  </div>
                </div>
              </div>
              <div className="ciceksepeti-modal-right">
                <div className="ciceksepeti-info-sections">
                  <div className="ciceksepeti-info-section">
                    <h4>Sipariş Veren Bilgileri</h4>
                    <div className="info-row">
                      <span className="info-label">Sipariş Veren</span>
                      <span className="info-value" id="modal-siparis-veren">-</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Sipariş Veren Telefonu</span>
                      <span className="info-value" id="modal-siparis-veren-tel">-</span>
                    </div>
                  </div>
                  <div className="ciceksepeti-info-section teslimat-wrapper">
                    <h4>Teslimat Bilgileri</h4>
                    <div className="info-row">
                      <span className="info-label">İl</span>
                      <span className="info-value" id="modal-teslim-il">-</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">İlçe</span>
                      <span className="info-value" id="modal-teslim-ilce">-</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Mahalle/Semt</span>
                      <span className="info-value" id="modal-teslim-mahalle">-</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Teslim Kişisi</span>
                      <span className="info-value" id="modal-teslim-kisi">-</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Teslim Kişisi Telefonu</span>
                      <span className="info-value" id="modal-teslim-kisi-tel">-</span>
                    </div>
                    <div className="info-row full-width">
                      <span className="info-label">Teslim Adresi</span>
                      <span className="info-value" id="modal-teslim-adres">-</span>
                    </div>
                  </div>
                  <div className="ciceksepeti-info-section">
                    <h4>Sipariş Notu</h4>
                    <div className="info-row">
                      <span className="info-value siparis-notu" id="modal-siparis-notu">-</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="ciceksepeti-modal-footer">
            <div className="ciceksepeti-modal-warning">
              <i className="fas fa-exclamation-triangle" />
              <span>Lütfen çiçeksepeti panelinden <strong>bu sipariş ürün ile ilgili stok durumunuzu kontrol ettikten sonra</strong> onaylayın veya reddedin</span>
            </div>
            <div className="ciceksepeti-modal-actions">
              <button type="button" id="ciceksepetiReddet" className="ciceksepeti-btn-reject">REDDET</button>
              <button type="button" id="ciceksepetiOnayla" className="ciceksepeti-btn-approve">SİPARİŞİ ONAYLA</button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast notifications: body'ye portal ile render edilir; sunucuda da overlay en üstte görünsün diye wrapper'a inline z-index */}
      {createPortal(
        <div className="app-toast-portal-wrapper" style={{ position: 'fixed', inset: 0, zIndex: 2147483647, pointerEvents: 'none' }}>
          <Toaster
            position="top-center"
            containerClassName="app-toast-container"
            toastOptions={{
            duration: 3000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#4ade80',
                secondary: '#fff',
              },
            },
            error: {
              duration: 4000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
          />
        </div>,
        document.body
      )}
    </div>
  );
};

