/**
 * Merkezi cache invalidation yardımcıları.
 * Bir entity (müşteri, partner, ürün vb.) güncellendiğinde
 * tüm sayfalarda anında yansıması için ilgili tüm query'leri invalidate eder.
 * Diğer açık sekmelere BroadcastChannel ile mesaj gönderilir; onlar da kendi cache'lerini invalidate eder.
 */

import type { QueryClient } from '@tanstack/react-query';
import { broadcastInvalidation } from './crossTabInvalidate';

/**
 * Müşteri güncellendiğinde (veya silindiğinde) tüm ilgili cache'leri invalidate et.
 * Böylece müşteri listesi, detay sayfası, cari sayfası, dashboard kartları anında güncellenir.
 */
export function invalidateCustomerQueries(
  queryClient: QueryClient,
  customerId: number | undefined | null
): void {
  queryClient.invalidateQueries({ queryKey: ['customers'], exact: false });
  queryClient.invalidateQueries({ queryKey: ['musteriler'] });
  if (customerId != null) {
    queryClient.invalidateQueries({ queryKey: ['customer-detail', customerId] });
    queryClient.invalidateQueries({ queryKey: ['customer-orders', customerId] });
    queryClient.invalidateQueries({ queryKey: ['customer-cari-ozet', customerId] });
    queryClient.invalidateQueries({ queryKey: ['customer-cari-ozet-inline', customerId] });
    queryClient.invalidateQueries({ queryKey: ['customer-tahsilatlar', customerId] });
    queryClient.invalidateQueries({ queryKey: ['customer-faturalar', customerId] });
  }
  queryClient.invalidateQueries({ queryKey: ['organizasyon-kartlar'] });
  queryClient.invalidateQueries({ queryKey: ['siparis-kartlar'] });
  const keys: unknown[][] = [['customers'], ['musteriler'], ['organizasyon-kartlar'], ['siparis-kartlar']];
  if (customerId != null) {
    keys.push(['customer-detail', customerId], ['customer-orders', customerId], ['customer-cari-ozet', customerId], ['customer-cari-ozet-inline', customerId], ['customer-tahsilatlar', customerId], ['customer-faturalar', customerId]);
  }
  broadcastInvalidation(keys);
}

/**
 * Partner güncellendiğinde (veya silindiğinde) tüm ilgili cache'leri invalidate et.
 */
export function invalidatePartnerQueries(
  queryClient: QueryClient,
  partnerId: string | number | undefined | null
): void {
  queryClient.invalidateQueries({ queryKey: ['partners'], exact: false });
  queryClient.invalidateQueries({ queryKey: ['partner-firmalar'] });
  if (partnerId != null) {
    const id = String(partnerId);
    queryClient.invalidateQueries({ queryKey: ['partner-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['partner-cari-ozet', id] });
    queryClient.invalidateQueries({ queryKey: ['partner-cari-ozet-inline', id] });
    queryClient.invalidateQueries({ queryKey: ['partner-orders-alinan', id] });
    queryClient.invalidateQueries({ queryKey: ['partner-orders-verilen', id] });
    queryClient.invalidateQueries({ queryKey: ['partner-odemeler', id] });
  }
  const keys: unknown[][] = [['partners'], ['partner-firmalar']];
  if (partnerId != null) {
    const idStr = String(partnerId);
    keys.push(['partner-detail', idStr], ['partner-cari-ozet', idStr], ['partner-cari-ozet-inline', idStr], ['partner-orders-alinan', idStr], ['partner-orders-verilen', idStr], ['partner-odemeler', idStr]);
  }
  broadcastInvalidation(keys);
}

/**
 * Organizasyon kartı / sipariş güncellendiğinde ilgili cache'leri invalidate et.
 * Teslim foto, davetiye görseli, kart düzenleme, sipariş silme vb. sonrası kullanılır.
 */
export function invalidateOrganizasyonKartQueries(
  queryClient: QueryClient,
  kartId?: number | string | undefined | null
): void {
  queryClient.invalidateQueries({ queryKey: ['organizasyon-kartlar'] });
  queryClient.invalidateQueries({ queryKey: ['siparis-kartlar'] });
  queryClient.invalidateQueries({ queryKey: ['baglantili-siparisler'] });
  queryClient.invalidateQueries({ queryKey: ['archived-orders'] });
  if (kartId != null) {
    queryClient.invalidateQueries({ queryKey: ['siparis-kartlar', kartId] });
    queryClient.invalidateQueries({ queryKey: ['organizasyon-siparisler', kartId] });
    queryClient.invalidateQueries({ queryKey: ['organizasyon-fotograflar', kartId] });
    queryClient.invalidateQueries({ queryKey: ['organizasyon-kart-detail', kartId] });
  }
  const keys: unknown[][] = [['organizasyon-kartlar'], ['siparis-kartlar'], ['baglantili-siparisler'], ['archived-orders']];
  if (kartId != null) {
    keys.push(['siparis-kartlar', kartId], ['organizasyon-siparisler', kartId], ['organizasyon-fotograflar', kartId], ['organizasyon-kart-detail', kartId]);
  }
  broadcastInvalidation(keys);
}

/**
 * Müşteri cari: tahsilat veya fatura eklendi/güncellendi/silindiğinde çağrılır.
 * Tüm sekmelerdeki müşteri cari sayfasının anında güncellenmesi için.
 */
export function invalidateCustomerCariQueries(
  queryClient: QueryClient,
  customerId: string | number
): void {
  const id = customerId;
  queryClient.invalidateQueries({ queryKey: ['customer-tahsilatlar', id] });
  queryClient.invalidateQueries({ queryKey: ['customer-faturalar', id] });
  queryClient.invalidateQueries({ queryKey: ['customer-cari-ozet', id] });
  queryClient.invalidateQueries({ queryKey: ['customer-orders', id] });
  queryClient.invalidateQueries({ queryKey: ['customer-cari-ozet-inline', id] });
  broadcastInvalidation([
    ['customer-tahsilatlar', id],
    ['customer-faturalar', id],
    ['customer-cari-ozet', id],
    ['customer-orders', id],
    ['customer-cari-ozet-inline', id],
  ]);
}

/**
 * Sipariş güncellendiğinde veya oluşturulduğunda çağrılır.
 * Index/dashboard'daki sipariş düzenlemeden sonra müşteri cari ve partner cari
 * sayfalarındaki sipariş listelerinin anında güncellenmesi için tüm ilgili cache'leri invalidate eder.
 */
export function invalidateSiparisGuncellemeQueries(
  queryClient: QueryClient,
  options: {
    organizasyonKartId?: number | string | null;
    musteriId?: number | string | undefined | null;
  }
): void {
  const { organizasyonKartId, musteriId } = options;

  queryClient.invalidateQueries({ queryKey: ['organizasyon-kartlar'] });
  queryClient.invalidateQueries({ queryKey: ['siparisler'] });
  queryClient.invalidateQueries({ queryKey: ['siparis-kartlar'] });
  queryClient.invalidateQueries({ queryKey: ['baglantili-siparisler'] });
  queryClient.invalidateQueries({ queryKey: ['archived-orders'] });

  if (organizasyonKartId != null) {
    const orgId = typeof organizasyonKartId === 'string' ? Number(organizasyonKartId) : organizasyonKartId;
    queryClient.invalidateQueries({ queryKey: ['siparis-kartlar', organizasyonKartId] });
    queryClient.invalidateQueries({ queryKey: ['siparis-kartlar', orgId] });
    queryClient.invalidateQueries({ queryKey: ['siparis-kartlari', organizasyonKartId] });
    queryClient.invalidateQueries({ queryKey: ['organizasyon-siparisler', organizasyonKartId] });
    queryClient.invalidateQueries({ queryKey: ['organizasyon-kart-detail', organizasyonKartId] });
  }

  // Güncel updated_at'in hemen görünmesi için invalidate sonrası refetch tetikle
  queryClient.refetchQueries({ queryKey: ['siparis-kartlar'], type: 'active' });
  if (organizasyonKartId != null) {
    const orgId = typeof organizasyonKartId === 'string' ? Number(organizasyonKartId) : organizasyonKartId;
    queryClient.refetchQueries({ queryKey: ['siparis-kartlar', organizasyonKartId], type: 'active' });
    queryClient.refetchQueries({ queryKey: ['siparis-kartlar', orgId], type: 'active' });
  }

  if (musteriId != null && musteriId !== '') {
    queryClient.invalidateQueries({ queryKey: ['customer-orders', musteriId] });
    queryClient.invalidateQueries({ queryKey: ['customer-cari-ozet', musteriId] });
  }

  // Partner cari sayfaları siparişi partner_firma_adi ile çekiyor; hangi partner'da olduğunu bilmediğimiz için tüm partner sipariş listelerini invalidate ediyoruz
  queryClient.invalidateQueries({ queryKey: ['partner-orders-alinan'] });
  queryClient.invalidateQueries({ queryKey: ['partner-orders-verilen'] });

  const keys: unknown[][] = [
    ['organizasyon-kartlar'],
    ['siparisler'],
    ['siparis-kartlar'],
    ['baglantili-siparisler'],
    ['archived-orders'],
    ['partner-orders-alinan'],
    ['partner-orders-verilen'],
  ];
  if (organizasyonKartId != null) {
    keys.push(['siparis-kartlar', organizasyonKartId], ['siparis-kartlari', organizasyonKartId], ['organizasyon-siparisler', organizasyonKartId], ['organizasyon-kart-detail', organizasyonKartId]);
  }
  if (musteriId != null && musteriId !== '') {
    keys.push(['customer-orders', musteriId], ['customer-cari-ozet', musteriId]);
  }
  broadcastInvalidation(keys);
}
