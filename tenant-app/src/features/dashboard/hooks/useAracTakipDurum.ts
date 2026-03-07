/**
 * Mevcut kullanıcının araç takip durumu (teslimatta mı)
 * Mobil header'da ikon rengi ve tıklanınca bilgi/başlat ayrımı için kullanılır.
 */

import { useState, useEffect, useCallback } from 'react';
import { getAracTakipDurumu, type AracTakipDurumResponse } from '../api/aracTakip';

export function useAracTakipDurum(enabled: boolean) {
  const [durum, setDurum] = useState<AracTakipDurumResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDurum = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await getAracTakipDurumu();
      setDurum(data || { durum: 'beklemede' });
    } catch {
      setDurum({ durum: 'beklemede' });
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchDurum();
    if (!enabled) return;
    const interval = setInterval(fetchDurum, 15000);
    return () => clearInterval(interval);
  }, [enabled, fetchDurum]);

  const isOnDelivery = durum?.durum === 'teslimatta';

  return { durum, isOnDelivery, loading, refetch: fetchDurum };
}
