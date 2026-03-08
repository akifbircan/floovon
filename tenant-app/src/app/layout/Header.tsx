import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { usePlan } from '../providers/PlanProvider';
import { usePagePermissions } from '../providers/PagePermissionsProvider';
import { getApiBaseUrl } from '../../lib/runtime';
import { useNotifications } from '../../features/dashboard/hooks/useNotifications';
import { useWhatsAppStatus } from '../../features/dashboard/hooks/useWhatsAppStatus';
import { useAracTakipDurum } from '../../features/dashboard/hooks/useAracTakipDurum';
import { WhatsAppQRModal } from '../../features/dashboard/components/WhatsAppQRModal';
import { WhatsAppConnectionInfoModal } from '../../features/dashboard/components/WhatsAppConnectionInfoModal';
import { TeknikDestekModal } from '../../features/dashboard/components/TeknikDestekModal';
import { formatPhoneNumber } from '../../shared/utils/formatUtils';
import { getUploadUrl } from '../../shared/utils/urlUtils';
import { dispatchThemeChanged, useTheme } from '../../shared/hooks/useTheme';
import { showToast } from '../../shared/utils/toastUtils';
import { completeAracTakip } from '../../features/dashboard/api/aracTakip';
import type { AracTakipDurumResponse } from '../../features/dashboard/api/aracTakip';
import { AracTakipModal } from '../../features/dashboard/components/AracTakipModal';
import { Truck, Clock, Timer } from 'lucide-react';

/** Başlangıç zamanını okunaklı formata çevir */
function formatBaslangicZamani(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const gün = d.getDate().toString().padStart(2, '0');
    const ay = (d.getMonth() + 1).toString().padStart(2, '0');
    const yıl = d.getFullYear();
    const sa = d.getHours().toString().padStart(2, '0');
    const dk = d.getMinutes().toString().padStart(2, '0');
    return `${gün}.${ay}.${yıl} ${sa}:${dk}`;
  } catch {
    return iso;
  }
}

/** Başlangıç zamanından bu yana geçen süreyi (saat/dakika/saniye) metin olarak */
function gecenSureMetin(baslangicIso?: string): string {
  if (!baslangicIso) return '—';
  try {
    const bas = new Date(baslangicIso).getTime();
    if (Number.isNaN(bas)) return '—';
    const diffMs = Date.now() - bas;
    if (diffMs < 0) return '—';
    const totalSeconds = Math.floor(diffMs / 1000);
    const saat = Math.floor(totalSeconds / 3600);
    const dakika = Math.floor((totalSeconds % 3600) / 60);
    const saniye = totalSeconds % 60;

    const parts: string[] = [];
    if (saat > 0) parts.push(`${saat} sa`);
    parts.push(`${dakika} dk`);
    parts.push(`${saniye} sn`);

    return parts.join(' ');
  } catch {
    return '—';
  }
}

interface AracTakipInfoPopupProps {
  durum: AracTakipDurumResponse | null;
  loading: boolean;
  onSonlandir: () => Promise<void>;
  onKapat: () => void;
}

function AracTakipInfoPopup({ durum, loading, onSonlandir, onKapat }: AracTakipInfoPopupProps) {
  const [gecenSure, setGecenSure] = useState(() => gecenSureMetin(durum?.baslangic_zamani));

  useEffect(() => {
    if (!durum?.baslangic_zamani) return;
    const t = setInterval(() => setGecenSure(gecenSureMetin(durum.baslangic_zamani)), 1000);
    return () => clearInterval(t);
  }, [durum?.baslangic_zamani]);

  const aracSatiri1 = durum?.plaka || '';
  const aracSatiri2 = (() => {
    const parcalar = [durum?.marka, durum?.model].filter(Boolean);
    return parcalar.join(' ');
  })();

  return (
    <div
      className="modal-react-arac-takip-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--toast-overlay-bg)' }}
      onClick={onKapat}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="arac-takip-info-popup"
        style={{ background: 'var(--white)', borderRadius: 16, padding: '1.5rem', maxWidth: '360px', width: '90%', boxShadow: '0 10px 30px rgba(15,23,42,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            marginBottom: '1rem',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              background: 'var(--arac-takip-aktif-zemin)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Truck size={22} strokeWidth={2.2} color="var(--yesil-color-1)" />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>Teslimattasınız</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {aracSatiri1 && <div>{aracSatiri1}</div>}
              {aracSatiri2 && <div>{aracSatiri2}</div>}
            </div>
          </div>
        </div>

        <div
          className="teslimat-aktif-bilgileri"
          style={{
            marginBottom: '1.25rem',
            padding: '0.75rem 0.9rem',
            borderRadius: 12,
            background: 'var(--arac-takip-aktif-zemin)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.5rem',
            fontSize: '0.85rem',
            color: 'var(--arac-takip-aktif-metin)',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Clock className="teslimat-aktif-ikon" size={20} strokeWidth={2.1} />
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8 }}>
                Başlangıç
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontWeight: 500,
                  border: '1px solid var(--arac-takip-aktif-metin)',
                  padding: 6,
                  borderRadius: 5,
                }}
              >
                {formatBaslangicZamani(durum?.baslangic_zamani)}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Timer className="teslimat-aktif-ikon" size={20} strokeWidth={2.1} />
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8 }}>
                Geçen süre
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontWeight: 500,
                  border: '1px solid var(--arac-takip-aktif-metin)',
                  padding: 6,
                  borderRadius: 5,
                }}
              >
                {gecenSure}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn-teslimata-sonlandir"
            onClick={onSonlandir}
            disabled={loading}
          >
            {loading ? 'Sonlandırılıyor…' : 'Teslimatı sonlandır'}
          </button>
          <button
            type="button"
            className="btn-teslimata-kapat"
            onClick={onKapat}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { isBaslangicPlan } = usePlan();
  const { hasAccess } = usePagePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const isDarkTheme = useTheme();

  // Sayfa değiştiğinde profil dropdown'ı kapat (overlay'ın tıklamaları engellemesini önle)
  useEffect(() => {
    setProfileDropdownOpen(false);
  }, [location.pathname]);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const mobileAvatarWrapperRef = useRef<HTMLDivElement>(null);
  /** Profil resmi URL cache: her render'da Date.now() kullanımı sekmeye neden oluyordu; sadece path değişince güncellenir */
  const profileImageCacheRef = useRef<{ path: string; ts: number }>({ path: '', ts: 0 });
  const getProfileImageSrc = (path: string): string => {
    if (!path || path.startsWith('http') || path.startsWith('data:')) return path;
    if (path !== profileImageCacheRef.current.path) {
      profileImageCacheRef.current = { path, ts: Date.now() };
    }
    const base = getUploadUrl(path);
    return `${base}${base.includes('?') ? '&' : '?'}t=${profileImageCacheRef.current.ts}`;
  };
  const [notificationsDropdownOpen, setNotificationsDropdownOpen] = useState(false);
  const { notifications, loading, unreadCount, loadNotifications, markAsRead, markAllAsRead } = useNotifications();
  
  // WhatsApp durum kontrolü
  const { status: whatsAppStatus, isConnected: whatsAppConnected, isReconnecting: whatsAppReconnecting, checkStatus: checkWhatsAppConnection } = useWhatsAppStatus();
  const [showWhatsAppQRModal, setShowWhatsAppQRModal] = useState(false);
  const [showWhatsAppConnectionInfoModal, setShowWhatsAppConnectionInfoModal] = useState(false);
  
  // Teknik destek modal
  const [showTeknikDestekModal, setShowTeknikDestekModal] = useState(false);

  // Sayfa açılır açılmaz WhatsApp durumunu kontrol et (sadece premium planda; Başlangıç’ta WhatsApp yok)
  useEffect(() => {
    if (isBaslangicPlan === false) checkWhatsAppConnection();
  }, [checkWhatsAppConnection, isBaslangicPlan]);

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

  // Bildirimleri yükle (dropdown açıldığında)
  useEffect(() => {
    if (notificationsDropdownOpen) {
      loadNotifications();
    }
  }, [notificationsDropdownOpen, loadNotifications]);

  // ✅ DÜZELTME: React component'te zaten open class'ı ekleniyor, useLayoutEffect gereksiz

  // ✅ DÜZELTME: Dropdown dışına tıklandığında kapat
  useEffect(() => {
    if (!notificationsDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const dropdownContent = document.getElementById('bildirimlerDropdown');
      const icon = document.querySelector('.ikon-bildirimler .header-icon');
      
      // Eğer tıklama dropdown içindeyse veya icon'a tıklandıysa, hiçbir şey yapma
      if (dropdownContent?.contains(target) || icon?.contains(target)) {
        return;
      }
      
      // Dropdown dışına tıklandıysa kapat
      setNotificationsDropdownOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notificationsDropdownOpen]);


  // ✅ KRİTİK: Sayfa yüklendiğinde localStorage'dan temayı oku ve uygula
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
      document.documentElement.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
      document.documentElement.classList.remove('dark-mode');
    }
    dispatchThemeChanged();
    // Icon'u güncelle
    const isDark = savedTheme === 'dark';
    document.querySelectorAll('.btn-theme-mode').forEach((btn: any) => {
      const btnIcon = btn.querySelector('i');
      if (btnIcon) {
        btnIcon.className = '';
        btnIcon.classList.add(isDark ? 'fa-regular' : 'fa-solid');
        btnIcon.classList.add(isDark ? 'fa-sun' : 'fa-moon');
      }
    });
  }, []);

  // Dashboard sayfasında mıyız?
  const isDashboardPage = location.pathname === '/' || location.pathname === '/dashboard';

  // Mobil görünüm (index mobil header band + toggle için)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  );
  const [headerBandCollapsed, setHeaderBandCollapsed] = useState(false);

  // Araç takip durumu (mobil + premium: teslimatta ise yeşil ikon, tıklanınca bilgi popup) – tüm sayfalarda
  const { durum: aracTakipDurum, isOnDelivery: aracTakipTeslimatta, refetch: refetchAracTakipDurum } = useAracTakipDurum(
    isMobile && isBaslangicPlan === false
  );
  const [showAracTakipInfo, setShowAracTakipInfo] = useState(false);
  const [aracTakipSonlandirLoading, setAracTakipSonlandirLoading] = useState(false);
  const [aracTakipModalOpen, setAracTakipModalOpen] = useState(false);
  useEffect(() => {
    const onGuncelle = () => refetchAracTakipDurum();
    window.addEventListener('aracTakipDurumGuncellendi', onGuncelle);
    return () => window.removeEventListener('aracTakipDurumGuncellendi', onGuncelle);
  }, [refetchAracTakipDurum]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = () => setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // body.header-hidden senkronizasyonu (mobil index band gizle/göster)
  useEffect(() => {
    if (!isDashboardPage || !isMobile) {
      document.body.classList.remove('header-hidden');
      return;
    }
    if (headerBandCollapsed) {
      document.body.classList.add('header-hidden');
    } else {
      document.body.classList.remove('header-hidden');
    }
    window.dispatchEvent(new CustomEvent('headerBandState', { detail: { collapsed: headerBandCollapsed } }));
    return () => {
      document.body.classList.remove('header-hidden');
    };
  }, [headerBandCollapsed, isDashboardPage, isMobile]);

  useEffect(() => {
    const handler = () => setHeaderBandCollapsed((prev) => !prev);
    window.addEventListener('toggleHeaderBand', handler);
    return () => window.removeEventListener('toggleHeaderBand', handler);
  }, []);

  // Araç takip modalı – tüm sayfalardan header butonu ile açılabilir
  useEffect(() => {
    const handler = () => setAracTakipModalOpen(true);
    window.addEventListener('openAracTakipModal', handler);
    return () => window.removeEventListener('openAracTakipModal', handler);
  }, []);

  // Sayfa başlığını belirle (header metni + sekme title için)
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return 'Siparişler';
    if (path.includes('/musteriler-cari')) return 'Müşteri Cari Hesabı';
    if (path.includes('/musteriler')) return 'Müşteriler';
    if (path.includes('/partner-firmalar-cari')) return 'Partner Cari Hesabı';
    if (path.includes('/partner-firmalar')) return 'Partner Firmalar';
    if (path.includes('/partnerler-potansiyel')) return 'Potansiyel Partnerler';
    if (path.includes('/kampanya')) return 'Kampanyalar';
    if (path.includes('/raporlar')) return 'Raporlar';
    if (path.includes('/ayarlar')) return 'Ayarlar';
    if (path.includes('/profil-ayarlari')) return 'Profil Ayarları';
    if (path.includes('/profil')) return 'Profil';
    if (path.includes('/siparis-kart-detay')) return 'Sipariş Detay';
    if (path.includes('/arsiv-siparisler')) return 'Arşiv Siparişler';
    return 'Floovon';
  };

  // Sekme başlığı: "Sayfa Adı | Floovon™"
  useEffect(() => {
    const pageTitle = getPageTitle();
    document.title = pageTitle === 'Floovon' ? 'Floovon™' : `${pageTitle} | Floovon™`;
  }, [location.pathname]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    // ✅ REACT: Arama query'sini window'a yaz (DashboardPage'den okunacak)
    (window as any).__REACT_SEARCH_QUERY__ = query;
    // Custom event dispatch et (DashboardPage dinleyecek)
    window.dispatchEvent(new CustomEvent('searchQueryChanged', { detail: { query } }));
  };

  const handleYeniKart = () => {
    // ✅ REACT: DashboardPage'deki modal state'ini açmak için custom event dispatch et
    window.dispatchEvent(new CustomEvent('openYeniKartModal'));
  };

  const handleYeniMusteri = () => {
    // ✅ REACT: DashboardPage'deki modal state'ini açmak için custom event dispatch et
    window.dispatchEvent(new CustomEvent('openYeniMusteriModal'));
  };

  // Bildirimleri render et - titreme sorununu önlemek için useMemo kullan
  const renderNotifications = React.useMemo(() => {
    if (loading) {
      return <div className="bildirim-yukleniyor">Bildirimler yükleniyor...</div>;
    }

    if (notifications.length === 0) {
      return <div className="bildirim-bos-mesaj">Henüz bildirim yok</div>;
    }

    const kullaniciAdi = (user as any)?.kullaniciadi || (user as any)?.username || 'Kullanıcı';
    const profilResmi = (user as any)?.profil_resmi || (user as any)?.profile_image || '';
    const profilResmiUrl = profilResmi ? getProfileImageSrc(profilResmi) : '';

    return (
      <>
        {notifications.map((bildirim, index) => {
          // Tarih parse işlemi
          let tarih: Date;
          if (bildirim.created_at) {
            const tarihStr = String(bildirim.created_at).trim();
            if (tarihStr.includes('T') && (tarihStr.endsWith('Z') || tarihStr.match(/[+-]\d{2}:\d{2}$/))) {
              tarih = new Date(tarihStr);
            } else if (tarihStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) {
              const [datePart, timePart] = tarihStr.split(' ');
              if (datePart && timePart) {
                const [year, month, day] = datePart.split('-').map(Number);
                const [hour, minute, second] = timePart.split(':').map(Number);
                tarih = new Date(Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0));
              } else {
                tarih = new Date();
              }
            } else {
              tarih = new Date(tarihStr);
            }
          } else {
            tarih = new Date();
          }

          if (isNaN(tarih.getTime())) {
            tarih = new Date();
          }

          const tarihStr = tarih.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
          const saatStr = tarih.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

          const durumClass =
            bildirim.tip === 'teslim-edildi'
              ? 'bildirim-durum-ok'
              : bildirim.tip === 'arsivlendi'
              ? 'bildirim-durum-arsiv'
              : 'bildirim-durum-ok';

          const organizasyonAltTur = (bildirim.organizasyon_alt_tur || '').toLowerCase();
          const isAracSusleme =
            organizasyonAltTur.includes('araç') ||
            organizasyonAltTur.includes('arac') ||
            organizasyonAltTur.includes('süsleme') ||
            organizasyonAltTur.includes('susleme') ||
            organizasyonAltTur.includes('gelin arabası') ||
            organizasyonAltTur.includes('gelin arabasi') ||
            organizasyonAltTur.includes('gelin-arabasi');

          const musteriUnvani = bildirim.musteri_unvani || '';
          // teslim_kisisi_baskasi SADECE WhatsApp mesajlarında kullanılır; bildirimde/ekranda sadece teslim_kisisi gösterilir
          const teslimKisisi = bildirim.teslim_kisisi || '';

          let musteriMetni = '';
          if (isAracSusleme) {
            if (musteriUnvani && teslimKisisi && musteriUnvani.trim() === teslimKisisi.trim()) {
              musteriMetni = musteriUnvani;
            } else {
              musteriMetni = musteriUnvani || '';
            }
          } else {
            if (musteriUnvani && teslimKisisi && musteriUnvani.trim() !== teslimKisisi.trim()) {
              musteriMetni = `${musteriUnvani} > ${teslimKisisi}`;
            } else if (musteriUnvani) {
              musteriMetni = musteriUnvani;
            } else if (teslimKisisi) {
              musteriMetni = teslimKisisi;
            }
          }

          let organizasyonMetni = bildirim.organizasyon_adi || '';
          if (bildirim.organizasyon_alt_tur && bildirim.organizasyon_alt_tur.trim() !== '') {
            organizasyonMetni = organizasyonMetni
              ? `${organizasyonMetni} (${bildirim.organizasyon_alt_tur})`
              : bildirim.organizasyon_alt_tur;
          }

          let urunResmi = bildirim.urun_resmi || '';
          if (urunResmi && !urunResmi.startsWith('http')) {
            const apiBase = getApiBaseUrl();
            const baseUrl = apiBase.replace('/api', '').replace(/\/$/, '');
            urunResmi = urunResmi.startsWith('/') ? `${baseUrl}${urunResmi}` : `${baseUrl}/${urunResmi}`;
          }

          const okunduClass = bildirim.is_read ? 'bildirim-okundu' : '';

          let bildirimBaslik = bildirim.baslik || '';
          if (isAracSusleme) {
            const baslikLower = bildirimBaslik.toLowerCase();
            if (
              baslikLower.includes('teslim') ||
              baslikLower.includes('sipariş') ||
              bildirimBaslik === 'Teslim edildi!' ||
              bildirimBaslik === 'Teslim edildi' ||
              bildirimBaslik === 'Sipariş teslim edildi!' ||
              bildirimBaslik === 'Sipariş teslim edildi'
            ) {
              bildirimBaslik = 'Süsleme tamamlandı!';
            }
          } else {
            if (bildirimBaslik === 'Teslim edildi!' || bildirimBaslik === 'Teslim edildi') {
              bildirimBaslik = 'Sipariş teslim edildi!';
            }
          }

          return (
            <React.Fragment key={bildirim.id}>
              <a
                href={bildirim.organizasyon_id ? `/siparis-kart-detay/${bildirim.organizasyon_id}` : '#'}
                className={`bildirim-item ${okunduClass}`}
                data-bildirim-id={bildirim.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setNotificationsDropdownOpen(false);
                  if (bildirim.organizasyon_id) {
                    navigate(`/siparis-kart-detay/${bildirim.organizasyon_id}`);
                  }
                }}
              >
                <div className="icerik-content">
                  <div className="bildirim-icerik">
                    <div className="baslik">
                      <div className={durumClass}></div>
                      {bildirimBaslik}
                    </div>
                    {bildirim.tip === 'arsivlendi' && (
                      <div className="bildirim-arsiv-sebep">{bildirim.arsivleme_sebebi || 'Belirtilmemiş'}</div>
                    )}
                    <div className="siparis-veren-musteri">{musteriMetni || 'Belirtilmemiş'}</div>
                    <div className="siparis-organizasyon">{organizasyonMetni || 'Belirtilmemiş'}</div>
                    <div className="siparis-edilen-urun">
                      {urunResmi && (
                        <img
                          src={urunResmi}
                          className="bildirim-urun-resmi"
                          alt={bildirim.siparis_adi || 'Ürün'}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      {bildirim.siparis_adi || 'Belirtilmemiş'}
                    </div>
                  </div>
                  <div className="bildirim-kisi">
                    {profilResmiUrl && (
                      <img
                        src={profilResmiUrl}
                        className="header-profil-resmi"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="dzn-kisitarih">
                      @{kullaniciAdi} • {tarihStr}, {saatStr}
                    </div>
                  </div>
                </div>
              </a>
              {index < notifications.length - 1 && <hr />}
            </React.Fragment>
          );
        })}
      </>
    );
  }, [notifications, loading, user, navigate]);

  return (
    <div className="header">
      <div className="h-sol">
        {/* Mobil: tüm sayfalar için kompakt bar (logo + sayfa başlığı veya arama alanı + tema + profil) */}
        {isMobile ? (
          <>
            <div className="mobile-header-logo-band">
              <Link to="/" className="mobile-header-logo-link" aria-label="Ana sayfa">
                <img
                  src={isDarkTheme ? '/assets/logo-floovon-light.svg' : '/assets/logo-floovon-dark.svg'}
                  alt="Floovon"
                  className="mobile-header-logo-img"
                />
              </Link>
              {!isDashboardPage && (
                <div className="mobile-header-page-title" id="page-title">
                  {getPageTitle()}
                </div>
              )}
              <div className="mobile-header-right-actions">
                {/* Profil: isim/soyisim + rol solda, avatar sağda (web ile aynı mantık, sıra mobilde: bilgi sol, avatar sağ) */}
                <div className={`profil clickdropdown ${profileDropdownOpen ? 'open' : ''}`}>
                  <div
                    className="kullanici-alan-wrapper clickdropbtn"
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  >
                    {user ? (
                      <>
                        <div className="kullanici-alan mobile-header-kullanici-alan">
                          <div className="kullanici-adi" id="header-user-name-mobile">
                            {(() => {
                              if (user.name && user.surname) return `${user.name} ${user.surname}`;
                              if (user.isim && user.soyisim) return `${user.isim} ${user.soyisim}`;
                              if (user.name) return user.name;
                              if (user.isim) return user.isim;
                              if (user.ad) return user.ad;
                              if (user.kullaniciadi) return user.kullaniciadi;
                              if (user.username) return user.username;
                              if (user.email) return user.email.split('@')[0];
                              return 'Kullanıcı';
                            })()}
                          </div>
                          <div className="kullanici-yetki" id="header-user-role-mobile">
                            {user.yetki || user.role || 'Sistem Yöneticisi'}
                          </div>
                        </div>
                        {(() => {
                          const imagePath = user.profil_resmi || user.profile_image || '';
                          const hasImage = imagePath && imagePath.trim() !== '' && imagePath !== 'null' && imagePath !== 'undefined';
                          const initials = ((user.ad || user.name || user.isim || ' ').charAt(0) || (user.kullaniciadi || user.username || '?').charAt(0)).toUpperCase();
                          return (
                            <div
                              ref={mobileAvatarWrapperRef}
                              className={`header-avatar-wrapper ${hasImage ? 'has-avatar-image' : ''}`}
                            >
                              {hasImage ? (
                                <img
                                  className="profil-resmi"
                                  src={getProfileImageSrc(imagePath)}
                                  alt=""
                                  onError={() => mobileAvatarWrapperRef.current?.classList.add('avatar-load-error')}
                                />
                              ) : null}
                              <div className="header-avatar-placeholder profil-resmi">
                                {initials}
                              </div>
                            </div>
                          );
                        })()}
                        <i className="menu-ok fa-solid fa-chevron-down"></i>
                      </>
                    ) : (
                      <div className="kullanici-alan mobile-header-kullanici-alan"><div className="kullanici-adi">...</div></div>
                    )}
                  </div>
                  {profileDropdownOpen && (
                    <div className="clickdropdown-content">
                      <div className="liste-baslik">@{user?.kullaniciadi || user?.username || 'Kullanıcı'}</div>
                      <div className="menu-links-wrapper">
                        {(() => {
                          const role = user?.yetki || user?.role || '';
                          const isSysAdmin = /sistem\s*y[oö]neticisi|sistem-yoneticisi|admin/i.test(String(role));
                          if (!isSysAdmin && !hasAccess('profil-ayarlari')) return null;
                          return (
                            <Link to="/profil-ayarlari" onClick={() => setProfileDropdownOpen(false)}>
                              Profil Ayarları
                            </Link>
                          );
                        })()}
                        <a href="#" onClick={(e) => { e.preventDefault(); setProfileDropdownOpen(false); logout(); }}>Çıkış Yap</a>
                      </div>
                    </div>
                  )}
                </div>
                {/* Tema butonu - index headerdaki gibi profilin sağında (mobilde tooltip yok) */}
                <div className="theme-mode">
                  <button
                    type="button"
                    className="btn-theme-mode"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const body = document.body;
                      const isNowDark = body.classList.toggle('dark-mode');
                      document.documentElement.classList.toggle('dark-mode', isNowDark);
                      localStorage.setItem('theme', isNowDark ? 'dark' : 'light');
                      dispatchThemeChanged();
                      const icon = e.currentTarget.querySelector('i');
                      if (icon) {
                        icon.className = '';
                        icon.classList.add(isNowDark ? 'fa-regular' : 'fa-solid');
                        icon.classList.add(isNowDark ? 'fa-sun' : 'fa-moon');
                      }
                      document.querySelectorAll('.btn-theme-mode').forEach((btn: any) => {
                        const btnIcon = btn.querySelector('i');
                        if (btnIcon) {
                          btnIcon.className = '';
                          btnIcon.classList.add(isNowDark ? 'fa-regular' : 'fa-solid');
                          btnIcon.classList.add(isNowDark ? 'fa-sun' : 'fa-moon');
                        }
                      });
                    }}
                    aria-label="Temayı değiştir"
                  >
                    <i className={isDarkTheme ? 'fa-regular fa-sun' : 'fa-solid fa-moon'}></i>
                  </button>
                </div>
                {/* Araç Takip - tüm sayfalarda (mobil), premium'da */}
                {isBaslangicPlan === false && (
                  <div
                    className={`mobile-arac-takip-btn-wrapper ${aracTakipTeslimatta ? 'mobile-arac-takip-btn-wrapper--active' : ''}`}
                  >
                    <button
                      id="mobileAracTakipBtn"
                      className={`mobile-arac-takip-btn ${aracTakipTeslimatta ? 'mobile-arac-takip-btn--active' : ''}`}
                      data-plan-feature="arac-takip"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (aracTakipTeslimatta) {
                          setShowAracTakipInfo(true);
                        } else {
                          window.dispatchEvent(new CustomEvent('openAracTakipModal'));
                        }
                      }}
                    >
                      <Truck size={20} strokeWidth={2.2} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            {isDashboardPage && (
            <div className="orta header-search-ve-butonlar-mobile">
              <div className="web-search">
                <div className="search-box-title">
                  <i className="icon-search"></i>
                  <input
                    className="web-search-input"
                    type="search"
                    id="search-box"
                    placeholder="Sipariş, organizasyon veya müşteri arayın"
                    value={searchQuery}
                    onChange={handleSearch}
                  />
                </div>
              </div>
              <div className="olustur-butonlar">
                <div className="top-tooltip" data-tooltip="Yeni Kart" data-tooltip-pos="bottom">
                  <button className="btn-yeni-kart-ekle" type="button" onClick={handleYeniKart}>
                    <i className="icon-btn-yeni-kart"></i>
                  </button>
                </div>
                <div className="top-tooltip" data-tooltip="Müşteri Ekle" data-tooltip-pos="bottom">
                  <button className="btn-yeni-musteri-ekle" type="button" onClick={handleYeniMusteri}>
                    <i className="icon-sm-i-musteriler"></i>
                  </button>
                </div>
              </div>
            </div>
            )}
          </>
        ) : (
          <>
            <div className="header-title" id="page-title">
              {getPageTitle()}
            </div>
            {isDashboardPage && (
              <div className="orta">
                <div className="web-search">
                  <div className="search-box-title">
                    <i className="icon-search"></i>
                    <input
                      className="web-search-input"
                      type="search"
                      id="search-box"
                      placeholder="Sipariş, organizasyon veya müşteri arayın"
                      value={searchQuery}
                      onChange={handleSearch}
                    />
                  </div>
                </div>
                <div className="olustur-butonlar">
                  <div className="top-tooltip" data-tooltip="Yeni Kart Oluştur" data-tooltip-pos="bottom">
                    <button className="btn-yeni-kart-ekle" data-value="Yeni Kart Oluştur" type="button" onClick={handleYeniKart}>
                      <i className="icon-btn-yeni-kart"></i>
                    </button>
                  </div>
                  <div className="top-tooltip" data-tooltip="Müşteri Ekle" data-tooltip-pos="bottom">
                    <button className="btn-yeni-musteri-ekle" data-value="Müşteri Ekle" type="button" onClick={handleYeniMusteri}>
                      <i className="icon-sm-i-musteriler"></i>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="h-sag" style={isMobile ? { display: 'none' } : undefined}>
        {/* Teknik Destek Butonu */}
        <div className="btn-teknik-destek top-tooltip" data-tooltip="Teknik Destek" data-tooltip-pos="bottom">
          <button 
            className="btn-teknik-destek-btn" 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowTeknikDestekModal(true);
            }}
          >
            <i className="header-icon fa-solid fa-headset"></i>
          </button>
        </div>

        {/* İkonlar */}
        <div className="ikonlar">
          {/* WhatsApp Durum Göstergesi - Sadece premium planda (Başlangıç’ta erişim yok) */}
          {isBaslangicPlan === false && (
          <div 
            className={`ikon-whatsapp top-tooltip ${whatsAppConnected ? 'connected' : whatsAppReconnecting ? 'reconnecting' : 'disconnected'}`}
            data-tooltip={
              whatsAppReconnecting
                ? (whatsAppStatus?.warning || 'Bağlantı yeniden kuruluyor…')
                : whatsAppConnected 
                ? (() => {
                    const lines = ['WhatsApp Bağlı'];
                    if (whatsAppStatus?.userName) {
                      lines.push(whatsAppStatus.userName);
                    }
                    if (whatsAppStatus?.phoneNumber) {
                      lines.push(formatPhoneNumber(whatsAppStatus.phoneNumber));
                    }
                    return lines.join('\n');
                  })()
                : 'WhatsApp Bağlı Değil - Tıklayarak bağlanın'
            }
            data-tooltip-pos="bottom"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!whatsAppConnected && !whatsAppReconnecting) {
                setShowWhatsAppQRModal(true);
              } else {
                setShowWhatsAppConnectionInfoModal(true);
              }
            }}
          >
            <i 
              className={`fa-brands fa-whatsapp`}
              style={{
                color: whatsAppConnected ? '#25D366' : whatsAppReconnecting ? '#F59E0B' : '#9CA3AF', // Bağlı: yeşil, yeniden bağlanıyor: turuncu, değilse gri
                fontSize: '20px'
              }}
            ></i>
          </div>
          )}
          
          {/* Bildirimler */}
          <div className="ikon-bildirimler clickdropdown top-tooltip" data-tooltip="Bildirimler" data-tooltip-pos="bottom">
            {unreadCount > 0 && (
              <div className="bildirimvar" id="bildirimBadge" style={{ display: 'flex' }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
            <i
              className="header-icon icon-header-i-bildirimler"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.nativeEvent) {
                  e.nativeEvent.stopImmediatePropagation();
                }
                setNotificationsDropdownOpen(prev => !prev);
              }}
              style={{ cursor: 'pointer', pointerEvents: 'auto' }}
            ></i>
            {notificationsDropdownOpen && (
              <div 
                className="clickdropdown-content bildirimler-dropdown" 
                id="bildirimlerDropdown"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  minWidth: '320px',
                  width: '320px',
                  paddingBottom: '10px',
                  zIndex: 99999,
                  display: 'block',
                  visibility: 'visible',
                  opacity: 1
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <div className="liste-baslik">Bildirimler</div>
                <hr />
                <div 
                  id="bildirimlerListesi"
                  onClick={(e) => {
                    e.stopPropagation(); // Liste içeriğine tıklandığında kapanmasını engelle
                  }}
                >
                  {renderNotifications}
                </div>
                {notifications.length > 0 && (
                  <div className="liste-alt" id="bildirimlerFooter">
                    <a
                      href="#"
                      id="tumunuOkunduIsaretle"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        markAllAsRead();
                      }}
                    >
                      Tümünü okundu olarak işaretle
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Potansiyel Partnerler - sayfa izni varsa göster */}
          {hasAccess('partnerler-potansiyel') && (
          <div className="potansiyel-partnerler top-tooltip" data-tooltip="Potansiyel Partnerler" data-tooltip-pos="bottom">
            <Link to="/partnerler-potansiyel">
              <i className="header-icon icon-partner-siparis"></i>
            </Link>
          </div>
          )}

          {/* Tema Değiştirme */}
          <div className="theme-mode top-tooltip" data-tooltip="Temayı Değiştir" data-tooltip-pos="bottom">
            <button 
              className="btn-theme-mode"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // ✅ REACT: Tema değiştirme - eski sistem fonksiyonunu kullan
                if (typeof (window as any).initDarkThemeToggle === 'function') {
                  // Eski sistem fonksiyonu var, ama buton zaten event listener'a sahip olabilir
                  // Direkt tema değiştirme mantığını çalıştır
                  const body = document.body;
                  const isNowDark = body.classList.toggle('dark-mode');
                  document.documentElement.classList.toggle('dark-mode', isNowDark);
                  localStorage.setItem('theme', isNowDark ? 'dark' : 'light');
                  dispatchThemeChanged();
                  
                  // Icon'u güncelle
                  const icon = e.currentTarget.querySelector('i');
                  if (icon) {
                    icon.className = '';
                    icon.classList.add(isNowDark ? 'fa-regular' : 'fa-solid');
                    icon.classList.add(isNowDark ? 'fa-sun' : 'fa-moon');
                  }
                  
                  // Tüm tema butonlarını güncelle
                  document.querySelectorAll('.btn-theme-mode').forEach((btn: any) => {
                    const btnIcon = btn.querySelector('i');
                    if (btnIcon) {
                      btnIcon.className = '';
                      btnIcon.classList.add(isNowDark ? 'fa-regular' : 'fa-solid');
                      btnIcon.classList.add(isNowDark ? 'fa-sun' : 'fa-moon');
                    }
                  });
                } else {
                  // Fallback: Direkt tema değiştirme
                  const body = document.body;
                  const isNowDark = body.classList.toggle('dark-mode');
                  document.documentElement.classList.toggle('dark-mode', isNowDark);
                  localStorage.setItem('theme', isNowDark ? 'dark' : 'light');
                  dispatchThemeChanged();
                  
                  // Icon'u güncelle
                  const icon = e.currentTarget.querySelector('i');
                  if (icon) {
                    icon.className = '';
                    icon.classList.add(isNowDark ? 'fa-regular' : 'fa-solid');
                    icon.classList.add(isNowDark ? 'fa-sun' : 'fa-moon');
                  }
                }
              }}
            >
              <i className="fa-solid fa-moon"></i>
            </button>
          </div>
        </div>

        {/* Kullanıcı Profili */}
        <div className={`profil clickdropdown ${profileDropdownOpen ? 'open' : ''}`}>
          <div
            className="kullanici-alan-wrapper clickdropbtn"
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
          >
            {user ? (
              <>
                {(() => {
                  const imagePath = user.profil_resmi || user.profile_image || '';
                  const hasImage = imagePath && imagePath.trim() !== '' && imagePath !== 'null' && imagePath !== 'undefined';
                  const ad = user.ad || user.name || user.isim || '';
                  const initials = ((ad || ' ').charAt(0) || (user.kullaniciadi || user.username || user.email || '?').charAt(0)).toUpperCase();
                  return (
                    <div className="header-avatar-wrapper">
                      {hasImage ? (
                        <img
                          className="profil-resmi"
                          id="header-user-avatar"
                          src={getProfileImageSrc(imagePath)}
                          alt={user.name || user.ad || user.email || 'User'}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const ph = target.parentElement?.querySelector('.header-avatar-placeholder') as HTMLElement;
                            if (ph) ph.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className="header-avatar-placeholder profil-resmi"
                        id="header-user-avatar"
                        style={hasImage ? { display: 'none' } : undefined}
                      >
                        {initials}
                      </div>
                    </div>
                  );
                })()}
                <div className="kullanici-alan">
                  <div className="kullanici-adi" id="header-user-name">
                    {/* Eski kod mantığı: name + surname veya isim + soyisim birleştir */}
                    {(() => {
                      if (user.name && user.surname) {
                        return `${user.name} ${user.surname}`;
                      } else if (user.isim && user.soyisim) {
                        return `${user.isim} ${user.soyisim}`;
                      } else if (user.name) {
                        return user.name;
                      } else if (user.isim) {
                        return user.isim;
                      } else if (user.ad) {
                        return user.ad;
                      } else if (user.kullaniciadi) {
                        return user.kullaniciadi;
                      } else if (user.username) {
                        return user.username;
                      } else if (user.email) {
                        return user.email.split('@')[0];
                      }
                      return 'Kullanıcı';
                    })()}
                  </div>
                  <div
                    className="kullanici-yetki"
                    id="header-user-role"
                    style={{ pointerEvents: 'none' }}
                  >
                    {user.yetki || user.role || 'Sistem Yöneticisi'}
                  </div>
                </div>
                <i className="menu-ok fa-solid fa-chevron-down"></i>
              </>
            ) : (
              <div className="kullanici-alan">
                <div className="kullanici-adi">Yükleniyor...</div>
              </div>
            )}
          </div>
          {profileDropdownOpen && (
            <div className="clickdropdown-content">
              <div className="liste-baslik" id="dropdown-user-name">
                @{user?.kullaniciadi || user?.username || user?.email?.split('@')[0] || 'Kullanıcı'}
                <span id="dropdown-user-role">{user?.yetki || user?.role || 'Sistem Yöneticisi'}</span>
              </div>
              <div className="menu-links-wrapper">
                {(() => {
                  const role = user?.yetki || user?.role || '';
                  const isSysAdmin = /sistem\s*y[oö]neticisi|sistem-yoneticisi|admin/i.test(String(role));
                  if (!isSysAdmin && !hasAccess('profil-ayarlari')) return null;
                  return (
                    <Link to="/profil-ayarlari" onClick={() => setProfileDropdownOpen(false)}>
                      Profil Ayarları
                    </Link>
                  );
                })()}
                <a
                  href="#"
                  id="logout-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    setProfileDropdownOpen(false);
                    logout();
                  }}
                >
                  Çıkış Yap
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close dropdowns */}
      {profileDropdownOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => {
            setProfileDropdownOpen(false);
          }}
        />
      )}

      {/* WhatsApp modalleri - sadece premium planda render (Başlangıç’ta erişim yok) */}
      {isBaslangicPlan === false && (
        <>
          <WhatsAppQRModal
            isOpen={showWhatsAppQRModal}
            onClose={() => {
              setShowWhatsAppQRModal(false);
              checkWhatsAppConnection();
            }}
            onConnected={() => {
              setShowWhatsAppQRModal(false);
              checkWhatsAppConnection();
            }}
          />
          <WhatsAppConnectionInfoModal
            isOpen={showWhatsAppConnectionInfoModal}
            onClose={() => setShowWhatsAppConnectionInfoModal(false)}
            onDisconnected={() => checkWhatsAppConnection()}
          />
        </>
      )}
      
      {/* Teknik Destek Modal */}
      <TeknikDestekModal
        isOpen={showTeknikDestekModal}
        onClose={() => setShowTeknikDestekModal(false)}
      />

      {/* Araç takip modalı – tüm sayfalarda header'dan açılır */}
      <AracTakipModal
        isOpen={aracTakipModalOpen}
        onClose={() => setAracTakipModalOpen(false)}
        onSuccess={() => {
          window.dispatchEvent(new CustomEvent('aracTakipDurumGuncellendi'));
          setAracTakipModalOpen(false);
        }}
      />

      {/* Araç takip bilgi popup: zaman bilgisi + Teslimatı sonlandır (mobilden başlatıp sonlandırıyoruz) */}
      {showAracTakipInfo && createPortal(
        <AracTakipInfoPopup
          durum={aracTakipDurum}
          loading={aracTakipSonlandirLoading}
          onSonlandir={async () => {
            const aracId = aracTakipDurum?.arac_id;
            if (!aracId) {
              showToast('error', 'Araç bilgisi bulunamadı');
              return;
            }
            setAracTakipSonlandirLoading(true);
            try {
              await completeAracTakip(aracId);
              showToast('success', 'Teslimat sonlandırıldı');
              window.dispatchEvent(new CustomEvent('aracTakipDurumGuncellendi'));
              refetchAracTakipDurum();
              setShowAracTakipInfo(false);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Teslimat sonlandırılamadı';
              showToast('error', msg);
            } finally {
              setAracTakipSonlandirLoading(false);
            }
          }}
          onKapat={() => setShowAracTakipInfo(false)}
        />,
        document.body
      )}
    </div>
  );
};

