import React from 'react';
import { createPortal } from 'react-dom';
import { apiClient } from '@/lib/api';
import { showToast, showToastInteractive } from '../../../shared/utils/toastUtils';
import { formatPhoneNumber } from '../../../shared/utils/formatUtils';

interface WhatsAppConnectionInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDisconnected?: () => void; // Bağlantı kesildikten sonra çağrılacak callback
}

interface WhatsAppStatus {
  installed: boolean;
  isReady: boolean;
  isAuthenticated: boolean;
  phoneNumber: string | null;
  userName: string | null;
  connectedAt: string | null;
}

export const WhatsAppConnectionInfoModal: React.FC<WhatsAppConnectionInfoModalProps> = ({
  isOpen,
  onClose,
  onDisconnected,
}) => {
  const [status, setStatus] = React.useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [disconnecting, setDisconnecting] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) {
      // Modal kapandığında disconnecting state'ini temizle
      setDisconnecting(false);
      return;
    }

    const fetchStatus = async () => {
      setLoading(true);
      // Modal açıldığında disconnecting state'ini temizle
      setDisconnecting(false);
      try {
        const response = await apiClient.get('/whatsapp/status');
        const statusData = response.data;
        // DB'ye yazılmamış olsa bile arayüzde görünsün: API camelCase veya snake_case dönebilir
        setStatus({
          installed: statusData.installed || false,
          isReady: statusData.isReady || false,
          isAuthenticated: statusData.isAuthenticated || false,
          phoneNumber: statusData.phoneNumber || statusData.phone_number || null,
          userName: statusData.userName || statusData.user_name || statusData.username || null,
          connectedAt: statusData.connectedAt || null,
        });
      } catch (error: unknown) {
        const statusCode = error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { status?: number } }).response?.status
          : undefined;
        if (statusCode === 500 || (statusCode != null && statusCode >= 400)) {
          setStatus({
            installed: false,
            isReady: false,
            isAuthenticated: false,
            phoneNumber: null,
            userName: null,
            connectedAt: null,
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [isOpen]);

  const handleDisconnect = () => {
    showToastInteractive({
      title: 'Bağlantıyı Kes',
      message: 'WhatsApp bağlantısını kesmek istediğinize emin misiniz? Telefondan da çıkış yapılacak.',
      confirmText: 'Evet, Kes',
      cancelText: 'İptal',
      onConfirm: async () => {
        setDisconnecting(true);
        try {
          const response = await apiClient.post('/whatsapp/disconnect');
          if (response.data.success) {
            showToast('success', 'WhatsApp bağlantısı başarıyla kesildi');
            onClose();
            if (onDisconnected) {
              onDisconnected();
              setTimeout(() => onDisconnected(), 600);
              setTimeout(() => onDisconnected(), 1400);
            } else {
              setTimeout(() => window.location.reload(), 500);
            }
          } else {
            const errorMsg = response.data.error || 'Bilinmeyen hata';
            showToast('error', 'Bağlantı kesilemedi: ' + errorMsg);
            setDisconnecting(false);
          }
        } catch (error: any) {
          console.error('❌ Bağlantı kesme hatası:', error);
          const errorMsg = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Bilinmeyen hata';
          showToast('error', 'Bağlantı kesilemedi: ' + errorMsg);
          setDisconnecting(false);
        }
      },
    });
  };

  // Bağlantı süresini hesapla
  const getConnectionDuration = (connectedAt: string | null): string => {
    if (!connectedAt) return 'Bilinmiyor';
    
    try {
      // connectedAt formatı: "YYYY-MM-DD HH:mm:ss" (Türkiye saati UTC+3)
      // Bu formatı parse etmek için manuel olarak parse edelim
      const dateMatch = connectedAt.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
      if (!dateMatch) {
        // Eğer format uyumsuzsa, Date constructor'ı dene
        const connectedDate = new Date(connectedAt);
        if (isNaN(connectedDate.getTime())) {
          return 'Hesaplanamadı';
        }
        const now = new Date();
        const diffMs = now.getTime() - connectedDate.getTime();
        
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 0) {
          return `${diffDays} gün ${diffHours % 24} saat`;
        } else if (diffHours > 0) {
          return `${diffHours} saat ${diffMinutes % 60} dakika`;
        } else if (diffMinutes > 0) {
          return `${diffMinutes} dakika`;
        } else {
          return `${diffSeconds} saniye`;
        }
      }
      
      // connectedAt backend'den "YYYY-MM-DD HH:mm:ss" (Türkiye saati) gelir; yerel saat olarak parse et
      const [, year, month, day, hours, minutes, seconds] = dateMatch;
      const connectedDate = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hours),
        parseInt(minutes),
        parseInt(seconds)
      );
      const now = new Date();
      let diffMs = now.getTime() - connectedDate.getTime();
      if (diffMs < 0) diffMs = 0;

      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) {
        return `${diffDays} gün ${diffHours % 24} saat`;
      } else if (diffHours > 0) {
        return `${diffHours} saat ${diffMinutes % 60} dakika`;
      } else if (diffMinutes > 0) {
        return `${diffMinutes} dakika`;
      } else if (diffSeconds > 0) {
        return `${diffSeconds} saniye`;
      } else {
        return 'Az önce';
      }
    } catch (error) {
      console.error('❌ Bağlantı süresi hesaplanamadı:', error);
      return 'Hesaplanamadı';
    }
  };

  // Tarih formatını düzenle
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Bilinmiyor';
    
    try {
      // Format: "YYYY-MM-DD HH:mm:ss"
      const dateMatch = dateString.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
      if (dateMatch) {
        const [, year, month, day, hours, minutes, seconds] = dateMatch;
        return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
      }
      
      // Eğer format uyumsuzsa, Date constructor'ı dene
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      
      return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
      return dateString;
    }
  };

  if (!isOpen) return null;

  const overlay = (
    <div
      className={`modal-react-whatsapp-info-overlay ${isOpen ? 'show' : ''}`}
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--overlay-bg-black)',
        display: isOpen ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999999,
      }}
    >
      <div
        className="modal-react-whatsapp-info-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--white)',
          padding: '30px',
          borderRadius: '10px',
          maxWidth: '500px',
          width: '90%',
        }}
      >
        <div className="modal-react-whatsapp-info-header">
          <h2 id="whatsapp-info-title" className="modal-react-whatsapp-info-title">
            <i className="fa-brands fa-whatsapp"></i>
            WhatsApp Bağlantı Bilgileri
          </h2>
          <button
            className="modal-react-whatsapp-info-close-btn"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="modal-react-whatsapp-info-loading">
            <i className="fa-solid fa-spinner fa-spin"></i>
            <p>Yükleniyor...</p>
          </div>
        ) : status && status.isReady && status.isAuthenticated ? (
          <div className="modal-react-whatsapp-info-content-wrapper">
            <div className="modal-react-whatsapp-info-status-indicator">
              <div className="modal-react-whatsapp-info-status-dot"></div>
              <span className="modal-react-whatsapp-info-status-text">
                Bağlantı Aktif
              </span>
            </div>
            <div className="modal-react-whatsapp-info-row">
              <i className="fa-solid fa-mobile-screen-button"></i>
              <span>
                {status.userName || 'Bilinmiyor'} {status.phoneNumber ? formatPhoneNumber(status.phoneNumber) : ''}
              </span>
            </div>
            <div className="modal-react-whatsapp-info-row">
              <i className="fa-solid fa-clock"></i>
              <span>
                {formatDate(status.connectedAt)} ({getConnectionDuration(status.connectedAt)})
              </span>
            </div>
          </div>
        ) : (
          <div className="modal-react-whatsapp-info-error-state">
            <i className="fa-solid fa-exclamation-triangle"></i>
            <p>WhatsApp bağlantısı bulunamadı.</p>
          </div>
        )}

        <div className="modal-react-whatsapp-info-footer">
          {status && status.isReady && status.isAuthenticated && (
            <button
              className="modal-react-whatsapp-info-disconnect-btn"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  Kesiliyor...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-link-slash"></i>
                  Bağlantıyı Kes
                </>
              )}
            </button>
          )}
          <button
            className="modal-react-whatsapp-info-close-btn-footer"
            onClick={onClose}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(overlay, document.body)}
    </>
  );
};

