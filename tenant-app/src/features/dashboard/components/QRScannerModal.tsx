import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalOpenAnimation } from '../../../shared/hooks/useModalOpenAnimation';
import { buildAddressForMapsQuery } from '../../../shared/utils/formatUtils';
import { formatDateToDisplay } from '../../../shared/utils/dateUtils';
import type { Order } from '../types';

// html5-qrcode CDN'den yükleniyor (index.html'de)
declare global {
  interface Window {
    Html5Qrcode: {
      new (elementId: string): {
        start: (config: unknown, options: unknown, onScan: (decodedText: string) => void | Promise<void>) => Promise<void>;
        stop: () => Promise<void>;
      };
      getCameras(): Promise<{ id: string; label?: string }[]>;
    };
  }
}

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (order: Order) => void;
  onScanError?: (error: string) => void;
}

const LAST_DEVICE_KEY = 'qr_last_device_id';

/**
 * QR Scanner Modal Component
 * html5-qrcode kütüphanesi ile kamera üzerinden QR kod okuma
 */
export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  onScanError,
}) => {
  const scannerRef = useRef<any | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const hasAnimatedOpen = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedOrder, setScannedOrder] = useState<Order | null>(null);
  const [orderDetails, setOrderDetails] = useState<{
    teslimKisi?: string;
    urun?: string;
    adres?: string;
    tarihSaat?: string;
    mapsUrl?: string;
    detayUrl?: string;
    teslimTel?: string;
    sipVerenTel?: string;
  } | null>(null);
  const [manualOrderId, setManualOrderId] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  // API cevabı snake_case veya camelCase olabilir; tek bir obje ile detay üret
  const orderToDetails = (o: Order | Record<string, unknown>) => {
    const raw = o as Record<string, unknown>;
    const teslimKisi = (raw.teslimKisisi ?? raw.teslim_kisisi ?? '-') as string;
    const urun = (raw.urun ?? raw.siparis_urun ?? '-') as string;
    // Tarih: önce sipariş, yoksa organizasyon kartı
    const tarih = (raw.teslim_tarih ?? raw.organizasyon_teslim_tarih ?? raw.tarih ?? '') as string;
    // Saat: önce sipariş, yoksa organizasyon kartı
    const teslimSaati = (raw.teslim_saat ?? raw.organizasyon_teslim_saat ?? raw.teslimSaati ?? '') as string;
    const orgId = (raw.organizasyon_id ?? raw.organizasyon_kart_id ?? raw.id) as string | number;
    const teslimTel = (raw.teslimKisisiTelefon ?? raw.teslim_kisisi_telefon) as string | undefined;
    const sipVerenTel = (raw.telefon ?? raw.siparis_veren_telefon) as string | undefined;

    const adresForDisplayAndMaps = buildAddressForMapsQuery(raw);
    const mapsUrl = adresForDisplayAndMaps
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresForDisplayAndMaps)}`
      : undefined;

    const getStr = (k: string) => ((raw[k] ?? (raw as Record<string, unknown>)[k]) ?? '') as string;
    const trimStr = (s: string) => (s || '').trim();
    const teslimatKonumu = trimStr(getStr('organizasyon_teslimat_konumu') || getStr('teslimat_konumu') || '');
    const ilce = trimStr(getStr('teslim_ilce') || getStr('organizasyon_ilce') || getStr('ilce') || '');
    const mahalle = trimStr(getStr('teslim_mahalle') || getStr('org_mahalle') || getStr('mahalle') || '');
    const acikAdres = trimStr(getStr('acik_adres') || getStr('acikAdres') || getStr('org_acik_adres') || getStr('teslim_acik_adres') || '');
    const adresParts = teslimatKonumu
      ? [teslimatKonumu, ilce].filter(Boolean)
      : [mahalle, acikAdres, ilce].filter(Boolean);
    const adresDisplay = adresParts.length ? adresParts.join(', ') : undefined;

    const tarihRaw = (tarih || '').toString().trim();
    const saatStr = (teslimSaati || '').toString().trim();
    const tarihFormatted = formatDateToDisplay(tarihRaw || null) || tarihRaw;
    const tarihSaatDisplay =
      tarihFormatted && saatStr
        ? `${tarihFormatted} • ${saatStr}`
        : tarihFormatted || saatStr || '-';

    return {
      teslimKisi: teslimKisi || '-',
      urun: urun || '-',
      adres: adresDisplay || adresForDisplayAndMaps || '-',
      tarihSaat: tarihSaatDisplay,
      mapsUrl,
      detayUrl: `/siparis-kart-detay/${orgId ?? o.id}`,
      teslimTel,
      sipVerenTel,
    };
  };

  // Masaüstünde kamera yokken sipariş ID ile popup içeriğini göster (test için)
  const handleManualLookup = async () => {
    const id = manualOrderId.trim();
    if (!id) return;
    setManualLoading(true);
    setError(null);
    try {
      const { scanQRCode } = await import('../api/qrScan');
      const order = await scanQRCode(id);
      if (order) {
        setScannedOrder(order as Order);
        setOrderDetails(orderToDetails(order));
        // Manuel testte modal açık kalsın; onScanSuccess çağrılmaz, böylece popup içeriği görünür
      } else {
        setError('Bu ID ile sipariş bulunamadı.');
      }
    } catch (err: any) {
      setError(err?.message || 'Sipariş yüklenirken hata oluştu.');
    } finally {
      setManualLoading(false);
    }
  };

  // Scanner'ı güvenli şekilde durdur
  const stopScannerSafely = async () => {
    if (!scannerRef.current) return;

    try {
      await scannerRef.current.stop();
    } catch (err: any) {
      // Scanner zaten durmuş, başlatılmamış veya başka bir durumda olabilir
      const errorMsg = err?.message?.toLowerCase() || '';
      if (
        !errorMsg.includes('not running') &&
        !errorMsg.includes('not started') &&
        !errorMsg.includes('not paused') &&
        !errorMsg.includes('scanner is not running')
      ) {
        // Beklenmeyen hata
      }
    }

    try {
      scannerRef.current.clear();
    } catch (err) {
      // clear() hatası önemli değil, sessizce devam et
    }

    scannerRef.current = null;
  };

  // Modal açıldığında scanner'ı başlat; kapatılınca resetle
  useEffect(() => {
    if (!isOpen) {
      stopScannerSafely();
      setScannedOrder(null);
      setOrderDetails(null);
      setError(null);
      setManualOrderId('');
      return;
    }

    const startScanner = async () => {
      // HTTPS veya localhost kontrolü
      const isSecure =
        location.protocol === 'https:' ||
        location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1';

      if (!isSecure) {
        const errorMsg = 'Kamera için sayfayı HTTPS veya localhost üzerinden açmalısınız.';
        setError(errorMsg);
        onScanError?.(errorMsg);
        return;
      }

      if (!viewportRef.current) {
        const errorMsg = 'QR viewport bulunamadı.';
        setError(errorMsg);
        onScanError?.(errorMsg);
        return;
      }

      setIsLoading(true);
      setError(null);

      // Kamera konfigürasyonu
      let cameraConfig: any = null;
      const cachedId = localStorage.getItem(LAST_DEVICE_KEY);

      // html5-qrcode CDN'den yüklenmiş olmalı
      if (!window.Html5Qrcode) {
        const errorMsg = 'html5-qrcode kütüphanesi yüklenemedi.';
        setError(errorMsg);
        onScanError?.(errorMsg);
        setIsLoading(false);
        return;
      }

      let devices: { id: string; label?: string }[] = [];
      try {
        devices = await window.Html5Qrcode.getCameras();
      } catch {
        devices = [];
      }

      // Kamera listesi boş olsa bile start() dene: tarayıcı izin penceresini start() (getUserMedia) açar.
      // İzin kapalıysa veya cihaz yoksa start() hata atar, catch'te uygun mesaj gösterilir.
      try {
        const cached = devices.find((d) => d.id === cachedId);
        if (cached?.id) {
          cameraConfig = { deviceId: { exact: cached.id } };
        } else if (devices.length > 0) {
          const back = devices.find(
            (d) =>
              /back|arka|environment/i.test(d.label || '') ||
              /back/i.test(d.id || '')
          );
          if (back?.id) {
            cameraConfig = { deviceId: { exact: back.id } };
          } else {
            cameraConfig = { deviceId: { exact: devices[0].id } };
          }
        } else {
          cameraConfig = { facingMode: 'user' };
        }
      } catch {
        cameraConfig = devices.length > 0 ? { deviceId: { exact: devices[0].id } } : { facingMode: 'user' };
      }

      try {
        // Önceki scanner varsa temizle
        await stopScannerSafely();

        // Yeni scanner oluştur
        scannerRef.current = new window.Html5Qrcode(viewportRef.current.id);

        // Scanner'ı başlat
        await scannerRef.current.start(
          cameraConfig,
          { fps: 12, qrbox: 260 },
          async (decodedText: string) => {
            // QR kod başarıyla okundu
            await stopScannerSafely();
            setIsLoading(false);

            // QR kod'dan sipariş ID'sini al
            const orderId = String(decodedText).trim();

            // Siparişi bul (API'den veya mevcut kartlardan)
            try {
              const { scanQRCode } = await import('../api/qrScan');
              const order = await scanQRCode(orderId);

              if (order) {
                setError(null);
                setScannedOrder(order);
                setOrderDetails(orderToDetails(order));
                /* Manuel girişteki gibi künye görünümü bu modalda kalsın; OrderActionModal açılmaz */
              } else {
                const errorMsg = 'Eşleşen sipariş bulunamadı!';
                setError(errorMsg);
                onScanError?.(errorMsg);
              }
            } catch (err: any) {
              const errorMsg = err?.message || 'Sipariş bulunurken bir hata oluştu.';
              setError(errorMsg);
              onScanError?.(errorMsg);
            }
          },
          () => {
            // QR kod okuma hatası (sessizce devam et)
          }
        );

        setIsLoading(false);

        // Kamera ID'sini cache'le
        if (cameraConfig?.deviceId?.exact) {
          localStorage.setItem(LAST_DEVICE_KEY, cameraConfig.deviceId.exact);
        }
      } catch (err: any) {
        await stopScannerSafely();
        setIsLoading(false);

        const msg = (err?.message || '').toLowerCase();
        const name = err?.name || '';

        let errorMessage = 'Kamera açılamadı. ';
        if (
          name === 'NotFoundError' ||
          msg.includes('not found') ||
          msg.includes('requested device not found')
        ) {
          errorMessage +=
            'Bu cihazda kamera bulunamadı. Altta sipariş kodunu girerek devam edebilirsiniz.';
        } else if (
          name === 'NotAllowedError' ||
          name === 'PermissionDeniedError'
        ) {
          errorMessage += 'Kamera izni verilmedi. Tarayıcı ayarlarından kamera iznini açın.';
        } else if (name === 'OverconstrainedError' || msg.includes('overconstrained')) {
          errorMessage += 'Seçilen kamera kısıtlamaları karşılanamadı. Sayfayı yenileyip tekrar deneyin veya altta sipariş kodunu girin.';
        } else if (name === 'NotReadableError' || msg.includes('not readable')) {
          errorMessage += 'Kamera kullanımda veya erişilemiyor. Başka uygulama kamerayı kapatıyorsa kapatıp tekrar deneyin.';
        } else {
          errorMessage += 'Altta sipariş kodunu girerek devam edebilirsiniz.';
        }

        setError(errorMessage);
        onScanError?.(errorMessage);
      }
    };

    startScanner();

    // Cleanup: Modal kapandığında scanner'ı durdur
    return () => {
      stopScannerSafely();
    };
  }, [isOpen, onScanSuccess, onScanError]);

  useModalOpenAnimation(isOpen, modalRef, panelRef);

  if (!isOpen) return null;

  const overlay = (
    <div
      ref={modalRef}
      className="modal-react-qr-scanner-overlay"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10002,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--toast-overlay-bg)',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={backdropRef}
        aria-hidden
        style={{ display: 'none' }}
      />
      <div
        ref={panelRef}
        className="modal-react-qr-scanner-container relative overflow-hidden rounded-lg text-left sm:my-8 sm:w-full sm:max-w-lg"
        style={{
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
          {/* Header */}
          <div className="modal-react-qr-scanner-content px-4 pt-5 pb-4 sm:p-6">
            <div className="modal-react-qr-scanner-header flex items-start justify-between mb-4">
              <h3 className="modal-react-qr-scanner-title text-lg font-medium leading-6">
                Sipariş Künyesi Karekod
              </h3>
              <button
                onClick={onClose}
                className="modal-react-qr-scanner-close"
              >
                <span className="sr-only">Kapat</span>
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Scanner Viewport */}
            {!scannedOrder && (
              <div className="modal-react-qr-scanner-scanner mb-4">
                <div
                  id="modal-react-qr-viewport"
                  ref={viewportRef}
                  className="modal-react-qr-scanner-viewport w-full h-64 rounded-lg"
                />
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="modal-react-qr-scanner-loading flex items-center justify-center py-8">
                <div className="modal-react-qr-scanner-loading-spinner rounded-full h-8 w-8 border-b-2"></div>
                <span className="modal-react-qr-scanner-loading-text ml-3 text-sm">Kamera hazırlanıyor...</span>
              </div>
            )}

            {/* Error State - sipariş bilgisi gösterilirken gösterme */}
            {error && !scannedOrder && (
              <div className="modal-react-qr-scanner-error mb-4 p-3 rounded-lg">
                <p className="modal-react-qr-scanner-error-text text-sm">{error}</p>
              </div>
            )}

            {/* Masaüstü / kamera yok: sipariş ID ile popup içeriğini göster - sipariş yüklendiyse gösterme */}
            {!scannedOrder && (
              <div className="modal-react-qr-scanner-manual mb-4 p-3 border rounded-lg">
                <p className="text-sm mb-2">Veya sipariş kodu girebilirsiniz:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualOrderId}
                    onChange={(e) => setManualOrderId(e.target.value)}
                    placeholder="Sipariş kodunu yazınız"
                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleManualLookup()}
                  />
                  <button
                    type="button"
                    onClick={handleManualLookup}
                    disabled={!manualOrderId.trim() || manualLoading}
                    className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {manualLoading ? '...' : 'Göster'}
                  </button>
                </div>
              </div>
            )}

            {/* Hint */}
            {!scannedOrder && !error && (
              <p className="modal-react-qr-scanner-hint text-sm text-center mb-4">
                Kamerayı künyedeki karekoda yöneltin
              </p>
            )}

            {/* Order Details */}
            {scannedOrder && orderDetails && (
              <div className="modal-react-qr-scanner-order-details">
                <div className="modal-react-qr-scanner-order-detail-item">
                  <div className="modal-react-qr-scanner-order-label">Teslim Edilecek Kişi</div>
                  <div className="modal-react-qr-scanner-order-value">{orderDetails.teslimKisi}</div>
                </div>
                <div className="modal-react-qr-scanner-order-detail-item">
                  <div className="modal-react-qr-scanner-order-label">Sipariş Ürün</div>
                  <div className="modal-react-qr-scanner-order-value">{orderDetails.urun}</div>
                </div>
                <div className="modal-react-qr-scanner-order-detail-item">
                  <div className="modal-react-qr-scanner-order-label">Teslim Adresi</div>
                  <div className="modal-react-qr-scanner-order-value">{orderDetails.adres}</div>
                </div>
                <div className="modal-react-qr-scanner-order-detail-item">
                  <div className="modal-react-qr-scanner-order-label">Teslim Tarihi ve Saati</div>
                  <div className="modal-react-qr-scanner-order-value">{orderDetails.tarihSaat}</div>
                </div>
              </div>
            )}

            {/* Actions */}
            {scannedOrder && orderDetails && (
              <div className="modal-react-qr-scanner-actions space-y-2">
                {orderDetails.mapsUrl && (
                  <a
                    href={orderDetails.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="modal-react-qr-scanner-action-link modal-react-qr-scanner-maps-link block w-full px-4 py-2 rounded-lg text-center font-medium transition-colors"
                  >
                    Yol tarifi al
                  </a>
                )}
                {orderDetails.teslimTel && (
                  <a
                    href={`tel:${orderDetails.teslimTel}`}
                    className="modal-react-qr-scanner-action-link modal-react-qr-scanner-tel-link block w-full px-4 py-2 rounded-lg text-center font-medium transition-colors"
                  >
                    Teslim edilecek kişiyi ara
                  </a>
                )}
                {orderDetails.sipVerenTel && (
                  <a
                    href={`tel:${orderDetails.sipVerenTel}`}
                    className="modal-react-qr-scanner-action-link modal-react-qr-scanner-siparis-veren-link block w-full px-4 py-2 rounded-lg text-center font-medium transition-colors"
                  >
                    Sipariş vereni ara
                  </a>
                )}
                {orderDetails.detayUrl && (
                  <a
                    href={orderDetails.detayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="modal-react-qr-scanner-action-link modal-react-qr-scanner-detay-link block w-full px-4 py-2 rounded-lg text-center font-medium transition-colors"
                  >
                    Sipariş detayını görüntüle
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
    </div>
  );

  return createPortal(overlay, document.body);
};

