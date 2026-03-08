import React, { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Tag, Pencil, Archive, FileText, SquareCheck, ArrowDownNarrowWide, ArrowDownAZ, Layers, Eye } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useSiparisKartlari } from '../hooks/useDashboardData';
import { OrderList } from './OrderList';
import { GroupedOrderList } from './GroupedOrderList';
import { useWhatsAppShare } from '../hooks/useWhatsAppShare';
import { WhatsAppPhoneSelectorModal } from './WhatsAppPhoneSelectorModal';
import type { OrganizasyonKart as OrganizasyonKartType, Order } from '../types';
import { formatDateToDisplay } from '../../../shared/utils/dateUtils';
import { getUploadUrl } from '../../../shared/utils/urlUtils';
import { getApiBaseUrl } from '../../../lib/runtime';
import { useDeliveryTimeWarning } from '../hooks/useDeliveryTimeWarning';
import { appendIlceIlToAddress, formatPhoneNumber, formatAddressDisplay } from '../../../shared/utils/formatUtils';
import { showToast, showPlanUpgradeToast } from '../../../shared/utils/toastUtils';
import { usePlan } from '../../../app/providers/PlanProvider';
import { invalidateOrganizasyonKartQueries } from '../../../lib/invalidateQueries';
import { apiClient } from '@/lib/api';
import { Lightbox } from '../../../shared/components/Lightbox';

interface OrganizasyonKartProps {
  organizasyonKart: OrganizasyonKartType;
  onOrderAction?: (action: string, order: Order) => void;
  onKartAction?: (action: string, kartId: number) => void;
  baglantiliSiparislerMap?: { [musteriUnvan: string]: number };
  onOrderContextMenu?: (event: React.MouseEvent, order: Order) => void;
  onOpenWhatsAppQRForShare?: (kart: OrganizasyonKartType, siparisler: Order[]) => void;
}

/**
 * Organizasyon Kart Component
 * Her organizasyon_kartlar tablosundaki satır = bir organizasyon kartı
 */
export const OrganizasyonKart: React.FC<OrganizasyonKartProps> = ({
  organizasyonKart,
  onOrderAction,
  onKartAction,
  baglantiliSiparislerMap,
  onOrderContextMenu,
  onOpenWhatsAppQRForShare,
}) => {
  const { isBaslangicPlan } = usePlan();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [sortType, setSortType] = useState<'alfabetik' | 'tur' | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const davetiyeInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const { data: siparisler = [], isLoading: siparislerLoading, error: siparislerError } = useSiparisKartlari(
    organizasyonKart.id
  );
  
  // Sıralanmış siparişler
  const sortedSiparisler = useMemo(() => {
    if (!sortType || siparisler.length === 0) return siparisler;
    
    const sorted = [...siparisler];
    
    if (sortType === 'alfabetik') {
      return sorted.sort((a, b) => {
        const aName = (a.musteriUnvani || a.musteriAdi || '').toLowerCase();
        const bName = (b.musteriUnvani || b.musteriAdi || '').toLowerCase();
        return aName.localeCompare(bName, 'tr-TR');
      });
    } else if (sortType === 'tur') {
      return sorted.sort((a, b) => {
        const aUrun = (a.urun || '').toLowerCase();
        const bUrun = (b.urun || '').toLowerCase();
        return aUrun.localeCompare(bUrun, 'tr-TR');
      });
    }
    
    return sorted;
  }, [siparisler, sortType]);
  
  
  // WhatsApp paylaşım hook'u
  const {
    showPhoneSelector,
    contacts,
    shareOrganizasyonKart,
    sendToContact,
    setShowPhoneSelector,
  } = useWhatsAppShare();

  const kartTur = organizasyonKart.kart_tur;
  const isGrouped = kartTur === 'ozelgun' || kartTur === 'ozelsiparis' || kartTur === 'ciceksepeti';

  // Teslim edilen sipariş sayısı
  const teslimEdilenSayisi = useMemo(() => {
    // ✅ KRİTİK: Eğer siparisler lazy load edilmişse onları kullan, yoksa siparis_sayisi'nden tahmin et
    if (siparisler.length > 0) {
      return siparisler.filter((s) => s.durum === 'teslim').length;
    }
    // Siparisler henüz yüklenmemişse, backend'den gelen siparis_sayisi'ni kullan
    // Ama teslim edilen sayısını bilmiyoruz, bu yüzden 0 döndür
    return 0;
  }, [siparisler]);
  
  // ✅ KRİTİK: Toplam sipariş sayısı - lazy load edilmişse siparisler.length, yoksa siparis_sayisi
  const toplamSiparisSayisi = useMemo(() => {
    if (siparisler.length > 0) {
      return siparisler.length;
    }
    // Siparisler henüz yüklenmemişse, backend'den gelen siparis_sayisi'ni kullan
    return organizasyonKart.siparis_sayisi || 0;
  }, [siparisler, organizasyonKart.siparis_sayisi]);

  // Teslim tarih formatı
  const teslimTarihFormatted = useMemo(() => {
    if (!organizasyonKart.teslim_tarih) return null;
    return formatDateToDisplay(organizasyonKart.teslim_tarih);
  }, [organizasyonKart.teslim_tarih]);

  // Telefon formatı
  const telefonFormatted = useMemo(() => {
    if (!organizasyonKart.teslim_kisisi_telefon) return null;
    return formatPhoneNumber(organizasyonKart.teslim_kisisi_telefon);
  }, [organizasyonKart.teslim_kisisi_telefon]);

  // Telefon href
  const telefonHref = useMemo(() => {
    if (!organizasyonKart.teslim_kisisi_telefon) return '#';
    const digits = organizasyonKart.teslim_kisisi_telefon.replace(/\D/g, '');
    if (digits.length >= 10) {
      const normalized = digits.length === 10 ? '90' + digits : digits;
      return `tel:+${normalized}`;
    }
    return '#';
  }, [organizasyonKart.teslim_kisisi_telefon]);

  // Açık adres - ilçe/il bilgisi ile birlikte (teslimat konumu seçilmişse mahalle açık adresin önüne eklenir)
  const acikAdresWithIlceIl = useMemo(() => {
    const baseAdres =
      organizasyonKart.organizasyon_teslimat_konumu &&
      organizasyonKart.mahalle &&
      organizasyonKart.acik_adres
        ? `${organizasyonKart.mahalle}, ${organizasyonKart.acik_adres}`
        : organizasyonKart.acik_adres;
    return appendIlceIlToAddress(
      baseAdres,
      organizasyonKart.organizasyon_ilce,
      organizasyonKart.organizasyon_il
    );
  }, [
    organizasyonKart.acik_adres,
    organizasyonKart.organizasyon_ilce,
    organizasyonKart.organizasyon_il,
    organizasyonKart.organizasyon_teslimat_konumu,
    organizasyonKart.mahalle,
  ]);

  // Geçmiş sipariş kontrolü
  const hasGecmisSiparis = useMemo(() => {
    if (!siparisler.length) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return siparisler.some((s) => {
      if (!s.tarih) return false;
      const siparisTarih = new Date(s.tarih);
      siparisTarih.setHours(0, 0, 0, 0);
      return siparisTarih < today && s.durum !== 'teslim';
    });
  }, [siparisler]);


  // Menü konumunu hesapla
  const handleMenuToggle = () => {
    if (!menuOpen && menuButtonRef.current) {
      const buttonRect = menuButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: buttonRect.bottom + 4,
        right: window.innerWidth - buttonRect.right,
      });
    } else {
      setMenuPosition(null);
    }
    setMenuOpen(!menuOpen);
  };

  // Menü dışına tıklama kontrolü
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        if (menuButtonRef.current && !menuButtonRef.current.contains(event.target as Node)) {
          setMenuOpen(false);
          setMenuPosition(null);
        }
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setSortMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Bağlantı yoksa önce WhatsApp QR açılsın; bağlanınca paylaşım devam etsin
  useEffect(() => {
    const handler = (e: CustomEvent<{ kart: OrganizasyonKartType; siparisler: Order[] }>) => {
      if (e.detail?.kart?.id === organizasyonKart.id) {
        shareOrganizasyonKart(e.detail.kart, e.detail.siparisler);
      }
    };
    window.addEventListener('floovon-whatsapp-connected-continue-share', handler as EventListener);
    return () => window.removeEventListener('floovon-whatsapp-connected-continue-share', handler as EventListener);
  }, [organizasyonKart.id, shareOrganizasyonKart]);

  // Menü aksiyonları
  const handleMenuAction = async (action: string) => {
    setMenuOpen(false);
    if (action === 'tumunu-teslim-et' && toplamSiparisSayisi === 0) return;
    if (action === 'whatsapp') {
      if (isBaslangicPlan === true) {
        showPlanUpgradeToast();
        return;
      }
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
        if (onOpenWhatsAppQRForShare) {
          onOpenWhatsAppQRForShare(organizasyonKart, siparisler);
          return;
        }
      }
      await shareOrganizasyonKart(organizasyonKart, siparisler);
    } else {
      onKartAction?.(action, organizasyonKart.id);
    }
  };

  const handleSortAction = (newSortType: string) => {
    setSortMenuOpen(false);
    // Client-side sıralama - state'i güncelle
    if (newSortType === 'alfabetik' || newSortType === 'tur') {
      setSortType(newSortType);
      // Toast mesajı göster
      showToast('success', `Siparişler ${newSortType === 'alfabetik' ? 'alfabetik' : 'ürün türüne'} göre sıralandı`);
    } else {
      setSortType(null);
    }
  };

  return (
    <div className={`ana-kart orgkart ${kartTur}`} data-card>
      {/* Kart Header */}
      <div className="kart-header">
        <div className="kart-header-sol">
          {/* Sıra: 1) Ana tür (kart-tur), 2) Alt tür (kart-alt-tur), 3) Etiket (kart-etiket) */}
          <div className="kart-header-turler">
          <span className="kart-tur">
            {kartTur === 'ciceksepeti' ? (
              <img
                src="/assets/cicek-sepeti/cicek-sepeti.svg"
                alt="Çiçek Sepeti"
                className="kart-tur-ciceksepeti-logo"
              />
            ) : (
              organizasyonKart.kart_tur_display ||
              (kartTur === 'organizasyon' ? 'Organizasyon' :
               kartTur === 'aracsusleme' ? 'Araç Süsleme' :
               kartTur === 'ozelgun' ? 'Özel Gün' :
               'Özel Sipariş')
            )}
          </span>
            {organizasyonKart.alt_tur ? (
              <span className="kart-alt-tur">{organizasyonKart.alt_tur}</span>
            ) : null}
            {organizasyonKart.kart_etiket ? (
            <span className="kart-etiket">
                <Tag className="kart-etiket-icon" aria-hidden />
              {(organizasyonKart.kart_etiket || '').toLocaleUpperCase('tr-TR')}
            </span>
            ) : null}
          </div>
        </div>
        <div className="kart-header-sag">
          {/* Sipariş detay (kart detay sayfasına git) – sirala-menu / kart-menu ile aynı kapsayıcı seviyesi */}
          <div className="siparis-detay-buton">
            <Link
              to={`/siparis-kart-detay/${organizasyonKart.id}`}
              data-tooltip="Sipariş Detayları"
              data-organizasyon-id={organizasyonKart.id}
              className="siparis-kart-detay-buton"
              onClick={() => {
                document.querySelectorAll('.tooltip').forEach((el) => el.remove());
                window.dispatchEvent(new CustomEvent('floovon-clear-tooltip'));
                requestAnimationFrame(() => {
                  document.querySelectorAll('.tooltip').forEach((el) => el.remove());
                });
              }}
            >
              <Eye size={16} aria-hidden />
            </Link>
          </div>
          {/* Sıralama Menüsü */}
          <div className="sirala-menu" ref={sortMenuRef}>
            <button
              onClick={() => setSortMenuOpen(!sortMenuOpen)}
              className="siparis-kart-filtrele-buton kart-header-aksiyon-buton"
              data-tooltip="Siparişleri Sırala"
            >
              <ArrowDownNarrowWide size={16} aria-hidden />
            </button>
            {sortMenuOpen && (
              <div className="filtre-menu-content">
                <div className="liste-baslik">Siparişleri Sırala</div>
                <button
                  onClick={() => handleSortAction('alfabetik')}
                  id="sirala-kart-alfabetik-org"
                >
                  <ArrowDownAZ size={16} aria-hidden /> Alfabetik
                </button>
                <button
                  onClick={() => handleSortAction('tur')}
                  id="sirala-kart-tur-org"
                >
                  <Layers size={16} aria-hidden /> Sipariş Türüne Göre
                </button>
              </div>
            )}
          </div>
          {/* Kart Menüsü */}
          <div className="kart-menu" data-tooltip="Kart Ayarları">
            <button
              ref={menuButtonRef}
              onClick={handleMenuToggle}
              className="kart-menu-buton"
            >
              <i className="icon-hamburger-menu" aria-hidden />
            </button>
          </div>
          {menuOpen && menuPosition && createPortal(
            <div 
              ref={menuRef}
              className="kart-menu-content"
              style={{
                position: 'fixed',
                top: `${menuPosition.top}px`,
                right: `${menuPosition.right}px`,
                zIndex: 10000,
              }}
            >
                <div className="liste-baslik">Kart Ayarları</div>
                {kartTur !== 'ciceksepeti' && (
                <button
                  onClick={() => handleMenuAction('duzenle')}
                  className="karti-duzenle"
                >
                  <Pencil size={16} aria-hidden />{' '}Düzenle
                </button>
                )}
                {kartTur !== 'ciceksepeti' && (
                <button
                  onClick={() => handleMenuAction('tumunu-teslim-et')}
                  id="tum-kartlari-teslim-edildi-olarak-isaretle"
                  disabled={toplamSiparisSayisi === 0}
                >
                  <SquareCheck size={16} aria-hidden />{' '}Tümünü teslim edildi işaretle
                </button>
                )}
                <button
                  onClick={() => handleMenuAction('arsivle')}
                  className="karti-arsivle"
                >
                  <Archive size={16} aria-hidden />{' '}Kartı arşivle
                </button>
                {kartTur !== 'aracsusleme' && (
                <button
                  onClick={() => handleMenuAction('yazdir')}
                  className="kart-siparis-kunyesi-yazdir"
                >
                  <FileText size={16} aria-hidden />{' '}Sipariş künyesi yazdır
                </button>
                )}
                {isBaslangicPlan === false && (
                <button
                  onClick={() => toplamSiparisSayisi > 0 && handleMenuAction('whatsapp')}
                  className="buton wp-listesi-paylas"
                  disabled={toplamSiparisSayisi === 0}
                  title={toplamSiparisSayisi === 0 ? 'Sipariş olmadığı için paylaşılamaz' : 'Whatsapp listesi paylaş'}
                >
                  <i className="icon-sp-kart-detay-btn-wp-listesi-paylas" aria-hidden />{' '}Whatsapp listesi paylaş
                </button>
                )}
            </div>,
            document.body
          )}
        </div>
      </div>

      {/* Kart Header Alt Satır */}
      <div className="kart-header-alt-satir">
        <div className="alt-satir-sol">
          {/* Sipariş Sayısı – teslim edilen / toplam (yönlendirme yok) */}
          <span
            className="toplam-siparisler"
            data-tooltip="Teslim Edilen / Toplam Sipariş"
          >
            <i className="icon-toplam-siparis"></i>
            {teslimEdilenSayisi}/{toplamSiparisSayisi}
          </span>
          {/* Partner Sipariş Sayısı - Çiçek Sepeti kartlarına partner sipariş eklenmez, gösterme */}
          {kartTur !== 'ciceksepeti' && (
          <div className="partner-siparisler" data-tooltip="Bu organizasyondaki partner sipariş sayısı">
            <i className="icon-partner-siparis"></i>
            <span className="partner-siparis-sayisi">{organizasyonKart.partner_siparis_sayisi || 0}</span>
          </div>
          )}
          {/* Foto Sayısı - Her zaman göster, foto yoksa 0 */}
          <button 
            type="button" 
            className="siparis-teslim-foto-ekle" 
            data-kart-id={organizasyonKart.id}
            data-tooltip={kartTur === 'aracsusleme' ? 'Tamamlanan araçların fotoğraflarını ekleyin' : 'Teslim edilen sipariş fotoğraf(lar)ı ekleyin'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Direkt #fotoInput'a tıklat (modal YOK!)
              const input = document.getElementById('fotoInput') as HTMLInputElement;
              if (input) {
                (window as any).selectedKartId = organizasyonKart.id;
                (window as any).selectedFotoButton = e.currentTarget;
                input.click();
              } else {
                showToast('error', 'Fotoğraf yükleme aracı bulunamadı');
              }
            }}
          >
            <i className="fa-solid fa-camera"></i>
            <div className="foto-sayi">{organizasyonKart.teslim_foto_sayisi || 0}</div>
          </button>
        </div>
        {/* Alt Satır Sağ - Organizasyon kartı: davetiye varsa görsel + ataç, yoksa ataç + placeholder yükle */}
        {kartTur === 'organizasyon' && (
          <div className="alt-satir-sag">
            <div className="kart-ekler" data-tooltip="Davetiye görseli">
              <i className="icon-ekler"></i>
            </div>
            {organizasyonKart.kart_gorsel ? (
              <div
                className="kart-gorsel kart-gorsel--lightbox"
                data-lightbox-grup
                role="button"
                tabIndex={0}
                onClick={() => setLightboxOpen(true)}
                onKeyDown={(e) => e.key === 'Enter' && setLightboxOpen(true)}
                title="Davetiye görselini büyüt"
                style={{ cursor: 'pointer' }}
              >
              <img
                src={getUploadUrl(organizasyonKart.kart_gorsel)}
                alt="Kart Görseli"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.style.display = 'none';
                }}
              />
            </div>
            ) : (
              <>
                <input
                  ref={davetiyeInputRef}
                  type="file"
                  accept="image/*"
                  className="file-input-hidden"
                  aria-hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const kartId = organizasyonKart.id;
                    try {
                      const formData = new FormData();
                      formData.append('davetiye_gorsel', file);
                      const baseUrl = getApiBaseUrl();
                      const res = await fetch(`${baseUrl}/organizasyon-kartlar/${kartId}/davetiye-gorseli`, {
                        method: 'POST',
                        body: formData,
                        credentials: 'include',
                      });
                      if (!res.ok) throw new Error('Yükleme başarısız');
                      showToast('success', 'Davetiye görseli yüklendi');
                      invalidateOrganizasyonKartQueries(queryClient, kartId);
                    } catch (err) {
                      showToast('error', (err as Error)?.message || 'Görsel yüklenemedi');
                    }
                    e.target.value = '';
                  }}
                />
                <div
                  className="kart-gorsel kart-gorsel-placeholder"
                  role="button"
                  tabIndex={0}
                  onClick={() => davetiyeInputRef.current?.click()}
                  onKeyDown={(e) => e.key === 'Enter' && davetiyeInputRef.current?.click()}
                  title="Davetiye görseli yükle"
                  data-tooltip="Davetiye görseli yükle"
                >
                  <i className="uil uil-plus" aria-hidden />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Teslimat Konumu - Sadece organizasyon kartı için göster */}
      {kartTur === 'organizasyon' && (organizasyonKart.organizasyon_teslimat_konumu || organizasyonKart.mahalle || acikAdresWithIlceIl) && (
        <div className="teslimat-konum">
          {(organizasyonKart.organizasyon_teslimat_konumu || organizasyonKart.mahalle) && (
            <div className="mahalle">
              {formatAddressDisplay(organizasyonKart.organizasyon_teslimat_konumu || organizasyonKart.mahalle)}
            </div>
          )}
          {acikAdresWithIlceIl && (
            <div className="acik-adres">{acikAdresWithIlceIl}</div>
          )}
        </div>
      )}

      {/* Organizasyon Sahibi - Sadece organizasyon kartı için göster */}
      {kartTur === 'organizasyon' && organizasyonKart.teslim_kisisi && (
        <div className="organizasyon-sahip">
          <div className="title">Organizasyon Sahibi</div>
          <div className="teslim-kisisi">{organizasyonKart.teslim_kisisi}</div>
          {organizasyonKart.teslim_kisisi_telefon && (
            <a
              href={telefonHref}
              className="teslim-kisisi-telefon"
            >
              <i className="icon-telefon"></i>
              {telefonFormatted || organizasyonKart.teslim_kisisi_telefon}
            </a>
          )}
        </div>
      )}

      {/* Kart Açıklaması - Araç Süsleme, Özel Gün, Özel Sipariş, Çiçek Sepeti için */}
      {(kartTur === 'aracsusleme' || kartTur === 'ozelgun' || kartTur === 'ozelsiparis' || kartTur === 'ciceksepeti') && (
        <div className="kart-aciklama">
          {kartTur === 'aracsusleme' ? (
            <>Araç randevuları için sipariş kartları üzerindeki <span>randevu saatini dikkate alınız</span></>
          ) : kartTur === 'ozelgun' ? (
            <>Özel gün siparişleri için sipariş kartları üzerindeki <span>teslim saatini dikkate alınız</span></>
          ) : kartTur === 'ciceksepeti' ? (
            <>Çiçeksepeti siparişleri için sipariş kartları üzerindeki <span>teslim saatini</span> dikkate alınız</>
          ) : (
            <>Özel siparişler için sipariş kartları üzerindeki <span>teslim saatini dikkate alınız</span></>
          )}
        </div>
      )}

      {/* Geçmiş Sipariş Uyarısı */}
      {hasGecmisSiparis && (
        <div className="gecmis-siparis-uyari">
          <i className="icon-uyari"></i>
          <div className="uyari-not">
            Bu kartta geçmiş siparişler mevcut!
          </div>
        </div>
      )}

      {/* Teslim Zamanı */}
      <div className="teslim-zaman">
        {teslimTarihFormatted && (
          <div className="tarih">
            {teslimTarihFormatted}
          </div>
        )}
        {/* Çiçek Sepeti kartında sadece tarih, saat gösterilmez */}
        {organizasyonKart.teslim_saat && teslimTarihFormatted && kartTur !== 'ciceksepeti' && <div className="vr"></div>}
        {organizasyonKart.teslim_saat && kartTur !== 'ciceksepeti' && (() => {
          const warning = useDeliveryTimeWarning(organizasyonKart.teslim_saat, organizasyonKart.teslim_tarih);
          return (
            <div className="teslim-saat">
              <div className="saat-icerik">
                <span>Saat</span>
                <span className="saat-veri">{organizasyonKart.teslim_saat}</span>
              </div>
              {warning && (
                <>
                  {warning.durum === 'gecikti' && (
                    <div className="sure-gecti" style={{ display: 'flex' }}>
                      <span>{warning.mesaj}</span>
                    </div>
                  )}
                  {warning.durum === 'uyari' && (
                    <div className="kalan-sure-uyari sifir-kaldi" style={{ display: 'flex' }}>
                      <i className="icon-saat"></i>
                      <span>{warning.mesaj}</span>
                    </div>
                  )}
                  {warning.durum === 'normal' && (
                    <div className="daha-zaman-var" style={{ display: 'block' }}>
                      <i className="icon-saat"></i>
                      <span>{warning.mesaj}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* Siparişler */}
      <div className="sk-kart-alan" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {siparislerLoading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gri70)', fontSize: '13px' }}>Yükleniyor...</div>
        ) : siparislerError ? (
          <div className="bos-siparis-mesaji">
            <i className="icon-kart-menu-tumu-teslim-edildi"></i>
            <div>Hata: {siparislerError.message || 'Siparişler yüklenirken bir hata oluştu'}</div>
          </div>
        ) : siparisler.length === 0 ? (
          <div className="bos-siparis-mesaji">
            <i className="icon-kart-menu-tumu-teslim-edildi"></i>
            <div>(Henüz sipariş bulunmuyor)</div>
            <small>Bu organizasyondaki siparişlerin hepsi teslim edilmiş veya arşivlenmiş olabilir. Yeni sipariş yoksa organizasyon kartını "arşivleyebilirsiniz".</small>
          </div>
        ) : isGrouped ? (
          <GroupedOrderList
            onOrderContextMenu={onOrderContextMenu}
            orders={sortedSiparisler} 
            organizasyonKartTur={kartTur} 
            onOrderAction={onOrderAction}
            baglantiliSiparislerMap={baglantiliSiparislerMap}
            organizasyonKartId={organizasyonKart.id}
          />
        ) : (
          <OrderList
            onOrderContextMenu={onOrderContextMenu} 
            orders={sortedSiparisler} 
            organizasyonKartTur={kartTur} 
            onOrderAction={onOrderAction}
            baglantiliSiparislerMap={baglantiliSiparislerMap}
            organizasyonKartId={organizasyonKart.id}
          />
        )}
      </div>

      {/* Yeni Sipariş Ekle Butonu – Çiçek Sepeti kartlarında yok (siparişler API'den gelir) */}
      {kartTur !== 'ciceksepeti' && (
      <div className="yeni-siparis-ekle">
        <button
          onClick={(e) => {
            e.stopPropagation();
            // onOrderAction prop'unu kullan
            if (onOrderAction) {
              onOrderAction('yeni-siparis', {
                ...organizasyonKart,
                id: `new-order-${organizasyonKart.id}`,
                kart_tur: kartTur,
                organizasyon_id: organizasyonKart.id,
              } as any);
            }
          }}
        >
          <span>+</span> Yeni Sipariş Ekle
        </button>
      </div>
      )}
      
      {/* WhatsApp Telefon Seçim Modalı – ekranda popup olarak (kartın dışında) */}
      {showPhoneSelector &&
        createPortal(
          <WhatsAppPhoneSelectorModal
            isOpen={true}
            contacts={contacts}
            onSelect={(phone) => sendToContact(phone)}
            onClose={() => setShowPhoneSelector(false)}
          />,
          document.body
        )}

      {/* Davetiye görseli lightbox - tam ekran body'de açılsın (kart içinde değil) */}
      {kartTur === 'organizasyon' && organizasyonKart.kart_gorsel && createPortal(
        <Lightbox
          isOpen={lightboxOpen}
          images={[{ src: getUploadUrl(organizasyonKart.kart_gorsel), alt: 'Davetiye görseli' }]}
          initialIndex={0}
          onClose={() => setLightboxOpen(false)}
          />,
          document.body
        )}
    </div>
  );
};
