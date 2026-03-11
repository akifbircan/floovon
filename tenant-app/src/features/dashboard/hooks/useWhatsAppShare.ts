import React, { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { showToast } from '../../../shared/utils/toastUtils';
import { cleanPhoneForDatabase } from '../../../shared/utils/formatUtils';
import { createOrganizasyonWhatsAppMessage, createOrderWhatsAppMessage } from '../utils/whatsappMessageUtils';

export type WhatsAppShareMode = 'list' | 'template';

/** Eski sistemdeki varsayılan müşteri sipariş şablonu (IBAN + bilgi formu) */
const DEFAULT_MUSTERI_SIPARIS_SABLONU = `Sayın müşterimiz,
Lütfen siparişiniz ile ilgili aşağıdaki alanları bize iletiniz.


*• Teslim Edilecek Kişi/Organizasyon İsim Soyisim*
*• Teslim Edilecek Kişi/Organizasyon Telefon Numarası*
*• Teslim Edilecek Açık Adres* _ve varsa lütfen konum paylaşınız_
*• Sipariş Ürününüz*
*• Sipariş Notunuz* _(Lütfen tek parça ve imla kurallarına uygun yazınız)_

///////////////////////

Sipariş ücretini aşağıdaki IBAN hesaplarımıza gönderebilirsiniz:

🏦 Ziraat Bankası (TL Hesabı)
Alıcı Adı: *Azmi Bircan*
TR 5400 0100 0265 4015 4601 5001


🏦 DenizBank (TL Hesabı)
Alıcı Adı: *Azmi Bircan*
TR 8200 1340 0000 8120 7570 0002


_Lütfen EFT/Havale işlemi açıklamasına isminizi ve sipariş detayını yazınız._`;
import type { OrganizasyonKart, Order } from '../types';

interface WhatsAppContact {
  isim: string;
  telefon: string;
}

/**
 * WhatsApp paylaşım hook'u
 * Organizasyon kartı için WhatsApp liste paylaşımı
 */
export function useWhatsAppShare() {
  const [loading, setLoading] = useState(false);
  const [showPhoneSelector, setShowPhoneSelector] = useState(false);
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [currentKart, setCurrentKart] = useState<OrganizasyonKart | null>(null);
  const [currentSiparisler, setCurrentSiparisler] = useState<Order[]>([]);
  const [initializingWhatsApp, setInitializingWhatsApp] = useState(false);
  const initializationToastShownRef = React.useRef(false);

  // WhatsApp durumunu kontrol et (sayfa ile aynı kriter: kart detay/dashboard paylaş butonları buna göre numara popup açıyor)
  const checkWhatsAppStatus = useCallback(async (): Promise<boolean> => {
    try {
      const response = await apiClient.get('/whatsapp/status');
      const status = response.data;
      return (
        !!status?.installed &&
        !!status?.isReady &&
        !!status?.isAuthenticated &&
        status?.lastDisconnectReason !== 'LOGOUT'
      );
    } catch {
      return false;
    }
  }, []);

  // WhatsApp bağlantısını başlat
  const initializeWhatsApp = useCallback(async (): Promise<boolean> => {
    try {
      const response = await apiClient.post('/whatsapp/initialize');
      const result = response.data;
      
      if (result.success || result.alreadyInitialized) {
        // Bağlantı kurulmasını bekle (maksimum 30 saniye)
        let connectionAttempts = 0;
        const maxConnectionAttempts = 60; // 30 saniye (60 * 500ms)
        
        while (connectionAttempts < maxConnectionAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const canSend = await checkWhatsAppStatus();
          if (canSend) {
            return true;
          }
          
          connectionAttempts++;
        }
        
        return false;
      }
      
      return false;
    } catch (error) {
      console.error('❌ WhatsApp bağlantı kurma hatası:', error);
      return false;
    }
  }, [checkWhatsAppStatus]);

  const musteriSablonRef = React.useRef<string>(DEFAULT_MUSTERI_SIPARIS_SABLONU);

  // Gönderim ayarlarından telefon numaralarını ve müşteri şablonunu yükle
  const loadContacts = useCallback(async (): Promise<WhatsAppContact[]> => {
    try {
      const response = await apiClient.get('/ayarlar/gonderim');
      const result = response.data;
      
      if (result.success && result.data) {
        const ayarlar = result.data;
        musteriSablonRef.current = (ayarlar.musteri_sablonu_whatsapp || '').trim() || DEFAULT_MUSTERI_SIPARIS_SABLONU;
        const kisiler: WhatsAppContact[] = [];
        
        // siparis_listesi_whatsapp alanını parse et
        if (ayarlar.siparis_listesi_whatsapp) {
          let wpListe = ayarlar.siparis_listesi_whatsapp;
          if (typeof wpListe === 'string') {
            try {
              wpListe = JSON.parse(wpListe);
            } catch (e) {
              // WhatsApp listesi JSON parse edilemedi
            }
          }
          
          if (typeof wpListe === 'object' && wpListe !== null) {
            // Obje formatı
            Object.keys(wpListe).forEach((key) => {
              const kisi = wpListe[key];
              if (kisi && (kisi.ad || kisi.isim) && (kisi.tel || kisi.telefon)) {
                kisiler.push({
                  isim: (kisi.ad || kisi.isim || '').trim(),
                  telefon: (kisi.tel || kisi.telefon || '').trim()
                });
              }
            });
          } else if (Array.isArray(wpListe) && wpListe.length > 0) {
            // Array formatı
            wpListe.forEach((kisi) => {
              if (kisi && (kisi.ad || kisi.isim) && (kisi.tel || kisi.telefon)) {
                kisiler.push({
                  isim: (kisi.ad || kisi.isim || '').trim(),
                  telefon: (kisi.tel || kisi.telefon || '').trim()
                });
              }
            });
          }
        }
        
        return kisiler;
      }
      
      return [];
    } catch (error) {
      console.error('❌ Gönderim ayarları yüklenirken hata:', error);
      return [];
    }
  }, []);

  // Telefon numarasını formatla
  const formatPhone = useCallback((phone: string): string => {
    if (!phone) return '';
    
    // React utility kullan
    const cleanPhone = cleanPhoneForDatabase(phone);
    if (cleanPhone) {
      return '+' + cleanPhone;
    }
    
    return '';
  }, []);

  // WhatsApp mesajı gönder
  const sendMessage = useCallback(async (phone: string, message: string): Promise<boolean> => {
    try {
      const formattedPhone = formatPhone(phone);
      if (!formattedPhone) {
        throw new Error('Geçerli telefon numarası bulunamadı');
      }
      
      const response = await apiClient.post('/whatsapp/send', {
        phone: formattedPhone,
        message: message
      });
      
      return response.data?.success === true;
    } catch (error: any) {
      console.error('❌ WhatsApp mesaj gönderme hatası:', error);
      throw new Error(error.response?.data?.error || error.message || 'Mesaj gönderilemedi');
    }
  }, [formatPhone]);

  // Organizasyon kartı için WhatsApp mesajı oluştur
  const [shareMode, setShareModeState] = useState<WhatsAppShareMode>('list');
  const shareModeRef = React.useRef<WhatsAppShareMode>('list');
  const createOrganizasyonMessage = useCallback(async (kart: OrganizasyonKart, siparisler?: Order[], modeOverride?: WhatsAppShareMode): Promise<string> => {
    const m = modeOverride ?? shareModeRef.current;
    if (m === 'template') {
      return musteriSablonRef.current;
    }
    const siparislerToUse = siparisler || kart.siparisler || [];
    return await createOrganizasyonWhatsAppMessage(kart, siparislerToUse);
  }, []);

  // WhatsApp paylaşım işlemini başlat (mode: 'list' = sipariş listesi, 'template' = müşteri sipariş şablonu)
  const shareOrganizasyonKart = useCallback(async (kart: OrganizasyonKart, siparisler?: Order[], options?: { mode?: WhatsAppShareMode }): Promise<void> => {
    const mode = options?.mode ?? 'list';
    shareModeRef.current = mode;
    setShareModeState(mode);
    // Eğer zaten yükleniyorsa veya başlatılıyorsa, tekrar çağırma
    if (loading || initializingWhatsApp) {
      return;
    }
    
    setLoading(true);
    
    try {
      // WhatsApp durumunu kontrol et
      let canSend = await checkWhatsAppStatus();
      
      if (!canSend) {
        // Eğer zaten başlatılıyorsa bekle
        if (initializingWhatsApp) {
          setLoading(false);
          return;
        }
        
        // Bağlantı kurmayı dene
        setInitializingWhatsApp(true);
        
        // Toast mesajını sadece bir kez göster
        if (!initializationToastShownRef.current) {
          showToast('info', 'WhatsApp bağlantısı kuruluyor, lütfen bekleyin...', { duration: 5000 });
          initializationToastShownRef.current = true;
        }
        
        canSend = await initializeWhatsApp();
        setInitializingWhatsApp(false);
        initializationToastShownRef.current = false;
        
        if (!canSend) {
          showToast('warning', 'WhatsApp bağlantısı kurulamadı. Lütfen Ayarlar sayfasından manuel olarak bağlanın.', { duration: 5000 });
          setLoading(false);
          return;
        }
      }
      
      // Telefon numaralarını yükle
      const loadedContacts = await loadContacts();
      
      if (loadedContacts.length === 0) {
        showToast('error', 'Tanımlı telefon numarası bulunamadı!');
        return;
      }
      
      setContacts(loadedContacts);
      setCurrentKart(kart);
      setCurrentSiparisler(siparisler || kart.siparisler || []);
      setShowPhoneSelector(true);
      
    } catch (error: any) {
      console.error('❌ WhatsApp paylaşım hatası:', error);
      showToast('error', error.message || 'WhatsApp paylaşımı başlatılamadı');
    } finally {
      setLoading(false);
    }
  }, [checkWhatsAppStatus, initializeWhatsApp, loadContacts]);

  // Seçilen telefon numarasına mesaj gönder (organizasyon kartı için)
  const sendToContact = useCallback(async (phone: string): Promise<void> => {
    if (!currentKart) {
      showToast('error', 'Kart bilgisi bulunamadı');
      return;
    }
    
    setLoading(true);
    setShowPhoneSelector(false);
    
    try {
      // Mesajı oluştur – shareModeRef kullan (stale closure önleme: tıklanan butona göre doğru mesaj)
      const message = await createOrganizasyonMessage(currentKart, currentSiparisler, shareModeRef.current);
      
      // Mesajı gönder
      const success = await sendMessage(phone, message);
      
      if (success) {
        showToast('success', 'Mesaj başarıyla gönderildi');
      } else {
        throw new Error('Mesaj gönderilemedi');
      }
    } catch (error: any) {
      console.error('❌ WhatsApp mesaj gönderme hatası:', error);
      showToast('error', error.message || 'Mesaj gönderilemedi');
    } finally {
      setLoading(false);
    }
  }, [createOrganizasyonMessage, sendMessage, currentKart, currentSiparisler]);

  // Tek sipariş için WhatsApp paylaşımı
  const shareOrder = useCallback(async (order: Order, organizasyonKart?: OrganizasyonKart): Promise<void> => {
    // Eğer zaten yükleniyorsa veya başlatılıyorsa, tekrar çağırma
    if (loading || initializingWhatsApp) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Plan kontrolü kaldırıldı - tüm kullanıcılar WhatsApp paylaşımı yapabilir
      // WhatsApp durumunu kontrol et
      let canSend = await checkWhatsAppStatus();
      
      if (!canSend) {
        // Eğer zaten başlatılıyorsa bekle
        if (initializingWhatsApp) {
          setLoading(false);
          return;
        }
        
        // Bağlantı kurmayı dene
        setInitializingWhatsApp(true);
        
        // Toast mesajını sadece bir kez göster
        if (!initializationToastShownRef.current) {
          showToast('info', 'WhatsApp bağlantısı kuruluyor, lütfen bekleyin...', { duration: 5000 });
          initializationToastShownRef.current = true;
        }
        
        canSend = await initializeWhatsApp();
        setInitializingWhatsApp(false);
        initializationToastShownRef.current = false;
        
        if (!canSend) {
          showToast('warning', 'WhatsApp bağlantısı kurulamadı. Lütfen Ayarlar sayfasından manuel olarak bağlanın.', { duration: 5000 });
          setLoading(false);
          return;
        }
      }
      
      // Telefon numarasını yükle
      const loadedContacts = await loadContacts();
      
      if (loadedContacts.length === 0) {
        showToast('error', 'Tanımlı telefon numarası bulunamadı!');
        return;
      }
      
      setContacts(loadedContacts);
      setCurrentKart(organizasyonKart || null);
      setCurrentSiparisler([order]);
      setShowPhoneSelector(true);
      
    } catch (error: any) {
      console.error('❌ WhatsApp paylaşım hatası:', error);
      showToast('error', error.message || 'WhatsApp paylaşımı başlatılamadı');
    } finally {
      setLoading(false);
    }
  }, [checkWhatsAppStatus, initializeWhatsApp, loadContacts]);

  // Seçilen telefon numarasına tek sipariş mesajı gönder
  const sendOrderToContact = useCallback(async (phone: string, order: Order, organizasyonKart?: OrganizasyonKart): Promise<void> => {
    setLoading(true);
    setShowPhoneSelector(false);
    
    try {
      // Mesajı oluştur
      const message = await createOrderWhatsAppMessage(order, organizasyonKart);
      
      // Mesajı gönder
      const success = await sendMessage(phone, message);
      
      if (success) {
        showToast('success', 'Mesaj başarıyla gönderildi');
      } else {
        throw new Error('Mesaj gönderilemedi');
      }
    } catch (error: any) {
      console.error('❌ WhatsApp mesaj gönderme hatası:', error);
      showToast('error', error.message || 'Mesaj gönderilemedi');
    } finally {
      setLoading(false);
    }
  }, [sendMessage]);

  const phoneSelectorTitle = shareMode === 'template'
    ? 'Müşteri sipariş şablonunun gönderileceği WhatsApp numarasını seçin'
    : 'Sipariş listesinin gönderileceği WhatsApp gönderim numarasını seçin';

  return {
    loading,
    showPhoneSelector,
    contacts,
    shareOrganizasyonKart,
    sendToContact,
    shareOrder,
    sendOrderToContact,
    checkWhatsAppStatus,
    setShowPhoneSelector,
    phoneSelectorTitle,
  };
}

