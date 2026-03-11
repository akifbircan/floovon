/**
 * Araç detay popup – teslimatta aktif vehicle-item tıklanınca açılır
 * Eski sistemdeki showVehicleDetail / vehicleDetailOverlay davranışının React karşılığı
 * Canlı harita: Leaflet ile OpenStreetMap (eski yapıdaki gibi)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalOpenAnimation } from '../../../shared/hooks/useModalOpenAnimation';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiRequest } from '../../../lib/api';
import { Van } from 'lucide-react';

/** Araç detay modalında kullanılan minimal araç tipi (useVehicleTracking ile döngüyü önlemek için yerel) */
interface VehicleDetailVehicle {
  id?: number;
  arac_id?: number;
  plaka: string;
  durum?: string;
  arac_durum?: string;
  is_active?: number | boolean | string;
  konum_lat?: string | number;
  konum_lng?: string | number;
  konum_adi?: string;
}

// Haversine mesafe (km)
function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function getAddressFromCoords(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(
      `/api/geocoding/reverse?lat=${lat}&lng=${lng}&zoom=18&addressdetails=1`
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.success && data?.data) {
      if (data.data.address && typeof data.data.address === 'string') return data.data.address;
      if (data.data.raw?.display_name) return data.data.raw.display_name;
    }
    if (data?.display_name) return data.display_name;
    return null;
  } catch {
    return null;
  }
}

export interface VehicleDetailData {
  plateNumber: string;
  driverName: string;
  aracBilgisi: string | null;
  status: string;
  speed: string;
  location: string;
  coords: string;
  lastUpdate: string;
  distance: string;
  lat: number | null;
  lng: number | null;
}

interface VehicleDetailModalProps {
  open: boolean;
  vehicle: VehicleDetailVehicle | null;
  driverName: string;
  onClose: () => void;
}

export const VehicleDetailModal: React.FC<VehicleDetailModalProps> = ({
  open,
  vehicle,
  driverName,
  onClose,
}) => {
  const [detail, setDetail] = useState<VehicleDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useModalOpenAnimation(open, overlayRef, panelRef);

  const vehicleId = vehicle ? String(vehicle.id ?? vehicle.arac_id ?? '') : '';
  const isActive =
    vehicle &&
    (vehicle.durum || vehicle.arac_durum || '').toString().toLowerCase().trim() === 'teslimatta' &&
    (vehicle.is_active === 1 || vehicle.is_active === true || vehicle.is_active === '1' || vehicle.is_active == null);

  const fetchDetail = useCallback(async (v: VehicleDetailVehicle): Promise<VehicleDetailData> => {
    const id = String(v.id ?? v.arac_id ?? '');
    let lat: number | null = v.konum_lat != null ? parseFloat(String(v.konum_lat)) : null;
    let lng: number | null = v.konum_lng != null ? parseFloat(String(v.konum_lng)) : null;
    let speed = '0';
    let lastUpdate = '--';
    let konumAdi = (v.konum_adi || '').trim();

    if (id) {
      try {
        const loc = await apiRequest<Record<string, unknown>>(`/arac-takip/${id}/konum`, { method: 'GET' });
        if (loc) {
          const latitude = loc.latitude ?? loc.enlem ?? loc.lat;
          const longitude = loc.longitude ?? loc.boylam ?? loc.lng ?? (loc as { lon?: number }).lon;
          if (latitude != null) lat = parseFloat(String(latitude));
          if (longitude != null) lng = parseFloat(String(longitude));
          speed = loc.hiz != null ? String(Math.round(Number(loc.hiz))) : '0';
          konumAdi = (loc.konum_adi as string) || konumAdi;
          const kayitZamani = loc.kayit_zamani ?? loc.timestamp ?? loc.son_guncelleme ?? loc.guncelleme_zamani;
          if (kayitZamani) {
            const date = new Date(String(kayitZamani));
            if (!isNaN(date.getTime())) {
              const sec = Math.floor((Date.now() - date.getTime()) / 1000);
              if (sec < 60) lastUpdate = 'Az önce';
              else if (sec < 3600) lastUpdate = `${Math.floor(sec / 60)} dk önce`;
              else lastUpdate = `${Math.floor(sec / 3600)} saat önce`;
            }
          }
        }
      } catch {
        // use existing lat/lng from vehicle
      }
    }

    const isKonumAdiCoord =
      /^\d+\.?\d*\s*,\s*\d+\.?\d*$/.test(konumAdi) ||
      /^\d+\.?\d*\s*°/.test(konumAdi) ||
      /^\d+\.?\d*,\s*\d+\.?\d*$/.test(konumAdi);
    let displayLocation: string =
      konumAdi && !isKonumAdiCoord ? konumAdi : '';

    if (!displayLocation && lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
      const addr = await getAddressFromCoords(lat, lng);
      displayLocation = addr || `${lat.toFixed(4)}° K, ${lng.toFixed(4)}° D`;
    }
    if (!displayLocation) displayLocation = 'Konum bilgisi yok';

    let distance = '0.00';
    try {
      const teslimatData = localStorage.getItem('teslimatDurum');
      if (teslimatData && id) {
        const veri = JSON.parse(teslimatData);
        if (veri.baslangicZamani && String(veri.aracId) === id && veri.durum === 'aktif') {
          const url = `/arac-takip/${id}/gecmis?baslangic=${encodeURIComponent(veri.baslangicZamani)}&limit=1000` +
            (veri.teslimatId ? `&teslimat_id=${veri.teslimatId}` : '');
          const res = await apiRequest<Record<string, unknown>[] | { success?: boolean; data?: Record<string, unknown>[] }>(url, { method: 'GET' });
          const list = Array.isArray(res) ? res : (res && (res as { data?: unknown[] }).data && Array.isArray((res as { data: unknown[] }).data)) ? (res as { data: Record<string, unknown>[] }).data : [];
          const sorted = [...list].sort((a, b) => {
            const tA = new Date(String(a.kayit_zamani ?? a.created_at ?? a.timestamp ?? 0)).getTime();
            const tB = new Date(String(b.kayit_zamani ?? b.created_at ?? b.timestamp ?? 0)).getTime();
            return tA - tB;
          });
          const start = new Date(veri.baslangicZamani).getTime();
          const points = sorted.filter((k) => new Date(String(k.kayit_zamani ?? k.created_at ?? k.timestamp ?? 0)).getTime() >= start);
          let total = 0;
          for (let i = 1; i < points.length; i++) {
            const p1 = points[i - 1];
            const p2 = points[i];
            const lat1 = Number(p1.latitude ?? p1.enlem);
            const lon1 = Number(p1.longitude ?? p1.boylam);
            const lat2 = Number(p2.latitude ?? p2.enlem);
            const lon2 = Number(p2.longitude ?? p2.boylam);
            if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
              total += haversineKm(lat1, lon1, lat2, lon2);
            }
          }
          distance = total.toFixed(2);
        }
      }
    } catch {
      distance = '0.00';
    }

    let aracBilgisi: string | null = null;
    if (id) {
      try {
        const arac = await apiRequest<{ marka?: string; model?: string }>(`/araclar/${id}`, { method: 'GET' });
        const d = arac && typeof arac === 'object' ? arac : null;
        if (d && (d.marka || d.model)) {
          aracBilgisi = [d.marka, d.model].filter(Boolean).join(' ').trim();
        }
      } catch {
        // ignore
      }
    }

    const coords =
      lat != null && lng != null && !isNaN(lat) && !isNaN(lng)
        ? `${lat.toFixed(4)}° K, ${lng.toFixed(4)}° D`
        : '--';

    return {
      plateNumber: v.plaka || '--',
      driverName: driverName || '--',
      aracBilgisi,
      status: 'Aktif',
      speed: speed ? `${speed} km/h` : '--',
      location: displayLocation,
      coords,
      lastUpdate,
      distance: distance ? `${distance} km` : '--',
      lat,
      lng,
    };
  }, []);

  useEffect(() => {
    if (!open || !vehicle || !isActive) {
      setDetail(null);
      setError(null);
      return;
    }
    setError(null);
    setLoading(true);
    setDetail(null);
    fetchDetail(vehicle)
      .then(setDetail)
      .catch(() => setError('Detay yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [open, vehicleId, isActive, fetchDetail, vehicle]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const hasValidCoords =
    detail?.lat != null && detail?.lng != null && !isNaN(detail.lat) && !isNaN(detail.lng);
  const mapCenter: [number, number] = hasValidCoords ? [detail!.lat!, detail!.lng!] : [39.93, 32.85];

  const vehicleMarkerIcon = L.divIcon({
    className: 'vehicle-detail-marker',
    html: '<div style="width:24px;height:24px;background:#e53e3e;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  if (!open) return null;

  const modalContent = (
    <div
      ref={overlayRef}
      className="vehicle-detail-overlay overlay-arac-takip-detay active"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vehicle-detail-title"
      onClick={handleOverlayClick}
    >
      <div ref={panelRef} className="vehicle-detail-modal detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="vehicle-detail-modal-header modal-header">
          <div className="vehicle-detail-modal-title modal-title">
            <div className="vehicle-icon vehicle-icon-lucide">
              <Van size={24} strokeWidth={2} className="vehicle-tracking-lucide-icon" aria-hidden />
            </div>
            <div className="title-vehicle-info">
              <div id="vehicle-detail-plate" className="vehicle-detail-plate">
                {detail?.plateNumber ?? vehicle?.plaka ?? '--'}
                {detail?.aracBilgisi && (
                  <small>{detail.aracBilgisi}</small>
                )}
              </div>
              <div id="vehicle-detail-driver" className="vehicle-detail-driver">
                {detail?.driverName ?? driverName ?? '--'}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            aria-label="Kapat"
          >
            <i className="icon-btn-kapat" aria-hidden />
          </button>
        </div>

        <div className="vehicle-detail-modal-content modal-content">
          {loading && (
            <div className="vehicle-detail-loading">
              <i className="fa-solid fa-spinner fa-spin" aria-hidden />
              <span>Yükleniyor...</span>
            </div>
          )}
          {error && (
            <div className="vehicle-detail-error">
              <i className="fa-solid fa-exclamation-circle" aria-hidden />
              <span>{error}</span>
            </div>
          )}
          {!loading && !error && detail && (
            <>
              <div className="vehicle-detail-map-section map-section">
                <div className="vehicle-detail-map-label">Canlı Konum Takibi</div>
                <div className="vehicle-detail-map-container map-container">
                  {hasValidCoords ? (
                    <MapContainer
                      center={mapCenter}
                      zoom={15}
                      style={{ height: '100%', width: '100%' }}
                      zoomControl={true}
                      attributionControl={false}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        maxZoom={19}
                      />
                      <Marker position={mapCenter} icon={vehicleMarkerIcon}>
                        <Popup>Araç konumu</Popup>
                      </Marker>
                    </MapContainer>
                  ) : (
                    <div className="vehicle-detail-map-placeholder">
                      <i className="fa-solid fa-map-location-dot" aria-hidden />
                      <span>Konum bilgisi yok</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="vehicle-detail-location-section location-section">
                <div className="location-header">
                  <span className="location-title">Güncel Konum</span>
                </div>
                <div className="vr" />
                <div className="location-info-wrapper">
                  <div className="location-address" id="detailLocation">
                    {detail.location}
                  </div>
                  <div className="location-coords">{detail.coords}</div>
                </div>
              </div>

              <div className="detail-info-grid vehicle-detail-info-grid">
                <div className="detail-info-card">
                  <div className="info-icon"><i className="fa-solid fa-traffic-light" aria-hidden /></div>
                  <div className="detail-info-label">Durum</div>
                  <div className="detail-info-value status-active-detail">{detail.status}</div>
                </div>
                <div className="detail-info-card">
                  <div className="info-icon"><i className="fa-solid fa-gauge-simple-high" aria-hidden /></div>
                  <div className="detail-info-label">Hız</div>
                  <div className="detail-info-value">{detail.speed}</div>
                </div>
                <div className="detail-info-card">
                  <div className="info-icon"><i className="fa-solid fa-clock" aria-hidden /></div>
                  <div className="detail-info-label">Son Güncelleme</div>
                  <div className="detail-info-value">{detail.lastUpdate}</div>
                </div>
                <div className="detail-info-card">
                  <div className="info-icon"><i className="fa-solid fa-road" aria-hidden /></div>
                  <div className="detail-info-label">Kat Edilen Mesafe</div>
                  <div className="detail-info-value">{detail.distance}</div>
                </div>
              </div>

              <div className="modal-actions vehicle-detail-actions">
                <button type="button" className="action-btn btn-secondary" onClick={onClose}>
                  KAPAT
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
































