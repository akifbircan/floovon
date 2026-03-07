import { useMemo, useEffect, useRef } from 'react';
import type { OrganizasyonKart, Order } from '../types';
import { useWeekDates } from './useWeekDates';

/**
 * Dashboard istatistiklerini hesaplayan hook
 * Toplam organizasyon, sipariş ve teslim edilen sipariş sayılarını hesaplar
 */
export function useDashboardStatistics(
  kartlar: OrganizasyonKart[] | null | undefined,
  selectedWeek: string | null | undefined,
  isLoading?: boolean
) {
  const { weekDates } = useWeekDates(selectedWeek ?? undefined);
  
  // ✅ DÜZELTME: Eski istatistikleri koru - ilk yüklemede 0 görünmesin
  const previousStatisticsRef = useRef<{
    toplamOrganizasyon: number;
    toplamSiparis: number;
    teslimEdilen: number;
  } | null>(null);
  
  // Seçili haftanın günlerini formatla (DD MMMM YYYY dddd formatında)
  const weekDays = useMemo(() => {
    if (!weekDates || weekDates.length === 0) return [];
    
    return weekDates.map(date => {
      const day = date.date.getDate();
      const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                          'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
      
      const month = monthNames[date.date.getMonth()];
      const year = date.date.getFullYear();
      const dayName = dayNames[date.date.getDay()];
      
      return `${day} ${month} ${year} ${dayName}`;
    });
  }, [weekDates]);

  // İstatistikleri hesapla
  const statistics = useMemo(() => {
    // ✅ DÜZELTME: kartlar null/undefined ise eski istatistikleri koru
    if (!kartlar) {
      // ✅ KRİTİK: Loading state'indeyse eski istatistikleri koru
      if (isLoading && previousStatisticsRef.current) {
        return previousStatisticsRef.current;
      }
      // Loading değilse veya önceki istatistik yoksa 0 döndür
      return previousStatisticsRef.current || {
        toplamOrganizasyon: 0,
        toplamSiparis: 0,
        teslimEdilen: 0,
      };
    }
    
    if (kartlar.length === 0) {
      // ✅ KRİTİK: Boş array ise ve loading state'indeyse eski istatistikleri koru
      if (isLoading && previousStatisticsRef.current) {
        return previousStatisticsRef.current;
      }
      // Eğer daha önce hesaplanmış istatistikler varsa onları döndür
      return previousStatisticsRef.current || {
        toplamOrganizasyon: 0,
        toplamSiparis: 0,
        teslimEdilen: 0,
      };
    }

    let toplamOrganizasyon = 0;
    let toplamSiparis = 0;
    let teslimEdilen = 0;

    kartlar.forEach((kart) => {
      // Teslim tarihini formatla
      if (!kart.teslim_tarih) return;
      
      const teslimTarih = new Date(kart.teslim_tarih);
      
      // ✅ KRİTİK: Geçersiz tarih kontrolü
      if (isNaN(teslimTarih.getTime())) {
        return;
      }
      
      const day = teslimTarih.getDate();
      const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                          'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
      
      const month = monthNames[teslimTarih.getMonth()];
      const year = teslimTarih.getFullYear();
      const dayName = dayNames[teslimTarih.getDay()];
      
      const teslimTarihFormatted = `${day} ${month} ${year} ${dayName}`;

      // ✅ KRİTİK: Hafta filtresi uygula - weekDays boşsa tüm kartları dahil et
      if (weekDays.length > 0 && !weekDays.includes(teslimTarihFormatted)) {
        return;
      }

      // Organizasyon sayısı (her kart bir kez)
      toplamOrganizasyon++;

      // ✅ DÜZELTME: Sipariş sayıları - Backend'den gelen siparis_sayisi kullan
      const kartSiparisSayisi = kart.siparis_sayisi || 0;
      
      // Eğer siparisler lazy load edilmişse, onları kullan
      if (kart.siparisler && Array.isArray(kart.siparisler) && kart.siparisler.length > 0) {
        // Lazy load edilmiş siparişler varsa, onları say
        kart.siparisler.forEach((siparis: Order) => {
          // Arşivlenmemiş siparişler (kalan siparişler)
          if (!siparis.arsivli && siparis.arsivli !== 1) {
            toplamSiparis++;
          }
          
          // Teslim edilen siparişler (arsiv_sebep = "teslim-edildi" veya arsivli = 1 ve sebep teslim)
          if (siparis.arsivli === 1 && siparis.arsiv_sebep === 'teslim-edildi') {
            teslimEdilen++;
          }
        });
      } else {
        // ✅ KRİTİK DÜZELTME: Lazy load edilmemişse, backend'den gelen siparis_sayisi kullan
        if (kartSiparisSayisi > 0) {
          toplamSiparis += kartSiparisSayisi;
        }
      }
    });

    const result = {
      toplamOrganizasyon,
      toplamSiparis,
      teslimEdilen,
    };
    
    // ✅ DÜZELTME: Hesaplanan istatistikleri sakla - sonraki yüklemelerde kullanmak için
    previousStatisticsRef.current = result;
    
    return result;
  }, [kartlar, weekDays, isLoading]);

  // Sayfa yeni yüklendiğinde localStorage'daki arşiv verilerini temizle
  useEffect(() => {
    if (window.localStorage.getItem('pageJustLoaded') !== 'false') {
      localStorage.removeItem("arsivSiparisler");
      window.localStorage.setItem('pageJustLoaded', 'false');
    }
  }, []);

  return statistics;
}

