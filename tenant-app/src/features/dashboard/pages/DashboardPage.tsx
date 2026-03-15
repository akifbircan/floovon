import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useOrganizasyonKartlari } from '../hooks/useDashboardData';
import { useWeekDates } from '../hooks/useWeekDates';
import { useBaglantiliSiparisler } from '../hooks/useBaglantiliSiparisler';
// ✅ REACT: useDeliveryTimeWarnings artık kullanılmıyor - her component kendi useDeliveryTimeWarning hook'unu kullanıyor
import { useFilterCounts } from '../hooks/useFilterCounts';
import { DashboardHeader } from '../components/DashboardHeader';
import { OrderBoard } from '../components/OrderBoard';
import { RightPanel } from '../components/RightPanel';
import { QRScannerFAB } from '../components/QRScannerFAB';
import { QRScannerModal } from '../components/QRScannerModal';
import { OrderActionModal } from '../components/OrderActionModal';
import { EditKartModal } from '../components/EditKartModal';
import { YeniKartModal } from '../components/YeniKartModal';
import { SiparisEditModal } from '../components/SiparisEditModal';
import { YeniMusteriModal } from '../components/YeniMusteriModal';
import { OrderContextMenu } from '../components/OrderContextMenu';
import { SicakSatisModal } from '../components/SicakSatisModal';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { ErrorState } from '../../../shared/components/ErrorState';
import { TeknikDestekModal } from '../components/TeknikDestekModal';
import { TeslimFotoModal } from '../components/TeslimFotoModal';
import { ImzaModal } from '../components/ImzaModal';
import { ArsivSebepModal } from '../components/ArsivSebepModal';
import { WhatsAppQRModal } from '../components/WhatsAppQRModal';
// import { scanQRCode } from '../api/qrScan'; // Kullanılmıyor
// ✅ TEMİZLENDİ: tumunuTeslimEt import'u kaldırıldı - sıfırdan yazılacak
import { usePageAnimations } from '../../../shared/hooks/usePageAnimations';
import { gsap } from 'gsap';
import { useExport } from '../hooks/useExport';
import { showToast } from '../../../shared/utils/toastUtils';
import type { Order, OrganizasyonKart } from '../types';
import { useUrunVerileri } from '../hooks/useUrunVerileri';
import { useTeslimFotoUpload } from '../hooks/useTeslimFotoUpload';
import { teslimEtSiparis, arsivleSiparis, arsivleOrganizasyonKart } from '../api/siparisActions';
import { getSiparisKartlariByOrganizasyon, deliverAllOrdersInKart as apiDeliverAllOrdersInKart } from '../api';
import { uploadTeslimFotolari } from '../api/teslimFotoApi';
import { createTeslimEdildiMessage, createPartnerMessage } from '../utils/whatsappMessageUtils';
import { getApiBaseUrl } from '../../../lib/runtime';
import { apiClient } from '../../../lib/api';
import { buildAddressForMapsQuery } from '../../../shared/utils/formatUtils';
import { invalidateOrganizasyonKartQueries, invalidateCustomerQueries } from '../../../lib/invalidateQueries';
import { broadcastInvalidation } from '../../../lib/crossTabInvalidate';
import { usePlan } from '../../../app/providers/PlanProvider';

/**
 * Siparişler Page - Ana sayfa
 * Tarih bazlı kolonlu organizasyon kartları board'u
 * Her kolonda o güne ait organizasyon kartları gösterilir
 */
export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isBaslangicPlan } = usePlan();
  const teslimFotoUpload = useTeslimFotoUpload();
  
  // QueryClient'ı window'a ekle (RightPanel'den erişilebilmesi için)
  React.useEffect(() => {
    (window as any).queryClient = queryClient;
  }, [queryClient]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // GSAP sayfa animasyonları
  usePageAnimations('dashboard');
  
  // ✅ REACT: Header'dan gelen arama query'sini dinle
  React.useEffect(() => {
    const handleSearchQueryChange = (event: CustomEvent) => {
      const newQuery = event.detail?.query || '';
      // ✅ KRİTİK: Her değişiklikte direkt güncelle (prevQuery kontrolü kaldırıldı)
      setSearchQuery(newQuery);
    };
    
    // Custom event listener
    window.addEventListener('searchQueryChanged', handleSearchQueryChange as EventListener);
    
    // ✅ KRİTİK: İlk yüklemede window'dan oku
    const initialQuery = (window as any).__REACT_SEARCH_QUERY__ || '';
    if (initialQuery) {
      setSearchQuery(initialQuery);
    }
    
    return () => {
      window.removeEventListener('searchQueryChanged', handleSearchQueryChange as EventListener);
    };
  }, []); // ✅ DÜZELTME: searchQuery dependency'sini kaldırdık - sonsuz döngüyü önlemek için

  // ✅ REACT: Header'daki "Yeni Kart" ve "Müşteri Ekle" butonlarından gelen event'leri dinle (Araç Takip Header'da global)
  useEffect(() => {
    const onOpenYeniKart = () => setYeniKartModalOpen(true);
    const onOpenYeniMusteri = () => setYeniMusteriModalOpen(true);
    window.addEventListener('openYeniKartModal', onOpenYeniKart);
    window.addEventListener('openYeniMusteriModal', onOpenYeniMusteri);
    return () => {
      window.removeEventListener('openYeniKartModal', onOpenYeniKart);
      window.removeEventListener('openYeniMusteriModal', onOpenYeniMusteri);
    };
  }, []);

  // Eski JS dosyaları için floovonFetch ve floovonFetchStandard fonksiyonlarını tanımla
  useEffect(() => {
    const setupLegacyApiFunctions = async () => {
      try {
        const { apiClient } = await import('../../../lib/api');
        const { getApiBaseUrl } = await import('../../../lib/runtime');
        
        // floovonFetch: Eski JS dosyaları için API wrapper
        // Response formatı: { success: boolean, data: any }
        (window as any).floovonFetch = async (url: string, options?: RequestInit) => {
          try {
            // Token ve Tenant ID'yi al
            const token = localStorage.getItem('floovon_token') || localStorage.getItem('token');
            
            // Tenant ID'yi al - Eski sistem mantığı ile
            let tenantId: string | null = null;
            
            // ÖNCE user objesinden al (en güvenilir kaynak)
            const userStr = localStorage.getItem('floovon_user') || localStorage.getItem('user');
            if (userStr) {
              try {
                const user = JSON.parse(userStr);
                if (user.tenant_id) {
                  tenantId = String(user.tenant_id);
                  localStorage.setItem('floovon_tenant_id', tenantId);
                }
              } catch (e) {
                // Parse hatası
              }
            }
            
            // Fallback: localStorage'dan direkt al
            if (!tenantId) {
              tenantId = localStorage.getItem('floovon_tenant_id');
            }
            
            // Son çare: Token'dan decode et
            if (!tenantId && token) {
              try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                if (payload.tenant_id) {
                  tenantId = String(payload.tenant_id);
                  localStorage.setItem('floovon_tenant_id', tenantId);
                }
              } catch (e) {
                // Token decode hatası
              }
            }
            
            // Header'ları hazırla
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
              ...(options?.headers as Record<string, string> || {}),
            };
            
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
            }
            
            if (tenantId) {
              headers['X-Tenant-ID'] = tenantId;
            }
            
            // ✅ KRİTİK: Eğer URL zaten tam URL ise (http:// ile başlıyorsa), direkt kullan
            if (url.startsWith('http://') || url.startsWith('https://')) {
              // Tam URL - apiClient baseURL'i kullanmamalı, direkt URL'yi kullan
              const response = await fetch(url, {
                method: options?.method || 'GET',
                headers,
                body: options?.body,
              });
              
              // Response'u kontrol et
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                  success: false,
                  message: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
                  errorCode: errorData.errorCode,
                  data: errorData,
                };
              }
              
              const result = await response.json();
              
              // Response formatını normalize et
              if (result && typeof result === 'object' && 'success' in result) {
                return result;
              }
              
              // Eğer direkt data geliyorsa, success: true ile wrap et
              return { success: true, data: result };
            }
            
            // URL'den endpoint'i çıkar (eğer /api ile başlıyorsa)
            let endpoint = url.startsWith('/api/') ? url.substring(5) : url;
            // Eğer endpoint / ile başlamıyorsa ekle
            if (!endpoint.startsWith('/')) {
              endpoint = '/' + endpoint;
            }
            
            // Method'u belirle
            const method = (options?.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH') || 'GET';
            
            // Body'yi parse et
            let data: any = undefined;
            if (options?.body) {
              try {
                data = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
              } catch (e) {
                // Body parse edilemezse olduğu gibi kullan
                data = options.body;
              }
            }
            
            // apiClient ile istek yap
            const response = await apiClient.request({
              url: endpoint,
              method,
              data,
              headers: {
                ...headers,
              },
            });
            
            // Response formatını normalize et
            // Backend'den gelen response zaten ApiResponse formatında olabilir
            if (response.data && typeof response.data === 'object' && 'success' in response.data) {
              return response.data;
            }
            
            // Eğer direkt data geliyorsa, success: true ile wrap et
            return { success: true, data: response.data };
          } catch (error: any) {
            // ApiError veya AxiosError'ı handle et
            if (error.response) {
              // Axios error response
              const errorData = error.response.data || {};
              return {
                success: false,
                message: errorData.message || error.message || 'Bir hata oluştu',
                errorCode: errorData.errorCode,
                data: errorData,
              };
            }
            
            // Diğer hatalar
            return {
              success: false,
              message: error.message || 'Bir hata oluştu',
            };
          }
        };
        
        // floovonFetchStandard: floovonFetch ile aynı
        (window as any).floovonFetchStandard = (window as any).floovonFetch;
        
        // getFloovonApiBase: API base URL'i döndür (sync olmalı)
        (window as any).getFloovonApiBase = () => {
          return getApiBaseUrl();
        };

        // loadDynamicCards: Legacy (Çiçek Sepeti onay, takvim vb.) tarafından çağrılır; kart listesini yeniler ve isteğe bağlı scroll yapar
        (window as any).loadDynamicCards = async (organizasyonId?: number | string) => {
          const win = window as any;
          try {
            win.loadDynamicCardsLoading = true;
            invalidateOrganizasyonKartQueries(queryClient, organizasyonId ?? undefined);
            await Promise.all([
              queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] }),
              queryClient.refetchQueries({ queryKey: ['siparis-kartlar'] }),
            ]);
            if (organizasyonId != null) {
              queryClient.refetchQueries({ queryKey: ['siparis-kartlar', organizasyonId] });
            }
          } finally {
            win.loadDynamicCardsLoading = false;
          }
          // Yeni kart oluştuğunda o karta scroll et (React render sonrası için kısa gecikme)
          if (organizasyonId != null) {
            const scrollToCard = () => {
              const el = document.querySelector(`[data-organizasyon-id="${organizasyonId}"]`) as HTMLElement;
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                const anaKart = el.querySelector('.ana-kart') as HTMLElement;
                if (anaKart && typeof gsap !== 'undefined') {
                  gsap.killTweensOf(anaKart);
                  gsap.set(anaKart, { scale: 1 });
                  const tl = gsap.timeline({ repeat: 1 });
                  tl.to(anaKart, { scale: 0.97, duration: 0.3, ease: 'power2.out' })
                    .to(anaKart, { scale: 1, duration: 0.3, ease: 'power2.in' });
                  tl.eventCallback('onComplete', () => {
                    gsap.set(anaKart, { scale: 1, clearProps: 'scale' });
                  });
                }
                return true;
              }
              return false;
            };
            setTimeout(() => {
              if (!scrollToCard()) {
                setTimeout(() => { scrollToCard(); }, 500);
              }
            }, 350);
          }
        };
      } catch (error) {
        // Legacy API fonksiyonları yüklenirken hata
      }
    };
    
    setupLegacyApiFunctions();
  }, [queryClient]);

  // urunVerileri artık useUrunVerileri hook'u ile yönetiliyor
  // OrderCard ve diğer component'ler window.urunVerileri'den okuyor, hook sadece yükleme için
  useUrunVerileri();
  
  // WhatsApp paylaşım hook'u - tek siparişler için
  
  // Modal states
  const [orderActionModalOpen, setOrderActionModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // ✅ REACT: Modal state'leri
  const [qrScannerModalOpen, setQrScannerModalOpen] = useState(false);
  const [editKartModalOpen, setEditKartModalOpen] = useState(false);
  const [selectedKart, setSelectedKart] = useState<OrganizasyonKart | null>(null);
  const [yeniKartModalOpen, setYeniKartModalOpen] = useState(false);
  const [siparisEditModalOpen, setSiparisEditModalOpen] = useState(false);
  const [selectedOrderForSiparisEdit, setSelectedOrderForSiparisEdit] = useState<Order | null>(null);
  const [yeniMusteriModalOpen, setYeniMusteriModalOpen] = useState(false);
  const [sicakSatisModalOpen, setSicakSatisModalOpen] = useState(false);
  const [teknikDestekModalOpen, setTeknikDestekModalOpen] = useState(false);
  
  // Sipariş işlem modal state'leri
  const [teslimFotoModalOpen, setTeslimFotoModalOpen] = useState(false);
  const [imzaModalOpen, setImzaModalOpen] = useState(false);
  const [arsivSebepModalOpen, setArsivSebepModalOpen] = useState(false);
  const [arsivSebepModalTip, setArsivSebepModalTip] = useState<'siparis' | 'organizasyon'>('siparis');
  const [whatsAppQRModalOpen, setWhatsAppQRModalOpen] = useState(false);
  const [pendingWhatsAppMessage, setPendingWhatsAppMessage] = useState<{
    order: Order;
    organizasyonKart: OrganizasyonKart;
    teslimKisi: string;
    teslimTuru: 'kendisi' | 'baskasi';
    siparisTeslimKisisiBaskasi?: string;
    fotoPath?: string;
  } | null>(null);
  /** Teslim Edildi tıklandı ama WhatsApp bağlı değildi – önce QR açıldı; bağlanınca bu sipariş için akış devam eder */
  const [pendingTeslimFlow, setPendingTeslimFlow] = useState<{ order: Order } | null>(null);
  /** Whatsapp listesi paylaş tıklandı ama bağlı değildi – bağlanınca paylaşım devam eder */
  const [pendingWhatsAppShare, setPendingWhatsAppShare] = useState<{ kart: OrganizasyonKart; siparisler: Order[] } | null>(null);
  /** Tümünü teslim et tıklandı ama WhatsApp bağlı değildi – bağlanınca bu kart için akış devam eder */
  const [pendingTumunuTeslimEtKartId, setPendingTumunuTeslimEtKartId] = useState<number | null>(null);
  
  // Teslim işlemi için geçici state'ler
  const [teslimEdilecekSiparis, setTeslimEdilecekSiparis] = useState<Order | null>(null);
  const [teslimEdilecekOrganizasyon, setTeslimEdilecekOrganizasyon] = useState<OrganizasyonKart | null>(null);
  /** Menüden "Kartı arşivle" tıklandığında kartId – find bazen bulamayabiliyor, onConfirm'te bu id kullanılır */
  const [organizasyonArsivlenecekId, setOrganizasyonArsivlenecekId] = useState<number | null>(null);
  
  // Context menu state
  const [contextMenuState, setContextMenuState] = useState<{
    open: boolean;
    position: { x: number; y: number };
    order: Order | null;
    sourceKart: OrganizasyonKart | null;
  }>({
    open: false,
    position: { x: 0, y: 0 },
    order: null,
    sourceKart: null,
  });

  // Hafta seçimi
  const { weekDates, selectedWeek, setSelectedWeek } = useWeekDates();
  
  // ✅ REACT: Seçili gün state'i (gün tıklama filtrelemesi için)
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // ✅ KRİTİK: navigateWeek fonksiyonu için React state callback'ini tanımla
  // navigateWeek çağrıldığında bu callback ile React state güncellenir
  React.useEffect(() => {
    (window as any).__REACT_WEEK_CHANGE_CALLBACK__ = (newWeek: string) => {
      // ✅ DÜZELTME: Gereksiz log mesajı kaldırıldı
      setSelectedWeek(newWeek);
    };
    
    return () => {
      delete (window as any).__REACT_WEEK_CHANGE_CALLBACK__;
    };
  }, [setSelectedWeek]);

  // ✅ KRİTİK: React state'i window'a ekle (getSelectedWeekDays için)
  React.useEffect(() => {
    if (selectedWeek) {
      (window as any).__REACT_SELECTED_WEEK__ = selectedWeek;
    }
    
    return () => {
      // Cleanup - sadece unmount'ta temizle
      if ((window as any).__REACT_SELECTED_WEEK__ === selectedWeek) {
        delete (window as any).__REACT_SELECTED_WEEK__;
      }
    };
  }, [selectedWeek]);

  // Organizasyon kartlarını getir (selectedWeek'e göre)
  // ✅ DÜZELTME: selectedWeek parametresini kaldırdık - backend'den her zaman tüm kartları çek
  const {
    data: kartlar,
    isLoading: kartlarLoading,
    isFetching: kartlarFetching,
    error: kartlarError,
  } = useOrganizasyonKartlari(); // selectedWeek kaldırıldı - tüm kartları çek, frontend'de filtrele

  // Seçili haftanın tarih stringleri (bağlantılı sipariş ve hafta filtresi için)
  const weekDateStrings = React.useMemo(() => {
    if (!selectedWeek || weekDates.length === 0) return [];
    return weekDates.map(wd => wd.dateString);
  }, [selectedWeek, weekDates]);

  // Sadece mevcut haftaki organizasyon kartları (bağlantılı sipariş sayısı bu haftayla sınırlı olsun)
  const mevcutHaftaKartlari = React.useMemo(() => {
    if (!kartlar || !selectedWeek || weekDateStrings.length === 0) return [];
    return kartlar.filter((kart) => {
      if (!kart.teslim_tarih) return false;
      try {
        let kartTarih: Date;
        if (kart.teslim_tarih && typeof kart.teslim_tarih === 'object' && 'getTime' in kart.teslim_tarih) {
          kartTarih = kart.teslim_tarih as Date;
        } else if (typeof kart.teslim_tarih === 'string') {
          kartTarih = new Date(kart.teslim_tarih);
          if (isNaN(kartTarih.getTime())) {
            const parts = kart.teslim_tarih.split('-');
            if (parts.length === 3) {
              kartTarih = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            } else return false;
          }
        } else return false;
        const kartTarihString = `${kartTarih.getFullYear()}-${String(kartTarih.getMonth() + 1).padStart(2, '0')}-${String(kartTarih.getDate()).padStart(2, '0')}`;
        return weekDateStrings.includes(kartTarihString);
      } catch {
        return false;
      }
    });
  }, [kartlar, selectedWeek, weekDateStrings]);

  // Bağlantılı siparişleri hesapla (sadece mevcut haftaki kartlara göre)
  const baglantiliSiparislerMap = useBaglantiliSiparisler(mevcutHaftaKartlari, selectedWeek);
  
  // Export hook'u - kartlar ve selectedWeek parametreleri ile
  const { handlePrint, handleExcelExport, handlePrintKunye } = useExport();
  
  // ✅ DÜZELTME: Sayfa yüklendiğinde cache'i temizle ve tüm kartları yeniden çek
  React.useEffect(() => {
    invalidateOrganizasyonKartQueries(queryClient);
    queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] });
    queryClient.refetchQueries({ queryKey: ['siparis-kartlar'] });
  }, []); // Sadece mount'ta çalış

  // ✅ REACT: Kartlar render edildikten sonra ürün yazısı mevcut butonlarını kontrol et
  React.useEffect(() => {
    if (!kartlarLoading && kartlar && kartlar.length > 0) {
      // DOM güncellemesinden sonra kontrol et
      requestAnimationFrame(() => {
        // Tüm sipariş kartlarındaki urun-yazisi-mevcut alanlarını kontrol et
        const urunYazisiMevcutElements = document.querySelectorAll('.urun-yazisi-mevcut:not([data-checked])');
        if (urunYazisiMevcutElements.length > 0) {
          // Her bir element için dosya kontrolü yap
          urunYazisiMevcutElements.forEach((element) => {
            const musteriId = element.getAttribute('data-musteri-id');
            if (!musteriId) {
              (element as HTMLElement).style.display = 'none';
              return;
            }
            
            // İşaretle ki tekrar kontrol edilmesin
            element.setAttribute('data-checked', 'true');
            
            // Dosya kontrolü yap
            const checkFiles = async () => {
              try {
                const { apiRequest } = await import('../../../lib/api');
                const result = await apiRequest<unknown>(`/customers/${musteriId}/urun-yazi-dosyalari`, { method: 'GET' });
                const files = Array.isArray(result) ? result : (result && typeof result === 'object' && (result as any).data != null) ? (Array.isArray((result as any).data) ? (result as any).data : []) : [];
                if (files && files.length > 0) {
                  (element as HTMLElement).style.display = 'flex';
                } else {
                  (element as HTMLElement).style.display = 'none';
                }
              } catch (error) {
                (element as HTMLElement).style.display = 'none';
              }
            };
            
            checkFiles();
          });
        }
      });
    }
  }, [kartlar, kartlarLoading]);

  // Tab ve hafta filtreleme (weekDateStrings yukarıda tanımlı – bağlantılı sipariş için)
  // ✅ REACT: Tarihi görüntü formatına çevir: "09 Şubat 2026 Pazartesi"
  const formatDateToDisplay = React.useCallback((date: Date): string => {
    try {
      const day = date.getDate();
      const monthNames = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
      ];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
      const dayName = dayNames[date.getDay()];
      
      return `${day} ${month} ${year} ${dayName}`;
    } catch (error) {
      return '';
    }
  }, []);

  const filteredKartlar = React.useMemo(() => {
    if (!kartlar) return undefined;
    
    // ✅ KRİTİK: Önce selectedWeek'e göre filtrele
    let weekFilteredKartlar = kartlar;
    // ✅ DÜZELTME: selectedWeek varsa ve weekDateStrings varsa filtrele, yoksa TÜM kartları göster
    if (selectedWeek && weekDateStrings.length > 0) {
      weekFilteredKartlar = kartlar.filter((kart) => {
        if (!kart.teslim_tarih) return false;
        
        try {
          // ✅ KRİTİK: Tarihi parse et - backend'den gelen formatı kontrol et
          let kartTarih: Date;
          
          // Eğer zaten Date objesi ise direkt kullan
          if (kart.teslim_tarih && typeof kart.teslim_tarih === 'object' && 'getTime' in kart.teslim_tarih) {
            kartTarih = kart.teslim_tarih as Date;
          } 
          // Eğer string ise parse et
          else if (typeof kart.teslim_tarih === 'string') {
            // Backend'den gelen format: "2026-02-23" veya "2026-02-23T00:00:00.000Z"
            // Önce direkt parse dene
            kartTarih = new Date(kart.teslim_tarih);
            
            // Eğer parse başarısız olduysa veya geçersiz tarih ise, string'i manuel parse et
            if (isNaN(kartTarih.getTime())) {
              // YYYY-MM-DD formatını manuel parse et
              const parts = kart.teslim_tarih.split('-');
              if (parts.length === 3) {
                const year = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1; // Month 0-indexed
                const day = parseInt(parts[2], 10);
                kartTarih = new Date(year, month, day);
              } else {
                return false; // Geçersiz format
              }
            }
          } else {
            return false; // Geçersiz tip
          }
          
          if (isNaN(kartTarih.getTime())) return false; // Geçersiz tarih
          
          // Tarihi YYYY-MM-DD formatına çevir
          const kartTarihString = `${kartTarih.getFullYear()}-${String(kartTarih.getMonth() + 1).padStart(2, '0')}-${String(kartTarih.getDate()).padStart(2, '0')}`;
          
          // ✅ REACT: Eğer selectedDay varsa, sadece o günü göster
          if (selectedDay) {
            // ✅ DÜZELTME: selectedDay formatı YYYY-MM-DD (dateString)
            // Kart tarihini YYYY-MM-DD formatına çevir ve karşılaştır
            const kartTarihString = `${kartTarih.getFullYear()}-${String(kartTarih.getMonth() + 1).padStart(2, '0')}-${String(kartTarih.getDate()).padStart(2, '0')}`;
            return kartTarihString === selectedDay;
          }
          
          // ✅ KRİTİK: Seçili haftanın günlerini kontrol et
          // weekDateStrings seçili haftanın 7 gününü içeriyor (YYYY-MM-DD formatında)
          const isInWeek = weekDateStrings.includes(kartTarihString);
          
          return isInWeek;
        } catch (error) {
          return false;
        }
      });
    }
    
    // Sonra tab'e göre filtrele
    let finalKartlar;
    if (activeTab === 'all') {
      finalKartlar = weekFilteredKartlar;
    } else {
      finalKartlar = weekFilteredKartlar.filter((kart) => {
        switch (activeTab) {
          case 'organizasyon':
            return kart.kart_tur === 'organizasyon';
          case 'aracsusleme':
            return kart.kart_tur === 'aracsusleme';
          case 'ozelgun':
            return kart.kart_tur === 'ozelgun';
          case 'ozelsiparis':
            return kart.kart_tur === 'ozelsiparis';
          case 'ciceksepeti':
            return kart.kart_tur === 'ciceksepeti';
          default:
            return false;
        }
      });
    }
    
    // ✅ REACT: Arama – org/sipariş kartlarındaki TÜM bilgiler; kelime kelime eşleşme (Ahmet / YILMAZ ayrı ayrı bulur)
    if (searchQuery && searchQuery.trim().length > 0) {
      const searchText = searchQuery.toLocaleLowerCase('tr-TR').trim();
      const words = searchText.split(/\s+/).filter(Boolean);
      const toStr = (v: unknown) => (v != null && v !== '' ? String(v).toLocaleLowerCase('tr-TR') : '');
      const matchAllWords = (s: string) => words.length > 0 && words.every((w) => s.includes(w));

      const allValuesToSearchString = (obj: unknown, depth = 0): string => {
          if (depth > 3) return '';
          if (obj == null) return '';
          if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') return toStr(obj);
          if (Array.isArray(obj)) return obj.map((item) => allValuesToSearchString(item, depth + 1)).join(' ');
          if (typeof obj === 'object') {
            return Object.values(obj)
              .map((v) => allValuesToSearchString(v, depth + 1))
              .join(' ');
          }
          return '';
        };

      return finalKartlar.filter((kart) => {
        // Önce organizasyon kartının kendi alanlarında ara
        const kartSearchable = allValuesToSearchString(kart);
        if (matchAllWords(kartSearchable)) return true;

        // ✅ KRİTİK: Siparişlerde ara – hem kart.siparisler hem de React Query cache'inde tutulan siparis-kartlar verilerini kullan
        // Böylece organizasyon kartı içinde listelenen TÜM siparişlerde (müşteri adı, unvan, notlar vb.) arama yapılır.

        // 1) Kart objesinin içindeki siparisler (varsa)
        const siparislerFromKart = Array.isArray(kart.siparisler) ? kart.siparisler : [];

        // 2) React Query cache'inden bu karta ait siparişler
        const cachedSiparisler = queryClient.getQueryData<any[]>(['siparis-kartlar', kart.id]);
        const siparislerFromCache = Array.isArray(cachedSiparisler) ? cachedSiparisler : [];

        // 3) Hepsini tek listede birleştir (aynı sipariş iki kez gelse bile arama açısından sorun olmaz)
        const tumSiparisler = [...siparislerFromKart, ...siparislerFromCache];

        const siparislerMatch = tumSiparisler.some((siparis) => {
          const raw = (siparis as any)._raw || {};
          const searchable = [allValuesToSearchString(siparis), allValuesToSearchString(raw)]
            .filter(Boolean)
            .join(' ');
          return matchAllWords(searchable);
        });

        return siparislerMatch === true;
      });
    }
    
    return finalKartlar;
  }, [kartlar, activeTab, selectedWeek, weekDateStrings, selectedDay, formatDateToDisplay, searchQuery, queryClient]);
  
  // ✅ REACT: Teslim saati uyarıları artık her component'te useDeliveryTimeWarning hook'u ile yapılıyor
  
  // Filtre sayılarını hesapla
  const filterCounts = useFilterCounts(kartlar ?? undefined, selectedWeek);
  
  // ✅ KRİTİK: Hafta değiştiğinde veya ilk yüklemede bugünün gününü otomatik seç
  // Sadece hafta değiştiğinde çalışmalı, kullanıcı başka güne tıkladığında çalışmamalı
  const prevSelectedWeekRef = React.useRef<string | null>(null);
  const userSelectedDayRef = React.useRef<string | null>(null); // Kullanıcı manuel seçim yaptı mı?
  
  React.useEffect(() => {
    if (weekDates.length > 0 && selectedWeek !== prevSelectedWeekRef.current) {
      prevSelectedWeekRef.current = selectedWeek;
      
      // ✅ KRİTİK: Hafta değiştiğinde selectedDay'i temizle - TÜM HAFTAYI GÖSTER
      // Hafta değiştiğinde her zaman tüm haftayı göster
      userSelectedDayRef.current = null;
      setSelectedDay(null); // Tüm haftayı göster
    }
  }, [selectedWeek, weekDates]); // Sadece hafta değiştiğinde çalışır
  
  // ✅ KRİTİK: Gün tıklama handler'ı - kullanıcı manuel seçim yaptığında işaretle
  const handleDayClick = (dateString: string) => {
    // ✅ DÜZELTME: Boş string ise null yap (tüm haftayı göster)
    if (!dateString || dateString === '') {
      userSelectedDayRef.current = null;
      setSelectedDay(null);
    } else {
      userSelectedDayRef.current = dateString; // Kullanıcı manuel seçim yaptı
      setSelectedDay(dateString);
    }
  };
  
  
  // ✅ KRİTİK: Hafta değişikliği handler'ı
  // ✅ DÜZELTME: setActiveTab kaldırıldı - component unmount'a neden oluyordu!
  const handleWeekChange = React.useCallback((newWeek: string) => {
    userSelectedDayRef.current = null;
    setSelectedWeek(newWeek);
  }, [setSelectedWeek]);

  // Bağlantılı siparişler tooltip'lerini güncelle (eski HTML'deki gibi)
  useEffect(() => {
  // ✅ REACT: Bağlantılı siparişler artık useBaglantiliSiparisler hook'u ile hesaplanıyor
  // Bu useEffect kaldırıldı - artık gerekli değil
}, [filteredKartlar]); // filteredKartlar değiştiğinde tekrar çağır

  // ✅ REACT: İstatistikler artık useDashboardStatistics hook'u ile hesaplanıyor (RightPanel'de)
  // Bu useEffect kaldırıldı - artık gerekli değil

  // ✅ REACT: Hafta eşleştirme artık filteredKartlar useMemo'sunda yapılıyor
  // Bu useEffect kaldırıldı - artık gerekli değil

  // ✅ REACT: Tab sayıları artık filterCounts hook'undan geliyor

  // Tarih aralığı metni (Pazartesi → Pazar) - RightPanel'deki hafta seçimi için
  const dateRangeText = React.useMemo(() => {
    if (weekDates.length === 0) return undefined;
    const first = weekDates[0]; // Pazartesi
    const last = weekDates[weekDates.length - 1]; // Pazar
    
    // Format: "09 Şubat 2026 Pazartesi → 15 Şubat 2026 Pazar"
    return `${first.displayDate} → ${last.displayDate}`;
  }, [weekDates]);

  // Context menu handler (mevcutHaftaKartlari yukarıda tanımlı – bağlantılı sipariş ile aynı)
  const handleOrderContextMenu = (event: React.MouseEvent, order: Order) => {
    // Kaynak organizasyon kartını bul
    const sourceKart = kartlar?.find((k) => k.id === order.organizasyon_id);
    if (!sourceKart) return;

    // ✅ ESKİ SİSTEM GİBİ: pageX ve pageY kullan (scroll pozisyonunu da içerir)
    setContextMenuState({
      open: true,
      position: { x: event.pageX, y: event.pageY },
      order,
      sourceKart,
    });
  };

  // Sipariş taşıma handler
  const handleMoveOrder = async (orderId: number, targetKartId: number) => {
    try {
      const { tasiSiparis, updateKartSira } = await import('../api/siparisActions');
      
      // ✅ ESKİ SİSTEM GİBİ: Kaynak organizasyon kartını bul (taşıma öncesi)
      // Context menu'dan gelen order bilgisini kullan
      const contextOrder = contextMenuState.order;
      const sourceKartId = contextOrder?.organizasyon_id || null;
      
      await tasiSiparis(orderId, targetKartId);
      
      // ✅ Başarılı - apiRequest zaten success: false durumunda hata fırlatıyor
      showToast('success', 'Sipariş başarıyla taşındı');
      
      // ✅ Refresh data - hem eski hem yeni organizasyon kartlarının siparişlerini güncelle + diğer sekmelere broadcast
      invalidateOrganizasyonKartQueries(queryClient);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] }),
        queryClient.refetchQueries({ queryKey: ['siparis-kartlar'] }),
      ]);

      // ✅ ESKİ SİSTEM GİBİ: Taşıma sonrası TÜM organizasyon kartlarındaki kart sıra numaralarını güncelle
      // setupKartSirasi() fonksiyonu gibi - hem kaynak hem hedef organizasyon kartlarındaki siparişlerin kart_sira'sını güncelle
      // ESKİ SİSTEM: DOM'dan alıyor, yani UI'daki görünüm sırasına göre numaralandırıyor
      // React Query refetch tamamlandıktan sonra DOM'dan al (DOM güncellenmiş olmalı)
      setTimeout(async () => {
        try {
          const { updateKartSira } = await import('../api/siparisActions');
          
          // ✅ ESKİ SİSTEM GİBİ: Her organizasyon kartı için ayrı ayrı güncelle
          const kartlarToUpdate = [targetKartId];
          if (sourceKartId && sourceKartId !== targetKartId) {
            kartlarToUpdate.push(sourceKartId);
          }

          for (const kartId of kartlarToUpdate) {
            try {
              // ✅ ESKİ SİSTEM GİBİ: DOM'dan sipariş kartlarını al
              // Eski sistemde: const kartAlanlari = document.querySelectorAll('.sk-kart-alan');
              // Her kartAlani için: const kartlar = kartAlani.querySelectorAll('.siparis-kart');
              const organizasyonKart = document.querySelector(`[data-organizasyon-id="${kartId}"]`) as HTMLElement;
              if (!organizasyonKart) {
                console.warn(`⚠️ Organizasyon kartı bulunamadı: ${kartId}`);
                continue;
              }

              // ✅ ESKİ SİSTEM GİBİ: .order-list-container veya .sk-kart-alan içindeki .siparis-kart elementlerini al
              // Eski sistemde: const kartAlani = ...; const kartlar = kartAlani.querySelectorAll('.siparis-kart');
              const kartAlani = organizasyonKart.querySelector('.order-list-container') || organizasyonKart.querySelector('.sk-kart-alan');
              if (!kartAlani) {
                console.warn(`⚠️ Kart alanı bulunamadı: ${kartId}`);
                continue;
              }

              // ✅ ESKİ SİSTEM GİBİ: DOM sırasına göre sipariş kartlarını al
              // querySelectorAll DOM sırasına göre döner, yani UI'daki görünüm sırasına göre
              const siparisKartlari = Array.from(kartAlani.querySelectorAll('.siparis-kart')) as HTMLElement[];
              
              if (siparisKartlari.length === 0) {
                continue; // Boş organizasyon kartı, atla
              }

              const siparisUpdates: Array<{ siparis_id: string | number; kart_sira: number }> = [];
              
              // ✅ ESKİ SİSTEM GİBİ: DOM sırasına göre 1'den başlayarak numaralandır
              // Eski sistemde: kartlar.forEach((kart, index) => { const newKartSira = index + 1; })
              siparisKartlari.forEach((kart, index) => {
                const orderId = kart.getAttribute('data-order-id');
                if (!orderId) {
                  console.warn('⚠️ Sipariş ID bulunamadı:', kart);
                  return;
                }

                // CS- prefix'li siparişler (Çiçek Sepeti) için kart-sıra güncellemesi yapma
                if (orderId.startsWith('CS-')) {
                  return; // Backend'e gönderme
                }

                // ✅ ESKİ SİSTEM GİBİ: Her zaman 1'den başlayarak numaralandır
                // index 0 -> kart_sira 1
                // index 1 -> kart_sira 2
                // index 2 -> kart_sira 3
                // ...
                const newKartSira = index + 1;
                
                // Mevcut kart-sıra numarasını kontrol et (DOM'dan)
                const currentKartSira = parseInt(kart.getAttribute('data-kart-sira') || '0', 10) || 0;
                
                // Sadece değişmişse ekle
                if (currentKartSira !== newKartSira) {
                  // Order ID formatını parse et
                  let parsedOrderId: string | number = orderId;
                  if (typeof orderId === 'string' && orderId.startsWith('ORD-')) {
                    parsedOrderId = orderId.replace('ORD-', '');
                  }
                  const orderIdNum = typeof parsedOrderId === 'string' ? parseInt(parsedOrderId, 10) : parsedOrderId;
                  if (isNaN(orderIdNum)) return;

                  siparisUpdates.push({
                    siparis_id: orderIdNum,
                    kart_sira: newKartSira,
                  });
                }
              });

              // ✅ ESKİ SİSTEM GİBİ: Eğer kart-sıra değişikliği varsa backend'e gönder
              if (siparisUpdates.length > 0) {
                console.log(`✅ Kart sıra güncelleme (${kartId === targetKartId ? 'hedef' : 'kaynak'}):`, { kartId, siparisUpdates });
                await updateKartSira(kartId, siparisUpdates);
                invalidateOrganizasyonKartQueries(queryClient, kartId);
                queryClient.refetchQueries({ queryKey: ['siparis-kartlar', kartId] });
              }
            } catch (error) {
              console.error(`❌ Kart sıra güncelleme hatası (kart ${kartId}):`, error);
              // Bir kart için hata olsa bile diğer kartı güncellemeye devam et
            }
          }
        } catch (error) {
          console.error('❌ Kart sıra güncelleme hatası:', error);
          // Sessizce devam et - kart sıra güncelleme kritik değil
        }
      }, 1000); // React Query refetch tamamlanması için biraz daha uzun bekle

      // ✅ GSAP İLE BASİT PULSE: Taşınan organizasyon kartına scroll yap ve hafif yanıp sön
      setTimeout(() => {
        const targetKart = document.querySelector(`[data-organizasyon-id="${targetKartId}"]`) as HTMLElement;
        if (targetKart) {
          // Smooth scroll ile karta odaklan
          targetKart.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
          });
          
          // GSAP ile basit pulse efekti - sadece küçülüp normale dön
          const anaKart = targetKart.querySelector('.ana-kart') as HTMLElement;
          if (anaKart) {
            // Önce mevcut animasyonları temizle
            gsap.killTweensOf(anaKart);
            
            // Başlangıç durumunu ayarla
            gsap.set(anaKart, { scale: 1 });
            
            // Basit pulse: küçül → normal (2 kere)
            const tl = gsap.timeline({ repeat: 1 });
            
            tl.to(anaKart, {
              scale: 0.97,
              duration: 0.3,
              ease: 'power2.out',
            })
            .to(anaKart, {
              scale: 1,
              duration: 0.3,
              ease: 'power2.in',
            });
            
            // Animasyon bittikten sonra temizle
            tl.eventCallback('onComplete', () => {
              gsap.set(anaKart, {
                scale: 1,
                clearProps: 'scale',
              });
            });
          }
        } else {
          console.warn('⚠️ Taşınan organizasyon kartı bulunamadı:', targetKartId);
          // Birkaç saniye sonra tekrar dene (kartlar henüz render olmamış olabilir)
          setTimeout(() => {
            const retryElement = document.querySelector(`[data-organizasyon-id="${targetKartId}"]`) as HTMLElement;
            if (retryElement) {
              retryElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'nearest'
              });
              const anaKart = retryElement.querySelector('.ana-kart') as HTMLElement;
              if (anaKart) {
                // GSAP animasyonu
                gsap.killTweensOf(anaKart);
                gsap.set(anaKart, { scale: 1 });
                
                const tl = gsap.timeline({ repeat: 1 });
                tl.to(anaKart, {
                  scale: 0.97,
                  duration: 0.3,
                  ease: 'power2.out',
                })
                .to(anaKart, {
                  scale: 1,
                  duration: 0.3,
                  ease: 'power2.in',
                });
                
                tl.eventCallback('onComplete', () => {
                  gsap.set(anaKart, {
                    scale: 1,
                    clearProps: 'scale',
                  });
                });
              }
            }
          }, 1000);
        }
      }, 100);
    } catch (error: any) {
      console.error('❌ Sipariş taşıma hatası:', error);
      
      // ApiError'dan mesaj al
      let errorMessage = 'Sipariş taşınırken bir hata oluştu.';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      showToast('error', errorMessage);
    }
  };

  // Order action handler
  const handleOrderAction = async (action: string, order: Order) => {
    switch (action) {
      case 'view':
        // Navigate to order detail page
        navigate(`/siparis-kart-detay/${order.id}`);
        break;
      case 'edit':
        // Sipariş düzenleme modalını aç
        setSelectedOrderForSiparisEdit(order);
        setSiparisEditModalOpen(true);
        break;
      case 'yeni-siparis':
        // Yeni sipariş ekleme modalını aç - React modal kullan
        // Organizasyon kartını bul
        const organizasyonKart = kartlar?.find((k) => k.id === order.organizasyon_id);
        if (!organizasyonKart) {
          console.error('❌ Organizasyon kartı bulunamadı');
          showToast('error', 'Organizasyon kartı bulunamadı');
          return;
        }

        // Yeni sipariş için boş order objesi oluştur
        const newOrder: Order = {
          id: 0, // Yeni sipariş için 0
          organizasyon_id: organizasyonKart.id,
          musteriAdi: '',
          telefon: '',
          urun: '',
          tutar: 0,
          durum: 'bekliyor',
          tarih: new Date().toISOString().split('T')[0],
          teslimSaati: '',
        };

        setSelectedOrderForSiparisEdit(newOrder);
        setSiparisEditModalOpen(true);
        break;
      case 'deliver': {
        // Başlangıç planında WhatsApp yok; doğrudan onay dialoguna git
        if (isBaslangicPlan !== true) {
          let isWhatsAppConnected = false;
          let statusConnecting = false;
          try {
            const statusResponse = await apiClient.get('/whatsapp/status');
            const whatsAppStatus = statusResponse.data;
            isWhatsAppConnected = !!(whatsAppStatus?.installed && whatsAppStatus?.isReady && whatsAppStatus?.isAuthenticated && whatsAppStatus?.lastDisconnectReason !== 'LOGOUT');
            statusConnecting = whatsAppStatus?.status === 'connecting';
          } catch (_) {}
          if (!isWhatsAppConnected) {
            if (statusConnecting) {
              showToast('info', 'Bağlantı yeniden kuruluyor… Lütfen birkaç saniye bekleyip tekrar deneyin.');
              break;
            }
            setPendingTeslimFlow({ order });
            setWhatsAppQRModalOpen(true);
            break;
          }
        }
        const { showToastInteractive } = await import('../../../shared/utils/toastUtils');
        const isAracSusleme = (order as any).organizasyonKartTur === 'aracsusleme';
        showToastInteractive({
          title: isAracSusleme ? 'Araç Süsleme Tamamlandı' : 'Sipariş Teslim Et',
          message: isAracSusleme
            ? 'Bu siparişi tamamlandı olarak işaretlemek istediğinize emin misiniz?'
            : 'Bu siparişi teslim edildi olarak işaretlemek istediğinize emin misiniz?',
          confirmText: isAracSusleme ? 'Evet, tamamlandı' : 'Evet, teslim edildi',
          cancelText: 'İptal',
          onConfirm: async () => {
            await startDeliverFlow(order);
          },
        });
        break;
      }
      case 'call':
        if (order.telefon) {
          window.location.href = `tel:${order.telefon}`;
        }
        break;
      case 'navigate': {
        const orderData = (order as any)._raw || order;
        const address = buildAddressForMapsQuery(orderData as Record<string, unknown>);
        if (address) {
          window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
        }
        break;
      }
      case 'archive':
        // Arşivleme işlemi başlat - ArsivSebepModal aç
        setTeslimEdilecekSiparis(order);
        setArsivSebepModalTip('siparis');
        setOrderActionModalOpen(false); // OrderActionModal'ı kapat
        setArsivSebepModalOpen(true); // ArsivSebepModal'ı aç
        break;
      default:
    }
  };

  /** Tümünü teslim et: API ile teslim + WhatsApp (index ve detay sayfası aynı mantık). */
  const deliverAllOrdersInKart = async (kartId: number): Promise<{ success: boolean; message: string; basarili: number; basarisiz: number }> => {
    const orgKart = kartlar?.find((k) => k.id === kartId);
    if (!orgKart) {
      return { success: false, message: 'Organizasyon kartı bulunamadı', basarili: 0, basarisiz: 0 };
    }
    return apiDeliverAllOrdersInKart(kartId, orgKart, { sendWhatsApp: isBaslangicPlan !== true });
  };

  const showTumunuTeslimEtConfirm = async (kartId: number) => {
    const { showToastInteractive } = await import('../../../shared/utils/toastUtils');
    showToastInteractive({
      title: 'Tüm Siparişleri Teslim Et',
      message: 'Bu organizasyon kartındaki tüm siparişleri teslim edildi olarak işaretlemek istediğinize emin misiniz? WhatsApp mesajları gönderilecektir.',
      confirmText: 'Evet, tümünü teslim et',
      cancelText: 'İptal',
      onConfirm: async () => {
        try {
          const result = await deliverAllOrdersInKart(kartId);
          if (result.basarili > 0 || result.basarisiz === 0) {
            showToast('success', result.message || 'Tüm siparişler teslim edildi');
            invalidateOrganizasyonKartQueries(queryClient, kartId);
            queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] });
            queryClient.refetchQueries({ queryKey: ['siparis-kartlar', kartId] });
          }
          if (result.basarisiz > 0) {
            showToast('warning', result.message);
          }
          if (result.basarili === 0 && result.basarisiz > 0) {
            showToast('error', result.message || 'Tümünü teslim et işlemi başarısız');
          }
        } catch (error: any) {
          console.error('Tümünü teslim et hatası:', error);
          showToast('error', error?.message || 'Tümünü teslim et işlemi başarısız');
        }
      },
    });
  };

  // Kart action handler
  const handleKartAction = async (action: string, kartId: number) => {
    switch (action) {
      case 'duzenle':
        // Kart düzenle modalı aç
        const kart = kartlar?.find((k) => k.id === kartId);
        if (kart) {
          setSelectedKart(kart);
          setEditKartModalOpen(true);
        } else {
          // Eğer kart bulunamazsa, backend'den detayını çek
          import('../api/kartActions').then(({ getOrganizasyonKartDetay }) => {
            getOrganizasyonKartDetay(kartId).then((kartDetay) => {
              if (kartDetay) {
                setSelectedKart(kartDetay);
                setEditKartModalOpen(true);
              } else {
                showToast('warning', 'Kart bulunamadı.');
              }
            });
          });
        }
        break;
      case 'tumunu-teslim-et': {
        // Tümünü teslim et işlemi
        const tumunuTeslimKart = kartlar?.find((k) => k.id === kartId);
        if (!tumunuTeslimKart) {
          showToast('error', 'Organizasyon kartı bulunamadı');
          return;
        }

        // Başlangıç planında WhatsApp entegrasyonu yok; doğrudan onay dialoguna git
        if (isBaslangicPlan !== true) {
          let isWhatsAppConnected = false;
          let statusConnecting = false;
          try {
            const statusResponse = await apiClient.get('/whatsapp/status');
            const whatsAppStatus = statusResponse.data;
            isWhatsAppConnected = !!(whatsAppStatus?.installed && whatsAppStatus?.isReady && whatsAppStatus?.isAuthenticated && whatsAppStatus?.lastDisconnectReason !== 'LOGOUT');
            statusConnecting = whatsAppStatus?.status === 'connecting';
          } catch (_) {}

          if (!isWhatsAppConnected) {
            if (statusConnecting) {
              showToast('info', 'Bağlantı yeniden kuruluyor… Lütfen birkaç saniye bekleyip tekrar deneyin.');
              break;
            }
            setPendingTumunuTeslimEtKartId(kartId);
            setWhatsAppQRModalOpen(true);
            break;
          }
        }

        await showTumunuTeslimEtConfirm(kartId);
        break;
      }
      case 'arsivle':
        // Organizasyon kartı arşivleme işlemi başlat - ArsivSebepModal aç (kartId her zaman saklanır, onConfirm'te kullanılır)
        const arsivleKart = kartlar?.find((k) => k.id === kartId);
        setTeslimEdilecekOrganizasyon(arsivleKart ?? null);
        setOrganizasyonArsivlenecekId(kartId);
        setArsivSebepModalTip('organizasyon');
        setArsivSebepModalOpen(true);
        break;
      case 'teslim-foto-ekle':
        // ✅ ESKİ SİSTEM: Direkt #fotoInput'a tıklat (modal YOK!)
        // Bu case artık kullanılmıyor - OrganizasyonKart component'inde direkt input.click() yapılıyor
        break;
      case 'yazdir':
        // React utility kullan
        const kartForKunye = kartlar?.find(k => k.id === kartId);
        if (kartForKunye) {
          handlePrintKunye(kartForKunye);
        } else {
          showToast('error', 'Kart bulunamadı!');
        }
        break;
      case 'whatsapp':
        // WhatsApp paylaşımı - OrganizasyonKart component'i içinde handleMenuAction ile yönetiliyor
        // Bu case'e gerek yok, çünkü OrganizasyonKart içinde useWhatsAppShare hook'u kullanılıyor
        break;
      case 'sort-alfabetik':
      case 'sort-tur':
        // Client-side sıralama - OrganizasyonKart component'inde yapılıyor
        // Backend çağrısı yok, sadece component state'i güncelleniyor
        break;
      default:
    }
  };

  // QR scan handler
  // QR Scanner Modal açma
  const handleOpenQRScanner = () => {
    setQrScannerModalOpen(true);
  };

  // QR Scanner'dan sipariş bulunduğunda
  const handleQRScanSuccess = (order: Order) => {
    setSelectedOrder(order);
    setQrScannerModalOpen(false);
    setOrderActionModalOpen(true);
  };

  // QR Scanner hata durumu
  const handleQRScanError = (_error: string) => {
    // Hata zaten modal içinde gösteriliyor
  };

  // WhatsApp mesajı gönder (teslim edildi mesajı) – Başlangıç planında erişim yok
  const handleTeslimEdildiWhatsApp = async (
    order: Order,
    organizasyonKart: OrganizasyonKart,
    teslimKisi: string,
    teslimTuru: 'kendisi' | 'baskasi',
    siparisTeslimKisisiBaskasi?: string,
    fotoPath?: string
  ) => {
    if (isBaslangicPlan === true) return; // WhatsApp özelliği Başlangıç planında kapalı
    try {
      // Önce WhatsApp bağlantı durumunu kontrol et
      let whatsAppStatus;
      try {
        const statusResponse = await apiClient.get('/whatsapp/status');
        whatsAppStatus = statusResponse.data;
      } catch {
        // Durum kontrolü başarısız olsa bile devam et (eski davranış)
        whatsAppStatus = null;
      }

      // WhatsApp bağlantı kontrolü
      // ÖNEMLİ: browserSessionActive kontrolünü kaldırdık çünkü WhatsApp Web açıkken de mesaj gönderilebilir
      // Sadece LOGOUT durumunda mesaj gönderilmemeli
      const isWhatsAppConnected = whatsAppStatus?.installed && 
                                  whatsAppStatus?.isReady && 
                                  whatsAppStatus?.isAuthenticated && 
                                  whatsAppStatus?.lastDisconnectReason !== 'LOGOUT';

      // Bağlı değilse, mesajı pending'e kaydet ve QR modal'ı aç
      if (!isWhatsAppConnected) {
        setPendingWhatsAppMessage({
          order,
          organizasyonKart,
          teslimKisi,
          teslimTuru,
          siparisTeslimKisisiBaskasi,
          fotoPath,
        });
        setWhatsAppQRModalOpen(true);
        return;
      }

      // Bağlıysa direkt mesajı gönder
      await sendWhatsAppMessage(order, organizasyonKart, teslimKisi, teslimTuru, siparisTeslimKisisiBaskasi, fotoPath);
    } catch (error: any) {
      console.error('❌ WhatsApp mesaj gönderme hatası:', error);
    }
  };

  // WhatsApp mesajını gönder (internal helper function)
  const sendWhatsAppMessage = async (
    order: Order,
    organizasyonKart: OrganizasyonKart,
    teslimKisi: string,
    _teslimTuru: 'kendisi' | 'baskasi',
    siparisTeslimKisisiBaskasi?: string,
    fotoPath?: string
  ) => {
    try {
      const rawOrderData = (order as any)._raw || order;
      // Özel gün ve özel sipariş için konum bilgileri sipariş kartından alınmalı
      const isOzelType = organizasyonKart.kart_tur === 'ozelgun' || organizasyonKart.kart_tur === 'ozelsiparis';
      
      // Konum bilgileri - özel gün/özel sipariş için sipariş kartından, diğerleri için organizasyon kartından
      const teslimIl = isOzelType ? (order.teslimIl || undefined) : (organizasyonKart.organizasyon_il || undefined);
      const teslimIlce = isOzelType ? (order.teslimIlce || undefined) : (organizasyonKart.organizasyon_ilce || undefined);
      const teslimMahalle = isOzelType ? (order.mahalle || undefined) : (organizasyonKart.mahalle || undefined);
      const teslimAcikAdres = isOzelType ? (order.acikAdres || undefined) : (organizasyonKart.acik_adres || undefined);
      
      // Teslim mesajı için ortak veri (musteri_unvan: sipariş kartı, organizasyon_teslim_kisisi: organizasyon kartı)
      const mesajData = {
        siparisVeren: order.musteriAdi,
        musteriUnvani: order.musteriUnvani,
        musteri_unvan: order.musteriUnvani,
        kartTipi: organizasyonKart.kart_tur,
        kart_tur: organizasyonKart.kart_tur,
        isAracSusleme: organizasyonKart.kart_tur === 'aracsusleme',
        urunAdi: order.urun,
        aracPlaka: order.aracPlaka,
        aracMarkaModel: order.aracMarkaModel,
        teslim_kisisi: teslimKisi,
        siparis_teslim_kisisi_baskasi: siparisTeslimKisisiBaskasi || undefined,
        organizasyon_teslim_kisisi: organizasyonKart.teslim_kisisi || undefined,
        organizasyon_il: organizasyonKart.organizasyon_il || teslimIl,
        teslim_il: teslimIl || organizasyonKart.organizasyon_il,
        organizasyon_ilce: organizasyonKart.organizasyon_ilce || teslimIlce,
        teslim_ilce: teslimIlce || organizasyonKart.organizasyon_ilce,
        mahalle: teslimMahalle || organizasyonKart.mahalle,
        teslim_mahalle: teslimMahalle || organizasyonKart.mahalle,
        organizasyon_mahalle: organizasyonKart.mahalle || teslimMahalle,
        acik_adres: teslimAcikAdres || organizasyonKart.acik_adres,
        teslim_acik_adres: teslimAcikAdres || organizasyonKart.acik_adres,
        organizasyon_acik_adres: organizasyonKart.acik_adres || teslimAcikAdres,
        gercekTeslimAlan: siparisTeslimKisisiBaskasi || teslimKisi,
        teslimKisi: teslimKisi,
      };
      const mesaj = createTeslimEdildiMessage(mesajData);

      // Telefon numarasını al ve formatla
      const telefon = order.telefon || '';
      if (!telefon) {
        console.warn('⚠️ Telefon numarası bulunamadı, WhatsApp mesajı gönderilemedi');
        return;
      }

      // Telefon numarasını formatla (sadece rakamlar)
      const formattedPhone = telefon.replace(/\D/g, '');

      // API'ye gönder
      const apiBase = getApiBaseUrl();
      const token = localStorage.getItem('floovon_token') || localStorage.getItem('token');
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Fotoğraf varsa send-media endpoint'ini kullan, yoksa send endpoint'ini kullan
      if (fotoPath) {
        // Fotoğraf ile mesaj gönder
        const response = await fetch(`${apiBase}/whatsapp/send-media`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            phone: formattedPhone,
            message: mesaj,
            mediaPath: fotoPath,
          }),
        });

        const result = await response.json();
        
        if (!response.ok || !result?.success) {
          if (response.status === 503 || result?.error === 'SERVICE_UNAVAILABLE') {
            console.warn('⚠️ WhatsApp servisi hazır değil, fotoğraf gönderilemedi ama teslim işlemi başarılı');
            return;
          }
          console.error('❌ WhatsApp fotoğraf gönderme hatası:', {
            status: response.status,
            result,
            phone: formattedPhone,
            fotoPath,
          });
          return;
        }

        console.log('✅ WhatsApp fotoğrafı gönderildi:', formattedPhone);
      } else {
        // Sadece mesaj gönder
        const response = await fetch(`${apiBase}/whatsapp/send`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            phone: formattedPhone,
            message: mesaj,
          }),
        });

        const result = await response.json();
        
        if (!response.ok || !result?.success) {
          if (response.status === 503 || result?.error === 'SERVICE_UNAVAILABLE') {
            console.warn('⚠️ WhatsApp servisi hazır değil (QR kod bekleniyor), mesaj gönderilemedi ama teslim işlemi başarılı');
            return;
          }

          console.error('❌ WhatsApp mesaj gönderme hatası:', {
            status: response.status,
            result,
            phone: formattedPhone,
            messageLength: mesaj?.length,
            error: result?.error,
            message: result?.message
          });
          return;
        }

        console.log('✅ WhatsApp mesajı gönderildi:', formattedPhone);
      }

      // Partner siparişi (alınan) ise partner firmaya da teslim mesajı gönder
      const partnerFirmaAdi = (order.partnerFirmaAdi || rawOrderData.partner_firma_adi)?.trim();
      const partnerSiparisTuruRaw = order.partnerSiparisTuru ?? rawOrderData.partner_siparis_turu;
      const isAlinan = partnerSiparisTuruRaw != null && ['alinan', 'gelen', 'alınan'].includes(String(partnerSiparisTuruRaw).toLowerCase().trim());
      if (partnerFirmaAdi && isAlinan) {
        try {
          let partnerTel: string | null = null;
          if (order.partnerFirmaTelefon && String(order.partnerFirmaTelefon).trim()) {
            partnerTel = String(order.partnerFirmaTelefon).trim();
          }
          if (!partnerTel && rawOrderData.partner_firma_telefon && String(rawOrderData.partner_firma_telefon).trim()) {
            partnerTel = String(rawOrderData.partner_firma_telefon).trim();
          }
          if (!partnerTel) {
            const partnerRes = await fetch(`${apiBase}/partner-firmalar`, {
              headers: { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
              credentials: 'include',
            });
            if (partnerRes.ok) {
              const partnerJson = await partnerRes.json();
              const list = Array.isArray(partnerJson?.data) ? partnerJson.data : [];
              const partnerFirma = list.find((p: { partner_firma_adi?: string; firma_adi?: string }) => {
                const adi = (p.partner_firma_adi || p.firma_adi || '').trim();
                return adi && adi === partnerFirmaAdi;
              });
              partnerTel = partnerFirma ? ((partnerFirma as any).partner_telefon || (partnerFirma as any).firma_tel || '').trim() || null : null;
            }
          }
          if (partnerTel) {
              const siparisForPartner = {
                musteri_unvan: order.musteriUnvani,
                musteri_isim_soyisim: order.musteriAdi,
                siparis_veren: order.musteriAdi,
                teslim_kisisi: siparisTeslimKisisiBaskasi || teslimKisi,
                siparis_urun: order.urun,
                teslim_mahalle: teslimMahalle,
              };
              const partnerMesaj = createPartnerMessage(mesajData, siparisForPartner, partnerFirmaAdi);
              const formattedPartnerPhone = String(partnerTel).replace(/\D/g, '');
              const partnerSendRes = await fetch(`${apiBase}/whatsapp/send`, {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({ phone: formattedPartnerPhone, message: partnerMesaj }),
              });
              const partnerSendResult = await partnerSendRes.json();
              if (partnerSendRes.ok && partnerSendResult?.success) {
                console.log('✅ Partner WhatsApp mesajı gönderildi:', formattedPartnerPhone);
              } else {
                console.warn('⚠️ Partner\'e WhatsApp gönderilemedi:', partnerSendResult?.error || partnerSendRes.status);
              }
          } else {
            console.warn('⚠️ Partner firma bulunamadı veya telefon yok:', partnerFirmaAdi);
          }
        } catch (partnerErr: any) {
          console.error('❌ Partner WhatsApp mesajı hatası:', partnerErr);
        }
      }
    } catch (error: any) {
      console.error('❌ WhatsApp mesaj gönderme hatası:', error);
    }
  };

  /** Teslim Edildi akışını başlat: org kartını bul, tipine göre TeslimFotoModal / imza / direkt teslim */
  const startDeliverFlow = async (order: Order) => {
    setTeslimEdilecekSiparis(order);
    if (!order.organizasyon_id) {
      console.error('❌ Order organizasyon_id yok:', order);
      showToast('error', 'Sipariş organizasyon bilgisi bulunamadı');
      return;
    }
    let deliverOrganizasyonKart = kartlar?.find((k) => k.id === order.organizasyon_id);
    if (!deliverOrganizasyonKart) {
      try {
        const { getOrganizasyonKartDetay } = await import('../api/kartActions');
        const kartDetay = await getOrganizasyonKartDetay(order.organizasyon_id);
        if (kartDetay) deliverOrganizasyonKart = kartDetay;
        else {
          showToast('error', 'Organizasyon kartı bulunamadı');
          return;
        }
      } catch (error: any) {
        console.error('❌ Organizasyon kartı çekilemedi:', error);
        showToast('error', 'Organizasyon kartı yüklenemedi');
        return;
      }
    }
    setTeslimEdilecekOrganizasyon(deliverOrganizasyonKart);
    setOrderActionModalOpen(false);
    const kartTur = (deliverOrganizasyonKart.kart_tur ?? deliverOrganizasyonKart.kart_tur_display ?? '').toString().trim();
    const isCiceksepeti = kartTur === 'Çiçek Sepeti' || kartTur.toLowerCase() === 'ciceksepeti' || /çiçek\s*sepeti/i.test(kartTur);
    if (kartTur === 'organizasyon') {
      setTeslimFotoModalOpen(true);
    } else if (isCiceksepeti) {
      // Çiçek Sepeti: sadece organizasyon_siparisler_ciceksepeti güncellensin (body.ciceksepeti: true zorunlu – yoksa aynı id başka org’da arşivlenir)
      const orgId = order.organizasyon_id ?? deliverOrganizasyonKart?.id;
      const orgIdNum = orgId != null ? Number(orgId) : null;
      try {
        await teslimEtSiparis(order.id, { ciceksepeti: true });
        await handleTeslimEdildiWhatsApp(order, deliverOrganizasyonKart, order.musteriAdi || 'Müşteri', 'kendisi');
        showToast('success', 'Sipariş teslim edildi');
        const teslimId = Number(order.id);
        if (orgIdNum != null && !Number.isNaN(teslimId)) {
          const keyNum: [string, number] = ['siparis-kartlar', orgIdNum];
          const keyStr = ['siparis-kartlar', String(orgId)] as const;
          const mevcut = queryClient.getQueryData<any[]>(keyNum) ?? queryClient.getQueryData<any[]>(keyStr);
          if (Array.isArray(mevcut)) {
            const yeniListe = mevcut.filter((s) => Number(s?.id ?? (s as any)?._raw?.id) !== teslimId);
            queryClient.setQueryData(keyNum, yeniListe);
            queryClient.setQueryData(keyStr, yeniListe);
          }
        }
        invalidateOrganizasyonKartQueries(queryClient, orgIdNum ?? undefined);
        queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] });
        setTeslimEdilecekSiparis(null);
        setTeslimEdilecekOrganizasyon(null);
      } catch (error: any) {
        console.error('Teslim işlemi hatası:', error);
        showToast('error', error?.message || 'Teslim işlemi başarısız');
        setTeslimEdilecekSiparis(null);
        setTeslimEdilecekOrganizasyon(null);
      }
    } else if (kartTur === 'aracsusleme') {
      try {
        await teslimEtSiparis(order.id);
        await handleTeslimEdildiWhatsApp(order, deliverOrganizasyonKart, order.musteriAdi || 'Müşteri', 'kendisi');
        showToast('success', 'Sipariş teslim edildi');
        invalidateOrganizasyonKartQueries(queryClient, order.organizasyon_id);
        await queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] });
        if (order.organizasyon_id) {
          await queryClient.refetchQueries({ queryKey: ['siparis-kartlar', order.organizasyon_id] });
        }
        setTeslimEdilecekSiparis(null);
        setTeslimEdilecekOrganizasyon(null);
      } catch (error: any) {
        console.error('Teslim işlemi hatası:', error);
        showToast('error', error?.message || 'Teslim işlemi başarısız');
        setTeslimEdilecekSiparis(null);
        setTeslimEdilecekOrganizasyon(null);
      }
    } else if (kartTur === 'ozelgun' || kartTur === 'ozelsiparis') {
      setImzaModalOpen(true);
    } else {
      // Diğer kart türleri: normal teslim (body yok)
      try {
        await teslimEtSiparis(order.id);
        await handleTeslimEdildiWhatsApp(order, deliverOrganizasyonKart, order.musteriAdi || 'Müşteri', 'kendisi');
        showToast('success', 'Sipariş teslim edildi');
        invalidateOrganizasyonKartQueries(queryClient, order.organizasyon_id);
        await queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] });
        if (order.organizasyon_id) await queryClient.refetchQueries({ queryKey: ['siparis-kartlar', order.organizasyon_id] });
        setTeslimEdilecekSiparis(null);
        setTeslimEdilecekOrganizasyon(null);
      } catch (error: any) {
        console.error('Teslim işlemi hatası:', error);
        showToast('error', error?.message || 'Teslim işlemi başarısız');
        setTeslimEdilecekSiparis(null);
        setTeslimEdilecekOrganizasyon(null);
      }
    }
  };

  // WhatsApp bağlantı kurulduğunda pending mesajı gönder veya bekleyen teslim akışını başlat
  const handleWhatsAppConnected = async () => {
    if (pendingWhatsAppMessage) {
      await sendWhatsAppMessage(
        pendingWhatsAppMessage.order,
        pendingWhatsAppMessage.organizasyonKart,
        pendingWhatsAppMessage.teslimKisi,
        pendingWhatsAppMessage.teslimTuru,
        pendingWhatsAppMessage.siparisTeslimKisisiBaskasi,
        pendingWhatsAppMessage.fotoPath
      );
      setPendingWhatsAppMessage(null);
    }
    if (pendingTeslimFlow) {
      const order = pendingTeslimFlow.order;
      setPendingTeslimFlow(null);
      const { showToastInteractive } = await import('../../../shared/utils/toastUtils');
      const isAracSusleme = (order as any).organizasyonKartTur === 'aracsusleme';
      showToastInteractive({
        title: isAracSusleme ? 'Araç Süsleme Tamamlandı' : 'Sipariş Teslim Et',
        message: isAracSusleme
          ? 'Bu siparişi tamamlandı olarak işaretlemek istediğinize emin misiniz?'
          : 'Bu siparişi teslim edildi olarak işaretlemek istediğinize emin misiniz?',
        confirmText: isAracSusleme ? 'Evet, tamamlandı' : 'Evet, teslim edildi',
        cancelText: 'İptal',
        onConfirm: async () => {
          await startDeliverFlow(order);
        },
      });
    }
    if (pendingTumunuTeslimEtKartId !== null) {
      const kartId = pendingTumunuTeslimEtKartId;
      setPendingTumunuTeslimEtKartId(null);
      await showTumunuTeslimEtConfirm(kartId);
    }
    if (pendingWhatsAppShare) {
      const { kart, siparisler } = pendingWhatsAppShare;
      setPendingWhatsAppShare(null);
      window.dispatchEvent(new CustomEvent('floovon-whatsapp-connected-continue-share', { detail: { kart, siparisler } }));
    }
  };

  // ✅ Loading state - Sadece ilk yüklemede göster (hafta değiştiğinde gösterme)
  // isLoading: İlk yükleme (cache yok)
  // isFetching: Her fetch (cache olsa bile) - hafta değiştiğinde de true olur
  // ✅ DÜZELTME: Hafta değiştiğinde sayfa yenilenmemeli, sadece itemsContainer içeriği değişmeli
  // isTransitioning kontrolünü kaldırdık - OrderBoard her zaman görünür olmalı
  // ✅ KRİTİK DÜZELTME: kartlarLoading && !kartlar kontrolü kaldırıldı - component unmount'a neden oluyordu!
  // placeholderData kullanıldığı için kartlar her zaman tanımlı olacak
  if (kartlarLoading && !kartlar && !kartlarFetching) {
    // Sadece ilk yüklemede ve fetch yapılmıyorsa loading göster
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Error state
  if (kartlarError) {
    return (
      <div className="backend-error-message-wrapper">
        <ErrorState
          title="Veri yüklenemedi"
          message={kartlarError instanceof Error 
            ? `Sunucuya bağlanırken bir sorun oluştu. Lütfen internet bağlantınızı kontrol edin ve sayfayı yenileyin. Hata: ${kartlarError.message}`
            : 'Sunucuya bağlanırken bir sorun oluştu. Lütfen internet bağlantınızı kontrol edin ve sayfayı yenileyin.'}
        />
      </div>
    );
  }

  // ✅ KRİTİK: Empty state kontrolünü kaldırdık - OrderBoard içindeki .empty-message gösterilecek
  // Kartlar boş olsa bile OrderBoard render edilsin, içindeki .empty-message gösterilsin

  return (
    <div className="flex h-full bg-alan">
      {/* Sipariş Container - Mavi çerçeveli alan (butonlar burada) */}
      <div className="flex-1 flex flex-col dashboard-container-wrapper">
        <div className="dashboard-container">
          <DashboardHeader
            dateRangeText={dateRangeText}
            selectedWeek={selectedWeek}
            weekDates={weekDates}
            onWeekChange={handleWeekChange}
            searchQuery={searchQuery}
            onSearchChange={(q) => {
              setSearchQuery(q);
              window.dispatchEvent(new CustomEvent('searchQueryChanged', { detail: { query: q } }));
            }}
            onSicakSatis={() => {
              setSicakSatisModalOpen(true);
            }}
            onSort={(sortType: string) => {
              // ✅ REACT: Kartları sırala - frontend'de sıralama yap
              if (!kartlar || kartlar.length === 0) return;
              
              let sortedKartlar: OrganizasyonKart[] = [...kartlar];
              
              switch (sortType) {
                case 'organizasyon-turu':
                  sortedKartlar.sort((a, b) => {
                    const turA = (a.kart_tur_display || a.kart_tur || '').toLocaleLowerCase('tr-TR');
                    const turB = (b.kart_tur_display || b.kart_tur || '').toLocaleLowerCase('tr-TR');
                    return turA.localeCompare(turB, 'tr-TR');
                  });
                  showToast('success', 'Kartlar organizasyon türüne göre sıralandı');
                  break;
                case 'teslim-saati':
                  sortedKartlar.sort((a, b) => {
                    const saatA = (a.teslim_saat || '').toLocaleLowerCase('tr-TR');
                    const saatB = (b.teslim_saat || '').toLocaleLowerCase('tr-TR');
                    if (!saatA && !saatB) return 0;
                    if (!saatA) return 1;
                    if (!saatB) return -1;
                    return saatA.localeCompare(saatB, 'tr-TR');
                  });
                  showToast('success', 'Kartlar teslim saatine göre sıralandı');
                  break;
                case 'teslim-tarihi':
                  sortedKartlar.sort((a, b) => {
                    if (!a.teslim_tarih && !b.teslim_tarih) return 0;
                    if (!a.teslim_tarih) return 1;
                    if (!b.teslim_tarih) return -1;
                    const tarihA = new Date(a.teslim_tarih).getTime();
                    const tarihB = new Date(b.teslim_tarih).getTime();
                    return tarihA - tarihB;
                  });
                  showToast('success', 'Kartlar teslim tarihine göre sıralandı');
                  break;
                case 'siparis-sayisi':
                  sortedKartlar.sort((a, b) => {
                    const sayiA = a.siparis_sayisi || 0;
                    const sayiB = b.siparis_sayisi || 0;
                    return sayiB - sayiA; // Büyükten küçüğe
                  });
                  showToast('success', 'Kartlar sipariş sayısına göre sıralandı');
                  break;
                default:
                  return;
              }
              
              // ✅ REACT: Sıralanmış kartları cache'e yaz (query key hook ile aynı olmalı: ['organizasyon-kartlar'])
              queryClient.setQueryData(['organizasyon-kartlar'], sortedKartlar);
            }}
            onYeniKart={() => {
              setYeniKartModalOpen(true);
            }}
            onYeniMusteri={() => {
              setYeniMusteriModalOpen(true);
            }}
            onExport={async (exportType) => {
              if (exportType === 'excel') {
                if (!kartlar || kartlar.length === 0) {
                  showToast('warning', 'Dışa aktarılacak sipariş bulunamadı');
                  return;
                }
                if (!selectedWeek) {
                  showToast('warning', 'Hafta seçilmedi');
                  return;
                }
                await handleExcelExport(kartlar, selectedWeek);
              } else if (exportType === 'pdf') {
                showToast('info', 'PDF export özelliği yakında eklenecek');
              } else if (exportType === 'print') {
                if (!kartlar || kartlar.length === 0) {
                  showToast('warning', 'Yazdırılacak sipariş bulunamadı');
                  return;
                }
                if (!selectedWeek) {
                  showToast('warning', 'Hafta seçilmedi');
                  return;
                }
                await handlePrint(kartlar, selectedWeek);
              }
            }}
            onCicekSepeti={() => {
              (window as any).ciceksepetiIntegration?.openModal?.();
            }}
          />

          {/* Tab'lar - Kart Filtreler */}
          <div className="dashboard-header">
            <div className="kart-filtreler" id="kartFiltreMenu">
              <ul>
                <li
                  className={`tum-siparisleri-goster text-uppercase ${activeTab === 'all' ? 'filtre-secili' : ''}`}
                  onClick={() => setActiveTab('all')}
                >
                  Tüm siparişler
                </li>
                <li
                  className={`kartin-tur-adi uppercase-turkish text-uppercase ${activeTab === 'organizasyon' ? 'filtre-secili' : ''} ${filterCounts.organizasyon === 0 ? 'filtre-pasif' : ''}`}
                  onClick={() => setActiveTab('organizasyon')}
                  data-kart-adeti={filterCounts.organizasyon}
                >
                  Organizasyon Siparişleri
                </li>
                <li
                  className={`kartin-tur-adi uppercase-turkish text-uppercase ${activeTab === 'aracsusleme' ? 'filtre-secili' : ''} ${filterCounts.aracsusleme === 0 ? 'filtre-pasif' : ''}`}
                  onClick={() => setActiveTab('aracsusleme')}
                  data-kart-adeti={filterCounts.aracsusleme}
                >
                  Araç Süsleme Randevuları
                </li>
                <li
                  className={`kartin-tur-adi uppercase-turkish text-uppercase ${activeTab === 'ozelgun' ? 'filtre-secili' : ''} ${filterCounts.ozelgun === 0 ? 'filtre-pasif' : ''}`}
                  onClick={() => setActiveTab('ozelgun')}
                  data-kart-adeti={filterCounts.ozelgun}
                >
                  Özel Gün Siparişleri
                </li>
                <li
                  className={`kartin-tur-adi uppercase-turkish text-uppercase ${activeTab === 'ozelsiparis' ? 'filtre-secili' : ''} ${filterCounts.ozelsiparis === 0 ? 'filtre-pasif' : ''}`}
                  onClick={() => setActiveTab('ozelsiparis')}
                  data-kart-adeti={filterCounts.ozelsiparis}
                >
                  Özel Siparişler
                </li>
                <li
                  className={`kartin-tur-adi uppercase-turkish text-uppercase ${activeTab === 'ciceksepeti' ? 'filtre-secili' : ''} ${filterCounts.ciceksepeti === 0 ? 'filtre-pasif' : ''}`}
                  onClick={() => setActiveTab('ciceksepeti')}
                  data-kart-adeti={filterCounts.ciceksepeti}
                >
                  Çiçek Sepeti
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Grid Container - OrderBoard için */}
        <div className="grid-container">
          <main className="grid-item main">
            {/* ✅ REACT: Empty message - kartlar yoksa göster (eski index.html yapısına göre) */}
            {(!filteredKartlar || filteredKartlar.length === 0) && !kartlarLoading && (
              <div className="empty-message">
                <i className="icon-kart-yok"></i>
                <div className="message">Henüz sipariş bulunmuyor<span>Yeni bir sipariş oluşturmak için "Yeni Kart Oluştur" butonuna tıklayın.</span></div>
              </div>
            )}
            
            {/* OrderBoard - Her kart kendi başına gösterilir, tarih kolonları yok */}
            {/* ✅ KRİTİK: key prop kaldırıldı - selectedWeek değiştiğinde component yeniden mount edilmesin */}
            {/* Sadece kartlar prop'u değiştiğinde React otomatik olarak güncelleyecek */}
            {/* ✅ DÜZELTME: OrderBoard her zaman görünür - hafta değiştiğinde sadece içerik güncellenir */}
            <OrderBoard 
              kartlar={filteredKartlar || []} 
              onOrderAction={handleOrderAction}
              onKartAction={handleKartAction}
              baglantiliSiparislerMap={baglantiliSiparislerMap}
              onOrderContextMenu={handleOrderContextMenu}
              onOpenWhatsAppQRForShare={isBaslangicPlan === false ? (kart, siparisler) => {
                setPendingWhatsAppShare({ kart, siparisler });
                setWhatsAppQRModalOpen(true);
              } : undefined}
            />
          </main>
        </div>
      </div>

      {/* Right Panel - Masaüstünde görünür; mobilde CSS ile gizlenir (mobile-index.css) */}
      <div className="dashboard-right-panel-wrapper flex-shrink-0">
        <RightPanel 
          kartlar={kartlar} 
          selectedWeek={selectedWeek}
          weekDates={weekDates}
          onWeekChange={handleWeekChange}
          onDayClick={handleDayClick}
          selectedDay={selectedDay}
          kartlarLoading={kartlarLoading}
        />
      </div>

      {/* Mobil Özellikler - QR FAB navbar üstünde (mobile-index.css) */}
      <QRScannerFAB
        onOpen={handleOpenQRScanner}
        onOpenSicakSatis={() => setSicakSatisModalOpen(true)}
        className="qr-fab-index"
      />

      {/* Modals */}
      <QRScannerModal
        isOpen={qrScannerModalOpen}
        onClose={() => setQrScannerModalOpen(false)}
        onScanSuccess={handleQRScanSuccess}
        onScanError={handleQRScanError}
      />

      <OrderActionModal
        isOpen={orderActionModalOpen}
        order={selectedOrder}
        onClose={() => {
          setOrderActionModalOpen(false);
          setSelectedOrder(null);
        }}
        onAction={handleOrderAction}
      />

      <EditKartModal
        isOpen={editKartModalOpen}
        kart={selectedKart}
        onClose={() => {
          setEditKartModalOpen(false);
          setSelectedKart(null);
        }}
        onSuccess={() => {
          invalidateOrganizasyonKartQueries(queryClient, selectedKart?.id);
          setEditKartModalOpen(false);
          setSelectedKart(null);
        }}
      />

      <YeniKartModal
        isOpen={yeniKartModalOpen}
        onClose={() => setYeniKartModalOpen(false)}
        onSuccess={(newKartId) => {
          invalidateOrganizasyonKartQueries(queryClient);
          setYeniKartModalOpen(false);
          if (newKartId != null) {
            setTimeout(() => {
              const el = document.querySelector(`[data-kart-id="${newKartId}"]`);
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 400);
          }
        }}
      />

      <SiparisEditModal
        isOpen={siparisEditModalOpen}
        order={selectedOrderForSiparisEdit}
        onClose={() => {
          setSiparisEditModalOpen(false);
          setSelectedOrderForSiparisEdit(null);
        }}
        onSuccess={() => {
          invalidateOrganizasyonKartQueries(queryClient, selectedOrderForSiparisEdit?.organizasyon_id);
          queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] });
          if (selectedOrderForSiparisEdit?.organizasyon_id) {
            queryClient.refetchQueries({ queryKey: ['siparis-kartlar', selectedOrderForSiparisEdit.organizasyon_id] });
          }
          setSiparisEditModalOpen(false);
          setSelectedOrderForSiparisEdit(null);
        }}
      />

      <YeniMusteriModal
        isOpen={yeniMusteriModalOpen}
        onClose={() => setYeniMusteriModalOpen(false)}
        onSuccess={() => {
          invalidateCustomerQueries(queryClient, undefined);
          setYeniMusteriModalOpen(false);
        }}
      />

      <SicakSatisModal
        isOpen={sicakSatisModalOpen}
        onClose={() => setSicakSatisModalOpen(false)}
        onSuccess={() => {
          invalidateOrganizasyonKartQueries(queryClient);
          setSicakSatisModalOpen(false);
        }}
      />

      {/* Sipariş İşlem Modalları */}
      
      {/* Teslim Foto Modal - SADECE organizasyon kartları için */}
        <TeslimFotoModal
        isOpen={teslimFotoModalOpen && teslimEdilecekOrganizasyon?.kart_tur === 'organizasyon'}
        organizasyonId={teslimEdilecekSiparis?.organizasyon_id || 0}
          onClose={() => {
            setTeslimFotoModalOpen(false);
          setTeslimEdilecekSiparis(null);
          setTeslimEdilecekOrganizasyon(null);
          }}
          onSkip={async () => {
            // Fotoğraf atlanırsa direkt teslim et (organizasyon için imza YOK!)
            setTeslimFotoModalOpen(false);
            
            if (teslimEdilecekSiparis?.id && teslimEdilecekOrganizasyon) {
              try {
                await teslimEtSiparis(teslimEdilecekSiparis.id);
                
                // WhatsApp mesajı gönder
                await handleTeslimEdildiWhatsApp(
                  teslimEdilecekSiparis,
                  teslimEdilecekOrganizasyon,
                  teslimEdilecekSiparis.musteriAdi || 'Müşteri',
                  'kendisi'
                );
                
                showToast('success', 'Sipariş teslim edildi');
                invalidateOrganizasyonKartQueries(queryClient, teslimEdilecekSiparis.organizasyon_id);
                queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] });
                if (teslimEdilecekSiparis.organizasyon_id) {
                  queryClient.refetchQueries({ queryKey: ['siparis-kartlar', teslimEdilecekSiparis.organizasyon_id] });
                }
                setTeslimEdilecekSiparis(null);
                setTeslimEdilecekOrganizasyon(null);
              } catch (error: any) {
                console.error('Teslim işlemi hatası:', error);
                showToast('error', error?.message || 'Teslim işlemi başarısız');
              }
            }
          }}
          onPhotoSelected={async (file: File) => {
            // Fotoğraf seçildi ve yüklendi - direkt teslim et (organizasyon için imza YOK!)
            setTeslimFotoModalOpen(false);
            
            // Fotoğrafı organizasyon kartına yükle
            if (teslimEdilecekSiparis?.organizasyon_id && teslimEdilecekOrganizasyon) {
              try {
                const uploadResult = await uploadTeslimFotolari(
                  teslimEdilecekSiparis.organizasyon_id,
                  [file],
                  {
                    customerId: teslimEdilecekSiparis.id?.toString() || '',
                    customerUnvan: teslimEdilecekSiparis.musteriAdi || '',
                  }
                );
                
                // Fotoğraf yüklendi, direkt teslim et (imza YOK!)
                if (teslimEdilecekSiparis.id) {
                  await teslimEtSiparis(teslimEdilecekSiparis.id);
                  
                  // WhatsApp mesajı gönder (fotoğraf ile)
                  const fotoPath = uploadResult.files?.[0]?.path;
                  await handleTeslimEdildiWhatsApp(
                    teslimEdilecekSiparis,
                    teslimEdilecekOrganizasyon,
                    teslimEdilecekSiparis.musteriAdi || 'Müşteri',
                    'kendisi',
                    undefined,
                    fotoPath
                  );
                  
                  showToast('success', 'Sipariş teslim edildi');
                  invalidateOrganizasyonKartQueries(queryClient, teslimEdilecekSiparis.organizasyon_id);
                  queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] });
                  if (teslimEdilecekSiparis.organizasyon_id) {
                    queryClient.refetchQueries({ queryKey: ['siparis-kartlar', teslimEdilecekSiparis.organizasyon_id] });
                  }
                  setTeslimEdilecekSiparis(null);
                  setTeslimEdilecekOrganizasyon(null);
                }
            } catch (error: any) {
                console.error('Fotoğraf yükleme veya teslim hatası:', error);
                showToast('error', error?.message || 'İşlem başarısız');
              }
            }
          }}
        />

      {/* İmza Modal - SADECE ozelgun ve ozelsiparis kartları için */}
      {/* ÖNEMLİ: Teslim kişi varsayılanı sipariş veren (musteriAdi) YAPILMAZ; önce sipariş kartındaki teslim_kisisi, sonra organizasyon kartındaki kullanılır. Böylece teslim kişi bilgisi sipariş veren ile karışmaz. */}
      <ImzaModal
        isOpen={imzaModalOpen && (teslimEdilecekOrganizasyon?.kart_tur === 'ozelgun' || teslimEdilecekOrganizasyon?.kart_tur === 'ozelsiparis')}
        defaultTeslimKisi={teslimEdilecekSiparis?.teslimKisisi || teslimEdilecekOrganizasyon?.teslim_kisisi || ''}
        onClose={() => {
          setImzaModalOpen(false);
          setTeslimEdilecekSiparis(null);
          setTeslimEdilecekOrganizasyon(null);
        }}
        onConfirm={async (teslimKisi: string, imzaData: string | null) => {
          // İmza alındı – ESKİ SİSTEM GİBİ: Tek istekte arşivle (deliver çağrısı yok)
          const defaultTeslimKisi = teslimEdilecekSiparis?.teslimKisisi || teslimEdilecekOrganizasyon?.teslim_kisisi || '';
          const teslimTuru = teslimKisi === defaultTeslimKisi ? 'kendisi' : 'baskasi';
          const gercekTeslimKisi = teslimTuru === 'kendisi'
            ? (teslimEdilecekOrganizasyon?.teslim_kisisi || teslimKisi)
            : teslimKisi;
          const siparisTeslimKisisiBaskasi = teslimTuru === 'baskasi' ? teslimKisi : undefined;
          
          setImzaModalOpen(false);
          
          if (teslimEdilecekSiparis?.id) {
            try {
              // Başkası seçildiyse teslim_kisisi alanına dokunma – sadece siparis_teslim_kisisi_baskasi yazılır
              const archivePayload: {
                teslim_kisisi?: string;
                teslim_turu?: 'kendisi' | 'baskasi';
                siparis_teslim_kisisi_baskasi?: string;
                teslim_imza_data?: string;
              } = {
                teslim_turu: teslimTuru,
                siparis_teslim_kisisi_baskasi: siparisTeslimKisisiBaskasi || undefined,
                teslim_imza_data: imzaData || undefined,
              };
              if (teslimTuru === 'kendisi') {
                archivePayload.teslim_kisisi = gercekTeslimKisi;
              }
              await arsivleSiparis(
                teslimEdilecekSiparis.id,
                'Teslim Edildi',
                archivePayload
              );
              
              // Sonra WhatsApp mesajı (eski sistemde de arşivden sonra; hata olsa bile işlem tamam sayılır)
              if (teslimEdilecekSiparis && teslimEdilecekOrganizasyon) {
                await handleTeslimEdildiWhatsApp(
                  teslimEdilecekSiparis,
                  teslimEdilecekOrganizasyon,
                  gercekTeslimKisi,
                  teslimTuru,
                  siparisTeslimKisisiBaskasi
                );
              }
              
              showToast('success', 'Sipariş teslim edildi ve arşivlendi');
              invalidateOrganizasyonKartQueries(queryClient, teslimEdilecekSiparis.organizasyon_id);
              queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] });
              if (teslimEdilecekSiparis.organizasyon_id) {
                queryClient.refetchQueries({ queryKey: ['siparis-kartlar', teslimEdilecekSiparis.organizasyon_id] });
              }
              setTeslimEdilecekSiparis(null);
              setTeslimEdilecekOrganizasyon(null);
            } catch (error: any) {
              console.error('Teslim işlemi hatası:', error);
              showToast('error', error?.message || 'Teslim işlemi başarısız');
            }
          }
        }}
      />

      {/* Arşiv Sebep Modal */}
      <ArsivSebepModal
        isOpen={arsivSebepModalOpen}
        tip={arsivSebepModalTip}
        onCancel={() => {
          setArsivSebepModalOpen(false);
          setTeslimEdilecekSiparis(null);
          setTeslimEdilecekOrganizasyon(null);
          setOrganizasyonArsivlenecekId(null);
        }}
        onConfirm={async (sebep: string) => {
          setArsivSebepModalOpen(false);
          
          if (arsivSebepModalTip === 'siparis' && teslimEdilecekSiparis?.id) {
            // Sipariş arşivle – Çiçek Sepeti kartındaki siparişse backend'e ciceksepeti: true gönder (organizasyon_siparisler_ciceksepeti güncellensin)
            const siparisKarti = kartlar?.find((k) => k.id === teslimEdilecekSiparis?.organizasyon_id);
            const kartTur = (siparisKarti?.kart_tur ?? siparisKarti?.kart_tur_display ?? '').toString().toLowerCase();
            const isCiceksepeti = kartTur === 'ciceksepeti' || kartTur.includes('çiçek sepeti') || kartTur.includes('ciceksepeti');
            try {
              const result = await arsivleSiparis(teslimEdilecekSiparis.id, sebep, undefined, isCiceksepeti);
              if (result.success) {
                showToast('success', 'Sipariş arşivlendi');
                // Arşivlenen siparişi index'teki listeden hemen kaldır (özellikle Çiçek Sepeti'nde refetch gecikince kart ekranda kalıyordu)
                const siparisKartlarKey = ['siparis-kartlar', teslimEdilecekSiparis.organizasyon_id] as const;
                const mevcutListe = queryClient.getQueryData<any[]>(siparisKartlarKey);
                if (Array.isArray(mevcutListe)) {
                  queryClient.setQueryData(
                    siparisKartlarKey,
                    mevcutListe.filter((s) => (s?.id ?? (s as any)?._raw?.id) !== teslimEdilecekSiparis.id)
                  );
                }
                invalidateOrganizasyonKartQueries(queryClient, teslimEdilecekSiparis.organizasyon_id);
                queryClient.invalidateQueries({ queryKey: ['archived-orders'] });
                await Promise.all([
                  queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] }),
                  queryClient.refetchQueries({ queryKey: ['siparis-kartlar', teslimEdilecekSiparis.organizasyon_id] }),
                  queryClient.refetchQueries({ queryKey: ['archived-orders'] }),
                ]);
                broadcastInvalidation([['organizasyon-kartlar'], ['archived-orders']]);
              } else {
                showToast('error', result.message || 'Arşivleme başarısız');
              }
            } catch (error: any) {
              console.error('Arşivleme hatası:', error);
              showToast('error', error?.message || 'Arşivleme başarısız');
            }
          } else if (arsivSebepModalTip === 'organizasyon' && (teslimEdilecekOrganizasyon?.id ?? organizasyonArsivlenecekId)) {
            // Organizasyon kartı arşivle (id: modal açılırken saklanan organizasyonArsivlenecekId veya teslimEdilecekOrganizasyon.id)
            const orgIdToArchive = teslimEdilecekOrganizasyon?.id ?? organizasyonArsivlenecekId!;
            try {
              const result = await arsivleOrganizasyonKart(orgIdToArchive, sebep);
              if (result.success) {
                showToast('success', 'Organizasyon kartı arşivlendi');
                invalidateOrganizasyonKartQueries(queryClient, orgIdToArchive);
                queryClient.invalidateQueries({ queryKey: ['archived-orders'] });
                await Promise.all([
                  queryClient.refetchQueries({ queryKey: ['organizasyon-kartlar'] }),
                  queryClient.refetchQueries({ queryKey: ['archived-orders'] }),
                ]);
                broadcastInvalidation([['organizasyon-kartlar'], ['archived-orders']]);
              } else {
                showToast('error', result.message || 'Arşivleme başarısız');
              }
            } catch (error: any) {
              console.error('Arşivleme hatası:', error);
              showToast('error', error?.message || 'Arşivleme başarısız');
            }
          }
          
          setTeslimEdilecekSiparis(null);
          setTeslimEdilecekOrganizasyon(null);
          setOrganizasyonArsivlenecekId(null);
        }}
      />

      {/* WhatsApp QR Modal */}
      <WhatsAppQRModal
        isOpen={whatsAppQRModalOpen}
        onClose={() => {
          setWhatsAppQRModalOpen(false);
          setPendingWhatsAppMessage(null);
          setPendingTeslimFlow(null);
          setPendingWhatsAppShare(null);
        }}
        onConnected={handleWhatsAppConnected}
      />

      {/* Context Menu */}
      {contextMenuState.open && contextMenuState.order && contextMenuState.sourceKart && (
        <OrderContextMenu
          order={contextMenuState.order}
          sourceKart={contextMenuState.sourceKart}
          targetKartlar={mevcutHaftaKartlari}
          position={contextMenuState.position}
          onClose={() => setContextMenuState({ open: false, position: { x: 0, y: 0 }, order: null, sourceKart: null })}
          onMove={handleMoveOrder}
        />
      )}

      {/* Teknik Destek Modal */}
      <TeknikDestekModal
        isOpen={teknikDestekModalOpen}
        onClose={() => setTeknikDestekModalOpen(false)}
      />

      {/* ✅ ESKİ SİSTEM: #fotoInput elementi - eski sistemdeki gibi direkt file picker açılıyor (modal YOK!) */}
      <input 
        type="file" 
        id="fotoInput" 
        accept="image/*" 
        multiple 
        style={{ display: 'none' }}
        onChange={async (e) => {
          const files = e.target.files;
          if (!files || files.length === 0) return;
          
          const kartId = (window as any).selectedKartId;
          if (!kartId) {
            showToast('error', 'Organizasyon kartı seçilmedi');
            return;
          }
          
          // Organizasyon kartı bilgilerini al (metadata için)
          const organizasyonKart = kartlar?.find(k => k.id === kartId);
          
          // Hook ile yükle
          teslimFotoUpload.upload({
            organizasyonId: kartId,
            files: Array.from(files),
            metadata: organizasyonKart
              ? {
                  customerId: kartId.toString(),
                  customerUnvan: organizasyonKart.teslim_kisisi || '',
                }
              : undefined,
          });
          
          // Input'u temizle
          e.target.value = '';
        }}
      />

          </div>
  );
};

