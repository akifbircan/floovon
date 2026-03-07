/**
 * Müşteri verilerini yükle ve React state olarak döndür
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';

export interface Musteri {
  id: number;
  musteri_unvani?: string;
  musteri_unvan?: string;
  musteri_adi?: string;
  musteri_ad_soyad?: string;
  yetkili_ad_soyad?: string;
  yetkili_telefon?: string;
  musteri_telefon?: string;
  telefon?: string;
  musteri_eposta?: string;
  email?: string;
  musteri_grubu?: string;
  teslim_il?: string;
  teslim_ilce?: string;
  teslim_mahalle?: string;
  teslim_acik_adres?: string;
  /** Müşteriye kayıtlı ürün yazısı metni (sipariş formunda seçilince doldurulur) */
  musteri_urun_yazisi?: string;
}

/**
 * Müşteri verilerini yükle ve React state olarak döndür
 */
export function useMusteriler() {
  const [musteriler, setMusteriler] = useState<Musteri[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['musteriler'],
    queryFn: async () => {
      try {
        const response = await apiRequest<unknown>('/customers');
        // apiRequest bazen backend'in { success, data } yanıtından sadece data'yı döndürür (dizi)
        const list = Array.isArray(response) ? response : (response && typeof response === 'object' && 'data' in response && Array.isArray((response as { data: any[] }).data))
          ? (response as { data: any[] }).data
          : [];
        const musterilerList: Musteri[] = list.map((musteri: any) => ({
            id: musteri.id,
            musteri_unvani: musteri.musteri_unvani ?? musteri.musteri_unvan,
            musteri_unvan: musteri.musteri_unvani ?? musteri.musteri_unvan,
            musteri_adi: musteri.musteri_unvani ?? musteri.musteri_ad_soyad ?? musteri.musteri_adi,
            musteri_ad_soyad: musteri.musteri_ad_soyad ?? musteri.musteri_isim_soyisim,
            yetkili_ad_soyad: musteri.musteri_ad_soyad ?? musteri.yetkili_ad_soyad,
            yetkili_telefon: musteri.musteri_telefon ?? musteri.yetkili_telefon,
            musteri_telefon: musteri.musteri_telefon ?? musteri.phone,
            telefon: musteri.musteri_telefon ?? musteri.phone ?? musteri.telefon,
            musteri_eposta: musteri.musteri_eposta ?? musteri.email,
            email: musteri.musteri_eposta ?? musteri.email,
            musteri_grubu: musteri.musteri_grubu,
            teslim_il: musteri.musteri_il ?? musteri.teslim_il,
            teslim_ilce: musteri.musteri_ilce ?? musteri.teslim_ilce,
            teslim_mahalle: musteri.musteri_mahalle ?? musteri.teslim_mahalle,
            teslim_acik_adres: musteri.musteri_acik_adres ?? musteri.teslim_acik_adres,
            musteri_urun_yazisi: musteri.musteri_urun_yazisi ?? undefined,
          }));
          
          setMusteriler(musterilerList);
          (window as any).musteriler = musterilerList;
          window.dispatchEvent(new CustomEvent('musterilerYuklendi'));
          return musterilerList;
      } catch (error) {
        console.error('Müşteri verileri yükleme hatası:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 dakika
    retry: false,
  });

  useEffect(() => {
    if (data) {
      setMusteriler(data);
    }
  }, [data]);

  return {
    musteriler,
    isLoading,
  };
}

