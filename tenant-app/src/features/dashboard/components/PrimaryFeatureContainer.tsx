/**
 * Primary Feature Container Component
 * Plan kontrolüne göre reklam veya araç takip alanını gösterir
 */

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { AdArea } from './AdArea';
import { VehicleTrackingArea } from './VehicleTrackingArea';

export const PrimaryFeatureContainer: React.FC = () => {
  const [isBaslangicPlan, setIsBaslangicPlan] = useState<boolean | null>(null);
  // ✅ KRİTİK: Varsayılan olarak araç takip göster (loading false), plan kontrolü arka planda yapılsın
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkPlan = async () => {
      try {
        // Tenant bilgisini al
        const tenantCode = localStorage.getItem('floovon_tenant_code') ||
                          localStorage.getItem('tenant_code') || 
                          localStorage.getItem('remembered_tenant_code') ||
                          new URLSearchParams(window.location.search).get('tenant');
        
        let tenantId = null;
        if (!tenantCode) {
          const userStr = localStorage.getItem('floovon_user') || localStorage.getItem('user');
          if (userStr) {
            try {
              const user = JSON.parse(userStr);
              tenantId = user.tenant_id || localStorage.getItem('floovon_tenant_id');
            } catch (e) {
              // User parse hatası
            }
          }
        }

        if (!tenantCode && !tenantId) {
          // Tenant bilgisi yoksa varsayılan olarak araç takip göster
          setIsBaslangicPlan(false);
          return;
        }

        // Plan bilgisini kontrol et - eski sistemdeki gibi /public/subscription endpoint'ini kullan
        const subscriptionUrl = tenantCode 
          ? `/public/subscription?tenant_code=${tenantCode}`
          : `/public/subscription?tenant_id=${tenantId}`;
        
        const response = await apiClient.get(subscriptionUrl);
        const data = response.data;
        
        if (data.success && data.data && data.data.plan_id) {
          // plan_id === 1 ise başlangıç paketi
          setIsBaslangicPlan(data.data.plan_id === 1);
        } else {
          // Plan bilgisi alınamazsa varsayılan olarak araç takip göster
          setIsBaslangicPlan(false);
        }
      } catch (error) {
        // Hata durumunda varsayılan olarak araç takip göster (console'a yazma, gereksiz log)
        setIsBaslangicPlan(false);
      }
    };

    checkPlan();
  }, []);

  // ✅ KRİTİK: Varsayılan olarak VehicleTrackingArea göster, plan kontrolü tamamlandığında gerekirse AdArea'ya geç
  return (
    <div id="primaryFeatureContainer">
      {isBaslangicPlan === true ? <AdArea /> : <VehicleTrackingArea />}
    </div>
  );
};

