/**
 * Primary Feature Container Component
 * Plan kontrolüne göre reklam veya araç takip alanını gösterir.
 * usePlan() kullanır – admin plan değiştirdiğinde 30 sn içinde güncellenir.
 */

import React from 'react';
import { usePlan } from '@/app/providers/PlanProvider';
import { AdArea } from './AdArea';
import { VehicleTrackingArea } from './VehicleTrackingArea';

export const PrimaryFeatureContainer: React.FC = () => {
  const { isBaslangicPlan } = usePlan();

  // Plan yüklenirken varsayılan araç takip; plan_id=1 (Başlangıç) ise reklam alanı
  return (
    <div id="primaryFeatureContainer">
      {isBaslangicPlan === true ? <AdArea /> : <VehicleTrackingArea />}
    </div>
  );
};

