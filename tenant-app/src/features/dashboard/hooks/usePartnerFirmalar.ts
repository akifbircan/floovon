/**
 * Partner firma listesini yükler (sipariş formunda "Partner firma seçin" için)
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';

export interface PartnerFirma {
  id: number;
  partner_firma_adi?: string;
  partner_telefon?: string;
  partner_eposta?: string;
  partner_acik_adres?: string;
}

export function usePartnerFirmalar() {
  const [partnerFirmalar, setPartnerFirmalar] = useState<PartnerFirma[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['partner-firmalar'],
    queryFn: async () => {
      try {
        const response = await apiRequest<unknown>('/partner-firmalar');
        const list = Array.isArray(response)
          ? response
          : (response && typeof response === 'object' && 'data' in response && Array.isArray((response as { data: any[] }).data))
            ? (response as { data: any[] }).data
            : [];
        const listMapped: PartnerFirma[] = list.map((p: any) => ({
          id: p.id,
          partner_firma_adi: p.partner_firma_adi ?? p.firma_adi,
          partner_telefon: p.partner_telefon ?? p.firma_tel,
          partner_eposta: p.partner_eposta ?? p.firma_email,
          partner_acik_adres: p.partner_acik_adres ?? p.firma_adres,
        }));
        setPartnerFirmalar(listMapped);
        return listMapped;
      } catch (error) {
        console.error('Partner firmalar yükleme hatası:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (data) setPartnerFirmalar(data);
  }, [data]);

  return { partnerFirmalar, isLoading };
}
