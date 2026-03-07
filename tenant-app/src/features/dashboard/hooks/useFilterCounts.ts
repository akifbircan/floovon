import { useMemo, useEffect } from 'react';
import type { OrganizasyonKart } from '../types';
import { useWeekDates } from './useWeekDates';

/**
 * Filtre sayılarını hesaplayan hook
 * Kart filtrelerindeki sayıları günceller
 */
export function useFilterCounts(
  kartlar: OrganizasyonKart[] | null | undefined,
  selectedWeek: string | null | undefined
) {
  const { weekDates } = useWeekDates(selectedWeek ?? undefined);
  
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

  // Filtre sayılarını hesapla
  const filterCounts = useMemo(() => {
    if (!kartlar || kartlar.length === 0) {
      return {
        organizasyon: 0,
        aracsusleme: 0,
        ozelgun: 0,
        ozelsiparis: 0,
        ciceksepeti: 0,
      };
    }

    const counts = {
      organizasyon: 0,
      aracsusleme: 0,
      ozelgun: 0,
      ozelsiparis: 0,
      ciceksepeti: 0,
    };

    kartlar.forEach((kart) => {
      // Teslim tarihini formatla
      if (!kart.teslim_tarih) return;
      
      const teslimTarih = new Date(kart.teslim_tarih);
      const day = teslimTarih.getDate();
      const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                          'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
      
      const month = monthNames[teslimTarih.getMonth()];
      const year = teslimTarih.getFullYear();
      const dayName = dayNames[teslimTarih.getDay()];
      
      const teslimTarihFormatted = `${day} ${month} ${year} ${dayName}`;

      // Hafta filtresi uygula
      if (weekDays.length > 0 && !weekDays.includes(teslimTarihFormatted)) {
        return;
      }

      // Kart türüne göre say
      const kartTur = kart.kart_tur?.toUpperCase();
      if (kartTur === 'ORGANIZASYON') {
        counts.organizasyon++;
      } else if (kartTur === 'ARACSUSLEME') {
        counts.aracsusleme++;
      } else if (kartTur === 'OZELGUN') {
        counts.ozelgun++;
      } else if (kartTur === 'OZELSIPARIS') {
        counts.ozelsiparis++;
      } else if (kartTur === 'CICEKSEPETI') {
        counts.ciceksepeti++;
      }
    });

    return counts;
  }, [kartlar, weekDays]);

  // ✅ REACT: Filter counts artık direkt return ediliyor, DOM manipülasyonu yok
  return filterCounts;
}

