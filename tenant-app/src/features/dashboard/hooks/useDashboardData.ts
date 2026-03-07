/**
 * Dashboard data hook
 * React Query ile organizasyon kartlarını ve siparişleri yönetir
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getOrganizasyonKartlari, getSiparisKartlariByOrganizasyon } from '../api';
import type { OrganizasyonKart } from '../types';

/**
 * Organizasyon kartlarını getir
 * selectedWeek parametresi ile haftaya göre filtreleme yapılabilir
 */
export function useOrganizasyonKartlari() {
  return useQuery({
    queryKey: ['organizasyon-kartlar'], // ✅ DÜZELTME: selectedWeek queryKey'den kaldırıldı
    queryFn: () => getOrganizasyonKartlari(), // ✅ DÜZELTME: selectedWeek parametresi kaldırıldı - her zaman tüm kartları çek
    staleTime: 30 * 1000, // 30 saniye cache
    refetchOnWindowFocus: true, // ✅ DÜZELTME: Window focus'ta refetch yap
    refetchOnMount: true, // ✅ DÜZELTME: Mount'ta refetch yap
    enabled: true,
    // ✅ KRİTİK DÜZELTME: placeholderData kullan - component unmount'u önlemek için
    placeholderData: (previousData) => previousData, // Eski verileri göster, component unmount etme
  });
}

/**
 * Belirli bir organizasyona ait siparişleri getir
 */
export function useSiparisKartlari(organizasyonId: number | null) {
  return useQuery({
    queryKey: ['siparis-kartlar', organizasyonId],
    queryFn: () => {
      if (!organizasyonId) throw new Error('Organizasyon ID gerekli');
      return getSiparisKartlariByOrganizasyon(organizasyonId);
    },
    enabled: !!organizasyonId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    // ✅ KRİTİK: placeholderData kullan - component unmount'u önlemek için
    placeholderData: (previousData) => previousData || [],
  });
}

/**
 * Tarih bazlı kolonlara göre organizasyon kartlarını grupla
 * Her tarih kolonunda o güne ait organizasyon kartları gösterilir
 */
export function useDateColumns(
  kartlar: OrganizasyonKart[] | undefined,
  weekDates: Array<{ dateString: string; displayDate: string }>
) {
  return useMemo(() => {
    if (!kartlar || !weekDates) {
      return weekDates.map((weekDate) => ({
        dateString: weekDate.dateString,
        displayDate: weekDate.displayDate,
        kartlar: [],
      }));
    }

    // Her tarih için o güne ait kartları filtrele
    return weekDates.map((weekDate) => {
      const filteredKartlar = kartlar.filter((kart) => {
        if (!kart.teslim_tarih) return false;
        
        // Tarih string'ini karşılaştır (YYYY-MM-DD)
        const kartTarih = new Date(kart.teslim_tarih);
        const kartTarihString = formatDateString(kartTarih);
        
        return kartTarihString === weekDate.dateString;
      });

      return {
        dateString: weekDate.dateString,
        displayDate: weekDate.displayDate,
        kartlar: filteredKartlar,
      };
    });
  }, [kartlar, weekDates]);
}

/**
 * Tarihi YYYY-MM-DD formatına çevir
 */
function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

