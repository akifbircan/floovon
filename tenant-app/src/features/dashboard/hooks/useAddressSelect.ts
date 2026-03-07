/**
 * Address Select Hook
 * İl, İlçe, Mahalle seçimi için React hook
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '../../../lib/api';

export interface AddressOption {
  id: string | number;
  name: string;
}

export interface UseAddressSelectReturn {
  il: string;
  ilce: string;
  mahalle: string;
  ilOptions: AddressOption[];
  ilceOptions: AddressOption[];
  mahalleOptions: AddressOption[];
  isLoading: boolean;
  setIl: (il: string, options?: { skipClear?: boolean }) => void;
  setIlce: (ilce: string, options?: { skipClear?: boolean }) => void;
  setMahalle: (mahalle: string) => void;
  reset: () => void;
}

/**
 * Adres seçimi hook'u
 */
export function useAddressSelect(
  initialIl?: string,
  initialIlce?: string,
  initialMahalle?: string
): UseAddressSelectReturn {
  const [il, setIl] = useState<string>(initialIl || '');
  const [ilce, setIlce] = useState<string>(initialIlce || '');
  const [mahalle, setMahalle] = useState<string>(initialMahalle || '');
  const [ilOptions, setIlOptions] = useState<AddressOption[]>([]);
  const [ilceOptions, setIlceOptions] = useState<AddressOption[]>([]);
  const [mahalleOptions, setMahalleOptions] = useState<AddressOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Detaydan doldurma sırasında il/ilçe değişince bağımlı alanları temizleme (skipClear)
  const skipClearIlRef = useRef(false);
  const skipClearIlceRef = useRef(false);

  // İlleri yükle - sadece bir kez, cache ile
  useEffect(() => {
    // Global cache kontrolü - tüm hook instance'ları aynı cache'i kullanır
    if (!(window as any).__addressSelectCache) {
      (window as any).__addressSelectCache = {
        ilOptions: null,
        loading: false,
        tried: false,
      };
    }

    const cache = (window as any).__addressSelectCache;

    // Eğer cache'de varsa direkt kullan
    if (cache.ilOptions !== null) {
      setIlOptions(cache.ilOptions);
      return;
    }

    // Eğer başka bir instance yüklüyorsa bekle
    if (cache.loading) {
      const checkInterval = setInterval(() => {
        if (cache.ilOptions !== null) {
          setIlOptions(cache.ilOptions);
          clearInterval(checkInterval);
        }
        // 5 saniye sonra timeout
        if (Date.now() - (cache.startTime || 0) > 5000) {
          clearInterval(checkInterval);
          cache.loading = false;
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    // İlk yükleme - sadece bir kez dene
    if (cache.tried) {
      // Zaten denendi, boş array döndür
      setIlOptions([]);
      return;
    }

    cache.loading = true;
    cache.startTime = Date.now();
    cache.tried = true;

    const loadIller = async () => {
      try {
        setIsLoading(true);
        
        // TRAddress yüklenene kadar bekle (max 3 saniye)
        let attempts = 0;
        while (attempts < 30 && typeof (window as any).TRAddress === 'undefined') {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        // TRAddress sistemi varsa kullan
        if (typeof (window as any).TRAddress !== 'undefined' && (window as any).TRAddress.getProvinces) {
          const provinces = await (window as any).TRAddress.getProvinces();
          const options = provinces.map((p: any) => ({ id: p.id, name: p.name }));
          cache.ilOptions = options;
          setIlOptions(options);
        } else {
          // TRAddress yoksa boş array döndür - sessizce devam et
          cache.ilOptions = [];
          setIlOptions([]);
        }
      } catch (error) {
        // Sessizce devam et - hata gösterme
        cache.ilOptions = [];
        setIlOptions([]);
      } finally {
        setIsLoading(false);
        cache.loading = false;
      }
    };

    loadIller();
  }, []);

  // İl değiştiğinde ilçeleri yükle
  useEffect(() => {
    if (!il) {
      setIlceOptions([]);
      setMahalleOptions([]);
      setIlce('');
      setMahalle('');
      return;
    }

    const loadIlceler = async () => {
      try {
        setIsLoading(true);
        // TRAddress sistemi varsa kullan
        if (typeof (window as any).TRAddress !== 'undefined' && (window as any).TRAddress.getProvinces) {
          const provinces = await (window as any).TRAddress.getProvinces();
          const selectedProvince = provinces.find((p: any) => p.name === il);
          if (selectedProvince) {
            const districts = await (window as any).TRAddress.getDistricts(selectedProvince.id);
            setIlceOptions(districts.map((d: any) => ({ id: d.id, name: d.name })));
          }
        } else {
          // TRAddress yoksa boş array döndür
          setIlceOptions([]);
        }
        // Restore modunda (detaydan doldurma) ilçe/mahalle temizlenmesin
        if (!skipClearIlRef.current) {
          setIlce('');
          setMahalle('');
          setMahalleOptions([]);
        }
        skipClearIlRef.current = false;
      } catch (error) {
        console.error('İlçeler yüklenemedi:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadIlceler();
  }, [il]);

  // İlçe değiştiğinde mahalleleri yükle
  useEffect(() => {
    if (!ilce || !il) {
      setMahalleOptions([]);
      setMahalle('');
      return;
    }

    const loadMahalleler = async () => {
      try {
        setIsLoading(true);
        // TRAddress sistemi varsa kullan
        if (typeof (window as any).TRAddress !== 'undefined' && (window as any).TRAddress.getProvinces) {
          const provinces = await (window as any).TRAddress.getProvinces();
          const selectedProvince = provinces.find((p: any) => p.name === il);
          if (selectedProvince) {
            const districts = await (window as any).TRAddress.getDistricts(selectedProvince.id);
            const selectedDistrict = districts.find((d: any) => d.name === ilce);
            if (selectedDistrict) {
              const neighborhoods = await (window as any).TRAddress.getNeighborhoods(selectedDistrict.id);
              setMahalleOptions(neighborhoods.map((n: any) => ({ id: n.id, name: n.name })));
            }
          }
        } else {
          // TRAddress yoksa boş array döndür
          setMahalleOptions([]);
        }
        // Restore modunda (detaydan doldurma) mahalle temizlenmesin
        if (!skipClearIlceRef.current) {
          setMahalle('');
        }
        skipClearIlceRef.current = false;
      } catch (error) {
        console.error('Mahalleler yüklenemedi:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMahalleler();
  }, [ilce, il]);

  const reset = useCallback(() => {
    setIl('');
    setIlce('');
    setMahalle('');
    setIlceOptions([]);
    setMahalleOptions([]);
  }, []);

  // Setter fonksiyonlarını useCallback ile sarmala - sonsuz döngüyü önle
  const setIlCallback = useCallback((newIl: string, options?: { skipClear?: boolean }) => {
    if (options?.skipClear) skipClearIlRef.current = true;
    setIl(newIl);
  }, []);

  const setIlceCallback = useCallback((newIlce: string, options?: { skipClear?: boolean }) => {
    if (options?.skipClear) skipClearIlceRef.current = true;
    setIlce(newIlce);
  }, []);

  const setMahalleCallback = useCallback((newMahalle: string) => {
    setMahalle(newMahalle);
  }, []);

  return {
    il,
    ilce,
    mahalle,
    ilOptions,
    ilceOptions,
    mahalleOptions,
    isLoading,
    setIl: setIlCallback,
    setIlce: setIlceCallback,
    setMahalle: setMahalleCallback,
    reset,
  };
}

