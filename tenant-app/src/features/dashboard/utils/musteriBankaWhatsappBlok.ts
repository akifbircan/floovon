import { apiClient } from '@/lib/api';

/**
 * Ayarlar → Müşteri mesaj şablonunda seçili banka hesaplarını,
 * "Sipariş Şablonu ve IBAN Bilgisi Gönder" ile aynı WhatsApp görünümünde üretir
 * (çizgiler + *banka* + IBAN + şube·hesap sahibi + EFT notu).
 * Seçili hesap yoksa veya hata olursa boş string.
 */
export async function buildMesajSablonuBankaBlokuAsync(): Promise<string> {
  try {
    const gon = await apiClient.get<{
      success?: boolean;
      data?: { mesajda_kullanilacak_banka_ids?: number[] };
    }>('/ayarlar/gonderim');
    const ids = gon.data?.data?.mesajda_kullanilacak_banka_ids;
    const bankaIds = Array.isArray(ids) ? ids : [];
    if (bankaIds.length === 0) return '';

    const bankRes = await apiClient.get<{
      success?: boolean;
      data?: Array<{
        id: number;
        banka_adi?: string;
        iban?: string;
        sube?: string;
        hesap_sahibi?: string;
      }>;
    }>('/ayarlar/fatura/banka-hesaplari');
    const tumHesaplar = bankRes.data?.data ?? [];
    const secilenler = tumHesaplar.filter((b) => bankaIds.includes(b.id));

    const satirlar: string[] = [];
    secilenler.forEach((b) => {
      const ad = (b.banka_adi || '').trim();
      const iban = (b.iban || '').trim();
      const subeSahibi = [b.sube, b.hesap_sahibi].filter(Boolean).join(' · ').trim();
      if (ad || iban) {
        if (ad) satirlar.push(`*${ad}*`);
        if (iban) satirlar.push(`IBAN: ${iban}`);
        if (subeSahibi) satirlar.push(subeSahibi);
        satirlar.push('');
      }
    });
    const bankaMetni = satirlar.join('\n').trimEnd();
    if (!bankaMetni) return '';

    return (
      '-----------------------\n' +
      bankaMetni +
      '\n-----------------------\n\n' +
      '_Lütfen EFT/Havale işlemi açıklamasına isminizi ve sipariş detayını yazınız._'
    );
  } catch {
    return '';
  }
}
