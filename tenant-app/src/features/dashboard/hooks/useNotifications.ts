import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { getApiBaseUrl } from '../../../lib/runtime';
import { showToast } from '../../../shared/utils/toastUtils';

export interface Bildirim {
  id: number;
  tip: string;
  baslik: string;
  musteri_unvani?: string;
  teslim_kisisi?: string;
  siparis_teslim_kisisi_baskasi?: string;
  organizasyon_adi?: string;
  organizasyon_alt_tur?: string;
  siparis_adi?: string;
  urun_resmi?: string;
  arsivleme_sebebi?: string;
  created_at: string;
  is_read: boolean;
  siparis_id?: number;
  organizasyon_id?: number;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Bildirim[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const org404SkipRef = useRef<Set<number>>(new Set());

  const loadNotifications = useCallback(async () => {
    if (!user) return;

    const kullaniciAdi = (user as any).kullaniciadi || (user as any).username;
    if (!kullaniciAdi) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setLoading(true);
    try {
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/bildirimler?kullanici_adi=${encodeURIComponent(kullaniciAdi)}&limit=20`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          setNotifications([]);
          setUnreadCount(0);
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        // Backend'den gelen verileri düzelt
        let bildirimlerData = result.data;
        if (typeof (window as any).fixBackendData === 'function') {
          bildirimlerData = (window as any).fixBackendData(bildirimlerData);
        }
        // is_read: sadece açıkça true/1 ise okundu; aksi halde okunmamış (ikon görünsün)
        bildirimlerData = bildirimlerData.map((b: Bildirim) => ({
          ...b,
          is_read: b.is_read === true || Number(b.is_read) === 1,
        }));

        // Eksik bilgileri backend'den çekerek tamamla
        const enrichedBildirimler = await Promise.all(
          bildirimlerData.map(async (bildirim: Bildirim) => {
            // Sipariş detaylarını çek
            if (bildirim.siparis_id) {
              try {
                const siparisResponse = await fetch(`${apiBase}/siparis-kartlar/${bildirim.siparis_id}`, {
                  credentials: 'include',
                });

                if (siparisResponse.ok) {
                  const siparisResult = await siparisResponse.json();
                  if (siparisResult.success && siparisResult.data) {
                    let siparis = siparisResult.data;
                    if (typeof (window as any).fixBackendData === 'function') {
                      siparis = (window as any).fixBackendData(siparis);
                    }

                    // Eksik bilgileri doldur
                    if (!bildirim.musteri_unvani || bildirim.musteri_unvani === '' || bildirim.musteri_unvani === 'Belirtilmemiş') {
                      if (siparis.musteri_unvan) {
                        bildirim.musteri_unvani = siparis.musteri_unvan;
                      }
                    }
                    if (siparis.siparis_teslim_kisisi_baskasi) {
                      bildirim.siparis_teslim_kisisi_baskasi = siparis.siparis_teslim_kisisi_baskasi;
                    }
                    // teslim_kisisi sadece organizasyon sahibi / teslim kişisi – siparis_teslim_kisisi_baskasi SADECE WhatsApp mesajlarında kullanılır, burada asla yazılmaz
                    if (!bildirim.teslim_kisisi || bildirim.teslim_kisisi === '' || bildirim.teslim_kisisi === 'Belirtilmemiş') {
                      if (siparis.teslim_kisisi) {
                        bildirim.teslim_kisisi = siparis.teslim_kisisi;
                      } else if (siparis.organizasyon_teslim_kisisi) {
                        bildirim.teslim_kisisi = siparis.organizasyon_teslim_kisisi;
                      }
                    }
                    if (!bildirim.urun_resmi && siparis.product_gorsel) {
                      let productGorsel = siparis.product_gorsel;
                      if (typeof (window as any).fixBackendUrl === 'function') {
                        productGorsel = (window as any).fixBackendUrl(productGorsel);
                      }
                      if (productGorsel && !productGorsel.startsWith('http')) {
                        const baseUrl = (window as any).getFloovonBackendBase ? (window as any).getFloovonBackendBase() : '';
                        bildirim.urun_resmi = productGorsel.startsWith('/') ? `${baseUrl}${productGorsel}` : `${baseUrl}/${productGorsel}`;
                      } else {
                        bildirim.urun_resmi = productGorsel;
                      }
                    }
                    if (bildirim.tip === 'arsivlendi' && (!bildirim.arsivleme_sebebi || bildirim.arsivleme_sebebi === '' || bildirim.arsivleme_sebebi === 'Belirtilmemiş')) {
                      if (siparis.arsivleme_sebebi) {
                        bildirim.arsivleme_sebebi = siparis.arsivleme_sebebi;
                      }
                    }
                    if (!bildirim.siparis_adi || bildirim.siparis_adi === '' || bildirim.siparis_adi === 'Belirtilmemiş') {
                      if (siparis.siparis_urun) {
                        bildirim.siparis_adi = siparis.siparis_urun;
                      }
                    }
                    if (!bildirim.organizasyon_adi || bildirim.organizasyon_adi === '' || bildirim.organizasyon_adi === 'Belirtilmemiş') {
                      if (siparis.organizasyon_kart_tur) {
                        bildirim.organizasyon_adi = siparis.organizasyon_kart_tur;
                      }
                    }
                    if (!bildirim.organizasyon_alt_tur || bildirim.organizasyon_alt_tur === '' || bildirim.organizasyon_alt_tur === 'Belirtilmemiş') {
                      if (siparis.organizasyon_kart_etiket) {
                        bildirim.organizasyon_alt_tur = siparis.organizasyon_kart_etiket;
                      }
                    }
                    if (!bildirim.organizasyon_id && (siparis.organizasyon_kart_id ?? siparis.organizasyon_id)) {
                      bildirim.organizasyon_id = siparis.organizasyon_kart_id ?? siparis.organizasyon_id;
                    }
                  }
                }
              } catch (error) {
                // Sessizce devam et
              }
            }

            // Organizasyon detaylarını çek (404 veren kartları bir kez deneyip sonra atla – silinmiş kart spam’i önler)
            const orgId = bildirim.organizasyon_id;
            if (orgId && !bildirim.organizasyon_alt_tur && !org404SkipRef.current.has(orgId)) {
              try {
                const orgResponse = await fetch(`${apiBase}/organizasyon-kartlar/${orgId}`, {
                  credentials: 'include',
                });
                if (orgResponse.status === 404) {
                  org404SkipRef.current.add(orgId);
                } else if (orgResponse.ok) {
                  const orgResult = await orgResponse.json();
                  if (orgResult.success && orgResult.data) {
                    const org = orgResult.data;
                    if (!bildirim.organizasyon_alt_tur && org.alt_tur) {
                      bildirim.organizasyon_alt_tur = org.alt_tur;
                    }
                  }
                }
              } catch (error) {
                // Sessizce devam et
              }
            }

            return bildirim;
          })
        );

        setNotifications(enrichedBildirimler);
        setUnreadCount(enrichedBildirimler.filter((b) => !b.is_read).length);
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error: any) {
      const isNetworkError =
        error?.isConnectionError ||
        error?.isIgnored ||
        (error?.message &&
          (error.message.includes('Backend bağlantı hatası') ||
            error.message.includes('Failed to fetch') ||
            error.message.includes('ERR_INTERNET_DISCONNECTED') ||
            error.message.includes('ERR_FAILED') ||
            error.message.includes('ERR_NETWORK_CHANGED')));

      if (!isNetworkError) {
        console.error('❌ Bildirimler yüklenirken hata:', error);
      }

      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Sayfa açıldığında / giriş yapıldığında bildirimleri yükle ki badge hemen görünsün
  useEffect(() => {
    if (user) {
      loadNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user, loadNotifications]);

  // Liste açılmadan badge güncellensin: teslim/arşivle sonrası veya global refresh olayında yenile
  useEffect(() => {
    const handler = () => loadNotifications();
    window.addEventListener('floovon-notifications-refresh', handler);
    return () => window.removeEventListener('floovon-notifications-refresh', handler);
  }, [loadNotifications]);

  const markAsRead = useCallback(
    async (bildirimId: number) => {
      try {
        const apiBase = getApiBaseUrl();
        await fetch(`${apiBase}/bildirimler/${bildirimId}/read`, {
          method: 'PUT',
          credentials: 'include',
        });
        await loadNotifications();
      } catch (error) {
        console.error('❌ Bildirim okundu işaretleme hatası:', error);
      }
    },
    [loadNotifications]
  );

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    const kullaniciAdi = (user as any).kullaniciadi || (user as any).username;
    if (!kullaniciAdi) return;

    try {
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/bildirimler/read-all?kullanici_adi=${encodeURIComponent(kullaniciAdi)}`, {
        method: 'PUT',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Bildirimler işaretlenirken bir hata oluştu');
      }

      // Bildirimleri yeniden yükle
      await loadNotifications();

      // Başarı mesajı göster
      showToast('success', 'Tüm bildirimler okundu olarak işaretlendi');
    } catch (error) {
      console.error('❌ Tüm bildirimleri okundu işaretleme hatası:', error);
      showToast('error', 'Bildirimler işaretlenirken bir hata oluştu');
    }
  }, [user, loadNotifications]);

  return {
    notifications,
    loading,
    unreadCount,
    loadNotifications,
    markAsRead,
    markAllAsRead,
  };
};

