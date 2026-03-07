/**
 * Teslim saati uyarısı hook'u
 * Bir teslim saati için kalan süreyi hesaplar ve uyarı durumunu döndürür
 */

import { useMemo, useEffect, useState } from 'react';

export interface DeliveryTimeWarning {
  kalanSure: number; // dakika cinsinden
  durum: 'gecikti' | 'uyari' | 'normal';
  mesaj: string;
}

/**
 * Teslim saati için uyarı durumunu hesapla
 * ✅ DÜZELTME: Sadece bugünün siparişleri için uyarı göster
 */
export function useDeliveryTimeWarning(
  teslimSaati: string | null | undefined,
  teslimTarih?: string | Date | null | undefined
): DeliveryTimeWarning | null {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Her dakika güncelle
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return useMemo(() => {
    if (!teslimSaati) return null;

    // ✅ KRİTİK: Teslim tarihi verilmişse, sadece bugünün siparişleri için uyarı göster
    if (teslimTarih) {
      const teslimTarihObj = teslimTarih instanceof Date ? teslimTarih : new Date(teslimTarih);
      const bugun = new Date();
      
      // Tarihleri sadece gün/ay/yıl olarak karşılaştır (saat bilgisi olmadan)
      const teslimTarihString = `${teslimTarihObj.getFullYear()}-${String(teslimTarihObj.getMonth() + 1).padStart(2, '0')}-${String(teslimTarihObj.getDate()).padStart(2, '0')}`;
      const bugunString = `${bugun.getFullYear()}-${String(bugun.getMonth() + 1).padStart(2, '0')}-${String(bugun.getDate()).padStart(2, '0')}`;
      
      // Bugün değilse uyarı gösterme
      if (teslimTarihString !== bugunString) {
        return null;
      }
    }

    // Saati parse et
    const saatParcalari = teslimSaati.split(':');
    if (saatParcalari.length < 2) return null;

    const teslimZamani = new Date();
    teslimZamani.setHours(parseInt(saatParcalari[0]));
    teslimZamani.setMinutes(parseInt(saatParcalari[1]));
    teslimZamani.setSeconds(0);

    const kalanSure = Math.floor((teslimZamani.getTime() - currentTime.getTime()) / (1000 * 60));

    if (kalanSure < 0) {
      return {
        kalanSure: 0,
        durum: 'gecikti',
        mesaj: 'TESLİM SAATİ GEÇTİ!',
      };
    } else if (kalanSure <= 60) {
      return {
        kalanSure,
        durum: 'uyari',
        mesaj: `${kalanSure} DK KALDI`,
      };
    } else {
      const kalanSaatler = Math.floor(kalanSure / 60);
      const kalanDakikalar = kalanSure % 60;
      return {
        kalanSure,
        durum: 'normal',
        mesaj: `${String(kalanSaatler).padStart(2, '0')} SA : ${String(kalanDakikalar).padStart(2, '0')} DK`,
      };
    }
  }, [teslimSaati, teslimTarih, currentTime]);
}

