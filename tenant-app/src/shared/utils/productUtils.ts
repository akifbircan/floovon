/**
 * Product utility functions
 * Ürün ile ilgili yardımcı fonksiyonlar
 */

import type { Order } from '../../features/dashboard/types';

/**
 * Ürün ID'sinden ürün adını al
 */
export function getUrunAdiFromId(
  urunId: number | string | undefined,
  fallbackName?: string,
  urunVerileri?: Record<string, any> | any[]
): string {
  if (!urunId) return fallbackName || 'Ürün Adı Yok';
  
  // Eğer urunVerileri array ise
  if (Array.isArray(urunVerileri)) {
    const urun = urunVerileri.find((u: any) => u.id === urunId || u.urun_id === urunId);
    if (urun) {
      return urun.urun_adi || urun.name || urun.product_name || fallbackName || 'Ürün Adı Yok';
    }
  }
  
  // Eğer urunVerileri object ise
  if (urunVerileri && typeof urunVerileri === 'object') {
    const urun = (urunVerileri as Record<string, any>)[String(urunId)];
    if (urun) {
      return urun.urun_adi || urun.name || urun.product_name || fallbackName || 'Ürün Adı Yok';
    }
  }
  
  return fallbackName || 'Ürün Adı Yok';
}

/**
 * Ürün yazısı HTML'i oluştur
 */
export function createUrunYazisiHTML(order: Order): string {
  if (!order.urunYazisi && !order.notes) return '';
  
  const urunYazisi = order.urunYazisi || order.notes || '';
  const safeForAttr = String(urunYazisi).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // copy-text: tıklanınca panoya kopyalanır (MainLayout'taki global handler)
  return `<div class="urun-yazisi-wrapper">
    <div class="urun-yazisi copy-text" data-tooltip="${safeForAttr}">
      <i class="icon-urun-yazisi"></i>${urunYazisi}
    </div>
  </div>`;
}



