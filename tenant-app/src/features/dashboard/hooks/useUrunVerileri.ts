/**
 * Ürün Verileri Hook
 * urunVerileri ve urunVerileriArray'i React state olarak yönetir
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';

interface UrunVerileri {
  [key: string]: {
    id: number | string;
    adi: string;
    fiyat: number;
    gorsel?: string;
    kategori?: string;
    kategori_id?: number;
  };
}

interface UrunVerileriArrayItem {
  id: number | string;
  adi: string;
  fiyat: number;
  gorsel?: string;
  kategori?: string;
  kategori_id?: number;
}

/**
 * Ürün verilerini yükle ve React state olarak döndür
 */
export function useUrunVerileri() {
  const [urunVerileri, setUrunVerileri] = useState<UrunVerileri>({});
  const [urunVerileriArray, setUrunVerileriArray] = useState<UrunVerileriArrayItem[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['urunler'],
    queryFn: async () => {
      try {
        const response = await apiRequest<unknown>('/urunler');
        const raw = Array.isArray(response) ? response : (response && typeof response === 'object' && 'data' in response && Array.isArray((response as { data: any[] }).data))
          ? (response as { data: any[] }).data
          : (response && typeof response === 'object' && 'data' in response ? (response as { data: any[] }).data : []);
        const list = Array.isArray(raw) ? raw : [];
        const urunVerileriObj: UrunVerileri = {};
        const urunVerileriArr: UrunVerileriArrayItem[] = [];
        
        list.forEach((urun: any) => {
            const urunObj = {
              id: urun.id,
              adi: urun.urun_adi || urun.adi,
              fiyat: urun.urun_fiyati || urun.fiyat,
              gorsel: urun.urun_gorseli || urun.gorsel,
              kategori: urun.kategori_adi || urun.kategori,
              kategori_id: urun.urun_kategori_id || urun.kategori_id
            };
            urunVerileriObj[urun.id] = urunObj;
            urunVerileriArr.push(urunObj);
          });
          
          setUrunVerileri(urunVerileriObj);
          setUrunVerileriArray(urunVerileriArr);
          
          // Eski JS uyumluluğu için window'a da set et (geçici)
          (window as any).urunVerileri = urunVerileriObj;
          (window as any).urunVerileriArray = urunVerileriArr;
          window.dispatchEvent(new CustomEvent('urunVerileriYuklendi'));
          
          return { urunVerileri: urunVerileriObj, urunVerileriArray: urunVerileriArr };
      } catch (error) {
        console.error('Ürün verileri yükleme hatası:', error);
        return { urunVerileri: {}, urunVerileriArray: [] };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 dakika
    retry: false,
  });

  useEffect(() => {
    if (data) {
      setUrunVerileri(data.urunVerileri);
      setUrunVerileriArray(data.urunVerileriArray);
    }
  }, [data]);

  return {
    urunVerileri,
    urunVerileriArray,
    isLoading,
  };
}



