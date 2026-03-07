/**
 * Vehicle Tracking Area Component
 * Araç takip alanı - Tamamen React ile
 * Teslimatta aktif vehicle-item tıklanınca detay popup açılır.
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Van, MapPin } from 'lucide-react';
import { useVehicleTracking, type Vehicle } from '../hooks/useVehicleTracking';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';

const VehicleDetailModal = lazy(() => import('./VehicleDetailModal').then((m) => ({ default: m.VehicleDetailModal })));

export const VehicleTrackingArea: React.FC = () => {
  const {
    vehicles,
    isLoading,
    totalCount,
    activeCount,
    driverName,
    truncateText,
    getAddressFromCoordinates,
  } = useVehicleTracking();

  const [detailVehicle, setDetailVehicle] = useState<Vehicle | null>(null);
  const [locationTexts, setLocationTexts] = useState<Record<string, string>>({});
  
  // ✅ KRİTİK: vehicles array'inin içeriğini takip et - referans değişikliği yerine içerik değişikliğini kontrol et
  const vehiclesKeyRef = React.useRef<string>('');
  const isProcessingRef = React.useRef<boolean>(false);

  // ✅ KRİTİK: vehicles array'inin içeriğini string'e çevir (ID ve konum bilgileri)
  const vehiclesKey = React.useMemo(() => {
    return vehicles.map(v => {
      const id = (v.id || v.arac_id || '').toString();
      const lat = v.konum_lat?.toString() || '';
      const lng = v.konum_lng?.toString() || '';
      const konumAdi = v.konum_adi || '';
      const durum = (v.durum || v.arac_durum || '').toString();
      return `${id}:${lat}:${lng}:${konumAdi}:${durum}`;
    }).join('|');
  }, [vehicles]);

  // ✅ KRİTİK: Konum adreslerini al - sadece vehicles içeriği değiştiğinde çalış
  useEffect(() => {
    // ✅ KRİTİK: Eğer içerik değişmediyse, hiçbir şey yapma
    if (vehiclesKey === vehiclesKeyRef.current) {
      return;
    }
    
    vehiclesKeyRef.current = vehiclesKey;

    // Eğer araç yoksa, locationTexts'i temizle
    if (vehicles.length === 0) {
      setLocationTexts({});
      return;
    }

    // ✅ KRİTİK: Eğer zaten işlem yapılıyorsa, yeni işlem başlatma
    if (isProcessingRef.current) {
      return;
    }

    // Debounce + koordinattan yer adı (reverse geocoding) – sıralı istek, 429 önlemek için arada bekle
    const timeoutId = setTimeout(async () => {
      isProcessingRef.current = true;
      const newLocationTexts: Record<string, string> = {};

      for (const vehicle of vehicles) {
        const vehicleId = (vehicle.id || vehicle.arac_id || '').toString();
        const durum = (vehicle.durum || vehicle.arac_durum || '').toString().toLowerCase().trim();
        const isActiveFromDB =
          vehicle.is_active !== undefined
            ? vehicle.is_active === 1 || vehicle.is_active === true || vehicle.is_active === '1'
            : true;
        const isActive = durum === 'teslimatta' && isActiveFromDB;

        if (isActive) {
          const konumAdi = (vehicle.konum_adi || '').trim();
          const isKoordinatFormat =
            /^\d+\.?\d*\s*,\s*\d+\.?\d*$/.test(konumAdi) ||
            /^\d+\.?\d*\s*°/.test(konumAdi) ||
            /^\d+\.?\d*,\s*\d+\.?\d*$/.test(konumAdi);

          if (konumAdi && !isKoordinatFormat) {
            newLocationTexts[vehicleId] = konumAdi;
          } else if (vehicle.konum_lat != null && vehicle.konum_lng != null) {
            const lat = parseFloat(vehicle.konum_lat.toString());
            const lng = parseFloat(vehicle.konum_lng.toString());
            if (!isNaN(lat) && !isNaN(lng)) {
              try {
                const adres = await getAddressFromCoordinates(lat, lng);
                newLocationTexts[vehicleId] = adres || 'Konum bilgisi yok';
              } catch {
                newLocationTexts[vehicleId] = 'Konum bilgisi yok';
              }
              await new Promise(r => setTimeout(r, 400));
            } else {
              newLocationTexts[vehicleId] = 'Konum bilgisi yok';
            }
          } else {
            newLocationTexts[vehicleId] = 'Konum bilgisi yok';
          }
        } else {
          newLocationTexts[vehicleId] = 'Teslimatta değil';
        }
      }

      setLocationTexts(prev => {
        const prevKey = Object.keys(prev).sort().map(k => `${k}:${prev[k]}`).join('|');
        const newKey = Object.keys(newLocationTexts).sort().map(k => `${k}:${newLocationTexts[k]}`).join('|');
        if (prevKey === newKey) return prev;
        return newLocationTexts;
      });
      isProcessingRef.current = false;
    }, 2000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [vehiclesKey, vehicles.length, getAddressFromCoordinates]);

  const handleVehicleClick = (vehicle: Vehicle) => {
    const durum = (vehicle.durum || vehicle.arac_durum || '').toString().toLowerCase().trim();
    const isActiveFromDB =
      vehicle.is_active !== undefined
        ? vehicle.is_active === 1 || vehicle.is_active === true || vehicle.is_active === '1'
        : true;
    const isActive = durum === 'teslimatta' && isActiveFromDB;

    if (isActive) {
      setDetailVehicle(vehicle);
    }
  };

  return (
    <>
    <div className="multi-arac-wrapper" id="multiVehicle">
      <div className="multi-header">
        <div className="multi-title-wrapper">
          <div className="multi-title-icon">
            <Van size={20} className="vehicle-tracking-lucide-icon" aria-hidden />
          </div>
          <div className="multi-title-content">
            <h3 className="multi-title">Araç Takibi</h3>
            <div className="multi-title-count" id="multiTitleCount">
              {totalCount} Araç
            </div>
          </div>
        </div>
        <div className={`active-vehicles-info ${activeCount > 0 ? 'has-active' : ''}`}>
          <div className="active-dot"></div>
          <span className="active-text" id="activeVehiclesCount">
            {activeCount} Aktif
          </span>
        </div>
      </div>
      <div className="vehicle-list">
        {isLoading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <LoadingSpinner size="sm" />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="no-vehicle-message" style={{ padding: '20px', textAlign: 'center', color: 'var(--gray-classic)' }}>
            <i className="fa-solid fa-car" style={{ fontSize: '32px', marginBottom: '10px', opacity: 0.3 }}></i>
            <p style={{ marginTop: '10px', fontSize: '14px', lineHeight: '1.5' }}>
              Herhangi bir araç eklenmemiş. Araç eklemek için Ayarlar &gt; Araç Takip ayarlarından yeni araç ekleyebilirsiniz.
            </p>
          </div>
        ) : (
          vehicles.map((vehicle) => {
            const vehicleId = (vehicle.id || vehicle.arac_id || '').toString();
            const durum = (vehicle.durum || vehicle.arac_durum || '').toString().toLowerCase().trim();
            const isActiveFromDB =
              vehicle.is_active !== undefined
                ? vehicle.is_active === 1 || vehicle.is_active === true || vehicle.is_active === '1'
                : true;
            const isActive = durum === 'teslimatta' && isActiveFromDB;
            const durumClass = isActive ? 'status-active' : 'status-inactive';
            const durumText = isActive ? 'Aktif' : 'Beklemede';
            const surucuBilgisi = isActive ? driverName : 'Henüz sürücü atanmadı';
            const konumText = locationTexts[vehicleId] || 'Teslimatta değil';

            return (
              <div
                key={vehicleId}
                className="vehicle-item"
                data-arac-id={vehicleId}
                data-plaka={vehicle.plaka}
                data-durum={durum}
                data-konum-lat={vehicle.konum_lat}
                data-konum-lng={vehicle.konum_lng}
                style={{ cursor: isActive ? 'pointer' : 'default' }}
                onClick={() => handleVehicleClick(vehicle)}
              >
                <div className="vehicle-main-info">
                  <div className="vehicle-plate">
                    <div className="plate-icon">
                      <Van size={14} className="vehicle-tracking-lucide-icon" aria-hidden />
                    </div>
                    <span className="plate-number">{vehicle.plaka || 'Plaka yok'}</span>
                  </div>
                  <div className={`vehicle-status ${durumClass}`}>{durumText}</div>
                </div>
                <div className="vehicle-driver">{surucuBilgisi}</div>
                <div className="vehicle-location">
                  <MapPin size={12} className="vehicle-location-icon" aria-hidden />
                  <span>{truncateText(konumText)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>

    {detailVehicle && (
      <Suspense fallback={null}>
        <VehicleDetailModal
          open={!!detailVehicle}
          vehicle={detailVehicle}
          driverName={driverName}
          onClose={() => setDetailVehicle(null)}
        />
      </Suspense>
    )}
    </>
  );
};

