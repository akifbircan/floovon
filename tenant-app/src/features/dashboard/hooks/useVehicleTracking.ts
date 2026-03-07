/**
 * Vehicle Tracking Hook
 * Araç takip sistemi için React hook
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { useAuth } from '../../../app/providers/AuthProvider';

export interface Vehicle {
  id?: number;
  arac_id?: number;
  plaka: string;
  durum?: string;
  arac_durum?: string;
  is_active?: number | boolean | string;
  konum_lat?: string | number;
  konum_lng?: string | number;
  konum_adi?: string;
  latitude?: string | number;
  longitude?: string | number;
}

interface VehicleListResponse {
  success: boolean;
  data?: Vehicle[];
  message?: string;
}

interface AracListResponse {
  success: boolean;
  data?: Array<{
    id: number;
    arac_id?: number;
    is_active?: number | boolean | string;
  }>;
}

/**
 * Koordinatlardan adres al (reverse geocoding)
 * ✅ DÜZELTME: Backend proxy endpoint'ini kullan (CORS sorunu için)
 */
async function getAddressFromCoordinates(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(
      `/api/geocoding/reverse?lat=${lat}&lng=${lng}&zoom=18&addressdetails=1`
    );
    if (!response.ok) return null;
    const data = await response.json();
    // Backend: { success: true, data: { address: "Sokak, Mahalle, İlçe...", raw: {...} } }
    if (data && data.success && data.data) {
      if (data.data.address && typeof data.data.address === 'string') return data.data.address;
      if (data.data.raw && data.data.raw.display_name) return data.data.raw.display_name;
    }
    if (data && data.display_name) return data.display_name;
    return null;
  } catch {
    return null;
  }
}

/**
 * Metni kısalt (truncate)
 */
function truncateText(text: string, maxLength: number = 35): string {
  if (!text) return text;
  const hasEmoji = text.indexOf('📍') !== -1;
  const cleanText = text.replace(/📍\s*/g, '').trim();
  if (cleanText.length <= maxLength) return text;
  const truncated = cleanText.substring(0, maxLength) + '...';
  return hasEmoji ? '📍 ' + truncated : truncated;
}

/**
 * Araç takip hook'u
 */
export const useVehicleTracking = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [driverName, setDriverName] = useState<string>('Henüz sürücü atanmadı');
  const updateIntervalRef = useRef<number | null>(null);

  // Sürücü adını al
  useEffect(() => {
    const fetchDriverName = async () => {
      if (!user) {
        setDriverName('Henüz sürücü atanmadı');
        return;
      }

      try {
        const userId = (user as any).id || 1;
        // ✅ DÜZELTME: apiRequest zaten data field'ını döndürüyor, success kontrolü gerekmez
        const userData = await apiRequest<any>(`/auth/me?id=${userId}`, {
          method: 'GET',
        });

        if (userData) {
          if (userData.name && userData.surname) {
            setDriverName(`${userData.name} ${userData.surname}`);
          } else if (userData.isim && userData.soyisim) {
            setDriverName(`${userData.isim} ${userData.soyisim}`);
          } else if (userData.name || userData.isim) {
            setDriverName(userData.name || userData.isim);
          } else if (userData.kullaniciadi) {
            setDriverName(userData.kullaniciadi);
          } else {
            setDriverName('Sürücü');
          }
        }
      } catch (error: any) {
        // Network error durumunda sessizce handle et
        setDriverName('Henüz sürücü atanmadı');
      }
    };

    fetchDriverName();
  }, [user]);

  // Araç listesini yükle
  const { data: vehiclesData, isLoading, error, refetch } = useQuery<Vehicle[]>({
    queryKey: ['vehicle-list'],
    queryFn: async () => {
      try {
        // Araç konumlarını al
        // apiRequest zaten response.data.data döndürüyor (ApiResponse formatında ise)
        // Ama backend direkt array döndürüyorsa, apiRequest direkt array döndürür
        const konumResponse = await apiRequest<VehicleListResponse | Vehicle[]>('/arac-takip/guncel-konumlar', {
          method: 'GET',
        });

        // Response formatını kontrol et
        let vehicles: Vehicle[] = [];
        
        // Eğer ApiResponse formatındaysa ({ success: true, data: [...] })
        if (konumResponse && typeof konumResponse === 'object' && 'success' in konumResponse) {
          const apiResponse = konumResponse as VehicleListResponse;
          if (apiResponse.success && apiResponse.data && Array.isArray(apiResponse.data)) {
            vehicles = [...apiResponse.data];
          } else {
            return [];
          }
        } 
        // Eğer direkt array formatındaysa
        else if (Array.isArray(konumResponse)) {
          vehicles = [...konumResponse];
        } else {
          return [];
        }

      // Araç bilgilerini al (is_active için)
      try {
        // ✅ DÜZELTME: apiRequest zaten data field'ını döndürüyor, success kontrolü gerekmez
        const aracResponse = await apiRequest<Array<{ id: number; arac_id?: number; is_active?: number | boolean | string }> | AracListResponse>('/araclar', {
          method: 'GET',
        });

        // Response formatını kontrol et
        let aracDataArray: Array<{ id: number; arac_id?: number; is_active?: number | boolean | string }> = [];
        
        // Eğer ApiResponse formatındaysa ({ success: true, data: [...] })
        if (aracResponse && typeof aracResponse === 'object' && 'success' in aracResponse) {
          const apiResponse = aracResponse as AracListResponse;
          if (apiResponse.success && apiResponse.data && Array.isArray(apiResponse.data)) {
            aracDataArray = apiResponse.data;
          }
        } 
        // Eğer direkt array formatındaysa
        else if (Array.isArray(aracResponse)) {
          aracDataArray = aracResponse;
        }

        if (aracDataArray.length > 0) {
          const aracMap = new Map<number, { is_active?: number | boolean | string }>();
          aracDataArray.forEach((arac) => {
            const aracId = arac.id || arac.arac_id;
            if (aracId) {
              aracMap.set(aracId, { is_active: arac.is_active });
            }
          });

          // is_active bilgisini ekle
          vehicles = vehicles.map((vehicle) => {
            const aracId = vehicle.id || vehicle.arac_id;
            if (aracId && aracMap.has(aracId)) {
              return { ...vehicle, is_active: aracMap.get(aracId)?.is_active };
            }
            return vehicle;
          });
        }
      } catch (error) {
        // araclar tablosundan is_active bilgisi alınamadı
      }

      // Filtrele: Plakası olmayan veya is_active = 0 olan araçları çıkar
      vehicles = vehicles.filter((arac) => {
        const plaka = arac.plaka || '';
        if (!plaka || plaka.trim() === '' || plaka === 'Plaka yok') {
          return false;
        }

        if (arac.is_active !== undefined && arac.is_active !== null) {
          const isActiveValue = arac.is_active;
          if (
            isActiveValue === 0 ||
            isActiveValue === false ||
            isActiveValue === '0' ||
            isActiveValue === 'false'
          ) {
            return false;
          }
        }

        return true;
      });

        return vehicles;
      } catch (error) {
        console.error('❌ Araç listesi yükleme hatası:', error);
        return [];
      }
    },
    refetchInterval: 5000, // 5 saniyede bir güncelle
    staleTime: 0,
  });

  // Araçları sırala: Aktif olanlar üstte
  const sortedVehicles = vehiclesData
    ? [...vehiclesData].sort((a, b) => {
        const durumA = (a.durum || a.arac_durum || '').toString().toLowerCase().trim();
        const durumB = (b.durum || b.arac_durum || '').toString().toLowerCase().trim();
        const isActiveFromDBA =
          a.is_active !== undefined
            ? a.is_active === 1 || a.is_active === true || a.is_active === '1'
            : true;
        const isActiveFromDBB =
          b.is_active !== undefined
            ? b.is_active === 1 || b.is_active === true || b.is_active === '1'
            : true;
        const isActiveA = durumA === 'teslimatta' && isActiveFromDBA;
        const isActiveB = durumB === 'teslimatta' && isActiveFromDBB;

        if (isActiveA && !isActiveB) return -1;
        if (!isActiveA && isActiveB) return 1;
        return 0;
      })
    : [];

  // Aktif araç sayısı
  const activeCount = sortedVehicles.filter((arac) => {
    const durum = (arac.durum || arac.arac_durum || '').toString().toLowerCase().trim();
    const isActiveFromDB =
      arac.is_active !== undefined
        ? arac.is_active === 1 || arac.is_active === true || arac.is_active === '1'
        : true;
    return durum === 'teslimatta' && isActiveFromDB;
  }).length;

  // Araç seçme fonksiyonu (modal açmak için)
  const selectVehicle = useCallback((plaka: string) => {
    // TODO: Araç detay modalını aç
  }, []);

  // ✅ KRİTİK: getAddressFromCoordinates ve truncateText'i useCallback ile sarmala
  // Böylece her render'da yeni referans oluşturulmaz ve "Maximum update depth exceeded" hatası önlenir
  const getAddressFromCoordinatesMemo = useCallback(async (lat: number, lng: number): Promise<string | null> => {
    return getAddressFromCoordinates(lat, lng);
  }, []);

  const truncateTextMemo = useCallback((text: string, maxLength: number = 35): string => {
    return truncateText(text, maxLength);
  }, []);

  return {
    vehicles: sortedVehicles,
    isLoading,
    error,
    totalCount: sortedVehicles.length,
    activeCount,
    driverName,
    refetch,
    selectVehicle,
    getAddressFromCoordinates: getAddressFromCoordinatesMemo,
    truncateText: truncateTextMemo,
  };
};

