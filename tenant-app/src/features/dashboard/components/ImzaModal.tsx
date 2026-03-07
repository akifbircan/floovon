import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ImzaModalProps {
  isOpen: boolean;
  defaultTeslimKisi: string;
  onClose: () => void;
  onConfirm: (teslimKisi: string, imzaData: string | null) => Promise<void>;
}

export const ImzaModal: React.FC<ImzaModalProps> = ({
  isOpen,
  defaultTeslimKisi,
  onClose,
  onConfirm,
}) => {
  const [teslimTuru, setTeslimTuru] = useState<'kendisi' | 'baskasi'>('kendisi');
  const [baskasiAdi, setBaskasiAdi] = useState<string>('');
  const [hasSignature, setHasSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  // Her açılışta formu sıfırla: Kendisi seçili, başkası alanı boş, imza temiz
  useEffect(() => {
    if (isOpen) {
      setTeslimTuru('kendisi');
      setBaskasiAdi('');
      setHasSignature(false);
      const id = setTimeout(() => {
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
        }
      }, 50);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      setupCanvas();
      // Focus yönetimi
      setTimeout(() => {
        const firstButton = canvasRef.current?.closest('.modal-react-imza-container')?.querySelector('button');
        if (firstButton) {
          (firstButton as HTMLButtonElement).focus();
        }
      }, 0);
    }
  }, [isOpen]);

  const setupCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas boyutlarını ayarla
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // Event listeners
    const startDrawing = (e: MouseEvent | TouchEvent) => {
      isDrawingRef.current = true;
      setHasSignature(true);
      const rect = canvas.getBoundingClientRect();
      const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
      const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawingRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
      const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const stopDrawing = () => {
      isDrawingRef.current = false;
    };

    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        draw(e);
      }
    };

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Touch events
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseout', stopDrawing);
      canvas.removeEventListener('touchstart', handleTouch);
      canvas.removeEventListener('touchmove', handleTouch);
      canvas.removeEventListener('touchend', stopDrawing);
    };
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleConfirm = async () => {
    const teslimKisi = teslimTuru === 'kendisi' 
      ? defaultTeslimKisi 
      : baskasiAdi.trim() || defaultTeslimKisi;

    let imzaData: string | null = null;
    if (hasSignature && canvasRef.current) {
      imzaData = canvasRef.current.toDataURL('image/png');
    }

    await onConfirm(teslimKisi, imzaData);
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="modal-react-imza-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="modal-react-imza-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-react-imza-header">
          <i className="icon-icon-siparis-teslim"></i>
          <h3 className="modal-react-imza-title">
            Sipariş Teslimi
          </h3>
          <p className="modal-react-imza-description">
            Teslim alan kişi bilgilerini girin ve teslim aşamasındaysanız imza alınız
          </p>
        </div>

        <div className="modal-react-imza-kisi-section">
          <div className="modal-react-imza-radio-group">
            <label className="modal-react-imza-radio-option modal-react-imza-kendisi">
              <input
                type="radio"
                name="modal-react-teslimTuru"
                value="kendisi"
                checked={teslimTuru === 'kendisi'}
                onChange={() => setTeslimTuru('kendisi')}
              />
              <span>Kendisi: <strong>{defaultTeslimKisi}</strong></span>
            </label>
            <div className="modal-react-imza-baska-kisi">
              <label className="modal-react-imza-radio-option">
                <input
                  type="radio"
                  name="modal-react-teslimTuru"
                  value="baskasi"
                  checked={teslimTuru === 'baskasi'}
                  onChange={() => setTeslimTuru('baskasi')}
                />
                <span>Başkası:</span>
              </label>
              {teslimTuru === 'baskasi' && (
                <input
                  type="text"
                  className="modal-react-imza-baskasi-input"
                  placeholder="İsim Soyisim yazınız"
                  value={baskasiAdi}
                  onChange={(e) => setBaskasiAdi(e.target.value)}
                />
              )}
            </div>
          </div>
        </div>

        <div className="modal-react-imza-section">
          <label className="modal-react-imza-section-label">
            İmza Alanı
          </label>
          <canvas
            ref={canvasRef}
            id="modal-react-imzaCanvas"
            width={400}
            height={150}
          />
          <div className="modal-react-imza-controls">
            <button
              type="button"
              className="modal-react-imza-temizle"
              onClick={clearCanvas}
            >
              İmzayı Temizle
            </button>
            <small className="modal-react-imza-help">
              İmza alanına parmağınızla imza atınız
            </small>
          </div>
        </div>

        <div className="modal-react-imza-buttons">
          <button
            type="button"
            className="modal-react-imza-iptal"
            onClick={onClose}
          >
            İPTAL
          </button>
          <button
            type="button"
            className="modal-react-imza-onayla"
            onClick={handleConfirm}
          >
            ONAYLA
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

