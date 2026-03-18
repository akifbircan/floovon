/**
 * Araç detay popup state'i — VehicleTrackingArea dışında tutulur.
 * Böylece sağ panel / plan / liste yeniden render olsa bile popup anında kapanmaz.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { VehicleDetailModal } from '../components/VehicleDetailModal';

export type VehicleDetailPayload = {
  id?: number;
  arac_id?: number;
  plaka: string;
  durum?: string;
  arac_durum?: string;
  is_active?: number | boolean | string;
  konum_lat?: string | number;
  konum_lng?: string | number;
  konum_adi?: string;
};

type Ctx = {
  openVehicleDetail: (vehicle: VehicleDetailPayload, driverName: string) => void;
  closeVehicleDetail: () => void;
};

const VehicleDetailModalContext = createContext<Ctx | null>(null);

export function VehicleDetailModalProvider({ children }: { children: React.ReactNode }) {
  const [payload, setPayload] = useState<{ vehicle: VehicleDetailPayload; driverName: string } | null>(null);

  const openVehicleDetail = useCallback((vehicle: VehicleDetailPayload, driverName: string) => {
    setPayload({ vehicle, driverName });
  }, []);

  const closeVehicleDetail = useCallback(() => {
    setPayload(null);
  }, []);

  const value = useMemo(
    () => ({ openVehicleDetail, closeVehicleDetail }),
    [openVehicleDetail, closeVehicleDetail]
  );

  return (
    <VehicleDetailModalContext.Provider value={value}>
      {children}
      {payload ? (
        <VehicleDetailModal
          open
          vehicle={payload.vehicle}
          driverName={payload.driverName}
          onClose={closeVehicleDetail}
        />
      ) : null}
    </VehicleDetailModalContext.Provider>
  );
}

export function useVehicleDetailModal(): Ctx {
  const ctx = useContext(VehicleDetailModalContext);
  if (!ctx) {
    return {
      openVehicleDetail: () => {},
      closeVehicleDetail: () => {},
    };
  }
  return ctx;
}
