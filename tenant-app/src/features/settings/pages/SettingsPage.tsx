import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, apiClient } from '../../../lib/api';
import { getApiBaseUrl } from '../../../lib/runtime';
import { getUploadUrl } from '../../../shared/utils/urlUtils';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { EmptyState } from '../../../shared/components/EmptyState';
import { TableSortHeader } from '../../../shared/components/TableSortHeader';
import { SearchInput } from '../../../shared/components/SearchInput';
import { usePageAnimations } from '../../../shared/hooks/usePageAnimations';
import { showToast, showToastInteractive } from '../../../shared/utils/toastUtils';
import { usePlan } from '../../../app/providers/PlanProvider';
import { formatPhoneNumber, cleanPhoneForDatabase, formatTutarInputLive, formatTutarInputKeyDown, parseTL, formatTL, formatTLDisplayValue } from '../../../shared/utils/formatUtils';
import { usePhoneInput } from '../../../shared/hooks/usePhoneInput';
import { useAddressSelect } from '../../dashboard/hooks/useAddressSelect';
import { getKonumAyarlari } from '../../dashboard/api/formActions';
import { Trash2, FileSearch, Package, Settings, Truck, Send, Pencil, Upload, Info, Wrench, Clock, ShoppingCart, Plug, RefreshCw, Bell, FileText, HelpCircle } from 'lucide-react';
import { WhatsAppQRModal } from '../../dashboard/components/WhatsAppQRModal';
import { FaturaTab } from './FaturaTab';

interface Urun {
  id: number;
  ad: string;
  grup?: string;
  fiyat: number;
  gorsel?: string;
  durum?: number | null;
}

interface UrunGrubu {
  id: number;
  ad: string;
  durum?: number;
}

/* Organizasyon grupları kullanılmıyor – sadece tip uyumu için bırakıldı */

interface OrganizasyonTuru {
  id: number;
  ad?: string;
  tur_adi?: string;
  grup_id?: number;
  grup_adi?: string; // Backend'den gelen organizasyon grubu adı
  renk_kodu?: string;
  is_active?: number;
  durum?: number;
}

interface OrganizasyonEtiketi {
  id: number;
  ad: string;
  renk?: string;
  renk_kodu?: string;
  grup_id?: number;
  grup_adi?: string;
  durum?: number;
}

/** Gönderim ayarları – sipariş listesi WhatsApp numaraları (WhatsApp bağlantısı header popup’tan yönetiliyor) */
/** Çiçek Sepeti API ayarları – API Key, Secret, Mod, Webhook, Sipariş kontrolü, Test siparişi */
function CiceksepetiAyarlariForm(
  { onDirtyChange, submitFormRef, onAfterSave }: {
    onDirtyChange?: (dirty: boolean) => void;
    submitFormRef?: React.MutableRefObject<(() => void) | null>;
    onAfterSave?: () => void;
  }
) {
  const queryClient = useQueryClient();
  const formRef = React.useRef<HTMLFormElement>(null);
  const { data: cicekData, isLoading } = useQuery({
    queryKey: ['ayarlar-ciceksepeti'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data?: Record<string, unknown> }>('/ayarlar/ciceksepeti');
      return res.data?.data ?? {};
    },
    staleTime: 60 * 1000,
  });
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [apiMode, setApiMode] = useState<'test' | 'live'>('test');
  const [siparisKontrol, setSiparisKontrol] = useState('60');
  const [otomatikOnay, setOtomatikOnay] = useState(false);
  const [sesBildirimi, setSesBildirimi] = useState(true);
  const [testBildirimi, setTestBildirimi] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notifPermission, setNotifPermission] = useState<'default' | 'granted' | 'denied' | 'unsupported'>(() => {
    if (typeof window === 'undefined' || typeof (window as any).Notification === 'undefined') return 'unsupported';
    return (window as any).Notification.permission as 'default' | 'granted' | 'denied';
  });
  React.useEffect(() => {
    if (cicekData && typeof cicekData === 'object') {
      setApiKey((cicekData.api_key as string) ?? '');
      setApiSecret((cicekData.api_secret as string) ?? '');
      setApiMode(((cicekData.api_mode as string) || 'test') as 'test' | 'live');
      setSiparisKontrol(String((cicekData.siparis_kontrol as number) ?? (cicekData.siparis_kontrol as string) ?? '60'));
      setOtomatikOnay(Boolean(cicekData.otomatik_onay));
      setSesBildirimi(cicekData.ses_bildirimi !== false && cicekData.ses_bildirimi !== 0);
      const tb = Boolean((cicekData as { test_bildirimi?: boolean }).test_bildirimi);
      setTestBildirimi(tb);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ciceksepeti_test_bildirimi', tb ? 'true' : 'false');
        localStorage.setItem('ciceksepeti_ses_bildirimi', cicekData.ses_bildirimi !== false && cicekData.ses_bildirimi !== 0 ? 'true' : 'false');
      }
    }
  }, [cicekData]);

  const isDirty = Boolean(cicekData && typeof cicekData === 'object' && (
    apiKey !== ((cicekData.api_key as string) ?? '') ||
    apiSecret !== ((cicekData.api_secret as string) ?? '') ||
    apiMode !== (((cicekData.api_mode as string) || 'test') as 'test' | 'live') ||
    siparisKontrol !== String((cicekData.siparis_kontrol as number) ?? (cicekData.siparis_kontrol as string) ?? '60') ||
    otomatikOnay !== Boolean(cicekData.otomatik_onay) ||
    sesBildirimi !== (cicekData.ses_bildirimi !== false && cicekData.ses_bildirimi !== 0) ||
    testBildirimi !== Boolean((cicekData as { test_bildirimi?: boolean }).test_bildirimi)
  ));
  React.useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  React.useEffect(() => {
    if (submitFormRef) {
      submitFormRef.current = () => formRef.current?.requestSubmit();
      return () => { submitFormRef.current = null; };
    }
  }, [submitFormRef]);

  const revertForm = () => {
    if (cicekData && typeof cicekData === 'object') {
      setApiKey((cicekData.api_key as string) ?? '');
      setApiSecret((cicekData.api_secret as string) ?? '');
      setApiMode(((cicekData.api_mode as string) || 'test') as 'test' | 'live');
      setSiparisKontrol(String((cicekData.siparis_kontrol as number) ?? (cicekData.siparis_kontrol as string) ?? '60'));
      setOtomatikOnay(Boolean(cicekData.otomatik_onay));
      setSesBildirimi(cicekData.ses_bildirimi !== false && cicekData.ses_bildirimi !== 0);
      setTestBildirimi(Boolean((cicekData as { test_bildirimi?: boolean }).test_bildirimi));
    }
    onDirtyChange?.(false);
  };

  const handleVazgec = () => {
    showToastInteractive({
      title: 'Değişiklikleri Kaydet',
      message: 'Kaydedilmeyen değişiklikler var! Değişiklikleri kaydetmek istiyor musunuz?',
      confirmText: 'Evet, Kaydet',
      cancelText: 'İptal',
      onConfirm: () => formRef.current?.requestSubmit(),
      onCancel: revertForm,
    });
  };

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/ciceksepeti/webhook` : '';
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.put('/ayarlar/ciceksepeti', {
        api_key: apiKey,
        api_secret: apiSecret,
        api_mode: apiMode,
        webhook_url: webhookUrl,
        siparis_kontrol: siparisKontrol,
        otomatik_onay: otomatikOnay,
        ses_bildirimi: sesBildirimi,
        test_bildirimi: testBildirimi,
      });
      queryClient.invalidateQueries({ queryKey: ['ayarlar-ciceksepeti'] });
      if (typeof window !== 'undefined') {
        localStorage.setItem('ciceksepeti_test_bildirimi', testBildirimi ? 'true' : 'false');
        localStorage.setItem('ciceksepeti_ses_bildirimi', sesBildirimi ? 'true' : 'false');
        window.dispatchEvent(new CustomEvent('ciceksepetiTestBildirimiChanged'));
      }
      showToast('success', 'Çiçek Sepeti ayarları kaydedildi.');
      onAfterSave?.();
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };
  const handleManuelKontrol = async () => {
    setTesting(true);
    try {
      const res = await apiClient.post<{ success?: boolean; message?: string }>('/ayarlar/ciceksepeti/manuel-kontrol');
      showToast('info', res.data?.message ?? 'Manuel kontrol için entegrasyon yapılandırılmalıdır.');
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'İşlem başarısız.');
    } finally {
      setTesting(false);
    }
  };
  const apiStatus = (cicekData as { api_status?: string })?.api_status || 'unknown';
  const sonKontrol = (cicekData as { son_kontrol?: string | null })?.son_kontrol;
  const toplamSiparis = (cicekData as { toplam_siparis?: number })?.toplam_siparis ?? 0;
  /** Çiçek Sepeti toast'ını şartsız gösterir; entegrasyon varsa mock sipariş eklenir, tıklanınca modal açılır ve ses çalar */
  const showCiceksepetiTestToastUnconditional = () => {
    const win = window as any;
    let container = document.getElementById('ciceksepetiToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'ciceksepetiToastContainer';
      container.className = 'ciceksepeti-toast-container';
      container.setAttribute('aria-live', 'polite');
      const root = document.getElementById('root');
      (root || document.body).appendChild(container);
    }
    /* Container varsayılan gizli; test toast göstermek için sadece bu anda aç */
    (container as HTMLElement).style.display = 'flex';
    const existing = container.querySelector('.ciceksepeti-toast');
    if (existing) existing.remove();
    const teslimTarihiStr = new Date(Date.now() + 86400000 * 2).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
    const teslimSaati = '14:00';
    const siparisNo = 'CS-TEST-' + Date.now();
    const urunAdi = 'Kırmızı Gül Buketi';
    const mockOrder = {
      siparisNo,
      siparisVeren: 'Test Müşteri',
      siparisVerenTelefon: '0532 123 45 67',
      teslimKisi: 'Teslim Alan',
      teslimKisiTelefon: '0532 987 65 43',
      teslimAdresi: 'Kadıköy, İstanbul',
      receiverCity: 'İstanbul',
      receiverDistrict: 'Kadıköy',
      receiverRegion: 'Caferağa',
      teslimIl: 'İstanbul',
      teslimIlce: 'Kadıköy',
      teslimMahalle: 'Caferağa',
      urunAdi,
      urunYazisi: 'Test siparişi',
      fiyat: 150,
      teslimTarihi: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
      teslimSaati,
      kaynak: 'Çiçeksepeti',
      timestamp: Date.now(),
    };
    let integration = win.ciceksepetiIntegration;
    if (!integration && typeof win.CiceksepetiFloovonIntegration === 'function') {
      win.ciceksepetiIntegration = integration = new win.CiceksepetiFloovonIntegration();
    }
    if (integration && Array.isArray(integration.pendingOrders)) {
      integration.pendingOrders.push(mockOrder);
      if (localStorage.getItem('ciceksepeti_ses_bildirimi') !== 'false' && typeof integration.playNotificationSound === 'function') {
        integration.playNotificationSound();
      }
    }
    const orderItem = `
      <div class="ciceksepeti-toast-order-item" data-order-id="${siparisNo}">
        <div class="ciceksepeti-order-content">
          <div class="ciceksepeti-order-title">Yeni sipariş geldi!</div>
          <div class="ciceksepeti-order-info">
            <div class="info-line">
              <span class="info-label">Teslim Zamanı:</span>
              <span class="info-value">${teslimTarihiStr}, Saat ${teslimSaati}</span>
            </div>
            <div class="info-line">
              <span class="info-label">Sipariş Ürün:</span>
              <span class="info-value">${urunAdi}</span>
            </div>
          </div>
        </div>
        <div class="ciceksepeti-status-indicator"></div>
      </div>
    `;
    const toast = document.createElement('div');
    toast.className = 'ciceksepeti-toast';
    toast.innerHTML = `
      <div class="ciceksepeti-toast-header">
        <img src="/assets/cicek-sepeti/cicek-sepeti.svg" alt="Çiçeksepeti" class="ciceksepeti-toast-logo" onerror="this.style.display='none'">
        <button type="button" class="ciceksepeti-toast-close" aria-label="Kapat"><i class="icon-btn-kapat"></i></button>
      </div>
      <div class="ciceksepeti-toast-title">Çiçeksepeti üzerinden gelen siparişler:</div>
      <div class="ciceksepeti-toast-subtitle">Siparişleri onaylamak veya reddetmek için sipariş detayını görüntüleyin</div>
      <div class="ciceksepeti-toast-orders">${orderItem}</div>
    `;
    const closeBtn = toast.querySelector('.ciceksepeti-toast-close');
    if (closeBtn) closeBtn.addEventListener('click', () => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 400); });
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
  };

  const handleTestSiparis = async () => {
    setTesting(true);
    try {
      const res = await apiClient.post<{ success?: boolean; message?: string }>('/ayarlar/ciceksepeti/test-siparis');
      const msg = res.data?.message ?? '';
      const isNotConfigured = /yapılandırılmalıdır|entegrasyon|yapılandırın/i.test(msg);
      if (isNotConfigured) {
        showToast('warning', 'Çiçek Sepeti API ayarlarını kaydedin; API Key ve Secret girili olmalı.');
      } else {
        showToast('success', msg || 'Test siparişi gönderildi.');
        handleTestSiparisBildirimi();
      }
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'İşlem başarısız.');
    } finally {
      setTesting(false);
    }
  };

  /** Sadece test siparişi bildirimi: önce ciceksepeti.js (tıklanınca modal + SİPARİŞİ ONAYLA ile kart oluşur), yoksa şartsız toast. Ayarlar sayfasındayken de çalışsın diye simulateNewOrder(true) ile sayfa kontrolü atlanır. */
  const handleTestSiparisBildirimi = () => {
    const win = window as any;
    if (win.ciceksepetiIntegration && typeof win.ciceksepetiIntegration.simulateNewOrder === 'function') {
      win.ciceksepetiIntegration.simulateNewOrder(true);
      return;
    }
    if (typeof win.CiceksepetiFloovonIntegration === 'function') {
      win.ciceksepetiIntegration = new win.CiceksepetiFloovonIntegration();
      win.ciceksepetiIntegration.simulateNewOrder(true);
      return;
    }
    showCiceksepetiTestToastUnconditional();
  };
  const handleTestBaglanti = async () => {
    setTesting(true);
    try {
      const res = await apiClient.post<{ success?: boolean; ok?: boolean; message?: string }>('/ayarlar/ciceksepeti/test-baglanti');
      const msg = res.data?.message ?? (res.data?.ok ? 'Bağlantı bilgileri kayıtlı.' : 'API Key ve Secret girildikten sonra test edin.');
      showToast(res.data?.ok ? 'success' : 'info', msg);
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Test başarısız.');
    } finally {
      setTesting(false);
    }
  };
  return (
    <div className="ayarlar-ciceksepeti-wrapper">
      <div className="ayarlar-ciceksepeti-sol">
        <form ref={formRef} id="ayarlar-ciceksepeti-form" className="ayarlar-form" onSubmit={handleSubmit}>
          <div className="ayarlar-form-group">
            <label className="ayarlar-label">API KEY</label>
            <input type="password" className="ayarlar-input" placeholder="Çiçek Sepeti API Key'inizi giriniz" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
          </div>
          <div className="ayarlar-form-group">
            <label className="ayarlar-label">API SECRET</label>
            <input type="password" className="ayarlar-input" placeholder="Çiçek Sepeti API Secret'inizi giriniz" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} autoComplete="off" />
          </div>
          <div className="ayarlar-form-group">
            <label className="ayarlar-label">API MODU</label>
            <select className="ayarlar-input ayarlar-select" value={apiMode} onChange={(e) => setApiMode(e.target.value as 'test' | 'live')}>
              <option value="test">Test Modu (Geliştirme)</option>
              <option value="live">Canlı Modu (Üretim)</option>
            </select>
          </div>
          <div className="ayarlar-form-group">
            <label className="ayarlar-label">WEBHOOK URL</label>
            <input type="text" className="ayarlar-input" value={webhookUrl} readOnly />
            <small className="ayarlar-help">Bu URL&apos;yi Çiçek Sepeti panelinizde webhook ayarlarına ekleyiniz</small>
          </div>
          <div className="ayarlar-form-group">
            <label className="ayarlar-label">SİPARİŞ KONTROL SIKLIĞI</label>
            <select className="ayarlar-input ayarlar-select" value={siparisKontrol} onChange={(e) => setSiparisKontrol(e.target.value)}>
              <option value="30">30 saniye</option>
              <option value="60">1 dakika</option>
              <option value="300">5 dakika</option>
              <option value="600">10 dakika</option>
            </select>
            <small className="ayarlar-help">Çiçek Sepeti&apos;nden siparişlerin kontrol edilme sıklığı</small>
          </div>
          <div className="ayarlar-ciceksepeti-checkbox-kutu">
            <div className="ayarlar-form-group ayarlar-form-group-checkbox">
              <label className="ayarlar-label ayarlar-label-inline">
                <input type="checkbox" checked={otomatikOnay} onChange={(e) => setOtomatikOnay(e.target.checked)} className="ayarlar-checkbox" /> Otomatik Sipariş Onayı
              </label>
              <small className="ayarlar-help">Açık olduğunda gelen siparişler otomatik olarak onaylanır</small>
            </div>
          </div>
          <div className="ayarlar-ciceksepeti-checkbox-kutu">
            <div className="ayarlar-form-group ayarlar-form-group-checkbox">
              <label className="ayarlar-label ayarlar-label-inline">
                <input type="checkbox" checked={sesBildirimi} onChange={(e) => setSesBildirimi(e.target.checked)} className="ayarlar-checkbox" /> Ses Bildirimi
              </label>
              <small className="ayarlar-help">Yeni sipariş geldiğinde ses bildirimi çalar (uygulama olarak açıksa ilk dokunuştan sonra çalışır)</small>
            </div>
          </div>
          <div className="ayarlar-ciceksepeti-checkbox-kutu">
            <div className="ayarlar-form-group">
              <label className="ayarlar-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bell size={16} aria-hidden /> Telefon bildirimleri
              </label>
              {notifPermission === 'unsupported' && (
                <small className="ayarlar-help">Bu tarayıcı bildirimleri desteklemiyor.</small>
              )}
              {notifPermission !== 'unsupported' && (
                <>
                  <small className="ayarlar-help" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    {notifPermission === 'granted'
                      ? 'Açık — Çiçek Sepeti\'nden yeni sipariş geldiğinde telefondaki bildirim çubuğunda (ve kilidi ekranında) uyarı görünür. Uygulama arka planda veya sekme kapalıyken de bildirim gelir.'
                      : notifPermission === 'denied'
                        ? 'Kapalı — Tarayıcı ayarlarından bildirim iznini açabilirsiniz.'
                        : 'Yeni sipariş geldiğinde telefondaki bildirim ekranında da uyarı görmek için izin verin.'}
                  </small>
                  {notifPermission !== 'granted' && (
                    <button
                      type="button"
                      className="ayarlar-btn ayarlar-btn-secondary"
                      style={{ marginTop: 4 }}
                      onClick={() => {
                        const integration = (window as any).ciceksepetiIntegration;
                        if (integration && typeof integration.requestNotificationPermission === 'function') {
                          integration.requestNotificationPermission((p: string) => {
                            setNotifPermission(p as 'default' | 'granted' | 'denied');
                            if (p === 'granted') showToast('success', 'Bildirim izni verildi. Yeni siparişlerde telefon bildirimi görünecek.');
                            if (p === 'denied') showToast('info', 'Bildirim kapalı. İsterseniz tarayıcı ayarlarından açabilirsiniz.');
                          });
                        } else {
                          if (typeof (window as any).Notification !== 'undefined') {
                            (window as any).Notification.requestPermission().then((p: string) => {
                              setNotifPermission(p as 'default' | 'granted' | 'denied');
                              if (p === 'granted') showToast('success', 'Bildirim izni verildi.');
                            });
                          }
                        }
                      }}
                    >
                      <Bell size={14} style={{ marginRight: 6 }} aria-hidden />
                      {notifPermission === 'denied' ? 'İzin tarayıcıda kapalı' : 'Telefon bildirimlerini aç'}
                    </button>
                  )}
                  {notifPermission === 'granted' && (
                    <>
                      <div className="ayarlar-ciceksepeti-bildirim-butonlar">
                        <button
                          type="button"
                          className="ayarlar-btn"
                          onClick={() => {
                            const integration = (window as any).ciceksepetiIntegration;
                            if (integration && typeof integration.showSystemNotification === 'function') {
                              integration.showSystemNotification('Test — Çiçek Sepeti', 'Bildirim ayarı çalışıyor. Yeni siparişte böyle görünecek.');
                              if (localStorage.getItem('ciceksepeti_ses_bildirimi') !== 'false' && typeof integration.playNotificationSound === 'function') {
                                integration.playNotificationSound();
                              }
                              showToast('success', 'Test bildirimi gönderildi. Bildirim çubuğuna veya kilidi ekranına bakın.');
                            } else {
                              try {
                                new (window as any).Notification('Test — Çiçek Sepeti', { body: 'Bildirim ayarı çalışıyor.' });
                                showToast('success', 'Test bildirimi gönderildi.');
                              } catch (err) {
                                showToast('error', 'Bu cihazda bildirim gösterilemedi. Bazı telefonlarda (örn. iPhone) yalnızca uygulama arka plandayken veya site ana ekrana eklendiyse çalışır.');
                              }
                            }
                          }}
                        >
                          <Bell size={18} aria-hidden />
                          Şimdi test bildirimi gönder
                        </button>
                        <button
                          type="button"
                          className="ayarlar-btn"
                          style={{ fontSize: '0.875rem' }}
                          onClick={() => showToast('info', 'Bildirimleri kapatmak için tarayıcı veya telefon ayarlarından bu site için bildirim iznini kapatın. (Örn. Chrome: adres çubuğundaki kilit/bilgi simgesi → Site ayarları → Bildirimler)')}
                        >
                          <HelpCircle size={18} aria-hidden />
                          Bildirimleri nasıl kapatırım?
                        </button>
                      </div>
                      <small className="ayarlar-help" style={{ display: 'block', marginTop: 8 }}>
                        Görünmüyorsa: Bazı telefonlarda (özellikle iPhone) bildirimler yalnızca sekme arka plandayken veya site ana ekrana eklendiyse çıkar. Opera/Chrome Android’de genelde çalışır.
                      </small>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="ayarlar-ciceksepeti-checkbox-kutu">
            <div className="ayarlar-form-group ayarlar-form-group-checkbox">
            <label className="ayarlar-label ayarlar-label-inline">
              <input
                type="checkbox"
                checked={testBildirimi}
                onChange={(e) => setTestBildirimi(e.target.checked)}
                className="ayarlar-checkbox"
              />
              Test Sipariş Bildirimlerini Göster
            </label>
            <small className="ayarlar-help">Açık olduğunda belirli aralıklarla test sipariş popup’ı gelir; siparişe tıklayınca detay açılır, SİPARİŞİ ONAYLA ile organizasyon kartı oluşur</small>
            </div>
          </div>
        </form>
      </div>
      <div className="ayarlar-ciceksepeti-sag">
        <div className="ayarlar-sekme-baslik-wrapper">
          <label className="ayarlar-label ayarlar-sekme-baslik">API Durumu ve Test Sonuçları</label>
          <p className="ayarlar-fatura-bolum-aciklama">Çiçek Sepeti API bağlantınızın durumunu kontrol edin ve test işlemlerini gerçekleştirin.</p>
        </div>
        <div className="ayarlar-ciceksepeti-durum-alan">
          <div className="ayarlar-form-group">
            <label className="ayarlar-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Wrench size={16} aria-hidden /> API Bağlantısı
            </label>
            <span className="ayarlar-count-badge ayarlar-count-badge-ciceksepeti" style={{ backgroundColor: apiStatus === 'ok' ? 'var(--mor-primary)' : 'var(--sari-uyari, #f59e0b)', color: '#fff', padding: '0.25rem 0.5rem', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600 }}>
              {apiStatus === 'ok' ? 'KAYITLI' : 'BİLİNMİYOR'}
            </span>
            <small className="ayarlar-help" style={{ display: 'block', marginTop: '0.25rem' }}>
              {apiStatus === 'ok' ? 'API bilgileri kayıtlı.' : 'API bağlantısı henüz test edilmedi'}
            </small>
          </div>
          <div className="ayarlar-form-group">
            <label className="ayarlar-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={16} aria-hidden /> Son Kontrol
            </label>
            <span className="ayarlar-help">{sonKontrol || 'Henüz kontrol edilmedi'}</span>
          </div>
          <div className="ayarlar-form-group">
            <label className="ayarlar-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShoppingCart size={16} aria-hidden /> Toplam Sipariş
            </label>
            <span className="ayarlar-help">{toplamSiparis} sipariş</span>
          </div>
        </div>
        <div className="ayarlar-ciceksepeti-test-butonlar">
          <button type="button" className="ayarlar-btn ayarlar-btn-primary" onClick={handleTestBaglanti} disabled={testing}>
            <Plug size={16} aria-hidden /> Bağlantıyı test et
          </button>
          <button type="button" className="ayarlar-btn ayarlar-btn-secondary" onClick={handleTestSiparis} disabled={testing}>
            <ShoppingCart size={16} aria-hidden /> Test siparişi gönder
          </button>
          <button type="button" className="ayarlar-btn ayarlar-btn-secondary" onClick={handleTestSiparisBildirimi}>
            <Send size={16} aria-hidden /> Test siparişi bildirimi gönder
          </button>
          <button type="button" className="ayarlar-btn ayarlar-btn-secondary" onClick={handleManuelKontrol} disabled={testing}>
            <RefreshCw size={16} aria-hidden /> Manuel sipariş kontrolü
          </button>
        </div>
      </div>
      <div className="ayarlar-ciceksepeti-actions">
        {isDirty && (
          <button type="button" className="ayarlar-btn ayarlar-btn-secondary" onClick={handleVazgec}>VAZGEÇ</button>
        )}
        <button type="submit" form="ayarlar-ciceksepeti-form" className="ayarlar-btn ayarlar-btn-primary" disabled={saving || isLoading}>{saving ? 'KAYDEDİLİYOR...' : 'AYARLARI KAYDET'}</button>
      </div>
    </div>
  );
}

function YazdirmaAyarlariForm() {
  const queryClient = useQueryClient();
  const { data: yazdirmaData, isLoading } = useQuery({
    queryKey: ['ayarlar-yazdirma'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data?: { logo_png_url?: string; is_active?: boolean } }>('/ayarlar/yazdirma');
      return res.data?.data ?? {};
    },
    staleTime: 60 * 1000,
  });
  const [logoPreview, setLogoPreview] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [logoUploading, setLogoUploading] = useState(false);
  React.useEffect(() => {
    if (yazdirmaData) {
      setLogoPreview(yazdirmaData.logo_png_url ?? '');
      setIsActive(yazdirmaData.is_active !== false);
    }
  }, [yazdirmaData]);
  const handleYazdirmaLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/png')) {
      showToast('warning', 'Lütfen PNG formatında bir dosya seçin.');
      return;
    }
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await apiClient.post<{ success: boolean; data?: { logo_png_url?: string; url?: string } }>('/ayarlar/yazdirma/logo', formData);
      const url = res.data?.data?.logo_png_url ?? res.data?.data?.url ?? '';
      if (url) setLogoPreview(url);
      queryClient.setQueryData(['ayarlar-yazdirma'], (prev: Record<string, unknown> | undefined) => ({ ...prev, logo_png_url: url, logo_png_path: url }));
      queryClient.invalidateQueries({ queryKey: ['ayarlar-yazdirma'] });
      showToast('success', 'Logo yüklendi.');
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Logo yüklenemedi.');
    } finally {
      setLogoUploading(false);
    }
  };
  const handleYazdirmaLogoRemove = async () => {
    try {
      await apiClient.put('/ayarlar/yazdirma', { logo_png_path: null, is_active: isActive });
      setLogoPreview('');
      queryClient.setQueryData(['ayarlar-yazdirma'], (prev: Record<string, unknown> | undefined) => ({ ...prev, logo_png_url: undefined, logo_png_path: null }));
      queryClient.invalidateQueries({ queryKey: ['ayarlar-yazdirma'] });
      showToast('success', 'Logo kaldırıldı.');
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Kaldırılamadı.');
    }
  };
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await apiClient.put('/ayarlar/yazdirma', { is_active: isActive });
      queryClient.setQueryData(['ayarlar-yazdirma'], (prev: Record<string, unknown> | undefined) => ({ ...prev, is_active: isActive }));
      queryClient.invalidateQueries({ queryKey: ['ayarlar-yazdirma'] });
      showToast('success', 'Yazdırma ayarları kaydedildi.');
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Kaydedilemedi.');
    }
  };
  const backendBase = getApiBaseUrl().replace(/\/api\/?$/, '');
  const logoDisplayUrl = logoPreview
    ? (logoPreview.startsWith('http') ? logoPreview : `${backendBase || (typeof window !== 'undefined' ? window.location.origin : '')}${logoPreview.startsWith('/') ? logoPreview : '/' + logoPreview}`)
    : '';
  return (
    <div className="ayarlar-yazdirma-wrapper">
      <form className="ayarlar-form" onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div className="ayarlar-yazdirma-sol-kutu">
            <div className="ayarlar-logo-alan ayarlar-logo-alan-inline" style={{ marginBottom: '1rem' }}>
              {logoPreview ? (
                <img src={logoDisplayUrl || logoPreview} alt="Yazdırma logosu" className="ayarlar-logo-img" style={{ maxHeight: '100px', objectFit: 'contain' }} />
              ) : (
                <div className="ayarlar-logo-placeholder">PNG logo yok</div>
              )}
              <div className="ayarlar-logo-butonlar">
                <button type="button" className="ayarlar-btn ayarlar-btn-primary" disabled={logoUploading} onClick={() => document.getElementById('yazdirma-logo-input')?.click()}>{logoUploading ? 'Yükleniyor...' : 'Yükle'}</button>
                <button type="button" className="ayarlar-btn ayarlar-btn-secondary" onClick={handleYazdirmaLogoRemove}>Kaldır</button>
              </div>
              <input id="yazdirma-logo-input" type="file" accept="image/png" className="hidden" onChange={handleYazdirmaLogoFile} />
            </div>
            <div className="ayarlar-form-group ayarlar-form-group-checkbox" style={{ marginBottom: 0 }}>
              <label className="ayarlar-label ayarlar-label-inline">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="ayarlar-checkbox" /> Yazdırma logosu aktif olsun
              </label>
            </div>
          </div>
          <div className="ayarlar-yazdirma-notlar" style={{ flex: '1', minWidth: '260px' }}>
            <div className="ayarlar-form-group" style={{ marginBottom: 0 }}>
              <div className="ayarlar-yazdirma-notlar">
                <div>
                  <span className="ayarlar-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <Info size={18} className="ayarlar-help-icon" aria-hidden />
                    Yazdırma Notları
                  </span>
                  <p className="ayarlar-yazdirma-desc" style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.5 }}>
                    Bu alandan yüklediğiniz PNG logo, tüm yazdırma çıktılarında ve sipariş künyesi çıktılarında kullanılacaktır. Logonun güncellenebilmesi için yükleme sonrasında mutlaka kaydedin.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="ayarlar-form-actions">
          <button type="submit" className="ayarlar-btn ayarlar-btn-primary" disabled={isLoading}>KAYDET</button>
        </div>
      </form>
    </div>
  );
}

type IletisimKisi = { id: number; kisi_ad_soyad: string; kisi_telefon: string };

function GonderimAyarlariTab() {
  const queryClient = useQueryClient();
  const { isBaslangicPlan } = usePlan();
  const [searchParams] = useSearchParams();
  const [gonderimSubTab, setGonderimSubTab] = useState<'iletisim' | 'mesaj-sablonlari' | 'rapor'>('iletisim');
  const [yeniAd, setYeniAd] = useState('');
  const iletisimTelInput = usePhoneInput('');
  const [editingIletisimId, setEditingIletisimId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [mesajSablonuValue, setMesajSablonuValue] = useState('');
  const [savingSablon, setSavingSablon] = useState(false);
  const [raporEposta, setRaporEposta] = useState('');
  const [raporGun, setRaporGun] = useState('1');
  const [raporSaat, setRaporSaat] = useState('18:00');
  const [savingRapor, setSavingRapor] = useState(false);
  const [sendingRapor, setSendingRapor] = useState(false);

  React.useEffect(() => {
    const subtab = searchParams.get('subtab');
    if (subtab === 'iletisim' || subtab === 'mesaj-sablonlari' || subtab === 'rapor') setGonderimSubTab(subtab);
  }, [searchParams]);

  // Gönderim alt sekmeleri: aktif buton değiştiğinde butonu görünecek şekilde kaydır
  React.useEffect(() => {
    const el = document.querySelector('.ayarlar-tab-icerik .ayarlar-subtab-nav .ayarlar-subtab-btn.active');
    if (el && el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [gonderimSubTab]);

  const { data: gonderimData, isLoading } = useQuery({
    queryKey: ['ayarlar-gonderim'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data?: Record<string, unknown> & { iletisimKisileri?: IletisimKisi[] } }>('/ayarlar/gonderim');
      return res.data;
    },
    staleTime: 60 * 1000,
  });

  const { data: raporData } = useQuery({
    queryKey: ['ayarlar-gonderim-rapor'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data?: { haftalik_rapor_eposta?: string | null; haftalik_rapor_gun?: string; haftalik_rapor_saat?: string } }>('/ayarlar/gonderim/rapor');
      return res.data;
    },
    staleTime: 60 * 1000,
    enabled: gonderimSubTab === 'rapor',
  });

  const { data: bankaHesaplariGonderim } = useQuery({
    queryKey: ['ayarlar-fatura-banka-hesaplari'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data?: Array<{ id: number; banka_adi?: string; iban?: string; sube?: string; hesap_sahibi?: string }> }>('/ayarlar/fatura/banka-hesaplari');
      return (res.data?.data ?? []) as Array<{ id: number; banka_adi?: string; iban?: string; sube?: string; hesap_sahibi?: string }>;
    },
    staleTime: 2 * 60 * 1000,
    enabled: gonderimSubTab === 'mesaj-sablonlari',
  });
  const bankaHesaplariMesaj = bankaHesaplariGonderim ?? [];

  React.useEffect(() => {
    if (raporData?.data) {
      setRaporEposta(raporData.data.haftalik_rapor_eposta || '');
      setRaporGun(raporData.data.haftalik_rapor_gun || '1');
      setRaporSaat(raporData.data.haftalik_rapor_saat || '18:00');
    }
  }, [raporData?.data]);

  const iletisimKisileri = (gonderimData?.data?.iletisimKisileri as IletisimKisi[] | undefined) || [];
  const kisiler = iletisimKisileri.map((k) => ({
    key: String(k.id),
    id: k.id,
    ad: (k.kisi_ad_soyad || '').trim(),
    tel: (k.kisi_telefon || '').trim(),
  })).filter((k) => k.ad || k.tel);

  // Editörde IBAN bloğu gösterilmez; gönderimde arka planda eklenir. Yüklerken bu bloğu çıkar.
  const stripIbanBlockFromTemplate = (text: string): string => {
    if (!text || typeof text !== 'string') return '';
    const t = text.trim();
    const ibanStart = 'Sipariş ücretini aşağıdaki IBAN hesaplarımıza gönderebilirsiniz:';
    const idx = t.indexOf(ibanStart);
    if (idx === -1) return t;
    let out = t.slice(0, idx).trimEnd();
    const ibanBlockEnd = '_Lütfen EFT/Havale işlemi açıklamasına isminizi ve sipariş detayını yazınız._';
    const afterBlock = t.slice(idx).indexOf(ibanBlockEnd);
    if (afterBlock !== -1) {
      const rest = t.slice(idx + afterBlock + ibanBlockEnd.length).trim();
      if (rest) out = out ? `${out}\n\n${rest}` : rest;
    }
    return out.trim();
  };

  React.useEffect(() => {
    const raw = gonderimData?.data?.musteri_sablonu_whatsapp;
    const value = typeof raw === 'string' ? stripIbanBlockFromTemplate(raw) : '';
    setMesajSablonuValue(value);
  }, [gonderimData?.data?.musteri_sablonu_whatsapp]);

  const mesajdaKullanilacakBankaIdsRaw = gonderimData?.data?.mesajda_kullanilacak_banka_ids;
  const [mesajSablonuSecilenBankaIds, setMesajSablonuSecilenBankaIds] = useState<number[]>(() => (Array.isArray(mesajdaKullanilacakBankaIdsRaw) ? mesajdaKullanilacakBankaIdsRaw : []));
  React.useEffect(() => {
    if (Array.isArray(mesajdaKullanilacakBankaIdsRaw)) setMesajSablonuSecilenBankaIds(mesajdaKullanilacakBankaIdsRaw);
  }, [mesajdaKullanilacakBankaIdsRaw]);

  const [gonderimSortField, setGonderimSortField] = useState<string | null>(null);
  const [gonderimSortDir, setGonderimSortDir] = useState<'asc' | 'desc'>('asc');
  const sortedKisiler = React.useMemo(() => {
    const list = [...kisiler];
    if (!gonderimSortField) return list;
    list.sort((a, b) => {
      let av: string | number = (a as Record<string, unknown>)[gonderimSortField] as string ?? '';
      let bv: string | number = (b as Record<string, unknown>)[gonderimSortField] as string ?? '';
      if (typeof av === 'string') av = av.toLocaleLowerCase('tr-TR');
      if (typeof bv === 'string') bv = bv.toLocaleLowerCase('tr-TR');
      if (av < bv) return gonderimSortDir === 'asc' ? -1 : 1;
      if (av > bv) return gonderimSortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [kisiler, gonderimSortField, gonderimSortDir]);
  const handleGonderimSort = (field: string, dir: 'asc' | 'desc') => {
    setGonderimSortField(field);
    setGonderimSortDir(dir);
  };

  // İletişim ayarlarında düzenle moduna girince sayfanın en üstüne scroll et
  React.useEffect(() => {
    if (!editingIletisimId) return;
    const t = setTimeout(() => {
      const pageWrapper = document.querySelector('.ayarlar-page.page-wrapper') as HTMLElement | null;
      if (pageWrapper) pageWrapper.scrollTo({ top: 0, behavior: 'smooth' });
      const main = document.querySelector('main[data-main-content]') as HTMLElement | null;
      if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
    return () => clearTimeout(t);
  }, [editingIletisimId]);

  const handleMesajSablonuKaydet = async () => {
    if (mesajSablonuSecilenBankaIds.length === 0) {
      showToast('warning', 'En az bir banka hesabı seçmelisiniz. Aşağıdaki tablodan mesajda görünecek hesapları işaretleyin.');
      return;
    }
    setSavingSablon(true);
    try {
      await apiClient.put('/ayarlar/gonderim', {
        musteri_sablonu_whatsapp: mesajSablonuValue.trim() || null,
        mesajda_kullanilacak_banka_ids: mesajSablonuSecilenBankaIds,
      });
      queryClient.invalidateQueries({ queryKey: ['ayarlar-gonderim'] });
      showToast('success', 'Mesaj şablonu kaydedildi.');
    } catch (err) {
      console.error(err);
      showToast('error', 'Mesaj şablonu kaydedilemedi.');
    } finally {
      setSavingSablon(false);
    }
  };

  const handleEkle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const ad = yeniAd.trim();
    const tel = iletisimTelInput.cleanValue ? iletisimTelInput.cleanValue.replace(/\D/g, '').slice(-10) : '';
    if (!ad || !tel) {
      showToast('warning', 'Kişi adı ve telefon numarası giriniz');
      return;
    }
    if (tel.length < 10) {
      showToast('warning', 'Geçerli bir telefon numarası giriniz');
      return;
    }
    setSaving(true);
    try {
      if (editingIletisimId) {
        await apiClient.put(`/ayarlar/gonderim/iletisim-kisileri/${editingIletisimId}`, { kisi_ad_soyad: ad, kisi_telefon: tel });
        queryClient.invalidateQueries({ queryKey: ['ayarlar-gonderim'] });
        setYeniAd('');
        iletisimTelInput.setDisplayValue('');
        setEditingIletisimId(null);
        showToast('success', 'Kişi güncellendi');
      } else {
        await apiClient.post('/ayarlar/gonderim/iletisim-kisileri', { kisi_ad_soyad: ad, kisi_telefon: tel });
        queryClient.invalidateQueries({ queryKey: ['ayarlar-gonderim'] });
        setYeniAd('');
        iletisimTelInput.setDisplayValue('');
        showToast('success', 'Kişi eklendi');
      }
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleSil = async (id: number) => {
    setSaving(true);
    try {
      await apiClient.delete(`/ayarlar/gonderim/iletisim-kisileri/${id}`);
      queryClient.invalidateQueries({ queryKey: ['ayarlar-gonderim'] });
      if (editingIletisimId === id) {
        setEditingIletisimId(null);
        setYeniAd('');
        iletisimTelInput.setDisplayValue('');
      }
      showToast('success', 'Kişi silindi');
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Silinemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleDüzenleIletisim = (k: { id: number; ad: string; tel: string }) => {
    setEditingIletisimId(k.id);
    setYeniAd(k.ad);
    iletisimTelInput.setDisplayValue(k.tel || '');
  };

  const handleVazgecIletisim = () => {
    setEditingIletisimId(null);
    setYeniAd('');
    iletisimTelInput.setDisplayValue('');
  };

  const handleRaporKaydet = async () => {
    setSavingRapor(true);
    try {
      await apiClient.put('/ayarlar/gonderim/rapor', {
        haftalik_rapor_eposta: raporEposta.trim() || null,
        haftalik_rapor_gun: raporGun || '1',
        haftalik_rapor_saat: raporSaat || '18:00',
      });
      queryClient.invalidateQueries({ queryKey: ['ayarlar-gonderim-rapor'] });
      queryClient.invalidateQueries({ queryKey: ['ayarlar-gonderim'] });
      showToast('success', 'Rapor ayarları kaydedildi.');
    } catch (err) {
      console.error(err);
      showToast('error', 'Rapor ayarları kaydedilemedi.');
    } finally {
      setSavingRapor(false);
    }
  };

  const handleRaporSimdiGonder = async () => {
    if (!raporEposta?.trim()) {
      showToast('error', 'Önce e-posta adresini girin ve kaydedin.');
      return;
    }
    setSendingRapor(true);
    try {
      const res = await apiClient.post<{ success: boolean; message?: string; error?: string }>('/ayarlar/weekly-report/send');
      if (res.data?.success) {
        showToast('success', res.data.message || 'Haftalık rapor e-posta ile gönderildi.');
        queryClient.invalidateQueries({ queryKey: ['ayarlar-gonderim-rapor'] });
      } else {
        showToast('error', res.data?.error || 'Rapor gönderilemedi.');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showToast('error', msg || 'Rapor gönderilemedi.');
    } finally {
      setSendingRapor(false);
    }
  };

  return (
    <div>
      <div className="ayarlar-subtab-nav">
        <button
          type="button"
          data-subtab="iletisim"
          onClick={() => setGonderimSubTab('iletisim')}
          className={`ayarlar-subtab-btn ${gonderimSubTab === 'iletisim' ? 'active' : ''}`}
        >
          İletişim Ayarları
        </button>
        {isBaslangicPlan === false && (
          <>
            <button
              type="button"
              data-subtab="rapor"
              onClick={() => setGonderimSubTab('rapor')}
              className={`ayarlar-subtab-btn ${gonderimSubTab === 'rapor' ? 'active' : ''}`}
            >
              Rapor Ayarları
            </button>
            <button
              type="button"
              data-subtab="mesaj-sablonlari"
              onClick={() => setGonderimSubTab('mesaj-sablonlari')}
              className={`ayarlar-subtab-btn ${gonderimSubTab === 'mesaj-sablonlari' ? 'active' : ''}`}
            >
              Müşteri Mesaj Şablonları
            </button>
          </>
        )}
      </div>
      {gonderimSubTab === 'iletisim' && (
        <div className={`flex flex-col lg:flex-row gap-6 ayarlar-form-row ${editingIletisimId ? 'ayarlar-form-active' : ''}`}>
          <div className="ayarlar-sol-kolon">
            <div className="ayarlar-panel-form">
              <h3 className="ayarlar-panel-form-title">{editingIletisimId ? 'Kişiyi Düzenle' : 'Yeni İletişim Kişisi Ekle'}</h3>
              <p className="ayarlar-panel-desc ayarlar-panel-desc-iletisim">
                Kart menüsündeki &quot;WhatsApp Sipariş Listesi Gönder&quot; ve &quot;Sipariş Şablonu ve IBAN Bilgisi Gönder&quot; butonlarında seçilecek numaralar. WhatsApp bağlantısı için üst menüdeki WhatsApp butonunu kullanın.
              </p>
              {isLoading ? (
                <div className="ayarlar-loading"><LoadingSpinner size="md" /></div>
              ) : (
                <form onSubmit={handleEkle} className="ayarlar-form">
                  <div className="ayarlar-form-group">
                    <label className="ayarlar-label">Kişi Adı</label>
                    <input type="text" value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} placeholder="Kişi Adı" className="ayarlar-input" required />
                  </div>
                  <div className="ayarlar-form-group">
                    <label className="ayarlar-label">Telefon</label>
                    <input type="tel" ref={iletisimTelInput.inputRef} value={iletisimTelInput.displayValue} onChange={iletisimTelInput.handleChange} onKeyDown={iletisimTelInput.handleKeyDown} onFocus={iletisimTelInput.handleFocus} onPaste={iletisimTelInput.handlePaste} placeholder="+90 (5XX) XXX XX XX" className="ayarlar-input" required data-phone-input="standard" />
                  </div>
                  <div className="ayarlar-form-actions">
                    {editingIletisimId && (
                      <button type="button" onClick={handleVazgecIletisim} className="ayarlar-btn ayarlar-btn-secondary">VAZGEÇ</button>
                    )}
                    <button type="submit" disabled={saving} className="ayarlar-btn ayarlar-btn-primary">
                      {editingIletisimId ? 'GÜNCELLE' : 'EKLE'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
          <div className="ayarlar-sag-kolon">
            <div className="ayarlar-panel">
              <div className="ayarlar-panel-header-sol">
                <h3 className="ayarlar-panel-form-title">Sipariş Listesi WhatsApp Numaraları</h3>
                <span className="ayarlar-count-badge">{kisiler.length} Kişi</span>
              </div>
              {isLoading ? (
                <div className="ayarlar-loading"><LoadingSpinner size="md" /></div>
              ) : kisiler.length === 0 ? (
                <EmptyState variant="soft" title="Henüz numara eklenmemiş" description="Sol taraftaki formdan yeni kişi ekleyebilirsiniz." icon={<FileSearch size={28} aria-hidden />} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full ayarlar-tablosu">
                    <thead>
                      <tr>
                        <TableSortHeader field="ad" label="Kişi Adı" currentSort={gonderimSortField} sortDirection={gonderimSortDir} onSort={handleGonderimSort} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase" />
                        <TableSortHeader field="tel" label="Telefon" currentSort={gonderimSortField} sortDirection={gonderimSortDir} onSort={handleGonderimSort} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase" />
                        <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase table-col-islem">İŞLEMLER</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {sortedKisiler.map((k) => (
                        <tr key={k.key} className="hover:bg-gray-50 ayarlar-table-row">
                          <td data-label="Kişi Adı" className="px-4 py-3 text-sm font-medium text-gray-900">{k.ad}</td>
                          <td data-label="Telefon" className="px-4 py-3 text-sm text-gray-600">{formatPhoneNumber(k.tel)}</td>
                          <td data-label="İşlemler" className="px-4 py-3 text-sm font-medium table-col-islem">
                            <div className="islem-ikonlar">
                              <button
                                type="button"
                                className="islem-ikon duzenle-ikon"
                                data-tooltip="Düzenle"
                                aria-label="Düzenle"
                                onClick={() => handleDüzenleIletisim(k)}
                                disabled={saving}
                              >
                                <Pencil size={16} aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSil(k.id)}
                                disabled={saving}
                                className="islem-ikon sil-ikon"
                                data-tooltip="Sil"
                                aria-label="Sil"
                              >
                                <Trash2 size={16} aria-hidden />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {isBaslangicPlan === false && gonderimSubTab === 'rapor' && (
        <div className="ayarlar-panel">
          <div className="ayarlar-panel-header">
            <h3 className="ayarlar-panel-form-title">Haftalık Rapor Gönderimi</h3>
            <p className="ayarlar-panel-desc">
              <Info size={18} className="ayarlar-help-icon ayarlar-panel-desc-icon" aria-hidden />
              Haftalık raporların gönderileceği e-posta adresi ve gönderim günü/saati.
            </p>
          </div>
          {raporData === undefined ? (
            <div className="ayarlar-loading"><LoadingSpinner size="md" /></div>
          ) : (
            <div className="ayarlar-form">
              <div className="ayarlar-form-row-3">
                <div className="ayarlar-form-group">
                  <label className="ayarlar-label" htmlFor="rapor-eposta">E-posta Adresi</label>
                  <input
                    id="rapor-eposta"
                    type="email"
                    className="ayarlar-input"
                    placeholder="ornek@email.com"
                    value={raporEposta}
                    onChange={(e) => setRaporEposta(e.target.value)}
                  />
                  <small className="ayarlar-panel-desc" style={{ display: 'block', marginTop: 4 }}>
                    Raporun gönderileceği e-posta adresi
                  </small>
                </div>
                <div className="ayarlar-form-group">
                  <label className="ayarlar-label" htmlFor="rapor-gun">Gönderim Günü</label>
                  <select
                    id="rapor-gun"
                    className="ayarlar-input"
                    value={raporGun}
                    onChange={(e) => setRaporGun(e.target.value)}
                  >
                    <option value="1">Pazartesi</option>
                    <option value="2">Salı</option>
                    <option value="3">Çarşamba</option>
                    <option value="4">Perşembe</option>
                    <option value="5">Cuma</option>
                    <option value="6">Cumartesi</option>
                    <option value="7">Pazar</option>
                  </select>
                  <small className="ayarlar-panel-desc" style={{ display: 'block', marginTop: 4 }}>
                    Raporun düzenli olarak gönderileceği gün
                  </small>
                </div>
                <div className="ayarlar-form-group">
                  <label className="ayarlar-label" htmlFor="rapor-saat">Gönderim Saati</label>
                  <input
                    id="rapor-saat"
                    type="time"
                    className="ayarlar-input"
                    value={raporSaat}
                    onChange={(e) => setRaporSaat(e.target.value)}
                  />
                  <small className="ayarlar-panel-desc" style={{ display: 'block', marginTop: 4 }}>
                    Raporun düzenli olarak gönderileceği saat
                  </small>
                </div>
              </div>
              <div className="ayarlar-form-actions">
                <button
                  type="button"
                  className="ayarlar-btn ayarlar-btn-primary"
                  onClick={handleRaporKaydet}
                  disabled={savingRapor}
                >
                  {savingRapor ? 'KAYDEDİLİYOR...' : 'KAYDET'}
                </button>
                <button
                  type="button"
                  className="ayarlar-btn ayarlar-btn-secondary"
                  onClick={handleRaporSimdiGonder}
                  disabled={sendingRapor || savingRapor}
                >
                  {sendingRapor ? 'GÖNDERİLİYOR...' : 'ŞİMDİ GÖNDER'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {isBaslangicPlan === false && gonderimSubTab === 'mesaj-sablonlari' && (
        <div className="ayarlar-panel">
          <div className="ayarlar-panel-header">
            <h3 className="ayarlar-panel-form-title">Müşteri Sipariş Mesaj Şablonu</h3>
            <p className="ayarlar-panel-desc">
              <Info size={18} className="ayarlar-help-icon ayarlar-panel-desc-icon" aria-hidden />
              WhatsApp &quot;Sipariş Şablonu ve IBAN Bilgisi Gönder&quot; butonu ile iletişim kişilerine gönderilen hazır müşteri mesajı.
            </p>
          </div>
          {isLoading ? (
            <div className="ayarlar-loading"><LoadingSpinner size="md" /></div>
          ) : (
            <div className="ayarlar-form">
              <div className="ayarlar-form-group">
                <label className="ayarlar-label">Şablon metni</label>
                <textarea
                  className="ayarlar-input ayarlar-textarea-mesaj-sablonu"
                  value={mesajSablonuValue}
                  onChange={(e) => setMesajSablonuValue(e.target.value)}
                  placeholder="Mesaj metnini buraya yazın. Kaydedince veritabanına yazılır."
                  rows={14}
                  style={{ resize: 'vertical', minHeight: 280 }}
                />
                <p className="ayarlar-panel-desc" style={{ marginTop: 8, marginBottom: 0 }}>
                  Banka hesabı/hesapları varsa ve seçiliyse yukarıdaki mesajın altında otomatik olarak gönderilecektir.
                </p>
              </div>
              {bankaHesaplariMesaj.length > 0 && (
              <div className="ayarlar-form-group" style={{ marginTop: 16 }}>
                <label className="ayarlar-label">Mesajda kullanılacak IBAN bilgileri</label>
                <p className="ayarlar-panel-desc" style={{ marginTop: 4, marginBottom: 8 }}>
                  <Info size={18} className="ayarlar-help-icon ayarlar-panel-desc-icon" aria-hidden />
                  Şablonda kullanılacak banka/IBAN hesaplarını işaretleyin. Hesap eklemek için Genel → Banka Hesap Bilgileri sekmesine gidin.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full ayarlar-tablosu">
                    <thead>
                      <tr>
                        <th className="ayarlar-banka-checkbox-col px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase w-10">Mesajda kullan</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Banka</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">IBAN</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Şube / Hesap sahibi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {bankaHesaplariMesaj.map((b) => (
                        <tr key={b.id}>
                          <td data-label="Mesajda kullan" className="ayarlar-banka-checkbox-col px-4 py-2">
                            <label className="ayarlar-label ayarlar-label-inline">
                              <input
                                type="checkbox"
                                className="ayarlar-checkbox"
                                checked={mesajSablonuSecilenBankaIds.includes(b.id)}
                                onChange={() => {
                                  if (mesajSablonuSecilenBankaIds.includes(b.id)) {
                                    setMesajSablonuSecilenBankaIds((prev) => prev.filter((id) => id !== b.id));
                                  } else {
                                    setMesajSablonuSecilenBankaIds((prev) => [...prev, b.id]);
                                  }
                                }}
                                aria-label={`Mesajda kullan: ${b.banka_adi || b.iban || ''}`}
                              />
                              <span className="sr-only">Mesajda kullan</span>
                            </label>
                          </td>
                          <td data-label="Banka">{b.banka_adi || '—'}</td>
                          <td data-label="IBAN">{b.iban || '—'}</td>
                          <td data-label="Şube">{[b.sube, b.hesap_sahibi].filter(Boolean).join(' · ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
              <div className="ayarlar-form-actions">
                <button type="button" className="ayarlar-btn ayarlar-btn-primary" onClick={handleMesajSablonuKaydet} disabled={savingSablon}>
                  {savingSablon ? 'KAYDEDİLİYOR...' : 'KAYDET'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Veritabanından gelen renk_kodu'nu CSS rengine çevirir (# yoksa ekler, geçersizse gri) */
/** Index'teki kart-tur renkleri (css-variables ile aynı) – nokta rengi için */
const KART_TUR_DOT_RENKLERI: Record<string, string> = {
  organizasyon: '#F64798',
  aracsusleme: '#ff9800',
  ozelgun: '#de3c00',
  ozelsiparis: '#9C27B0',
};

/** grup_adi / tür adını index'teki kart türüne çevirir (organizasyon, aracsusleme, ozelgun, ozelsiparis) */
function grupAdiToKartTurSlug(grupAdi: string | undefined | null): string {
  if (!grupAdi) return 'organizasyon';
  const t = String(grupAdi).toLowerCase().trim();
  if (t.includes('araç') || t.includes('arac') || t === 'aracsusleme') return 'aracsusleme';
  if (t.includes('özel gün') || t.includes('ozel gun') || t === 'ozelgun') return 'ozelgun';
  if (t.includes('özel sipariş') || t.includes('ozel siparis') || t === 'ozelsiparis') return 'ozelsiparis';
  return 'organizasyon';
}

/** Nokta rengi: önce API renk_kodu (geçerli hex), yoksa index kart-tur rengi */
function organizasyonTurNoktaRenk(renkKodu: string | undefined | null, grupAdi: string | undefined | null): string {
  if (renkKodu != null && typeof renkKodu === 'string') {
    const s = renkKodu.trim();
    if (/^#[0-9A-Fa-f]{3,8}$/.test(s)) return s;
    if (/^[0-9A-Fa-f]{6}$/.test(s) || /^[0-9A-Fa-f]{8}$/.test(s)) return '#' + s;
  }
  const slug = grupAdiToKartTurSlug(grupAdi);
  return KART_TUR_DOT_RENKLERI[slug] ?? '#999999';
}

/**
 * Ayarlar sayfası
 * UI-map gereksinimlerine göre düzenlendi
 * Tab sistemi: Veri Tanımları, Genel Ayarlar, Araç Takip Ayarları, Gönderim Ayarları
 */
/** Raporlar sayfasındaki ApexCharts bazen body'de tooltip/overlay bırakıyor; Ayarlar açılınca temizle (chart flash'ı önler) */
function useApexChartsCleanup() {
  useEffect(() => {
    const main = document.querySelector('[data-main-content]');
    const run = () => {
      document.querySelectorAll('body > .apexcharts-tooltip, body > [id*="apexcharts"], body > .apexcharts-canvas, body > div[class*="apexcharts"]').forEach((el) => {
        if (el && main && !main.contains(el)) el.remove();
      });
    };
    run();
    const t = setTimeout(run, 100);
    return () => clearTimeout(t);
  }, []);
}

export const SettingsPage: React.FC = () => {
  usePageAnimations('settings');
  useApexChartsCleanup();
  const { isBaslangicPlan } = usePlan();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'veri' | 'genel' | 'arac' | 'gonderim' | 'fatura' | 'ciceksepeti'>('veri');
  const [activeSubTab, setActiveSubTab] = useState<'urunler' | 'urun-gruplari' | 'organizasyon-turleri' | 'organizasyon-etiketleri'>('urunler');
  const [genelSubTab, setGenelSubTab] = useState<'isletme' | 'konum' | 'teslimat' | 'yazdirma' | 'banka' | 'ciceksepeti'>('isletme');
  const [ciceksepetiDirty, setCiceksepetiDirty] = useState(false);
  const ciceksepetiSubmitRef = React.useRef<(() => void) | null>(null);
  const pendingTabRef = React.useRef<'veri' | 'genel' | 'arac' | 'gonderim' | 'fatura' | 'ciceksepeti' | null>(null);

  const handleTabChange = (tab: 'veri' | 'genel' | 'arac' | 'gonderim' | 'fatura' | 'ciceksepeti') => {
    if (activeTab === 'ciceksepeti' && ciceksepetiDirty) {
      showToastInteractive({
        title: 'Değişiklikleri Kaydet',
        message: 'Kaydedilmeyen değişiklikler var! Değişiklikleri kaydetmek istiyor musunuz?',
        confirmText: 'Evet, Kaydet',
        cancelText: 'İptal',
        onConfirm: () => {
          pendingTabRef.current = tab;
          ciceksepetiSubmitRef.current?.();
        },
        onCancel: () => {},
      });
      return;
    }
    setActiveTab(tab);
  };

  const handleCiceksepetiAfterSave = () => {
    if (pendingTabRef.current) {
      setActiveTab(pendingTabRef.current);
      pendingTabRef.current = null;
    }
  };

  // Tablo sıralama durumları
  const [urunSortField, setUrunSortField] = useState<string | null>(null);
  const [urunSortDir, setUrunSortDir] = useState<'asc' | 'desc'>('asc');
  const [urunGrupSortField, setUrunGrupSortField] = useState<string | null>(null);
  const [urunGrupSortDir, setUrunGrupSortDir] = useState<'asc' | 'desc'>('asc');
  const [orgTurSortField, setOrgTurSortField] = useState<string | null>(null);
  const [orgTurSortDir, setOrgTurSortDir] = useState<'asc' | 'desc'>('asc');
  const [etiketSortField, setEtiketSortField] = useState<string | null>(null);
  const [etiketSortDir, setEtiketSortDir] = useState<'asc' | 'desc'>('asc');
  const [teslimatSortField, setTeslimatSortField] = useState<string | null>(null);
  const [teslimatSortDir, setTeslimatSortDir] = useState<'asc' | 'desc'>('asc');
  const [aracSortField, setAracSortField] = useState<string | null>(null);
  const [aracSortDir, setAracSortDir] = useState<'asc' | 'desc'>('asc');
  const [veriSearchQuery, setVeriSearchQuery] = useState('');

  // URL'deki tab parametresine göre başlangıç sekmesini ayarla
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'gonderim' && isBaslangicPlan === false) {
      setActiveTab('gonderim');
    } else if (tabParam === 'genel') {
      setActiveTab('genel');
    } else if (tabParam === 'arac' && isBaslangicPlan === false) {
      setActiveTab('arac');
    } else if (tabParam === 'veri') {
      setActiveTab('veri');
    } else if (tabParam === 'fatura') {
      setActiveTab('fatura');
    } else if (tabParam === 'ciceksepeti' && isBaslangicPlan === false) {
      setActiveTab('ciceksepeti');
    }
  }, [searchParams, isBaslangicPlan]);

  // Başlangıç planında (plan_id=1) Araç Takip ve Çiçek Sepeti gizli; açıksa başka sekmeye al
  useEffect(() => {
    if (isBaslangicPlan !== true) return;
    if (activeTab === 'arac') setActiveTab('genel');
    if (activeTab === 'ciceksepeti') setActiveTab('genel');
    if (genelSubTab === 'ciceksepeti') setGenelSubTab('isletme');
  }, [isBaslangicPlan, activeTab, genelSubTab]);

  // Düzenleme modları (Veri Tanımları alt sekmeleri)
  const [editingUrunId, setEditingUrunId] = useState<number | null>(null);
  const [editingUrunGrubuId, setEditingUrunGrubuId] = useState<number | null>(null);
  const [editingOrganizasyonTuruId, setEditingOrganizasyonTuruId] = useState<number | null>(null);
  const [editingEtiketId, setEditingEtiketId] = useState<number | null>(null);

  const [urunFormData, setUrunFormData] = useState({
    ad: '',
    grup: '',
    fiyat: '',
    gorsel: null as File | null,
  });
  const [urunGorselPreview, setUrunGorselPreview] = useState<string>('');
  const [urunGrubuFormData, setUrunGrubuFormData] = useState({ ad: '' });
  const [organizasyonTuruFormData, setOrganizasyonTuruFormData] = useState<{ ad: string; grupId: number | null }>({ ad: '', grupId: null });
  const [organizasyonEtiketiFormData, setOrganizasyonEtiketiFormData] = useState<{ ad: string; grupId: number | null }>({ ad: '', grupId: null });

  // Veri tanımları
  // Ürünler: Ayarlar sayfası için backend'deki /urunler/all endpoint'ini kullan
  // Backend kolonları: urun_adi, urun_fiyati, urun_gorseli, kategori_adi
  // Bunları frontend'deki Urun tipine map ediyoruz (ad, grup, fiyat, gorsel)
  const { data: urunlerData, isLoading: urunlerLoading } = useQuery({
    queryKey: ['ayarlar', 'urunler'],
    queryFn: async () => {
      try {
        const result = await apiRequest<any[]>('/urunler/all', { method: 'GET' });
        if (!Array.isArray(result)) return [];
        return result.map((row) => ({
          id: Number(row.id),
          ad: String(row.urun_adi ?? row.ad ?? '').trim(),
          grup: String(row.kategori_adi ?? row.grup ?? '').trim() || undefined,
          fiyat: Number(row.urun_fiyati ?? row.fiyat ?? 0),
          gorsel: row.urun_gorseli ?? row.gorsel ?? undefined,
          durum: row.durum ?? 1,
        })) as Urun[];
      } catch {
        return [];
      }
    },
    enabled: activeTab === 'veri',
    staleTime: 2 * 60 * 1000,
    retry: false,
  });
  const urunler = Array.isArray(urunlerData) ? urunlerData : [];

  const { data: urunGruplariData } = useQuery({
    queryKey: ['urun-gruplari'],
    queryFn: async () => {
      try {
        const result = await apiRequest<UrunGrubu[]>('/urun-gruplari', { method: 'GET' });
        return Array.isArray(result) ? result : [];
      } catch (err) {
        return [];
      }
    },
    // Ürün formundaki "Ürün Grubu" dropdown'ı için, Veri Tanımları sekmesindeyken her zaman yükle
    enabled: activeTab === 'veri',
    staleTime: 2 * 60 * 1000,
    retry: false,
  });
  const urunGruplari = Array.isArray(urunGruplariData) ? urunGruplariData : [];

  // Select/dropdown listelerde sadece aktif kayıtlar görünsün (pasif tabloda kalır, listede görünmez)
  const urunGruplariAktif = React.useMemo(
    () => (Array.isArray(urunGruplari) ? urunGruplari.filter((g) => (g.durum ?? 1) === 1) : []),
    [urunGruplari],
  );
  const urunGruplariDropdown = React.useMemo(() => {
    const akt = urunGruplariAktif;
    const currentAd = urunFormData.grup?.trim();
    if (!currentAd) return akt;
    const current = urunGruplari.find((g) => (g.ad || '').trim() === currentAd);
    if (current && !akt.some((g) => g.id === current.id)) return [...akt, current];
    return akt;
  }, [urunGruplariAktif, urunGruplari, urunFormData.grup]);

  const { data: organizasyonTurleriData } = useQuery({
    queryKey: ['organizasyon-turleri'],
    queryFn: async () => {
      try {
        const result = await apiRequest<OrganizasyonTuru[] | { data?: OrganizasyonTuru[] }>('/organizasyon-turleri?all=1', { method: 'GET' });
        const list = Array.isArray(result) ? result : (result?.data && Array.isArray(result.data) ? result.data : []);
        return list.map((row: any) => ({
          id: Number(row.id),
          tur_adi: row.tur_adi ?? row.turAdi ?? undefined,
          ad: row.ad,
          grup_id: row.grup_id ?? row.grupId,
          grup_adi: row.grup_adi ?? row.grupAdi ?? undefined,
          renk_kodu: row.renk_kodu ?? row.renkKodu ?? undefined,
          durum: row.durum ?? (row.is_active === 0 ? 0 : 1),
          is_active: row.is_active ?? row.isActive,
          tur_aciklama: row.tur_aciklama ?? row.turAciklama,
          sira_no: row.sira_no ?? row.siraNo,
          tenant_id: row.tenant_id ?? row.tenantId,
          base_id: row.base_id ?? row.baseId,
          created_at: row.created_at ?? row.createdAt,
          updated_at: row.updated_at ?? row.updatedAt,
        }));
      } catch (err) {
        return [];
      }
    },
    enabled: activeTab === 'veri',
    staleTime: 2 * 60 * 1000,
    retry: false,
  });
  const organizasyonTurleriRaw = Array.isArray(organizasyonTurleriData) ? organizasyonTurleriData : [];

  // Organizasyon grupları (alt tür ve etiket tablolarındaki grup adları ve form select için)
  const { data: organizasyonGruplariData } = useQuery({
    queryKey: ['organizasyon-gruplari'],
    queryFn: async () => {
      try {
        const result = await apiRequest<any[]>('/organizasyon-gruplari', { method: 'GET' });
        return Array.isArray(result) ? result : [];
      } catch {
        return [];
      }
    },
    enabled: activeTab === 'veri',
    staleTime: 2 * 60 * 1000,
    retry: false,
  });
  const organizasyonGruplari = Array.isArray(organizasyonGruplariData) ? organizasyonGruplariData : [];

  const { data: organizasyonEtiketleriData } = useQuery({
    queryKey: ['organizasyon-etiketleri'],
    queryFn: async () => {
      try {
        // Ürün grupları / organizasyon türleri gibi: parametresiz GET = backend sadece silinmemiş kayıtları döner
        const result = await apiRequest<any[] | { data?: any[] }>('/organizasyon-etiketleri', { method: 'GET' });
        const list = Array.isArray(result) ? result : (result?.data && Array.isArray(result.data) ? result.data : []);
        // Backend bazen silinmiş (is_active=0) de dönebiliyor; aynı davranış için listeden çıkar
        const activeList = list.filter((row: any) => {
          const v = row.is_active ?? row.isActive;
          return v !== 0 && v !== '0' && v !== false;
        });
        return activeList.map((row: any) => ({
          id: Number(row.id),
          ad: String(row.etiket_adi ?? row.etiketAdi ?? row.ad ?? '').trim(),
          grup_id: row.grup_id ?? row.grupId,
          grup_adi: row.grup_adi ?? row.grupAdi ?? undefined,
          renk_kodu: row.renk_kodu ?? row.renkKodu ?? undefined,
          durum: row.durum === 0 ? 0 : 1,
        })) as OrganizasyonEtiketi[];
      } catch (err) {
        return [];
      }
    },
    enabled: activeTab === 'veri',
    staleTime: 2 * 60 * 1000,
    retry: false,
  });
  const organizasyonEtiketleriRaw = Array.isArray(organizasyonEtiketleriData) ? organizasyonEtiketleriData : [];

  // Organizasyon türü / etiket tablolarında "Organizasyon Türü" sütunu: grup_adi ve renk_kodu
  // her zaman organizasyon_turleri (gruplar) tablosundan grup_id ile eşleştirilerek kullanılsın
  const organizasyonTurleri = React.useMemo(() => {
    const gruplar = Array.isArray(organizasyonGruplari) ? organizasyonGruplari : [];
    return (organizasyonTurleriRaw || []).map((tur) => {
      const gid = tur.grup_id;
      let grupAdi = tur.grup_adi;
      let renk = tur.renk_kodu;
      if (gid != null && gruplar.length > 0) {
        const grup = gruplar.find((g: { id?: number }) => Number(g.id) === Number(gid));
        if (grup) {
          const g = grup as { grup_adi?: string; tur_adi?: string; name?: string; renk_kodu?: string; renk?: string };
          grupAdi = g.grup_adi ?? g.tur_adi ?? g.name ?? '';
          renk = renk ?? g.renk_kodu ?? (grup as any).renkKodu ?? g.renk;
        }
      }
      return { ...tur, grup_adi: grupAdi ?? tur.grup_adi, renk_kodu: renk ?? tur.renk_kodu };
    });
  }, [organizasyonTurleriRaw, organizasyonGruplari]);
  const organizasyonEtiketleri = React.useMemo(() => {
    const gruplar = Array.isArray(organizasyonGruplari) ? organizasyonGruplari : [];
    return (organizasyonEtiketleriRaw || []).map((etiket) => {
      const gid = etiket.grup_id;
      let grupAdi = etiket.grup_adi;
      let renk = etiket.renk_kodu;
      if (gid != null && gruplar.length > 0) {
        const grup = gruplar.find((g: { id?: number }) => Number(g.id) === Number(gid));
        if (grup) {
          const g = grup as { grup_adi?: string; tur_adi?: string; name?: string; renk_kodu?: string; renk?: string };
          grupAdi = g.grup_adi ?? g.tur_adi ?? g.name ?? '';
          renk = renk ?? g.renk_kodu ?? (grup as any).renkKodu ?? g.renk;
        }
      }
      return { ...etiket, grup_adi: grupAdi ?? etiket.grup_adi, renk_kodu: renk ?? etiket.renk_kodu };
    });
  }, [organizasyonEtiketleriRaw, organizasyonGruplari]);

  // Araç Takip – araç listesi (Araç Takip Ayarları sekmesinde)
  const { data: araclarData, isLoading: araclarLoading, refetch: refetchAraclar } = useQuery({
    queryKey: ['araclar'],
    queryFn: async () => {
      try {
        const result = await apiRequest<any[] | { data?: any[] }>('/araclar', { method: 'GET' });
        const list = Array.isArray(result) ? result : (result?.data && Array.isArray(result.data) ? result.data : []);
        return list.map((row: any) => ({
          id: Number(row.id),
          plaka: String(row.plaka ?? '').trim(),
          marka: String(row.marka ?? '').trim(),
          model: String(row.model ?? '').trim(),
          renk: String(row.renk ?? '').trim(),
          yil: row.yil != null ? Number(row.yil) : null,
          arac_tipi: String(row.arac_tipi ?? '').trim(),
        }));
      } catch {
        return [];
      }
    },
    enabled: activeTab === 'arac',
    staleTime: 60 * 1000,
    retry: false,
  });
  const araclar = Array.isArray(araclarData) ? araclarData : [];

  const [aracFormData, setAracFormData] = useState({ plaka: '', marka: '', model: '', renk: '', yil: '' as string | number, arac_tipi: '' });
  const [editingAracId, setEditingAracId] = useState<number | null>(null);

  // İşletme ayarları
  const addressSelectIsletme = useAddressSelect();
  const { data: isletmeData, isLoading: isletmeLoading } = useQuery({
    queryKey: ['ayarlar-isletme'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data?: Record<string, string> }>('/ayarlar/isletme');
      return res.data?.data ?? {};
    },
    enabled: activeTab === 'genel' && genelSubTab === 'isletme',
    staleTime: 2 * 60 * 1000,
  });
  const [isletmeFormData, setIsletmeFormData] = useState({
    isletme_adi: '', yetkili_kisi: '', telefon: '', whatsapp: '', eposta: '', website: '',
    vergi_dairesi: '', vergi_no: '', adres: '',
  });
  const isletmeTelefonInput = usePhoneInput('');
  const isletmeWhatsappInput = usePhoneInput('');
  const [isletmeLogoSrc, setIsletmeLogoSrc] = useState<string>('');
  const initialIsletmeRef = React.useRef<{
    formData: typeof isletmeFormData;
    telefon10: string;
    whatsapp10: string;
    il: string;
    ilce: string;
  } | null>(null);
  React.useEffect(() => {
    if (isletmeData && activeTab === 'genel' && genelSubTab === 'isletme') {
      const formData = {
        isletme_adi: isletmeData.isletme_adi ?? '',
        yetkili_kisi: isletmeData.yetkili_kisi ?? '',
        telefon: isletmeData.telefon ?? '',
        whatsapp: isletmeData.whatsapp ?? '',
        eposta: isletmeData.eposta ?? '',
        website: isletmeData.website ?? '',
        vergi_dairesi: isletmeData.vergi_dairesi ?? '',
        vergi_no: isletmeData.vergi_no ?? '',
        adres: isletmeData.adres ?? '',
      };
      setIsletmeFormData(formData);
      isletmeTelefonInput.setDisplayValue(isletmeData.telefon ?? '');
      isletmeWhatsappInput.setDisplayValue(isletmeData.whatsapp ?? '');
      if (isletmeData.il) addressSelectIsletme.setIl(isletmeData.il, { skipClear: true });
      if (isletmeData.ilce) addressSelectIsletme.setIlce(isletmeData.ilce, { skipClear: true });
      setIsletmeLogoSrc(isletmeData.logo_url ?? '');
      const norm = (s: string) => (s || '').replace(/\D/g, '').slice(-10);
      initialIsletmeRef.current = {
        formData,
        telefon10: norm(isletmeData.telefon ?? ''),
        whatsapp10: norm(isletmeData.whatsapp ?? ''),
        il: isletmeData.il ?? '',
        ilce: isletmeData.ilce ?? '',
      };
    }
  }, [isletmeData, activeTab, genelSubTab]);
  const hasIsletmeChanges = React.useMemo(() => {
    const init = initialIsletmeRef.current;
    if (!init) return false;
    const norm = (s: string) => (s || '').replace(/\D/g, '').slice(-10);
    const tel10 = norm(isletmeTelefonInput.cleanValue);
    const wp10 = norm(isletmeWhatsappInput.cleanValue);
    if (tel10 !== init.telefon10 || wp10 !== init.whatsapp10) return true;
    if (addressSelectIsletme.il !== init.il || addressSelectIsletme.ilce !== init.ilce) return true;
    const f = isletmeFormData;
    const i = init.formData;
    return f.isletme_adi !== i.isletme_adi || f.yetkili_kisi !== i.yetkili_kisi || f.eposta !== i.eposta || f.website !== i.website || f.vergi_dairesi !== i.vergi_dairesi || f.vergi_no !== i.vergi_no || f.adres !== i.adres;
  }, [isletmeFormData, isletmeTelefonInput.cleanValue, isletmeWhatsappInput.cleanValue, addressSelectIsletme.il, addressSelectIsletme.ilce]);
  const handleVazgecIsletme = () => {
    const init = initialIsletmeRef.current;
    if (!init) return;
    setIsletmeFormData(init.formData);
    isletmeTelefonInput.setDisplayValue(init.formData.telefon);
    isletmeWhatsappInput.setDisplayValue(init.formData.whatsapp);
    if (init.il) addressSelectIsletme.setIl(init.il, { skipClear: true });
    if (init.ilce) addressSelectIsletme.setIlce(init.ilce, { skipClear: true });
  };

  // Teslimat konumları
  const { data: teslimatKonumlariData } = useQuery({
    queryKey: ['teslimat-konumlari'],
    queryFn: async () => {
      const data = await apiRequest<Array<{ id: number; konum_adi: string; il?: string; ilce?: string; mahalle?: string; acik_adres?: string }>>('/teslimat-konumlari', { method: 'GET' });
      return Array.isArray(data) ? data : [];
    },
    enabled: activeTab === 'genel' && genelSubTab === 'teslimat',
    staleTime: 60 * 1000,
  });
  const teslimatKonumlari = Array.isArray(teslimatKonumlariData) ? teslimatKonumlariData : [];
  const [teslimatFormData, setTeslimatFormData] = useState({ konum_adi: '', il: '', ilce: '', mahalle: '', acik_adres: '' });
  const [editingTeslimatId, setEditingTeslimatId] = useState<number | null>(null);
  const addressSelectTeslimat = useAddressSelect();

  // Fatura ayarları (müşteri faturası sağ üst logo)
  type FaturaBankaHesap = { id: number; banka_adi?: string; iban?: string; sube?: string; hesap_sahibi?: string; aciklama?: string; sira?: number };
  type FaturaAyarlariData = {
    fatura_logo_yolu?: string; fatura_logo_url?: string;
    firma_adi?: string; adres?: string; il?: string; ilce?: string; vergi_dairesi?: string; vergi_no?: string;
    kdv_orani?: number; fatura_not?: string; faturada_gosterilen_banka_ids?: number[]; banka_hesaplari?: FaturaBankaHesap[];
  };
  const { data: faturaAyarlariData, refetch: refetchFaturaAyarlari } = useQuery({
    queryKey: ['ayarlar-fatura'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data?: FaturaAyarlariData }>('/ayarlar/fatura');
      return res.data?.data ?? {};
    },
    enabled: activeTab === 'fatura' || (activeTab === 'genel' && genelSubTab === 'banka'),
    staleTime: 2 * 60 * 1000,
  });
  const [faturaLogoUploading, setFaturaLogoUploading] = useState(false);
  const [faturaLogoCacheBuster, setFaturaLogoCacheBuster] = useState(0);
  const faturaLogoPath = (faturaAyarlariData?.fatura_logo_yolu ?? faturaAyarlariData?.fatura_logo_url ?? '').toString();
  const faturaLogoSrcBase = faturaLogoPath ? getUploadUrl(faturaLogoPath) : '';
  const faturaLogoSrc = faturaLogoSrcBase + (faturaLogoCacheBuster ? (faturaLogoSrcBase.includes('?') ? '&' : '?') + 't=' + faturaLogoCacheBuster : '');
  const [faturaForm, setFaturaForm] = useState({
    firma_adi: '', adres: '', il: '', ilce: '', vergi_dairesi: '', vergi_no: '',
    kdv_orani: 20, fatura_not: ''
  });
  const [faturaSaving, setFaturaSaving] = useState(false);
  React.useEffect(() => {
    if ((activeTab !== 'fatura' && !(activeTab === 'genel' && genelSubTab === 'banka')) || !faturaAyarlariData) return;
    setFaturaForm({
      firma_adi: (faturaAyarlariData.firma_adi ?? '').toString(),
      adres: (faturaAyarlariData.adres ?? '').toString(),
      il: (faturaAyarlariData.il ?? '').toString(),
      ilce: (faturaAyarlariData.ilce ?? '').toString(),
      vergi_dairesi: (faturaAyarlariData.vergi_dairesi ?? '').toString(),
      vergi_no: (faturaAyarlariData.vergi_no ?? '').toString(),
      kdv_orani: faturaAyarlariData.kdv_orani != null ? Number(faturaAyarlariData.kdv_orani) : 20,
      fatura_not: (faturaAyarlariData.fatura_not ?? '').toString()
    });
  }, [activeTab, genelSubTab, faturaAyarlariData]);
  const faturadaGosterilenBankaIdsRaw = faturaAyarlariData?.faturada_gosterilen_banka_ids;
  const [faturadaSecilenBankaIds, setFaturadaSecilenBankaIds] = useState<number[]>(() => Array.isArray(faturadaGosterilenBankaIdsRaw) ? faturadaGosterilenBankaIdsRaw : []);
  React.useEffect(() => {
    if (Array.isArray(faturadaGosterilenBankaIdsRaw)) setFaturadaSecilenBankaIds(faturadaGosterilenBankaIdsRaw);
  }, [faturadaGosterilenBankaIdsRaw]);
  const handleFaturaAyarlariSave = async () => {
    setFaturaSaving(true);
    try {
      await apiClient.post('/ayarlar/fatura', { ...faturaForm, faturada_gosterilen_banka_ids: faturadaSecilenBankaIds });
      await refetchFaturaAyarlari();
      showToast('success', 'Fatura ayarları kaydedildi.');
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Kayıt başarısız.');
    } finally {
      setFaturaSaving(false);
    }
  };
  const bankaHesaplari = (faturaAyarlariData?.banka_hesaplari ?? []) as FaturaBankaHesap[];
  const [bankaForm, setBankaForm] = useState({ banka_adi: '', iban: '', sube: '', hesap_sahibi: '', aciklama: '' });
  const [editingBankaId, setEditingBankaId] = useState<number | null>(null);
  const handleBankaEkle = async () => {
    try {
      await apiClient.post('/ayarlar/fatura/banka-hesaplari', bankaForm);
      setBankaForm({ banka_adi: '', iban: '', sube: '', hesap_sahibi: '', aciklama: '' });
      await refetchFaturaAyarlari();
      showToast('success', 'Banka hesabı eklendi.');
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Eklenemedi.');
    }
  };
  const handleBankaGuncelle = async () => {
    if (!editingBankaId) return;
    try {
      await apiClient.put(`/ayarlar/fatura/banka-hesaplari/${editingBankaId}`, bankaForm);
      setEditingBankaId(null);
      setBankaForm({ banka_adi: '', iban: '', sube: '', hesap_sahibi: '', aciklama: '' });
      await refetchFaturaAyarlari();
      showToast('success', 'Banka hesabı güncellendi.');
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Güncellenemedi.');
    }
  };
  const handleBankaSil = async (id: number) => {
    if (!window.confirm('Bu banka hesabını silmek istediğinize emin misiniz?')) return;
    try {
      await apiClient.delete(`/ayarlar/fatura/banka-hesaplari/${id}`);
      await refetchFaturaAyarlari();
      if (editingBankaId === id) { setEditingBankaId(null); setBankaForm({ banka_adi: '', iban: '', sube: '', hesap_sahibi: '', aciklama: '' }); }
      showToast('success', 'Banka hesabı silindi.');
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Silinemedi.');
    }
  };
  const handleFaturaLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      showToast('warning', 'Lütfen PNG veya JPG seçin.');
      return;
    }
    setFaturaLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      await apiClient.post('/ayarlar/fatura/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      await refetchFaturaAyarlari();
      setFaturaLogoCacheBuster(Date.now());
      showToast('success', 'Fatura logosu güncellendi.');
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Logo yüklenemedi.');
    } finally {
      setFaturaLogoUploading(false);
      e.target.value = '';
    }
  };

  // Konum ayarları
  const { data: konumData } = useQuery({
    queryKey: ['ayarlar-konum'],
    queryFn: getKonumAyarlari,
    enabled: activeTab === 'genel' && genelSubTab === 'konum',
    staleTime: 5 * 60 * 1000,
  });
  const addressSelectKonum = useAddressSelect();
  React.useEffect(() => {
    if (konumData && activeTab === 'genel' && genelSubTab === 'konum') {
      if (konumData.il_adi) addressSelectKonum.setIl(konumData.il_adi, { skipClear: true });
      if (konumData.ilce_adi) addressSelectKonum.setIlce(konumData.ilce_adi, { skipClear: true });
    }
  }, [konumData, activeTab, genelSubTab]);

  // Sıralanmış listeler
  const sortedUrunler = React.useMemo(() => {
    if (!Array.isArray(urunler)) return [];
    const data = [...urunler];
    // Varsayılan: ID'ye göre küçükten büyüğe sırala
    if (!urunSortField) {
      data.sort((a, b) => (a.id || 0) - (b.id || 0));
      return data;
    }
    data.sort((a, b) => {
      let av: any;
      let bv: any;
      if (urunSortField === 'ad') {
        av = a.ad || '';
        bv = b.ad || '';
      } else if (urunSortField === 'grup') {
        av = a.grup || '';
        bv = b.grup || '';
      } else if (urunSortField === 'fiyat') {
        av = a.fiyat ?? 0;
        bv = b.fiyat ?? 0;
      } else {
        return 0;
      }
      if (typeof av === 'string') av = av.toString().toLocaleLowerCase('tr-TR');
      if (typeof bv === 'string') bv = bv.toString().toLocaleLowerCase('tr-TR');
      if (av < bv) return urunSortDir === 'asc' ? -1 : 1;
      if (av > bv) return urunSortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return data;
  }, [urunler, urunSortField, urunSortDir]);

  const sortedUrunGruplari = React.useMemo(() => {
    if (!Array.isArray(urunGruplari)) return [];
    const data = [...urunGruplari];
    // Varsayılan: ID'ye göre küçükten büyüğe sırala
    if (!urunGrupSortField) {
      data.sort((a, b) => (a.id || 0) - (b.id || 0));
      return data;
    }
    if (urunGrupSortField === 'ad') {
      data.sort((a, b) => {
        const av = (a.ad || '').toLocaleLowerCase('tr-TR');
        const bv = (b.ad || '').toLocaleLowerCase('tr-TR');
        if (av < bv) return urunGrupSortDir === 'asc' ? -1 : 1;
        if (av > bv) return urunGrupSortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [urunGruplari, urunGrupSortField, urunGrupSortDir]);

  const sortedOrganizasyonTurleri = React.useMemo(() => {
    if (!Array.isArray(organizasyonTurleri)) return [];
    const data = [...organizasyonTurleri];
    // Varsayılan: Organizasyon türü id'sine (grup_id) göre küçükten büyüğe, aynı grupta alt tür id'sine göre
    if (!orgTurSortField) {
      data.sort((a, b) => {
        const ga = a.grup_id ?? 0;
        const gb = b.grup_id ?? 0;
        if (ga !== gb) return ga - gb;
        return (a.id || 0) - (b.id || 0);
      });
      return data;
    }
    data.sort((a, b) => {
      let av = '';
      let bv = '';
      if (orgTurSortField === 'grup') {
        av = (a.grup_adi || '').toLocaleLowerCase('tr-TR');
        bv = (b.grup_adi || '').toLocaleLowerCase('tr-TR');
      } else if (orgTurSortField === 'tur') {
        av = (a.tur_adi || a.ad || '').toLocaleLowerCase('tr-TR');
        bv = (b.tur_adi || b.ad || '').toLocaleLowerCase('tr-TR');
      }
      if (av < bv) return orgTurSortDir === 'asc' ? -1 : 1;
      if (av > bv) return orgTurSortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return data;
  }, [organizasyonTurleri, orgTurSortField, orgTurSortDir]);

  const sortedEtiketler = React.useMemo(() => {
    if (!Array.isArray(organizasyonEtiketleri)) return [];
    const data = [...organizasyonEtiketleri];
    // Varsayılan: Organizasyon türü id'sine (grup_id) göre küçükten büyüğe, aynı grupta etiket id'sine göre
    if (!etiketSortField) {
      data.sort((a, b) => {
        const ga = a.grup_id ?? 0;
        const gb = b.grup_id ?? 0;
        if (ga !== gb) return ga - gb;
        return (a.id || 0) - (b.id || 0);
      });
      return data;
    }
    data.sort((a, b) => {
      let av = '';
      let bv = '';
      if (etiketSortField === 'grup') {
        av = (a.grup_adi || '').toLocaleLowerCase('tr-TR');
        bv = (b.grup_adi || '').toLocaleLowerCase('tr-TR');
      } else if (etiketSortField === 'ad') {
        av = (a.ad || '').toLocaleLowerCase('tr-TR');
        bv = (b.ad || '').toLocaleLowerCase('tr-TR');
      }
      if (av < bv) return etiketSortDir === 'asc' ? -1 : 1;
      if (av > bv) return etiketSortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return data;
  }, [organizasyonEtiketleri, etiketSortField, etiketSortDir]);

  const veriSearchLower = veriSearchQuery.trim().toLowerCase();
  const filteredUrunler = React.useMemo(() => {
    if (!veriSearchLower) return sortedUrunler;
    return sortedUrunler.filter(
      (u) =>
        (u.ad || '').toLowerCase().includes(veriSearchLower) ||
        (u.grup || '').toLowerCase().includes(veriSearchLower)
    );
  }, [sortedUrunler, veriSearchLower]);
  const filteredUrunGruplari = React.useMemo(() => {
    if (!veriSearchLower) return sortedUrunGruplari;
    return sortedUrunGruplari.filter((g) => (g.ad || '').toLowerCase().includes(veriSearchLower));
  }, [sortedUrunGruplari, veriSearchLower]);
  const filteredOrganizasyonTurleri = React.useMemo(() => {
    if (!veriSearchLower) return sortedOrganizasyonTurleri;
    return sortedOrganizasyonTurleri.filter(
      (t) =>
        (t.grup_adi || '').toLowerCase().includes(veriSearchLower) ||
        (t.tur_adi || t.ad || '').toLowerCase().includes(veriSearchLower)
    );
  }, [sortedOrganizasyonTurleri, veriSearchLower]);
  const filteredEtiketler = React.useMemo(() => {
    if (!veriSearchLower) return sortedEtiketler;
    return sortedEtiketler.filter(
      (e) =>
        (e.grup_adi || '').toLowerCase().includes(veriSearchLower) ||
        (e.ad || '').toLowerCase().includes(veriSearchLower)
    );
  }, [sortedEtiketler, veriSearchLower]);

  const sortedTeslimatKonumlari = React.useMemo(() => {
    const list = [...teslimatKonumlari];
    if (!teslimatSortField) return list;
    list.sort((a: { konum_adi?: string; il?: string; ilce?: string; mahalle?: string }, b: { konum_adi?: string; il?: string; ilce?: string; mahalle?: string }) => {
      let av: string = (a as Record<string, unknown>)[teslimatSortField] as string ?? '';
      let bv: string = (b as Record<string, unknown>)[teslimatSortField] as string ?? '';
      if (typeof av === 'string') av = av.toLocaleLowerCase('tr-TR');
      if (typeof bv === 'string') bv = bv.toLocaleLowerCase('tr-TR');
      if (av < bv) return teslimatSortDir === 'asc' ? -1 : 1;
      if (av > bv) return teslimatSortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [teslimatKonumlari, teslimatSortField, teslimatSortDir]);

  const sortedAraclar = React.useMemo(() => {
    const list = [...araclar];
    if (!aracSortField) return list;
    list.sort((a: { plaka?: string; marka?: string; model?: string; renk?: string; yil?: number | null; arac_tipi?: string }, b: { plaka?: string; marka?: string; model?: string; renk?: string; yil?: number | null; arac_tipi?: string }) => {
      let av: string | number = (a as Record<string, unknown>)[aracSortField] as string | number ?? '';
      let bv: string | number = (b as Record<string, unknown>)[aracSortField] as string | number ?? '';
      if (aracSortField === 'marka_model') {
        av = ((a.marka || '') + ' ' + (a.model || '')).trim().toLocaleLowerCase('tr-TR');
        bv = ((b.marka || '') + ' ' + (b.model || '')).trim().toLocaleLowerCase('tr-TR');
      } else if (typeof av === 'string') av = String(av).toLocaleLowerCase('tr-TR');
      else if (typeof bv === 'string') bv = String(bv).toLocaleLowerCase('tr-TR');
      if (typeof av === 'number' && typeof bv === 'number') {
        if (av < bv) return aracSortDir === 'asc' ? -1 : 1;
        if (av > bv) return aracSortDir === 'asc' ? 1 : -1;
        return 0;
      }
      const as = String(av);
      const bs = String(bv);
      if (as < bs) return aracSortDir === 'asc' ? -1 : 1;
      if (as > bs) return aracSortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [araclar, aracSortField, aracSortDir]);

  const handleUrunSort = (field: string, dir: 'asc' | 'desc') => {
    setUrunSortField(field);
    setUrunSortDir(dir);
  };

  const handleUrunGrupSort = (field: string, dir: 'asc' | 'desc') => {
    setUrunGrupSortField(field);
    setUrunGrupSortDir(dir);
  };

  const handleOrgTurSort = (field: string, dir: 'asc' | 'desc') => {
    setOrgTurSortField(field);
    setOrgTurSortDir(dir);
  };

  const handleEtiketSort = (field: string, dir: 'asc' | 'desc') => {
    setEtiketSortField(field);
    setEtiketSortDir(dir);
  };

  const handleTeslimatSort = (field: string, dir: 'asc' | 'desc') => {
    setTeslimatSortField(field);
    setTeslimatSortDir(dir);
  };

  const handleAracSort = (field: string, dir: 'asc' | 'desc') => {
    setAracSortField(field);
    setAracSortDir(dir);
  };

  const getVeriListCount = () => {
    if (activeSubTab === 'urunler') {
      return Array.isArray(urunler) ? urunler.length : 0;
    }
    if (activeSubTab === 'urun-gruplari') {
      return Array.isArray(urunGruplari) ? urunGruplari.length : 0;
    }
    if (activeSubTab === 'organizasyon-turleri') {
      return Array.isArray(organizasyonTurleri) ? organizasyonTurleri.length : 0;
    }
    if (activeSubTab === 'organizasyon-etiketleri') {
      return Array.isArray(organizasyonEtiketleri) ? organizasyonEtiketleri.length : 0;
    }
    return 0;
  };

  const getVeriListLabel = () => {
    if (activeSubTab === 'urunler') return 'Ürün';
    if (activeSubTab === 'urun-gruplari') return 'Ürün Kategorisi';
    if (activeSubTab === 'organizasyon-turleri') return 'Organizasyon Türü';
    if (activeSubTab === 'organizasyon-etiketleri') return 'Etiket';
    return '';
  };

  const handleSubTabChange = (
    tab: 'urunler' | 'urun-gruplari' | 'organizasyon-turleri' | 'organizasyon-etiketleri',
  ) => {
    setActiveSubTab(tab);
    // Alt sekme değiştiğinde tüm düzenleme modlarını sıfırla
    setEditingUrunId(null);
    setEditingUrunGrubuId(null);
    setEditingOrganizasyonTuruId(null);
    setEditingEtiketId(null);

    if (tab === 'urunler') {
      setUrunFormData({
        ad: '',
        grup: '',
        fiyat: '',
        gorsel: null,
      });
    }
    if (tab === 'urun-gruplari') {
      setUrunGrubuFormData({ ad: '' });
    }
    if (tab === 'organizasyon-turleri') {
      setOrganizasyonTuruFormData({ ad: '', grupId: null });
    }
    if (tab === 'organizasyon-etiketleri') {
      setOrganizasyonEtiketiFormData({ ad: '', grupId: null });
    }
  };

  const getVeriFormTitle = () => {
    if (activeSubTab === 'urunler') {
      return editingUrunId ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle';
    }
    if (activeSubTab === 'urun-gruplari') {
      return editingUrunGrubuId ? 'Ürün Kategorisini Düzenle' : 'Yeni Ürün Kategorisi Ekle';
    }
    if (activeSubTab === 'organizasyon-turleri') {
      return editingOrganizasyonTuruId ? 'Organizasyon Alt Türünü Düzenle' : 'Yeni Organizasyon Alt Türü Ekle';
    }
    if (activeSubTab === 'organizasyon-etiketleri') {
      return editingEtiketId ? 'Organizasyon Etiketini Düzenle' : 'Yeni Organizasyon Etiketi Ekle';
    }
    return '';
  };

  const handleCancelUrunEdit = () => {
    setEditingUrunId(null);
    setUrunFormData({
      ad: '',
      grup: '',
      fiyat: '',
      gorsel: null,
    });
  };

  const handleCancelUrunGrubuEdit = () => {
    setEditingUrunGrubuId(null);
    setUrunGrubuFormData({ ad: '' });
  };

  const handleCancelOrganizasyonTuruEdit = () => {
    setEditingOrganizasyonTuruId(null);
    setOrganizasyonTuruFormData({ ad: '', grupId: null });
  };

  const handleCancelEtiketEdit = () => {
    setEditingEtiketId(null);
    setOrganizasyonEtiketiFormData({ ad: '', grupId: null });
  };

  const resetAracForm = () => {
    setAracFormData({ plaka: '', marka: '', model: '', renk: '', yil: '', arac_tipi: '' });
    setEditingAracId(null);
  };

  const handleAracSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const plaka = (aracFormData.plaka || '').trim().toUpperCase();
    if (!plaka) {
      showToast('warning', 'Plaka giriniz.');
      return;
    }
    try {
      if (editingAracId) {
        await apiRequest(`/araclar/${editingAracId}`, {
          method: 'PUT',
          data: {
            plaka,
            marka: (aracFormData.marka || '').trim() || undefined,
            model: (aracFormData.model || '').trim() || undefined,
            renk: (aracFormData.renk || '').trim() || undefined,
            yil: aracFormData.yil !== '' && aracFormData.yil != null ? Number(aracFormData.yil) : undefined,
            arac_tipi: (aracFormData.arac_tipi || '').trim() || undefined,
          },
        });
        showToast('success', 'Araç güncellendi.');
      } else {
        await apiRequest('/araclar', {
          method: 'POST',
          data: {
            plaka,
            marka: (aracFormData.marka || '').trim() || undefined,
            model: (aracFormData.model || '').trim() || undefined,
            renk: (aracFormData.renk || '').trim() || undefined,
            yil: aracFormData.yil !== '' && aracFormData.yil != null ? Number(aracFormData.yil) : undefined,
            arac_tipi: (aracFormData.arac_tipi || '').trim() || undefined,
          },
        });
        showToast('success', 'Araç eklendi.');
      }
      queryClient.invalidateQueries({ queryKey: ['araclar'] });
      refetchAraclar();
      resetAracForm();
    } catch (err: any) {
      showToast('error', err?.message || 'İşlem başarısız.');
    }
  };

  const handleTeslimatSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const konum_adi = teslimatFormData.konum_adi.trim();
    if (!konum_adi) {
      showToast('warning', 'Teslimat konumu adı giriniz.');
      return;
    }
    try {
      if (editingTeslimatId) {
        await apiRequest(`/teslimat-konumlari/${editingTeslimatId}`, {
          method: 'PUT',
          data: {
            konum_adi,
            il: addressSelectTeslimat.il || undefined,
            ilce: addressSelectTeslimat.ilce || undefined,
            mahalle: addressSelectTeslimat.mahalle || undefined,
            acik_adres: teslimatFormData.acik_adres || undefined,
          },
        });
        showToast('success', 'Teslimat konumu güncellendi.');
      } else {
        await apiRequest('/teslimat-konumlari', {
          method: 'POST',
          data: {
            konum_adi,
            il: addressSelectTeslimat.il || undefined,
            ilce: addressSelectTeslimat.ilce || undefined,
            mahalle: addressSelectTeslimat.mahalle || undefined,
            acik_adres: teslimatFormData.acik_adres || undefined,
          },
        });
        showToast('success', 'Teslimat konumu eklendi.');
      }
      queryClient.invalidateQueries({ queryKey: ['teslimat-konumlari'] });
      setTeslimatFormData({ konum_adi: '', il: '', ilce: '', mahalle: '', acik_adres: '' });
      setEditingTeslimatId(null);
      addressSelectTeslimat.reset();
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Kaydedilemedi.');
    }
  };

  const handleKonumSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const ilOpt = addressSelectKonum.ilOptions.find((o) => o.name === addressSelectKonum.il);
      const ilceOpt = addressSelectKonum.ilceOptions.find((o) => o.name === addressSelectKonum.ilce);
      await apiClient.put('/ayarlar/konum', {
        il_id: ilOpt?.id ?? null,
        il_adi: addressSelectKonum.il || '',
        ilce_id: ilceOpt?.id ?? null,
        ilce_adi: addressSelectKonum.ilce || '',
      });
      queryClient.invalidateQueries({ queryKey: ['ayarlar-konum'] });
      showToast('success', 'Konum ayarları kaydedildi.');
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Kaydedilemedi.');
    }
  };

  const handleIsletmeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const telefon10 = isletmeTelefonInput.cleanValue.replace(/\D/g, '').slice(-10);
    const whatsapp10 = isletmeWhatsappInput.cleanValue.replace(/\D/g, '').slice(-10);
    try {
      await apiClient.put('/ayarlar/isletme', {
        ...isletmeFormData,
        telefon: telefon10,
        whatsapp: whatsapp10,
        il: addressSelectIsletme.il || undefined,
        ilce: addressSelectIsletme.ilce || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['ayarlar-isletme'] });
      showToast('success', 'İşletme ayarları kaydedildi.');
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Kaydedilemedi.');
    }
  };

  const [isletmeLogoUploading, setIsletmeLogoUploading] = useState(false);
  const handleIsletmeLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) {
      showToast('warning', 'Lütfen geçerli bir görsel seçin (PNG, JPG, SVG vb.).');
      return;
    }
    setIsletmeLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await apiClient.post<{ success: boolean; data?: { logo_url?: string } }>('/ayarlar/isletme/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const url = res.data?.data?.logo_url ?? '';
      if (url) setIsletmeLogoSrc(url);
      queryClient.invalidateQueries({ queryKey: ['ayarlar-isletme'] });
      showToast('success', 'Logo yüklendi.');
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Logo yüklenemedi.');
    } finally {
      setIsletmeLogoUploading(false);
    }
  };
  const handleIsletmeLogoRemove = async () => {
    try {
      await apiClient.put('/ayarlar/isletme', {
        ...isletmeFormData,
        il: addressSelectIsletme.il || undefined,
        ilce: addressSelectIsletme.ilce || undefined,
        logo_path: '',
      });
      setIsletmeLogoSrc('');
      queryClient.invalidateQueries({ queryKey: ['ayarlar-isletme'] });
      showToast('success', 'Logo kaldırıldı.');
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Logo kaldırılamadı.');
    }
  };

  const handleAracDelete = async (id: number) => {
    showToastInteractive({
      title: 'Aracı Sil',
      message: 'Bu aracı silmek istediğinize emin misiniz?',
      confirmText: 'Evet, Sil',
      cancelText: 'İptal',
      onConfirm: async () => {
        try {
          await apiRequest(`/araclar/${id}`, { method: 'DELETE' });
          showToast('success', 'Araç silindi.');
          queryClient.invalidateQueries({ queryKey: ['araclar'] });
          refetchAraclar();
          if (editingAracId === id) resetAracForm();
        } catch (err: any) {
          showToast('error', err?.message || 'Silinemedi.');
        }
      },
    });
  };

  // Ürün formu submit (yeni ürün ekle / mevcut ürünü güncelle)
  const handleUrunSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity();
      return;
    }

    const ad = urunFormData.ad.trim();
    const grupAd = urunFormData.grup.trim();
    const fiyatNumber = parseTL(urunFormData.fiyat);

    if (!ad) {
      showToast('warning', 'Lütfen ürün adını girin.');
      return;
    }

    if (!grupAd) {
      showToast('warning', 'Lütfen bir ürün kategorisi seçin.');
      return;
    }

    if (!urunFormData.fiyat || fiyatNumber <= 0) {
      showToast('warning', 'Lütfen geçerli bir ürün fiyatı girin.');
      return;
    }

    // Seçilen grup adına göre kategori ID'sini bul
    const matchedGrup = Array.isArray(urunGruplari)
      ? urunGruplari.find((g) => (g.ad || '').trim() === grupAd)
      : undefined;

    if (!matchedGrup) {
      showToast('error', 'Seçilen ürün kategorisi bulunamadı.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('urun_adi', ad);
      formData.append('urun_kategori_id', String(matchedGrup.id));
      formData.append('urun_fiyati', String(fiyatNumber));
      formData.append('durum', '1');

      if (urunFormData.gorsel) {
        formData.append('urun_gorseli', urunFormData.gorsel);
      }

      if (editingUrunId) {
        await apiClient.put(`/urunler/${editingUrunId}`, formData);
        showToast('success', 'Ürün güncellendi.');
      } else {
        await apiClient.post('/urunler', formData);
        showToast('success', 'Ürün eklendi.');
      }

      // Listeyi yenile
      queryClient.invalidateQueries({ queryKey: ['ayarlar', 'urunler'] });

      // Formu sıfırla
      setEditingUrunId(null);
      setUrunFormData({
        ad: '',
        grup: '',
        fiyat: '',
        gorsel: null,
      });
    } catch (err: unknown) {
      const message = (err as Error)?.message || 'Ürün kaydedilemedi.';
      showToast('error', message);
    }
  };

  const handleUrunGrubuSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity();
      return;
    }
    const ad = (urunGrubuFormData.ad || '').trim();
    if (!ad) {
      showToast('warning', 'Lütfen ürün kategorisi adını girin.');
      return;
    }
    try {
      if (editingUrunGrubuId) {
        await apiRequest(`/urun-gruplari/${editingUrunGrubuId}`, {
          method: 'PUT',
          data: { name: ad },
        });
        showToast('success', 'Ürün kategorisi güncellendi.');
      } else {
        await apiRequest('/urun-gruplari', {
          method: 'POST',
          data: { name: ad },
        });
        showToast('success', 'Ürün kategorisi eklendi.');
      }
      queryClient.invalidateQueries({ queryKey: ['urun-gruplari'] });
      setEditingUrunGrubuId(null);
      setUrunGrubuFormData({ ad: '' });
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Ürün kategorisi kaydedilemedi.');
    }
  };

  const handleOrganizasyonTuruSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity();
      return;
    }
    const turAdi = (organizasyonTuruFormData.ad || '').trim();
    const grupId = organizasyonTuruFormData.grupId;
    if (!turAdi) {
      showToast('warning', 'Lütfen organizasyon alt türü adını girin.');
      return;
    }
    if (!grupId || Number.isNaN(grupId)) {
      showToast('warning', 'Lütfen bir organizasyon grubu seçin.');
      return;
    }
    try {
      if (editingOrganizasyonTuruId) {
        await apiRequest(`/organizasyon-turleri/${editingOrganizasyonTuruId}`, {
          method: 'PUT',
          data: { tur_adi: turAdi, grup_id: grupId },
        });
        showToast('success', 'Organizasyon türü güncellendi.');
      } else {
        await apiRequest('/organizasyon-turleri', {
          method: 'POST',
          data: { tur_adi: turAdi, grup_id: grupId },
        });
        showToast('success', 'Organizasyon türü eklendi.');
      }
      queryClient.invalidateQueries({ queryKey: ['organizasyon-turleri'] });
      setEditingOrganizasyonTuruId(null);
      setOrganizasyonTuruFormData({ ad: '', grupId: null });
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Organizasyon türü kaydedilemedi.');
    }
  };

  const handleEtiketSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity();
      return;
    }
    const etiketAdi = (organizasyonEtiketiFormData.ad || '').trim();
    const grupId = organizasyonEtiketiFormData.grupId;
    if (!etiketAdi) {
      showToast('warning', 'Lütfen etiket adını girin.');
      return;
    }
    if (!grupId || Number.isNaN(grupId)) {
      showToast('warning', 'Lütfen bir organizasyon grubu seçin.');
      return;
    }
    try {
      if (editingEtiketId) {
        await apiRequest(`/organizasyon-etiketleri/${editingEtiketId}`, {
          method: 'PUT',
          data: { etiket_adi: etiketAdi, grup_id: grupId },
        });
        showToast('success', 'Organizasyon etiketi güncellendi.');
      } else {
        await apiRequest('/organizasyon-etiketleri', {
          method: 'POST',
          data: { etiket_adi: etiketAdi, grup_id: grupId },
        });
        showToast('success', 'Organizasyon etiketi eklendi.');
      }
      queryClient.invalidateQueries({ queryKey: ['organizasyon-etiketleri'] });
      setEditingEtiketId(null);
      setOrganizasyonEtiketiFormData({ ad: '', grupId: null });
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Organizasyon etiketi kaydedilemedi.');
    }
  };

  /** Ana sekme değişince tıklanan tab butonunu görünür yap (profil ayarları gibi) */
  React.useEffect(() => {
    const tabEl = document.querySelector(`.ayarlar-tab-nav button[data-tab="${activeTab}"]`);
    if (tabEl && tabEl instanceof HTMLElement) {
      tabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  /** Subtab değişince ilgili subtab butonunu görünür yap (aktif butonu merkeze kaydır) */
  React.useEffect(() => {
    const el = document.querySelector('.ayarlar-tab-icerik .ayarlar-subtab-nav .ayarlar-subtab-btn.active');
    if (el && el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab, activeSubTab, genelSubTab]);

  /** Düzenle tıklanınca scroll: panel + main (layout’ta hangisi scroll ediyorsa o hareket etsin) */
  const ayarlarFormActive = !!(
    editingUrunId ||
    editingUrunGrubuId ||
    editingOrganizasyonTuruId ||
    editingEtiketId ||
    editingTeslimatId ||
    editingAracId ||
    editingBankaId
  );
  React.useEffect(() => {
    if (!ayarlarFormActive) return;
    const t = setTimeout(() => {
      const pageWrapper = document.querySelector('.ayarlar-page.page-wrapper') as HTMLElement | null;
      if (pageWrapper) pageWrapper.scrollTo({ top: 0, behavior: 'smooth' });
      const main = document.querySelector('main[data-main-content]') as HTMLElement | null;
      if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
    return () => clearTimeout(t);
  }, [ayarlarFormActive, editingUrunId, editingUrunGrubuId, editingOrganizasyonTuruId, editingEtiketId, editingTeslimatId, editingAracId, editingBankaId]);

  return (
    <div className="ayarlar-page page-wrapper">
      <div className="ayarlar-page-inner">
        <div className="ayarlar-tab-nav">
          <button
            type="button"
            data-tab="veri"
            onClick={() => handleTabChange('veri')}
            className={`ayarlar-tab-btn ${activeTab === 'veri' ? 'active' : ''}`}
          >
            <Package size={18} />
            Veri Tanımları
          </button>
          <button
            type="button"
            data-tab="genel"
            onClick={() => handleTabChange('genel')}
            className={`ayarlar-tab-btn ${activeTab === 'genel' ? 'active' : ''}`}
          >
            <Settings size={18} />
            Genel Ayarlar
          </button>
          {isBaslangicPlan === false && (
            <button
              type="button"
              data-tab="arac"
              onClick={() => handleTabChange('arac')}
              className={`ayarlar-tab-btn ${activeTab === 'arac' ? 'active' : ''}`}
            >
              <Truck size={18} />
              Araç Takip Ayarları
            </button>
          )}
          {isBaslangicPlan === false && (
            <button
              type="button"
              data-tab="gonderim"
              onClick={() => handleTabChange('gonderim')}
              className={`ayarlar-tab-btn ${activeTab === 'gonderim' ? 'active' : ''}`}
            >
              <Send size={18} />
              Gönderim Ayarları
            </button>
          )}
          <button
            type="button"
            data-tab="fatura"
            onClick={() => handleTabChange('fatura')}
            className={`ayarlar-tab-btn ${activeTab === 'fatura' ? 'active' : ''}`}
          >
            <FileText size={18} />
            Fatura Ayarları
          </button>
          {isBaslangicPlan === false && (
            <button
              type="button"
              data-tab="ciceksepeti"
              onClick={() => handleTabChange('ciceksepeti')}
              className={`ayarlar-tab-btn ${activeTab === 'ciceksepeti' ? 'active' : ''}`}
            >
              <ShoppingCart size={18} />
              Çiçek Sepeti Ayarları
            </button>
          )}
        </div>

        {/* Veri Tanımları Tab */}
        {activeTab === 'veri' && (
          <div className="ayarlar-tab-icerik">
            <div className="ayarlar-subtab-nav">
              <button
                type="button"
                data-subtab="urunler"
                onClick={() => handleSubTabChange('urunler')}
                className={`ayarlar-subtab-btn ${activeSubTab === 'urunler' ? 'active' : ''}`}
              >
                Ürünler
              </button>
              <button
                type="button"
                data-subtab="urun-gruplari"
                onClick={() => handleSubTabChange('urun-gruplari')}
                className={`ayarlar-subtab-btn ${activeSubTab === 'urun-gruplari' ? 'active' : ''}`}
              >
                Ürün Kategorileri
              </button>
              <button
                type="button"
                data-subtab="organizasyon-turleri"
                onClick={() => handleSubTabChange('organizasyon-turleri')}
                className={`ayarlar-subtab-btn ${activeSubTab === 'organizasyon-turleri' ? 'active' : ''}`}
              >
                Organizasyon Alt Türleri
              </button>
              <button
                type="button"
                data-subtab="organizasyon-etiketleri"
                onClick={() => handleSubTabChange('organizasyon-etiketleri')}
                className={`ayarlar-subtab-btn ${activeSubTab === 'organizasyon-etiketleri' ? 'active' : ''}`}
              >
                Organizasyon Etiketleri
              </button>
            </div>

            <div className={`flex flex-col lg:flex-row gap-6 ayarlar-form-row ${editingUrunId || editingUrunGrubuId || editingOrganizasyonTuruId || editingEtiketId ? 'ayarlar-form-active' : ''}`}>
              <div className="ayarlar-sol-kolon">
                <div className="ayarlar-panel-form">
                  <h3 className="ayarlar-panel-form-title">{getVeriFormTitle()}</h3>
                  
                  {activeSubTab === 'urunler' && (
                    <form className="ayarlar-form" onSubmit={handleUrunSubmit}>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">Ürün Görseli</label>
                        <div
                          className={`dosya-yukle-alan ${urunGorselPreview ? 'dosya-secildi' : ''}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => document.getElementById('ayarlar-urun-gorsel-upload')?.click()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              document.getElementById('ayarlar-urun-gorsel-upload')?.click();
                            }
                          }}
                        >
                          <input
                            id="ayarlar-urun-gorsel-upload"
                            type="file"
                            accept="image/*"
                            className="file-input"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setUrunFormData((prev) => ({ ...prev, gorsel: file }));
                              if (file && file.type.startsWith('image/')) {
                                const reader = new FileReader();
                                reader.onloadend = () => setUrunGorselPreview(reader.result as string);
                                reader.readAsDataURL(file);
                              } else {
                                setUrunGorselPreview('');
                              }
                            }}
                          />
                          {urunGorselPreview ? (
                            <>
                              <img src={urunGorselPreview} alt="Ürün görseli" className="davetiye-preview-img" />
                              <span className="secilen-dosya-metin">
                                <strong>Seçilen dosya:</strong> {urunFormData.gorsel?.name}
                              </span>
                              <button
                                type="button"
                                className="remove-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setUrunFormData((prev) => ({ ...prev, gorsel: null }));
                                  setUrunGorselPreview('');
                                }}
                              >
                                Kaldır
                              </button>
                            </>
                          ) : (
                            <>
                              <Upload size={18} strokeWidth={1.5} aria-hidden />
                              <span className="file-label">Ürün görselini buraya sürükleyin veya tıklayın</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">Ürün Kategorisi</label>
                        <select
                          value={urunFormData.grup}
                          onChange={(e) => setUrunFormData({ ...urunFormData, grup: e.target.value })}
                          className="ayarlar-input ayarlar-select"
                          required
                        >
                          <option value="">Seçiniz</option>
                          {Array.isArray(urunGruplariDropdown) && urunGruplariDropdown.map((grup) => (
                            <option key={grup.id} value={grup.ad}>{grup.ad}</option>
                          ))}
                        </select>
                      </div>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">Ürün Adı</label>
                        <input
                          type="text"
                          value={urunFormData.ad}
                          onChange={(e) => setUrunFormData({ ...urunFormData, ad: e.target.value })}
                          className="ayarlar-input"
                          required
                        />
                      </div>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">Ürün Fiyatı (TL)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={urunFormData.fiyat}
                          onChange={(e) =>
                            setUrunFormData((prev) => ({
                              ...prev,
                              fiyat: formatTutarInputLive(e.target.value),
                            }))
                          }
                          onKeyDown={(e) => formatTutarInputKeyDown(e as any, urunFormData.fiyat)}
                          onBlur={() => setUrunFormData((prev) => ({ ...prev, fiyat: formatTLDisplayValue(parseTL(prev.fiyat)) }))}
                          placeholder="0,00"
                          className="ayarlar-input tl-input"
                          required
                        />
                      </div>
                      <div className="ayarlar-form-actions">
                        {editingUrunId && (
                          <button type="button" className="ayarlar-btn ayarlar-btn-secondary" onClick={handleCancelUrunEdit}>Vazgeç</button>
                        )}
                        <button type="submit" className="ayarlar-btn ayarlar-btn-primary">{editingUrunId ? 'Güncelle' : 'Kaydet'}</button>
                      </div>
                    </form>
                  )}

                  {activeSubTab === 'urun-gruplari' && (
                    <form className="ayarlar-form" onSubmit={handleUrunGrubuSubmit}>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">Ürün Kategorisi Adı</label>
                        <input
                          type="text"
                          value={urunGrubuFormData.ad}
                          onChange={(e) => setUrunGrubuFormData({ ad: e.target.value })}
                          className="ayarlar-input"
                          required
                        />
                      </div>
                      <div className="ayarlar-form-actions">
                        {editingUrunGrubuId && (
                          <button type="button" className="ayarlar-btn ayarlar-btn-secondary" onClick={handleCancelUrunGrubuEdit}>Vazgeç</button>
                        )}
                        <button type="submit" className="ayarlar-btn ayarlar-btn-primary">{editingUrunGrubuId ? 'Güncelle' : 'Kaydet'}</button>
                      </div>
                    </form>
                  )}

                  {activeSubTab === 'organizasyon-turleri' && (
                    <form className="ayarlar-form" onSubmit={handleOrganizasyonTuruSubmit}>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">Organizasyon Grubu</label>
                        <select
                          className="ayarlar-input"
                          value={organizasyonTuruFormData.grupId ?? ''}
                          onChange={(e) =>
                            setOrganizasyonTuruFormData({
                              ...organizasyonTuruFormData,
                              grupId: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          required
                        >
                          <option value="">Seçiniz</option>
                          {organizasyonGruplari.map((grup: { id: number; grup_adi?: string; tur_adi?: string; name?: string }) => (
                            <option key={grup.id} value={grup.id}>
                              {grup.grup_adi || grup.tur_adi || grup.name || `Grup #${grup.id}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">Organizasyon Alt Türü Adı</label>
                        <input
                          type="text"
                          value={organizasyonTuruFormData.ad}
                          onChange={(e) => setOrganizasyonTuruFormData({ ...organizasyonTuruFormData, ad: e.target.value })}
                          className="ayarlar-input"
                          required
                        />
                      </div>
                      <div className="butonlar" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
                        {editingOrganizasyonTuruId && (
                          <button
                            type="button"
                            className="secondary-button btn-vazgec"
                            onClick={handleCancelOrganizasyonTuruEdit}
                          >
                            VAZGEÇ
                          </button>
                        )}
                        <button
                          type="submit"
                          className="primary-button btn-kaydet"
                          style={{ marginLeft: editingOrganizasyonTuruId ? '0.75rem' : 0 }}
                        >
                          {editingOrganizasyonTuruId ? 'GÜNCELLE' : 'KAYDET'}
                        </button>
                      </div>
                    </form>
                  )}

                  {activeSubTab === 'organizasyon-etiketleri' && (
                    <form className="ayarlar-form" onSubmit={handleEtiketSubmit}>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">Organizasyon Grubu</label>
                        <select
                          className="ayarlar-input"
                          value={organizasyonEtiketiFormData.grupId ?? ''}
                          onChange={(e) =>
                            setOrganizasyonEtiketiFormData({
                              ...organizasyonEtiketiFormData,
                              grupId: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          required
                        >
                          <option value="">Seçiniz</option>
                          {organizasyonGruplari.map((grup: { id: number; grup_adi?: string; tur_adi?: string; name?: string }) => (
                            <option key={grup.id} value={grup.id}>
                              {grup.grup_adi || grup.tur_adi || grup.name || `Grup #${grup.id}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">Organizasyon Etiketi Adı</label>
                        <input
                          type="text"
                          value={organizasyonEtiketiFormData.ad}
                          onChange={(e) => setOrganizasyonEtiketiFormData({ ...organizasyonEtiketiFormData, ad: e.target.value })}
                          className="ayarlar-input"
                          required
                        />
                      </div>
                      <div className="ayarlar-form-actions">
                        {editingEtiketId && (
                          <button type="button" className="ayarlar-btn ayarlar-btn-secondary" onClick={handleCancelEtiketEdit}>Vazgeç</button>
                        )}
                        <button type="submit" className="ayarlar-btn ayarlar-btn-primary">{editingEtiketId ? 'Güncelle' : 'Kaydet'}</button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              <div className="ayarlar-sag-kolon">
                <div className="ayarlar-panel">
                  <div className="ayarlar-panel-header">
                    <div className="ayarlar-panel-header-sol">
                      <h3 className="ayarlar-panel-title">
                        {activeSubTab === 'urunler' && 'Ürünler'}
                        {activeSubTab === 'urun-gruplari' && 'Ürün Kategorileri'}
                        {activeSubTab === 'organizasyon-turleri' && 'Organizasyon Alt Türleri'}
                        {activeSubTab === 'organizasyon-etiketleri' && 'Organizasyon Etiketleri'}
                      </h3>
                      <span className="ayarlar-count-badge">
                        {activeSubTab === 'urunler' && filteredUrunler.length}
                        {activeSubTab === 'urun-gruplari' && filteredUrunGruplari.length}
                        {activeSubTab === 'organizasyon-turleri' && filteredOrganizasyonTurleri.length}
                        {activeSubTab === 'organizasyon-etiketleri' && filteredEtiketler.length}{' '}
                        {getVeriListLabel()}
                      </span>
                    </div>
                    <SearchInput
                      value={veriSearchQuery}
                      onChange={setVeriSearchQuery}
                      placeholder={
                        activeSubTab === 'urunler'
                          ? 'Ürün ara...'
                          : activeSubTab === 'urun-gruplari'
                            ? 'Kategori ara...'
                            : activeSubTab === 'organizasyon-turleri'
                              ? 'Organizasyon türü ara...'
                              : 'Etiket ara...'
                      }
                      className="page-search-input ayarlar-panel-search"
                      aria-label="Liste ara"
                    />
                  </div>
                  
                  {activeSubTab === 'urunler' && (
                    urunlerLoading ? (
                      <LoadingSpinner />
                    ) : !Array.isArray(urunler) || urunler.length === 0 ? (
                      <EmptyState variant="soft" title="Görüntülenecek ürün bulunamadı" description="" icon={<FileSearch size={28} aria-hidden />} />
                    ) : filteredUrunler.length === 0 ? (
                      <EmptyState variant="soft" title="Arama sonucu bulunamadı" description="Farklı bir arama terimi deneyin." icon={<FileSearch size={28} aria-hidden />} />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full ayarlar-tablosu ayarlar-urunler-tablosu">
                          <thead>
                            <tr>
                              <th className="table-col-gorsel">ÜRÜN GÖRSELİ</th>
                              <TableSortHeader field="ad" label="Ürün Adı" currentSort={urunSortField} sortDirection={urunSortDir} onSort={handleUrunSort} className="table-col-urun-adi" />
                              <TableSortHeader field="grup" label="Ürün Kategorisi" currentSort={urunSortField} sortDirection={urunSortDir} onSort={handleUrunSort} className="table-col-urun-kategori" />
                              <TableSortHeader field="fiyat" label="Ürün Fiyatı" currentSort={urunSortField} sortDirection={urunSortDir} onSort={handleUrunSort} className="table-col-fiyat" />
                              <th className="table-col-durum">DURUM</th>
                              <th className="table-col-islem">İŞLEMLER</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.isArray(filteredUrunler) && filteredUrunler.map((urun) => (
                              <tr key={urun.id} className="hover:bg-gray-50 ayarlar-table-row" data-table-row>
                                <td data-label="Ürün Görseli" className="px-4 py-3 table-col-gorsel">
                                  {urun.gorsel ? (
                                    <img src={urun.gorsel} alt={urun.ad} className="w-12 h-12 object-cover rounded" />
                                  ) : (
                                    <img src="/assets/product-img-placeholder.png" alt="Görsel yok" className="w-12 h-12 object-cover rounded" />
                                  )}
                                </td>
                                <td data-label="Ürün Adı" className="px-4 py-3 text-sm text-gray-900 urunler-ad-hucre">{urun.ad}</td>
                                <td data-label="Ürün Kategorisi" className="px-4 py-3 text-sm text-gray-600">
                                  <span className="cell-badge">{urun.grup || '-'}</span>
                                </td>
                                <td data-label="Ürün Fiyatı" className="px-4 py-3 text-sm font-medium text-gray-900">
                                  {urun.fiyat != null && urun.fiyat !== undefined
                                    ? formatTL(urun.fiyat)
                                    : '-'}
                                </td>
                                <td data-label="Durum" className="px-4 py-3 text-sm table-col-durum">
                                  <button
                                    type="button"
                                    className={`durum-badge ${
                                      urun.durum === 1 ? 'durum-badge-aktif' : 'durum-badge-pasif'
                                    }`}
                                    data-tooltip="Ürünün durumunu güncellemek için tıklayın"
                                    onClick={async () => {
                                      try {
                                        const yeniDurum = urun.durum === 1 ? 0 : 1;
                                        await apiClient.put(
                                          `/urunler/${urun.id}`,
                                          { durum: yeniDurum },
                                        );
                                        queryClient.invalidateQueries({ queryKey: ['ayarlar', 'urunler'] });
                                        showToast('success', yeniDurum === 1 ? 'Ürün aktif yapıldı.' : 'Ürün pasif yapıldı.');
                                      } catch (err) {
                                        const msg = (err as Error)?.message || 'Durum güncellenemedi';
                                        showToast('error', msg);
                                      }
                                    }}
                                  >
                                    {urun.durum === 1 ? 'AKTİF' : 'PASİF'}
                                  </button>
                                </td>
                                <td data-label="İşlemler" className="px-4 py-3 text-sm font-medium table-col-islem">
                                  <div className="islem-ikonlar">
                                    <button
                                      type="button"
                                      className="islem-ikon duzenle-ikon"
                                      data-tooltip="Ürünü Düzenle"
                                      onClick={() => {
                                        setEditingUrunId(urun.id);
                                        setActiveSubTab('urunler');
                                        setUrunFormData({
                                          ad: urun.ad || '',
                                          grup: urun.grup || '',
                                          fiyat: formatTLDisplayValue(urun.fiyat) || '',
                                          gorsel: null,
                                        });
                                      }}
                                    >
                                      <Pencil size={16} aria-hidden />
                                    </button>
                                    <button
                                      type="button"
                                      className="islem-ikon sil-ikon"
                                      data-tooltip="Ürünü Sil"
                                      onClick={() => {
                                        const ad = (urun.ad || '').trim() || `Ürün #${urun.id}`;
                                        showToastInteractive({
                                          title: 'Ürün Sil',
                                          message: `${ad} kaydını silmek istediğinize emin misiniz?`,
                                          confirmText: 'Evet, Sil',
                                          cancelText: 'İptal',
                                          onConfirm: async () => {
                                            try {
                                              queryClient.setQueryData<Urun[]>(['ayarlar', 'urunler'], (old) => {
                                                if (!Array.isArray(old)) return old;
                                                return old.filter((u) => u.id !== urun.id);
                                              });
                                              await apiRequest(`/urunler/${urun.id}`, {
                                                method: 'DELETE',
                                              });
                                              queryClient.invalidateQueries({ queryKey: ['ayarlar', 'urunler'] });
                                              if (editingUrunId === urun.id) {
                                                setEditingUrunId(null);
                                                setUrunFormData({
                                                  ad: '',
                                                  grup: '',
                                                  fiyat: '',
                                                  gorsel: null,
                                                });
                                              }
                                              showToast('success', 'Ürün silindi.');
                                            } catch (err) {
                                              showToast('error', (err as Error)?.message || 'Ürün silinemedi.');
                                            }
                                          },
                                        });
                                      }}
                                    >
                                      <Trash2 size={16} aria-hidden />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}

                  {activeSubTab === 'urun-gruplari' && (
                    !urunGruplari || urunGruplari.length === 0 ? (
                      <EmptyState variant="soft" title="Görüntülenecek ürün kategorisi bulunamadı" description="" icon={<FileSearch size={28} aria-hidden />} />
                    ) : filteredUrunGruplari.length === 0 ? (
                      <EmptyState variant="soft" title="Arama sonucu bulunamadı" description="Farklı bir arama terimi deneyin." icon={<FileSearch size={28} aria-hidden />} />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full ayarlar-tablosu">
                          <thead>
                            <tr>
                              <TableSortHeader
                                field="ad"
                                label="Ürün Kategorisi Adı"
                                currentSort={urunGrupSortField}
                                sortDirection={urunGrupSortDir}
                                onSort={handleUrunGrupSort}
                              />
                              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase table-col-durum">
                                DURUM
                              </th>
                              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase table-col-islem">
                                İŞLEMLER
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.isArray(filteredUrunGruplari) && filteredUrunGruplari.map((grup) => (
                              <tr key={grup.id} className="hover:bg-gray-50 ayarlar-table-row" data-table-row>
                                <td data-label="Ürün Kategorisi Adı" className="px-4 py-3 text-sm font-medium text-gray-900">{grup.ad}</td>
                                <td data-label="Durum" className="px-4 py-3 text-sm table-col-durum">
                                  <button
                                    type="button"
                                    className={`durum-badge ${grup.durum === 1 ? 'durum-badge-aktif' : 'durum-badge-pasif'}`}
                                    data-tooltip="Ürün kategorisi durumunu güncellemek için tıklayın"
                                    onClick={async () => {
                                      try {
                                        const yeniDurum = grup.durum === 1 ? 0 : 1;
                                        await apiClient.put(`/urun-gruplari/${grup.id}`, { durum: yeniDurum });
                                        queryClient.invalidateQueries({ queryKey: ['urun-gruplari'] });
                                        showToast('success', yeniDurum === 1 ? 'Kategori aktif yapıldı.' : 'Kategori pasif yapıldı.');
                                      } catch (err) {
                                        showToast('error', (err as Error)?.message || 'Durum güncellenemedi');
                                      }
                                    }}
                                  >
                                    {grup.durum === 1 ? 'AKTİF' : 'PASİF'}
                                  </button>
                                </td>
                                <td data-label="İşlemler" className="px-4 py-3 text-sm font-medium table-col-islem">
                                  <div className="islem-ikonlar">
                                    <button
                                      type="button"
                                      className="islem-ikon duzenle-ikon"
                                      data-tooltip="Ürün Kategorisini Düzenle"
                                      onClick={() => {
                                        setEditingUrunGrubuId(grup.id);
                                        setUrunGrubuFormData({ ad: grup.ad || '' });
                                      }}
                                    >
                                      <Pencil size={16} aria-hidden />
                                    </button>
                                    <button
                                      type="button"
                                      className="islem-ikon sil-ikon"
                                      data-tooltip="Ürün Kategorisini Sil"
                                      onClick={() => {
                                        const ad = (grup.ad || '').trim() || `Ürün Kategorisi #${grup.id}`;
                                        showToastInteractive({
                                          title: 'Ürün Kategorisi Sil',
                                          message: `${ad} kategorisini silmek istediğinize emin misiniz?`,
                                          confirmText: 'Evet, Sil',
                                          cancelText: 'İptal',
                                          onConfirm: async () => {
                                            try {
                                              await apiRequest(`/urun-gruplari/${grup.id}`, {
                                                method: 'DELETE',
                                              });
                                              queryClient.invalidateQueries({ queryKey: ['urun-gruplari'] });
                                              setEditingUrunGrubuId(null);
                                              setUrunGrubuFormData({ ad: '' });
                                              showToast('success', 'Ürün kategorisi silindi.');
                                            } catch (err) {
                                              showToast('error', (err as Error)?.message || 'Ürün kategorisi silinemedi');
                                            }
                                          },
                                        });
                                      }}
                                    >
                                      <Trash2 size={16} aria-hidden />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}

                  {activeSubTab === 'organizasyon-turleri' && (
                    !organizasyonTurleri || organizasyonTurleri.length === 0 ? (
                      <EmptyState
                        variant="soft"
                        title="Görüntülenecek organizasyon türü bulunamadı"
                        description=""
                        icon={<FileSearch size={28} aria-hidden />}
                      />
                    ) : filteredOrganizasyonTurleri.length === 0 ? (
                      <EmptyState variant="soft" title="Arama sonucu bulunamadı" description="Farklı bir arama terimi deneyin." icon={<FileSearch size={28} aria-hidden />} />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full ayarlar-tablosu">
                          <thead>
                            <tr>
                              <TableSortHeader
                                field="grup"
                                label="Organizasyon Türü"
                                currentSort={orgTurSortField}
                                sortDirection={orgTurSortDir}
                                onSort={handleOrgTurSort}
                                className="table-col-organizasyon-turu"
                              />
                              <TableSortHeader
                                field="tur"
                                label="Tanımlı Alt Türler"
                                currentSort={orgTurSortField}
                                sortDirection={orgTurSortDir}
                                onSort={handleOrgTurSort}
                              />
                              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase table-col-durum">
                                DURUM
                              </th>
                              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase table-col-islem">
                                İŞLEMLER
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.isArray(filteredOrganizasyonTurleri) && filteredOrganizasyonTurleri.map((tur) => (
                              <tr key={tur.id} className="hover:bg-gray-50 ayarlar-table-row" data-table-row>
                                <td data-label="Organizasyon Türü" className="px-4 py-3 text-sm font-medium text-gray-900 table-col-organizasyon-turu">
                                  <span className="cell-badge cell-badge-with-dot">
                                    <span
                                      className="cell-badge-dot"
                                      style={{ backgroundColor: organizasyonTurNoktaRenk(tur.renk_kodu, tur.grup_adi) }}
                                      aria-hidden
                                    />
                                    {tur.grup_adi || tur.tur_adi || tur.ad || '—'}
                                  </span>
                                </td>
                                <td data-label="Tanımlı Alt Türler" className="px-4 py-3 text-sm text-gray-900">
                                  {tur.tur_adi ?? tur.ad ?? '—'}
                                </td>
                                <td data-label="Durum" className="px-4 py-3 text-sm table-col-durum">
                                  <button
                                    type="button"
                                    className={`durum-badge ${(tur.durum ?? 1) === 1 ? 'durum-badge-aktif' : 'durum-badge-pasif'}`}
                                    data-tooltip="Organizasyon türü durumunu güncellemek için tıklayın"
                                    onClick={async () => {
                                      try {
                                        const yeniDurum = (tur.durum ?? 1) === 1 ? 0 : 1;
                                        await apiClient.put(`/organizasyon-turleri/${tur.id}`, { durum: yeniDurum });
                                        queryClient.invalidateQueries({ queryKey: ['organizasyon-turleri'] });
                                        showToast('success', yeniDurum === 1 ? 'Organizasyon türü aktif yapıldı.' : 'Organizasyon türü pasif yapıldı.');
                                      } catch (err) {
                                        showToast('error', (err as Error)?.message || 'Durum güncellenemedi');
                                      }
                                    }}
                                  >
                                    {(tur.durum ?? 1) === 1 ? 'AKTİF' : 'PASİF'}
                                  </button>
                                </td>
                                <td data-label="İşlemler" className="px-4 py-3 text-sm font-medium table-col-islem">
                                  <div className="islem-ikonlar">
                                    <button
                                      type="button"
                                      className="islem-ikon duzenle-ikon"
                                      data-tooltip="Organizasyon Türünü Düzenle"
                                      onClick={() => {
                                        setEditingOrganizasyonTuruId(tur.id);
                                        setOrganizasyonTuruFormData({
                                          ad: (tur.tur_adi ?? tur.ad ?? '').trim(),
                                          grupId: tur.grup_id ?? null,
                                        });
                                      }}
                                    >
                                      <Pencil size={16} aria-hidden />
                                    </button>
                                    <button
                                      type="button"
                                      className="islem-ikon sil-ikon"
                                      data-tooltip="Organizasyon Türünü Sil"
                                      onClick={() => {
                                        const ad = (tur.tur_adi ?? tur.ad ?? '').trim() || `Organizasyon Türü #${tur.id}`;
                                        showToastInteractive({
                                          title: 'Organizasyon Türü Sil',
                                          message: `${ad} kaydını silmek istediğinize emin misiniz?`,
                                          confirmText: 'Evet, Sil',
                                          cancelText: 'İptal',
                                          onConfirm: async () => {
                                            try {
                                              await apiRequest(`/organizasyon-turleri/${tur.id}`, {
                                                method: 'DELETE',
                                              });
                                              queryClient.invalidateQueries({ queryKey: ['organizasyon-turleri'] });
                                              setEditingOrganizasyonTuruId(null);
                                              setOrganizasyonTuruFormData({ ad: '', grupId: null });
                                              showToast('success', 'Organizasyon türü silindi.');
                                            } catch (err) {
                                              showToast('error', (err as Error)?.message || 'Organizasyon türü silinemedi');
                                            }
                                          },
                                        });
                                      }}
                                    >
                                      <Trash2 size={16} aria-hidden />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}

                  {activeSubTab === 'organizasyon-etiketleri' && (
                    !organizasyonEtiketleri || organizasyonEtiketleri.length === 0 ? (
                      <EmptyState
                        variant="soft"
                        title="Görüntülenecek organizasyon etiketi bulunamadı"
                        description=""
                        icon={<FileSearch size={28} aria-hidden />}
                      />
                    ) : filteredEtiketler.length === 0 ? (
                      <EmptyState variant="soft" title="Arama sonucu bulunamadı" description="Farklı bir arama terimi deneyin." icon={<FileSearch size={28} aria-hidden />} />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full ayarlar-tablosu">
                          <thead>
                            <tr>
                              <TableSortHeader
                                field="grup"
                                label="Organizasyon Türü"
                                currentSort={etiketSortField}
                                sortDirection={etiketSortDir}
                                onSort={handleEtiketSort}
                                className="table-col-organizasyon-turu"
                              />
                              <TableSortHeader
                                field="ad"
                                label="Tanımlı Etiketler"
                                currentSort={etiketSortField}
                                sortDirection={etiketSortDir}
                                onSort={handleEtiketSort}
                              />
                              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase table-col-durum">
                                DURUM
                              </th>
                              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase table-col-islem">
                                İŞLEMLER
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.isArray(filteredEtiketler) && filteredEtiketler.map((etiket) => (
                              <tr key={etiket.id} className="hover:bg-gray-50 ayarlar-table-row" data-table-row>
                                <td data-label="Organizasyon Türü" className="px-4 py-3 text-sm font-medium text-gray-900 table-col-organizasyon-turu">
                                  <span className="cell-badge cell-badge-with-dot">
                                    <span
                                      className="cell-badge-dot"
                                      style={{ backgroundColor: organizasyonTurNoktaRenk(etiket.renk_kodu ?? etiket.renk, etiket.grup_adi) }}
                                      aria-hidden
                                    />
                                    {etiket.grup_adi || etiket.ad || '—'}
                                  </span>
                                </td>
                                <td data-label="Tanımlı Etiketler" className="px-4 py-3 text-sm font-medium text-gray-900">
                                  {etiket.ad}
                                </td>
                                <td data-label="Durum" className="px-4 py-3 text-sm table-col-durum">
                                  <button
                                    type="button"
                                    className={`durum-badge ${(etiket.durum ?? 1) === 1 ? 'durum-badge-aktif' : 'durum-badge-pasif'}`}
                                    data-tooltip="Etiket durumunu güncellemek için tıklayın"
                                    onClick={async () => {
                                      try {
                                        const yeniDurum = (etiket.durum ?? 1) === 1 ? 0 : 1;
                                        await apiClient.put(`/organizasyon-etiketleri/${etiket.id}`, { durum: yeniDurum });
                                        queryClient.invalidateQueries({ queryKey: ['organizasyon-etiketleri'] });
                                        showToast('success', yeniDurum === 1 ? 'Etiket aktif yapıldı.' : 'Etiket pasif yapıldı.');
                                      } catch (err) {
                                        showToast('error', (err as Error)?.message || 'Durum güncellenemedi');
                                      }
                                    }}
                                  >
                                    {(etiket.durum ?? 1) === 1 ? 'AKTİF' : 'PASİF'}
                                  </button>
                                </td>
                                <td data-label="İşlemler" className="px-4 py-3 text-sm font-medium table-col-islem">
                                  <div className="islem-ikonlar">
                                    <button
                                      type="button"
                                      className="islem-ikon duzenle-ikon"
                                      data-tooltip="Etiketi Düzenle"
                                      onClick={() => {
                                        setEditingEtiketId(etiket.id);
                                        setOrganizasyonEtiketiFormData({
                                          ad: etiket.ad,
                                          grupId: etiket.grup_id ?? null,
                                        });
                                      }}
                                    >
                                      <Pencil size={16} aria-hidden />
                                    </button>
                                    <button
                                      type="button"
                                      className="islem-ikon sil-ikon"
                                      data-tooltip="Etiketi Sil"
                                      onClick={() => {
                                        const ad = (etiket.ad || '').trim() || `Etiket #${etiket.id}`;
                                        showToastInteractive({
                                          title: 'Etiket Sil',
                                          message: `${ad} etiketini silmek istediğinize emin misiniz?`,
                                          confirmText: 'Evet, Sil',
                                          cancelText: 'İptal',
                                          onConfirm: async () => {
                                            const silinecekId = etiket.id;
                                            try {
                                              await apiRequest(`/organizasyon-etiketleri/${silinecekId}`, {
                                                method: 'DELETE',
                                              });
                                              queryClient.setQueryData(
                                                ['organizasyon-etiketleri'],
                                                (prev: OrganizasyonEtiketi[] | undefined) =>
                                                  Array.isArray(prev) ? prev.filter((e) => e.id !== silinecekId) : prev
                                              );
                                              setEditingEtiketId(null);
                                              setOrganizasyonEtiketiFormData({ ad: '', grupId: null });
                                              showToast('success', 'Organizasyon etiketi silindi.');
                                            } catch (err) {
                                              showToast('error', (err as Error)?.message || 'Organizasyon etiketi silinemedi');
                                            }
                                          },
                                        });
                                      }}
                                    >
                                      <Trash2 size={16} aria-hidden />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Genel Ayarlar Tab */}
        {activeTab === 'genel' && (
          <div className="ayarlar-tab-icerik">
            <div className="ayarlar-subtab-nav">
              <button type="button" data-subtab="isletme" onClick={() => setGenelSubTab('isletme')} className={`ayarlar-subtab-btn ${genelSubTab === 'isletme' ? 'active' : ''}`}>İşletme Ayarları</button>
              <button type="button" data-subtab="konum" onClick={() => setGenelSubTab('konum')} className={`ayarlar-subtab-btn ${genelSubTab === 'konum' ? 'active' : ''}`}>Konum Ayarları</button>
              <button type="button" data-subtab="teslimat" onClick={() => setGenelSubTab('teslimat')} className={`ayarlar-subtab-btn ${genelSubTab === 'teslimat' ? 'active' : ''}`}>Teslimat Konumları</button>
              <button type="button" data-subtab="yazdirma" onClick={() => setGenelSubTab('yazdirma')} className={`ayarlar-subtab-btn ${genelSubTab === 'yazdirma' ? 'active' : ''}`}>Yazdırma Ayarları</button>
              <button type="button" data-subtab="banka" onClick={() => setGenelSubTab('banka')} className={`ayarlar-subtab-btn ${genelSubTab === 'banka' ? 'active' : ''}`}>Banka Hesap Bilgileri</button>
            </div>
            {/* Banka Hesap Bilgileri: sol form + sağ tablo */}
            {genelSubTab === 'banka' ? (
              <div className={`flex flex-col lg:flex-row gap-6 ayarlar-form-row ${editingBankaId ? 'ayarlar-form-active' : ''}`}>
                <div className="ayarlar-sol-kolon">
                  <div className="ayarlar-panel-form">
                    <h3 className="ayarlar-panel-form-title">{editingBankaId ? 'Banka Hesabını Düzenle' : 'Yeni Banka Hesabı Ekle'}</h3>
                    <p className="ayarlar-panel-desc">Fatura ve müşteri mesajında kullanılacak banka/IBAN bilgileri. Faturada veya mesajda göstermek istediklerinizi ilgili sekmelerden seçebilirsiniz.</p>
                    <form
                      className="ayarlar-form"
                      onSubmit={(e) => { e.preventDefault(); if (editingBankaId) handleBankaGuncelle(); else handleBankaEkle(); }}
                      noValidate
                    >
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">Banka adı *</label>
                        <input type="text" className="ayarlar-input" placeholder="Banka adı" value={bankaForm.banka_adi} onChange={(e) => setBankaForm((p) => ({ ...p, banka_adi: e.target.value }))} required />
                      </div>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">IBAN *</label>
                        <input type="text" className="ayarlar-input" placeholder="IBAN" value={bankaForm.iban} onChange={(e) => setBankaForm((p) => ({ ...p, iban: e.target.value }))} required />
                      </div>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">Şube</label>
                        <input type="text" className="ayarlar-input" placeholder="Şube" value={bankaForm.sube} onChange={(e) => setBankaForm((p) => ({ ...p, sube: e.target.value }))} />
                      </div>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">Hesap sahibi</label>
                        <input type="text" className="ayarlar-input" placeholder="Hesap sahibi" value={bankaForm.hesap_sahibi} onChange={(e) => setBankaForm((p) => ({ ...p, hesap_sahibi: e.target.value }))} />
                      </div>
                      <div className="ayarlar-form-actions">
                        {editingBankaId && (
                          <button type="button" className="ayarlar-btn ayarlar-btn-secondary" onClick={() => { setEditingBankaId(null); setBankaForm({ banka_adi: '', iban: '', sube: '', hesap_sahibi: '', aciklama: '' }); }}>Vazgeç</button>
                        )}
                        <button type="submit" className="ayarlar-btn ayarlar-btn-primary">{editingBankaId ? 'Güncelle' : 'Ekle'}</button>
                      </div>
                    </form>
                  </div>
                </div>
                <div className="ayarlar-sag-kolon">
                  <div className="ayarlar-panel">
                    <div className="ayarlar-panel-header-sol">
                      <h3 className="ayarlar-panel-form-title">Banka Hesapları</h3>
                      <span className="ayarlar-count-badge">{bankaHesaplari.length} Hesap</span>
                    </div>
                    {bankaHesaplari.length === 0 ? (
                      <EmptyState variant="soft" title="Henüz banka hesabı eklenmemiş" description="Sol taraftaki formdan yeni hesap ekleyebilirsiniz." icon={<FileSearch size={28} aria-hidden />} />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full ayarlar-tablosu ayarlar-tablosu--banka-hesaplari">
                          <thead>
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Banka</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">IBAN</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Şube / Hesap sahibi</th>
                              <th className="table-col-islem w-24">İşlem</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {bankaHesaplari.map((b) => (
                              <tr key={b.id}>
                                <td>{b.banka_adi || '—'}</td>
                                <td>{b.iban || '—'}</td>
                                <td>{[b.sube, b.hesap_sahibi].filter(Boolean).join(' · ') || '—'}</td>
                                <td className="table-col-islem">
                                  <div className="islem-ikonlar">
                                    <button type="button" className="islem-ikon duzenle-ikon" aria-label="Düzenle" onClick={() => { setBankaForm({ banka_adi: b.banka_adi || '', iban: b.iban || '', sube: b.sube || '', hesap_sahibi: b.hesap_sahibi || '', aciklama: b.aciklama || '' }); setEditingBankaId(b.id); }}><Pencil size={16} /></button>
                                    <button type="button" className="islem-ikon sil-ikon" aria-label="Sil" onClick={() => handleBankaSil(b.id)}><Trash2 size={16} /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : genelSubTab === 'teslimat' ? (
              <div className={`flex flex-col lg:flex-row gap-6 ayarlar-form-row ${editingTeslimatId ? 'ayarlar-form-active' : ''}`}>
                <div className="ayarlar-sol-kolon">
                  <div className="ayarlar-panel-form">
                    <h3 className="ayarlar-panel-form-title">{editingTeslimatId ? 'Teslimat Konumunu Düzenle' : 'Yeni Teslimat Konumu Ekle'}</h3>
                    <form className="ayarlar-form" onSubmit={handleTeslimatSubmit}>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">Teslimat Konumu Adı *</label>
                        <input type="text" className="ayarlar-input" placeholder="Örn. Düğün Salonu Adı" value={teslimatFormData.konum_adi} onChange={(e) => setTeslimatFormData((p) => ({ ...p, konum_adi: e.target.value }))} required />
                      </div>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">İl</label>
                        <select className="ayarlar-input ayarlar-select" value={addressSelectTeslimat.il} onChange={(e) => addressSelectTeslimat.setIl(e.target.value)}>
                          <option value="">İl Seçiniz</option>
                          {addressSelectTeslimat.ilOptions.map((il) => (
                            <option key={il.id} value={il.name}>{il.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">İlçe</label>
                        <select className="ayarlar-input ayarlar-select" value={addressSelectTeslimat.ilce} onChange={(e) => addressSelectTeslimat.setIlce(e.target.value)} disabled={!addressSelectTeslimat.il}>
                          <option value="">İlçe Seçiniz</option>
                          {addressSelectTeslimat.ilceOptions.map((ilce) => (
                            <option key={ilce.id} value={ilce.name}>{ilce.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">Mahalle</label>
                        <select className="ayarlar-input ayarlar-select" value={addressSelectTeslimat.mahalle} onChange={(e) => addressSelectTeslimat.setMahalle(e.target.value)} disabled={!addressSelectTeslimat.ilce}>
                          <option value="">Mahalle Seçiniz</option>
                          {addressSelectTeslimat.mahalleOptions.map((m) => (
                            <option key={m.id} value={m.name}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">Açık Adres</label>
                        <textarea className="ayarlar-input" rows={2} placeholder="Açık adres" value={teslimatFormData.acik_adres} onChange={(e) => setTeslimatFormData((p) => ({ ...p, acik_adres: e.target.value }))} />
                      </div>
                      <div className="ayarlar-form-actions">
                        {editingTeslimatId && (
                          <button type="button" className="ayarlar-btn ayarlar-btn-secondary" onClick={() => { setEditingTeslimatId(null); setTeslimatFormData({ konum_adi: '', il: '', ilce: '', mahalle: '', acik_adres: '' }); addressSelectTeslimat.reset(); }}>Vazgeç</button>
                        )}
                        <button type="submit" className="ayarlar-btn ayarlar-btn-primary">{editingTeslimatId ? 'Güncelle' : 'Ekle'}</button>
                      </div>
                    </form>
                  </div>
                </div>
                <div className="ayarlar-sag-kolon">
                  <div className="ayarlar-panel">
                    <div className="ayarlar-panel-header-sol">
                      <h3 className="ayarlar-panel-form-title">Teslimat Konumları Listesi</h3>
                      <span className="ayarlar-count-badge">{teslimatKonumlari.length} Konum</span>
                    </div>
                    {teslimatKonumlari.length === 0 ? (
                      <EmptyState variant="soft" title="Henüz teslimat konumu eklenmemiş" description="Sol taraftaki formdan yeni konum ekleyebilirsiniz." icon={<FileSearch size={28} aria-hidden />} />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full ayarlar-tablosu">
                          <thead>
                            <tr>
                              <TableSortHeader field="konum_adi" label="Konum Adı" currentSort={teslimatSortField} sortDirection={teslimatSortDir} onSort={handleTeslimatSort} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase" />
                              <TableSortHeader field="il" label="İl / İlçe" currentSort={teslimatSortField} sortDirection={teslimatSortDir} onSort={handleTeslimatSort} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase" />
                              <TableSortHeader field="mahalle" label="Mahalle" currentSort={teslimatSortField} sortDirection={teslimatSortDir} onSort={handleTeslimatSort} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase" />
                              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase table-col-islem">İŞLEMLER</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedTeslimatKonumlari.map((k: { id: number; konum_adi: string; il?: string; ilce?: string; mahalle?: string }) => (
                              <tr key={k.id} className="hover:bg-gray-50 ayarlar-table-row">
                                <td data-label="" className="td-no-mobile-label px-4 py-3 text-sm font-medium text-gray-900">{k.konum_adi}</td>
                                <td data-label="İl/İlçe" className="px-4 py-3 text-sm text-gray-600">{(k.il || '') + (k.ilce ? ' / ' + k.ilce : '') || '—'}</td>
                                <td data-label="Mahalle" className="px-4 py-3 text-sm text-gray-600">{k.mahalle || '—'}</td>
                                <td data-label="İşlemler" className="px-4 py-3 text-sm font-medium table-col-islem">
                                  <div className="islem-ikonlar">
                                    <button type="button" className="islem-ikon duzenle-ikon" data-tooltip="Düzenle" aria-label="Düzenle" onClick={() => { const row = k as { id: number; konum_adi: string; il?: string; ilce?: string; mahalle?: string; acik_adres?: string }; setEditingTeslimatId(row.id); setTeslimatFormData({ konum_adi: row.konum_adi, il: row.il || '', ilce: row.ilce || '', mahalle: row.mahalle || '', acik_adres: row.acik_adres || '' }); addressSelectTeslimat.setIl(row.il || '', { skipClear: true }); addressSelectTeslimat.setIlce(row.ilce || '', { skipClear: true }); addressSelectTeslimat.setMahalle(row.mahalle || ''); }}><Pencil size={16} aria-hidden /></button>
                                    <button type="button" className="islem-ikon sil-ikon" data-tooltip="Sil" aria-label="Sil" onClick={() => showToastInteractive({ title: 'Teslimat Konumunu Sil', message: `${k.konum_adi} silinsin mi?`, confirmText: 'Evet, Sil', cancelText: 'İptal', onConfirm: async () => { await apiRequest(`/teslimat-konumlari/${k.id}`, { method: 'DELETE' }); queryClient.invalidateQueries({ queryKey: ['teslimat-konumlari'] }); if (editingTeslimatId === k.id) { setEditingTeslimatId(null); setTeslimatFormData({ konum_adi: '', il: '', ilce: '', mahalle: '', acik_adres: '' }); addressSelectTeslimat.reset(); } showToast('success', 'Teslimat konumu silindi.'); } })}><Trash2 size={16} aria-hidden /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
            <div className="ayarlar-panel">
              <div className="ayarlar-panel-header">
                <h2 className="ayarlar-panel-title">
                  {genelSubTab === 'isletme' && 'İşletme Ayarları'}
                  {genelSubTab === 'konum' && 'Konum Ayarları'}
                  {genelSubTab === 'yazdirma' && 'Yazdırma Ayarları'}
                </h2>
                <p className="ayarlar-panel-desc">
                  <Info size={18} className="ayarlar-help-icon ayarlar-panel-desc-icon" aria-hidden />
                  {genelSubTab === 'isletme' && 'Yazdırma sayfaları ve sipariş künyesi üzerindeki işletme bilgileri buradan yönetin.'}
                  {genelSubTab === 'konum' && 'Sipariş ve formlarda tanımlı olarak listelenecek il/ilçe bilgilerinizi buradan tanımlayın.'}
                  {genelSubTab === 'yazdirma' && 'Yazdırma sayfaları ve sipariş künyesi üzerindeki logonuzu buradan yönetin.'}
                </p>
              </div>
              {genelSubTab === 'isletme' && (
                <form className="ayarlar-form" onSubmit={handleIsletmeSubmit}>
                  <div className="ayarlar-form-group">
                    <div className="ayarlar-logo-alan ayarlar-logo-alan-inline">
                      {isletmeLogoSrc ? (
                        <img src={isletmeLogoSrc.startsWith('http') ? isletmeLogoSrc : (isletmeLogoSrc.startsWith('/') && typeof window !== 'undefined' ? `${window.location.origin}${isletmeLogoSrc}` : isletmeLogoSrc)} alt="İşletme logosu" className="ayarlar-logo-img" />
                      ) : (
                        <div className="ayarlar-logo-placeholder">Logo yok</div>
                      )}
                      <div className="ayarlar-logo-butonlar">
                        <button type="button" className="ayarlar-btn ayarlar-btn-primary" disabled={isletmeLogoUploading} onClick={() => document.getElementById('isletme-logo-input')?.click()}>{isletmeLogoUploading ? 'Yükleniyor...' : 'Yükle'}</button>
                        <button type="button" className="ayarlar-btn ayarlar-btn-secondary" onClick={handleIsletmeLogoRemove}>Kaldır</button>
                      </div>
                      <input id="isletme-logo-input" type="file" accept="image/*" className="hidden" onChange={handleIsletmeLogoFile} />
                    </div>
                    <small className="ayarlar-help">SVG, PNG veya JPG. Logonun yanındaki butonlarla yükleyebilir veya kaldırabilirsiniz.</small>
                  </div>
                  <div className="ayarlar-isletme-3kolon">
                    <div className="ayarlar-isletme-kolon">
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">İşletme Adı</label>
                        <input type="text" className="ayarlar-input" placeholder="İşletme adı" value={isletmeFormData.isletme_adi} onChange={(e) => setIsletmeFormData((p) => ({ ...p, isletme_adi: e.target.value }))} required />
                      </div>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">Yetkili Kişi</label>
                        <input type="text" className="ayarlar-input" placeholder="Yetkili kişi" value={isletmeFormData.yetkili_kisi} onChange={(e) => setIsletmeFormData((p) => ({ ...p, yetkili_kisi: e.target.value }))} />
                      </div>
                    </div>
                    <div className="ayarlar-isletme-kolon">
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">Telefon</label>
                        <input type="tel" ref={isletmeTelefonInput.inputRef} value={isletmeTelefonInput.displayValue} onChange={isletmeTelefonInput.handleChange} onKeyDown={isletmeTelefonInput.handleKeyDown} onFocus={isletmeTelefonInput.handleFocus} onPaste={isletmeTelefonInput.handlePaste} placeholder="+90 (5XX) XXX XX XX" className="ayarlar-input" data-phone-input="standard" />
                      </div>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">E-posta</label>
                        <input type="email" className="ayarlar-input" placeholder="E-posta" value={isletmeFormData.eposta} onChange={(e) => setIsletmeFormData((p) => ({ ...p, eposta: e.target.value }))} />
                      </div>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">Whatsapp Hattı</label>
                        <input type="tel" ref={isletmeWhatsappInput.inputRef} value={isletmeWhatsappInput.displayValue} onChange={isletmeWhatsappInput.handleChange} onKeyDown={isletmeWhatsappInput.handleKeyDown} onFocus={isletmeWhatsappInput.handleFocus} onPaste={isletmeWhatsappInput.handlePaste} placeholder="+90 (5XX) XXX XX XX" className="ayarlar-input" data-phone-input="standard" />
                      </div>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">Web Site</label>
                        <input type="text" className="ayarlar-input" placeholder="https://" value={isletmeFormData.website} onChange={(e) => setIsletmeFormData((p) => ({ ...p, website: e.target.value }))} />
                      </div>
                    </div>
                    <div className="ayarlar-isletme-kolon">
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">İl</label>
                        <select className="ayarlar-input ayarlar-select" value={addressSelectIsletme.il} onChange={(e) => addressSelectIsletme.setIl(e.target.value)}>
                          <option value="">İl Seçiniz</option>
                          {addressSelectIsletme.ilOptions.map((il) => (
                            <option key={il.id} value={il.name}>{il.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">İlçe</label>
                        <select className="ayarlar-input ayarlar-select" value={addressSelectIsletme.ilce} onChange={(e) => addressSelectIsletme.setIlce(e.target.value)} disabled={!addressSelectIsletme.il}>
                          <option value="">İlçe Seçiniz</option>
                          {addressSelectIsletme.ilceOptions.map((ilce) => (
                            <option key={ilce.id} value={ilce.name}>{ilce.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="ayarlar-form-group">
                        <label className="ayarlar-label">Adres</label>
                        <textarea className="ayarlar-input" rows={2} placeholder="Açık adres" value={isletmeFormData.adres} onChange={(e) => setIsletmeFormData((p) => ({ ...p, adres: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                  <div className="ayarlar-form-actions">
                    {hasIsletmeChanges && (
                      <button type="button" onClick={handleVazgecIsletme} className="ayarlar-btn ayarlar-btn-secondary">VAZGEÇ</button>
                    )}
                    <button type="submit" className="ayarlar-btn ayarlar-btn-primary" disabled={isletmeLoading}>KAYDET</button>
                  </div>
                </form>
              )}
              {genelSubTab === 'konum' && (
                <form className="ayarlar-form" onSubmit={handleKonumSubmit}>
                  <div className="ayarlar-konum-select-wrap">
                    <div className="ayarlar-form-group">
                      <label className="ayarlar-label">İl</label>
                      <select className="ayarlar-input ayarlar-select" value={addressSelectKonum.il} onChange={(e) => addressSelectKonum.setIl(e.target.value)}>
                        <option value="">İl Seçiniz</option>
                        {addressSelectKonum.ilOptions.map((il) => (
                          <option key={il.id} value={il.name}>{il.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="ayarlar-form-group">
                      <label className="ayarlar-label">İlçe</label>
                      <select className="ayarlar-input ayarlar-select" value={addressSelectKonum.ilce} onChange={(e) => addressSelectKonum.setIlce(e.target.value)} disabled={!addressSelectKonum.il}>
                        <option value="">İlçe Seçiniz</option>
                        {addressSelectKonum.ilceOptions.map((ilce) => (
                          <option key={ilce.id} value={ilce.name}>{ilce.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="ayarlar-form-actions">
                    <button type="submit" className="ayarlar-btn ayarlar-btn-primary">KAYDET</button>
                  </div>
                </form>
              )}
              {genelSubTab === 'yazdirma' && (
                <YazdirmaAyarlariForm />
              )}
            </div>
            )}
          </div>
        )}

        {/* Çiçek Sepeti Ayarları Tab – ana sekme (sadece plan_id !== 1) */}
        {isBaslangicPlan === false && activeTab === 'ciceksepeti' && (
          <div className="ayarlar-tab-icerik">
            <div className="ayarlar-subtab-nav ayarlar-subtab-nav--single">
              <button type="button" className="ayarlar-subtab-btn active" aria-current="true">
                Çiçek Sepeti Ayarları
              </button>
            </div>
            <div className="ayarlar-panel">
              <div className="ayarlar-panel-header">
                <h2 className="ayarlar-panel-title">Çiçek Sepeti API Ayarları</h2>
                <p className="ayarlar-panel-desc">
                  <Info size={18} className="ayarlar-help-icon ayarlar-panel-desc-icon" aria-hidden />
                  API bilgilerinizi girerek Çiçek Sepeti siparişlerini otomatik sisteminize aktarın.
                </p>
              </div>
              <CiceksepetiAyarlariForm onDirtyChange={setCiceksepetiDirty} submitFormRef={ciceksepetiSubmitRef} onAfterSave={handleCiceksepetiAfterSave} />
            </div>
          </div>
        )}

        {/* Araç Takip Ayarları Tab – Araç Yönetimi alt tab (sadece plan_id !== 1) */}
        {isBaslangicPlan === false && activeTab === 'arac' && (
          <div className="ayarlar-tab-icerik">
            <div className="ayarlar-subtab-nav">
              <button
                type="button"
                data-subtab="arac"
                className="ayarlar-subtab-btn active"
              >
                Araç Yönetimi
              </button>
            </div>
            <div className={`flex flex-col lg:flex-row gap-6 ayarlar-form-row ${editingAracId ? 'ayarlar-form-active' : ''}`}>
              <div className="ayarlar-sol-kolon">
                <div className="ayarlar-panel-form">
                  <h3 className="ayarlar-panel-form-title">{editingAracId ? 'Aracı Düzenle' : 'Yeni Araç Ekle'}</h3>
                  <form className="ayarlar-form" onSubmit={handleAracSubmit}>
                    <div className="ayarlar-form-group">
                      <label className="ayarlar-label">Plaka *</label>
                      <input
                        type="text"
                        className="ayarlar-input"
                        placeholder="Plaka"
                        value={aracFormData.plaka}
                        onChange={(e) => setAracFormData((p) => ({ ...p, plaka: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="ayarlar-form-group">
                      <label className="ayarlar-label">Marka</label>
                      <input
                        type="text"
                        className="ayarlar-input"
                        placeholder="Marka"
                        value={aracFormData.marka}
                        onChange={(e) => setAracFormData((p) => ({ ...p, marka: e.target.value }))}
                      />
                    </div>
                    <div className="ayarlar-form-group">
                      <label className="ayarlar-label">Model</label>
                      <input
                        type="text"
                        className="ayarlar-input"
                        placeholder="Model"
                        value={aracFormData.model}
                        onChange={(e) => setAracFormData((p) => ({ ...p, model: e.target.value }))}
                      />
                    </div>
                    <div className="ayarlar-form-group">
                      <label className="ayarlar-label">Renk</label>
                      <input
                        type="text"
                        className="ayarlar-input"
                        placeholder="Renk"
                        value={aracFormData.renk}
                        onChange={(e) => setAracFormData((p) => ({ ...p, renk: e.target.value }))}
                      />
                    </div>
                    <div className="ayarlar-form-group">
                      <label className="ayarlar-label">Yıl</label>
                      <input
                        type="number"
                        className="ayarlar-input"
                        placeholder="Yıl"
                        min={1990}
                        max={2030}
                        value={aracFormData.yil === '' ? '' : aracFormData.yil}
                        onChange={(e) => setAracFormData((p) => ({ ...p, yil: e.target.value === '' ? '' : e.target.value }))}
                      />
                    </div>
                    <div className="ayarlar-form-group">
                      <label className="ayarlar-label">Araç Tipi</label>
                      <select
                        className="ayarlar-input ayarlar-select"
                        value={aracFormData.arac_tipi}
                        onChange={(e) => setAracFormData((p) => ({ ...p, arac_tipi: e.target.value }))}
                      >
                        <option value="">Seçiniz</option>
                        <option value="Minivan">Minivan</option>
                        <option value="Kamyonet">Kamyonet</option>
                        <option value="Panelvan">Panelvan</option>
                        <option value="Motosiklet">Motosiklet</option>
                        <option value="Diğer">Diğer</option>
                      </select>
                    </div>
                    <div className="ayarlar-form-actions">
                      {editingAracId && (
                        <button type="button" className="ayarlar-btn ayarlar-btn-secondary" onClick={resetAracForm}>Vazgeç</button>
                      )}
                      <button type="submit" className="ayarlar-btn ayarlar-btn-primary">{editingAracId ? 'Güncelle' : 'Kaydet'}</button>
                    </div>
                  </form>
                </div>
              </div>
              <div className="ayarlar-sag-kolon">
                <div className="ayarlar-panel">
                  <div className="ayarlar-panel-header-sol">
                    <h3 className="ayarlar-panel-form-title">Araç Listesi</h3>
                    <span className="ayarlar-count-badge">{araclar.length} Araç</span>
                  </div>
                  {araclarLoading ? (
                    <div className="ayarlar-loading"><LoadingSpinner size="md" /></div>
                  ) : araclar.length === 0 ? (
                    <EmptyState title="Henüz araç eklenmemiş" description="Sol taraftan yeni araç ekleyebilirsiniz." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full ayarlar-tablosu">
                        <thead>
                          <tr>
                            <TableSortHeader field="plaka" label="Plaka" currentSort={aracSortField} sortDirection={aracSortDir} onSort={handleAracSort} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase" />
                            <TableSortHeader field="marka_model" label="Marka / Model" currentSort={aracSortField} sortDirection={aracSortDir} onSort={handleAracSort} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase" />
                            <TableSortHeader field="renk" label="Renk" currentSort={aracSortField} sortDirection={aracSortDir} onSort={handleAracSort} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase" />
                            <TableSortHeader field="yil" label="Yıl" currentSort={aracSortField} sortDirection={aracSortDir} onSort={handleAracSort} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase" />
                            <TableSortHeader field="arac_tipi" label="Tip" currentSort={aracSortField} sortDirection={aracSortDir} onSort={handleAracSort} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase" />
                            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase table-col-islem w-24">İşlem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {sortedAraclar.map((a: { id: number; plaka: string; marka: string; model: string; renk: string; yil?: number | null; arac_tipi?: string }) => (
                            <tr key={a.id}>
                              <td data-label="Plaka">{a.plaka}</td>
                              <td data-label="Marka/Model">{(a.marka || '') + (a.model ? ' ' + a.model : '') || '—'}</td>
                              <td data-label="Renk">{a.renk || '—'}</td>
                              <td data-label="Yıl">{a.yil ?? '—'}</td>
                              <td data-label="Tip">{a.arac_tipi || '—'}</td>
                              <td data-label="İşlem" className="table-col-islem">
                                <div className="islem-ikonlar">
                                  <button type="button" className="islem-ikon duzenle-ikon" data-tooltip="Düzenle" aria-label="Düzenle" onClick={() => { setAracFormData({ plaka: a.plaka, marka: a.marka || '', model: a.model || '', renk: a.renk || '', yil: a.yil ?? '', arac_tipi: a.arac_tipi || '' }); setEditingAracId(a.id); }}><Pencil size={16} aria-hidden /></button>
                                  <button type="button" className="islem-ikon sil-ikon" data-tooltip="Sil" aria-label="Sil" onClick={() => handleAracDelete(a.id)}><Trash2 size={16} aria-hidden /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gönderim Ayarları Tab - Sadece premium planda (WhatsApp) */}
        {isBaslangicPlan === false && activeTab === 'gonderim' && (
          <div className="ayarlar-tab-icerik">
            <GonderimAyarlariTab />
          </div>
        )}

        {/* Fatura Ayarları Tab – Logo, İşletme bilgileri, Banka hesapları, KDV, Not */}
        {activeTab === 'fatura' ? (
          <FaturaTab
            faturaLogoSrc={faturaLogoSrc}
            faturaLogoUploading={faturaLogoUploading}
            handleFaturaLogoFile={handleFaturaLogoFile}
            faturaForm={faturaForm}
            setFaturaForm={setFaturaForm}
            faturaSaving={faturaSaving}
            handleFaturaAyarlariSave={handleFaturaAyarlariSave}
            bankaHesaplari={bankaHesaplari}
            faturadaSecilenBankaIds={faturadaSecilenBankaIds}
            onFaturadaSecimChange={setFaturadaSecilenBankaIds}
          />
        ) : null}
      </div>
    </div>
  );
};
