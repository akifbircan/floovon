import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TeslimFotoModalProps {
  isOpen: boolean;
  organizasyonId: number;
  onClose: () => void;
  onSkip: () => void;
  onPhotoSelected: (file: File) => Promise<void>;
}

export const TeslimFotoModal: React.FC<TeslimFotoModalProps> = ({
  isOpen,
  organizasyonId,
  onClose,
  onSkip,
  onPhotoSelected,
}) => {
  const [status, setStatus] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && fileInputRef.current) {
      // Focus yönetimi
      setTimeout(() => {
        const firstButton = fileInputRef.current?.closest('.modal-react-teslim-foto-container')?.querySelector('button');
        if (firstButton) {
          (firstButton as HTMLButtonElement).focus();
        }
      }, 0);
    }
  }, [isOpen]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setStatus('Fotoğraf yükleniyor...');

    try {
      await onPhotoSelected(file);
      setStatus('Fotoğraf başarıyla yüklendi!');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error: any) {
      console.error('Fotoğraf yükleme hatası:', error);
      setStatus('Fotoğraf yüklenirken hata oluştu: ' + (error?.message || 'Bilinmeyen hata'));
    } finally {
      setUploading(false);
    }
  };

  const handleAddPhoto = () => {
    fileInputRef.current?.click();
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="modal-react-teslim-foto-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="modal-react-teslim-foto-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-react-teslim-foto-header-alan">
          <button
            type="button"
            className="btn-close-modal"
            onClick={onClose}
            aria-label="Popup kapat"
          >
            <i className="icon-btn-kapat"></i>
          </button>
        </div>

        <div className="modal-react-teslim-foto-header">
          <i className="fa-solid fa-image modal-react-teslim-foto-icon"></i>
          <h3 className="modal-react-teslim-foto-title">
            Teslim Edildi Fotoğrafı Gönder
          </h3>
          <p className="modal-react-teslim-foto-description">
            Organizasyon siparişlerine özel olarak müşteriye teslim edildi görseli göndermek ister misiniz?
          </p>
        </div>

        <div className="modal-react-teslim-foto-actions">
          <button
            type="button"
            className="modal-react-teslim-foto-add"
            onClick={handleAddPhoto}
            disabled={uploading}
          >
            {uploading ? 'Yükleniyor...' : 'FOTOĞRAF ÇEK/EKLE'}
          </button>
          <button
            type="button"
            className="modal-react-teslim-foto-skip"
            onClick={onSkip}
            disabled={uploading}
          >
            ATLA
          </button>
        </div>

        {status && (
          <div 
            className={`modal-react-teslim-foto-status ${status.includes('hata') ? 'error' : 'success'}`}
            aria-live="polite"
          >
            {status}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="modal-react-teslim-foto-input"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>
    </div>,
    document.body
  );
};

