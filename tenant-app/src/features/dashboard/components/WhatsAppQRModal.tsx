import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { apiClient } from '@/lib/api';
import QRCode from 'qrcode';

interface WhatsAppQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
  skipImzaForm?: boolean;
}

/**
 * WhatsApp QR modal - tek lifecycle:
 * Açılınca 1x initialize, 1sn polling. status qr -> QR göster; ready -> Bağlandı + kapat; disconnected/auth_failure -> Tekrar bağla.
 */
export const WhatsAppQRModal: React.FC<WhatsAppQRModalProps> = ({
  isOpen,
  onClose,
  onConnected,
}) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string>('QR kod yükleniyor...');
  const [showReconnect, setShowReconnect] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbackExecutedRef = useRef(false);
  const initCalledRef = useRef(false);
  const lastPollStRef = useRef<string | null>(null);
  const lastPollQrRef = useRef<string | null>(null);
  const lastDrawnQrRef = useRef<string | null>(null);
  const firstQrShownAtRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  const onConnectedRef = useRef(onConnected);
  onCloseRef.current = onClose;
  onConnectedRef.current = onConnected;
  /** Sabit akış: loading → qr → pairing → success. Geri dönüş yok (disconnected hariç). Sekme biter. */
  const displayPhaseRef = useRef<'loading' | 'qr' | 'pairing' | 'success'>('loading');

  const LOADING_MSG = 'QR kod yükleniyor...';
  const QR_MSG = 'QR kodu telefonunuzla tarayın';
  const PAIRING_MSG = 'Bağlantı kuruluyor...';
  const SUCCESS_MSG = 'Bağlantı başarılı!';

  const setPhase = (phase: 'loading' | 'qr' | 'pairing' | 'success') => {
    if (displayPhaseRef.current === phase) return;
    displayPhaseRef.current = phase;
    if (phase === 'loading') {
      setStatusMessage(LOADING_MSG);
      setLoading(true);
    } else if (phase === 'qr') {
      setStatusMessage(QR_MSG);
      setLoading(false);
    } else if (phase === 'pairing') {
      setStatusMessage(PAIRING_MSG);
      setLoading(false);
    } else {
      setStatusMessage(SUCCESS_MSG);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    // Bağlantı başarılı gösterildiyse effect tekrar çalışmasın (onClose/onConnected değişince) – karekod ve mesaj sabit kalsın
    if (displayPhaseRef.current === 'success' || callbackExecutedRef.current) return;

    callbackExecutedRef.current = false;
    lastPollStRef.current = null;
    lastPollQrRef.current = null;
    lastDrawnQrRef.current = null;
    firstQrShownAtRef.current = null;
    displayPhaseRef.current = 'loading';
    setStatusMessage(LOADING_MSG);
    setLoading(true);
    setQrCode(null);
    setShowReconnect(false);

    initCalledRef.current = true;
    apiClient.post('/whatsapp/initialize').catch(() => {});

    const poll = async () => {
      try {
        // Bağlantı başarılı gösterildiyse bir daha hiçbir şey güncelleme – sadece kapanana kadar sabit kalsın
        if (displayPhaseRef.current === 'success' || callbackExecutedRef.current) return;

        const res = await apiClient.get('/whatsapp/status');
        const data = res.data;
        // Uçuşta olan poll: cevap geldiği anda başka poll "Bağlantı başarılı" göstermiş olabilir – bir daha hiçbir şey güncelleme
        if (displayPhaseRef.current === 'success' || callbackExecutedRef.current) return;

        const st = (data.status === 'ready' || (data.isReady && data.isAuthenticated)) ? 'ready' : data.status || (data.isAuthenticated && !data.isReady ? 'pairing' : data.hasQRCode ? 'qr' : 'uninitialized');
        const qr = data.qrCode || data.qr || null;

        const prevSt = lastPollStRef.current;
        if (prevSt === st && (st !== 'qr' || lastPollQrRef.current === qr)) return;
        lastPollStRef.current = st;
        if (st === 'qr') lastPollQrRef.current = qr;

        if (!data.installed) {
          setStatusMessage('WhatsApp servisi kurulu değil.');
          setLoading(false);
          return;
        }

        if (st === 'ready') {
          if (callbackExecutedRef.current) return;
          callbackExecutedRef.current = true;
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setPhase('success');
          // Karekodu ekrandan kaldırma – kalsın ki "QR kod yükleniyor" boş alanda görünmesin
          setTimeout(() => {
            onCloseRef.current();
            onConnectedRef.current?.();
          }, 1500);
          return;
        }

        if (st === 'pairing') {
          if (displayPhaseRef.current !== 'success') setPhase('pairing');
          return;
        }

        if (st === 'qr' || data.hasQRCode) {
          if (qr) {
            const now = Date.now();
            const firstShown = firstQrShownAtRef.current;
            const QR_STABLE_MS = 50000; // 50 sn – WhatsApp QR ~60 sn geçerli, süresi dolmadan yenileyebilsin
            const allowNewQr = firstShown === null || (now - firstShown > QR_STABLE_MS);
            setQrCode((prev) => {
              if (prev === qr) return prev;
              if (prev && !allowNewQr) return prev;
              if (firstQrShownAtRef.current === null) firstQrShownAtRef.current = now;
              return qr;
            });
            if (displayPhaseRef.current === 'loading') setPhase('qr');
          }
          setLoading(false);
          return;
        }

        if (st === 'disconnected') {
          if (displayPhaseRef.current === 'qr') {
            // QR zaten gösteriliyorsa silme – backend bazen geçici disconnected dönebilir, karekod kaybolup dönmesin
            if (!initCalledRef.current) {
              initCalledRef.current = true;
              apiClient.post('/whatsapp/initialize').catch(() => {});
            }
            return;
          }
          if (prevSt !== 'disconnected') initCalledRef.current = false;
          if (!initCalledRef.current) {
            initCalledRef.current = true;
            apiClient.post('/whatsapp/initialize').catch(() => {});
          }
          setShowReconnect(false);
          setPhase('loading');
          setQrCode(null);
          return;
        }

        if (st === 'auth_failure') {
          setShowReconnect(true);
          setStatusMessage('Kimlik doğrulama başarısız.');
          setLoading(false);
          setQrCode(null);
          return;
        }

        if (st === 'initializing' || st === 'uninitialized') {
          if (!initCalledRef.current) {
            initCalledRef.current = true;
            try {
              await apiClient.post('/whatsapp/initialize');
            } catch {
              setStatusMessage('WhatsApp başlatılamadı. Backend sunucusunu kontrol edin.');
              setLoading(false);
            }
          }
          if (displayPhaseRef.current === 'loading') setStatusMessage(LOADING_MSG);
        }
      } catch (err: any) {
        const msg = err?.response?.status === 404 || err?.message?.includes('Network') ? 'Backend sunucusu çalışmıyor.' : 'WhatsApp durumu alınamadı.';
        setStatusMessage(msg);
        setLoading(false);
      }
    };

    poll();
    pollIntervalRef.current = setInterval(poll, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      initCalledRef.current = false;
    };
    // Sadece isOpen'a bağlı: onClose/onConnected her render'da yeni referans olunca effect tekrar çalışıp initialize + QR yenilenmesin
  }, [isOpen]);

  // QR canvas çizimi – sadece qrCode gerçekten değiştiğinde çiz (aynı qr tekrar çizilmesin, sekip durmasın)
  useEffect(() => {
    if (!qrCode || !isOpen) return;
    if (lastDrawnQrRef.current === qrCode) return;
    lastDrawnQrRef.current = qrCode;
    const canvas = canvasRef.current || document.getElementById('modal-react-whatsapp-qr-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    QRCode.toCanvas(canvas, qrCode, { width: 256, margin: 2, color: { dark: '#000000', light: '#FFFFFF' } }).catch(() => {});
  }, [qrCode, isOpen]);

  const handleReconnect = async () => {
    setShowReconnect(false);
    setLoading(true);
    setStatusMessage('QR kod yükleniyor...');
    initCalledRef.current = false;
    try {
      await apiClient.post('/whatsapp/initialize');
    } catch {
      setStatusMessage('Başlatılamadı. Tekrar deneyin.');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isSuccess = statusMessage.includes('Bağlantı başarılı');

  const overlay = (
    <div className="modal-react-whatsapp-qr-overlay">
      <div
        className="modal-react-whatsapp-qr-content"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-react-whatsapp-qr-title">WhatsApp Bağlantısı</h2>
        <p className="modal-react-whatsapp-qr-instruction">Telefonunuzla QR kodu tarayın:</p>

        <div className={`modal-react-whatsapp-qr-area ${isSuccess ? 'modal-react-whatsapp-qr-area-success-passive' : ''}`}>
          {loading && !qrCode && !isSuccess && (
            <div className="modal-react-whatsapp-qr-loading">
              <div className="modal-react-whatsapp-qr-loading-spinner" />
            </div>
          )}
          {qrCode && (
            <canvas ref={canvasRef} id="modal-react-whatsapp-qr-canvas" className="modal-react-whatsapp-qr-canvas" />
          )}
        </div>

        {statusMessage && (
          <div
            className={`modal-react-whatsapp-qr-status-message ${
              statusMessage.includes('Bağlantı başarılı') || statusMessage.includes('tarayın') ? 'success' : statusMessage.includes('hatası') || statusMessage.includes('başarısız') ? 'error' : 'success'
            }`}
          >
            {statusMessage}
          </div>
        )}

        <p className="modal-react-whatsapp-qr-help">WhatsApp &gt; Ayarlar &gt; Bağlı Cihazlar &gt; Cihaz Bağla</p>

        <div className="modal-react-whatsapp-qr-info">
          <i className="fa-solid fa-circle-info" aria-hidden></i>
          <span>
            Karekodu okuturken sorun yaşarsanız veya WhatsApp uygulamanız &quot;Giriş Yapılamadı&quot; veya &quot;Karekod okunamadı&quot; uyarı verirse; telefonunuzdaki WhatsApp uygulamanızı sonlandırıp tekrar girdikten sonra karekodu okutun.
          </span>
        </div>

        {showReconnect && (
          <button
            type="button"
            className="modal-react-whatsapp-qr-btn modal-react-whatsapp-qr-btn-reconnect"
            onClick={handleReconnect}
          >
            Tekrar bağla
          </button>
        )}

        <div className="modal-react-whatsapp-qr-actions">
          <button
            id="modal-react-whatsapp-qr-close"
            className="modal-react-whatsapp-qr-btn modal-react-whatsapp-qr-btn-close"
            onClick={() => onCloseRef.current()}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};
