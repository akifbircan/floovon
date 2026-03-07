/**
 * Teslim Foto API
 * Organizasyon kartlarına teslim fotoğrafları yükleme
 */

import { getApiBaseUrl } from '../../../lib/runtime';
import type { ApiResponse } from '../../../lib/api';

export interface TeslimFotoUploadResponse {
  success: boolean;
  files?: Array<{
    filename: string;
    path: string;
    size: number;
  }>;
  message?: string;
  updated?: number;
}

/**
 * Organizasyon kartına teslim fotoğrafları yükle
 * @param organizasyonId - Organizasyon kart ID'si
 * @param files - Yüklenecek fotoğraf dosyaları
 * @param metadata - Opsiyonel metadata (customerId, customerUnvan)
 */
export async function uploadTeslimFotolari(
  organizasyonId: number,
  files: File[],
  metadata?: {
    customerId?: string;
    customerUnvan?: string;
  }
): Promise<TeslimFotoUploadResponse> {
  const formData = new FormData();

  // Dosyaları ekle
  files.forEach((file) => {
    formData.append('files', file);
  });

  // Metadata ekle (opsiyonel)
  if (metadata?.customerId) {
    formData.append('customerId', metadata.customerId);
  }
  if (metadata?.customerUnvan) {
    formData.append('customerUnvan', metadata.customerUnvan);
  }

  try {
    
    // ✅ ESKİ SİSTEM: fetch kullan (Axios FormData ile sorun çıkarabiliyor)
    // Eski sistemde fetch kullanılıyor ve çalışıyor
    const apiBase = getApiBaseUrl();
    const token = localStorage.getItem('floovon_token') || localStorage.getItem('token');
    
    const response = await fetch(
      `${apiBase}/organizasyon-kartlar/${organizasyonId}/teslim-fotolar`,
      {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          // Content-Type'ı EKLEME - browser otomatik ekleyecek boundary ile
        },
        body: formData,
        credentials: 'include', // Cookies için
      }
    );
    
    // Response body'yi bir kez okumak için önce text olarak al, sonra parse et
    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('❌ API response not ok:', response.status, responseText.substring(0, 200));
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // JSON parse et
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ JSON parse hatası:', responseText.substring(0, 200));
      throw new Error('Server geçersiz JSON döndü');
    }

    // Backend response formatı kontrolü
    if (responseData && typeof responseData === 'object' && 'success' in responseData) {
      const apiResponse = responseData as ApiResponse<TeslimFotoUploadResponse>;
      
      if (apiResponse.success) {
        // success: true ise, data varsa onu döndür
        if (apiResponse.data) {
          return {
            success: true,
            files: apiResponse.data.files,
            message: apiResponse.data.message || apiResponse.message,
            updated: apiResponse.data.updated || files.length,
          };
        }
        // data yoksa ama success: true ise, direkt response'dan al
        // Backend direkt { success: true, updated: X, files: [...] } formatında döndürüyor
        return {
          success: true,
          files: (responseData as any).files || [],
          message: apiResponse.message || 'Fotoğraflar başarıyla yüklendi',
          updated: (responseData as any).updated || files.length,
        };
      }
      
      // success: false durumunda hata fırlat
      throw new Error(apiResponse.message || 'Fotoğraf yükleme başarısız');
    }

    // Direkt response formatındaysa
    return responseData as TeslimFotoUploadResponse;
  } catch (error: any) {
    console.error('❌ Teslim fotoğrafı yükleme hatası:', error);
    throw error;
  }
}

/**
 * Teslim fotoğrafı sil (index ile)
 */
export async function deleteTeslimFoto(organizasyonId: number, index: number): Promise<void> {
  const apiBase = getApiBaseUrl();
  const token = localStorage.getItem('floovon_token') || localStorage.getItem('token');

  const response = await fetch(
    `${apiBase}/organizasyon-kartlar/${organizasyonId}/teslim-fotolar?index=${index}`,
    {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || err.message || 'Fotoğraf silinemedi');
  }
}

