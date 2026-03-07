import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import type { OrganizasyonKart } from '../types';

interface BaglantiliSiparislerMap {
  [musteriUnvan: string]: number; // Müşteri unvanı -> farklı organizasyon sayısı
}

interface SiparisKartResponse {
  success?: boolean;
  data?: Array<{
    musteri_unvan?: string;
    musteri_isim_soyisim?: string;
    organizasyon_kart_id?: number;
    teslim_tarih?: string;
  }>;
}

/**
 * Bağlantılı siparişleri hesaplayan hook
 * Her müşteri için seçili haftada kaç farklı organizasyon kartında sipariş olduğunu hesaplar
 */
export function useBaglantiliSiparisler(
  kartlar: OrganizasyonKart[],
  _selectedWeek: string | null
): BaglantiliSiparislerMap {
  // Tüm siparişleri çek (queryKey sabit – hook sırası değişmesin)
  const { data: allSiparisler } = useQuery<SiparisKartResponse>({
    queryKey: ['baglantili-siparisler'],
    queryFn: async () => {
      const response = await apiRequest<SiparisKartResponse>('/siparis-kartlar');
      return response;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Bağlantılı siparişleri hesapla: sadece seçili haftadaki kartlara ait siparişler, müşteri başına kaç farklı kartta siparişi var
  const baglantiliSiparislerMap: BaglantiliSiparislerMap = useMemo(() => {
    const map: BaglantiliSiparislerMap = {};
    const list: Array<{ musteri_unvan?: string; musteri_isim_soyisim?: string; organizasyon_kart_id?: number }> =
      Array.isArray(allSiparisler)
        ? allSiparisler
        : (allSiparisler?.success && Array.isArray(allSiparisler.data) ? allSiparisler.data : []);

    if (list.length === 0 || !kartlar?.length) {
      return map;
    }

    // Seçili haftadaki kart id'leri (Dashboard zaten haftaya göre kartları filtreliyor)
    const selectedWeekKartIds = new Set((kartlar ?? []).map((k) => k.id));

    // key = musteri_unvan || musteri_isim_soyisim; value = { orgIds, altKeys } (lookup için musteriAdi/musteriUnvani)
    const musteriOrganizasyonMap = new Map<
      string,
      { orgIds: Set<number>; altKeys: Set<string> }
    >();

    list.forEach((siparis) => {
      const organizasyonKartId = siparis.organizasyon_kart_id;
      if (!organizasyonKartId || !selectedWeekKartIds.has(organizasyonKartId)) {
        return;
      }
      const musteriUnvan = (siparis.musteri_unvan ?? '').trim();
      const musteriIsim = (siparis.musteri_isim_soyisim ?? '').trim();
      const key = musteriUnvan || musteriIsim || null;
      if (!key) return;

      if (!musteriOrganizasyonMap.has(key)) {
        musteriOrganizasyonMap.set(key, { orgIds: new Set(), altKeys: new Set() });
      }
      const entry = musteriOrganizasyonMap.get(key)!;
      entry.orgIds.add(organizasyonKartId);
      if (musteriUnvan) entry.altKeys.add(musteriUnvan);
      if (musteriIsim) entry.altKeys.add(musteriIsim);
    });

    musteriOrganizasyonMap.forEach((entry, key) => {
      const count = entry.orgIds.size;
      map[key] = count;
      entry.altKeys.forEach((alt) => {
        if (alt) map[alt] = count;
      });
    });

    return map;
  }, [allSiparisler, kartlar]);

  return baglantiliSiparislerMap;
}

