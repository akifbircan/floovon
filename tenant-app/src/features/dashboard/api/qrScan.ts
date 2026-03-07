/**
 * QR Kod Okuma API functions
 */

import { apiRequest } from '../../../lib/api';
import type { Order } from '../types';

/**
 * QR kod ile sipariş bul.
 * Backend /api/qr/scan: body.qr_code = sipariş id (sayı) veya sipariş kodu (ORD-123, SP-123 vb.).
 */
export async function scanQRCode(qrCode: string): Promise<Order | null> {
  try {
    const data = await apiRequest<Order>('/qr/scan', {
      method: 'POST',
      data: { qr_code: qrCode },
    });
    return data ?? null;
  } catch (error) {
    console.error('QR kod okuma hatası:', error);
    return null;
  }
}




