import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalOpenAnimation } from '../../../shared/hooks/useModalOpenAnimation';
import { useAuth } from '../../../app/providers/AuthProvider';
import { apiRequest } from '../../../lib/api';
import { showToast } from '../../../shared/utils/toastUtils';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { formatPhoneNumber } from '../../../shared/utils/formatUtils';
import { getProfileImageUrl } from '../../../shared/utils/userUtils';

interface TeknikDestekModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TeknikDestekModal: React.FC<TeknikDestekModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    konu: '',
    oncelik: 'Normal',
    mesaj: '',
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useModalOpenAnimation(isOpen, overlayRef, panelRef);

  // Modal açıldığında formu sıfırla
  useEffect(() => {
    if (isOpen) {
      setFormData({ konu: '', oncelik: 'Normal', mesaj: '' });
      setShowSuccess(false);
    }
  }, [isOpen]);

  // ESC tuşu ile kapatma
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Body scroll'u engelle
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.konu || !formData.mesaj) {
      showToast('error', 'Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    setLoading(true);

    try {
      const response = await apiRequest<{ success?: boolean; message?: string }>('/teknik-destek', {
        method: 'POST',
        data: {
          konu: formData.konu,
          oncelik: formData.oncelik,
          mesaj: formData.mesaj,
          email: user?.email || '',
          telefon: user?.telefon || user?.phone || '',
          user_id: user?.id,
        },
      });

      if (response?.success) {
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          onClose();
        }, 2000);
      } else {
        throw new Error(response?.message || 'Destek talebi gönderilemedi');
      }
    } catch (error: unknown) {
      console.error('❌ Destek talebi gönderme hatası:', error);
      const err = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
      const errorMessage = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Destek talebi gönderilemedi';
      showToast('error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="modal-react-teknik-destek-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        className="modal-react-teknik-destek-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-react-teknik-destek-header">
          <h3>
            <i className="fa-solid fa-headset"></i> Hızlı Teknik Destek
          </h3>
          <button
            className="btn-close-modal"
            onClick={onClose}
            type="button"
          >
            <i className="icon-btn-kapat"></i>
          </button>
        </div>

        {/* Content */}
        <div className="modal-react-teknik-destek-content">
          {/* User Card */}
          <div className="modal-react-teknik-destek-user-card">
            <div className="modal-react-teknik-destek-user-avatar">
              <img
                src={getProfileImageUrl(user)}
                alt={user?.name || user?.ad || 'Kullanıcı'}
                onError={(e) => {
                  const el = e.target as HTMLImageElement;
                  el.onerror = null;
                  el.src = getProfileImageUrl(null);
                }}
              />
            </div>
            <div className="modal-react-teknik-destek-user-info">
              <h4>{user?.name || user?.ad || user?.isim || 'Kullanıcı'} {user?.surname || user?.soyisim || ''}</h4>
              <p>
                <i className="fa-solid fa-briefcase"></i>{' '}
                <span>{user?.role || user?.yetki || 'Kullanıcı'}</span>
              </p>
              <p>
                <i className="fa-solid fa-envelope"></i>{' '}
                <span>{user?.email || '-'}</span>
              </p>
              {user?.telefon && (
                <p>
                  <i className="fa-solid fa-phone"></i>{' '}
                  <span>{formatPhoneNumber(user.telefon)}</span>
                </p>
              )}
            </div>
          </div>

          {/* Info Message */}
          <div className="modal-react-teknik-destek-info">
            <p>
              <i className="fa-solid fa-info-circle"></i> Destek talebiniz en kısa sürede değerlendirilecek ve iletişim bilgileriniz üzerinden dönüş yapılacaktır.
            </p>
          </div>

          {/* Success Message */}
          {showSuccess && (
            <div className="modal-react-teknik-destek-success-message active">
              <div className="modal-react-teknik-destek-success-icon">
                <i className="fa-solid fa-check"></i>
              </div>
              <h4>Talebiniz Alındı!</h4>
              <p>Destek talebiniz başarıyla gönderildi. En kısa sürede size dönüş yapacağız.</p>
            </div>
          )}

          {/* Form */}
          {!showSuccess && (
            <form id="teknikDestekForm" className="modal-react-teknik-destek-form" onSubmit={handleSubmit}>
              <div className="modal-react-teknik-destek-form-group">
                <label htmlFor="destekKonu">Konu *</label>
                <select
                  id="destekKonu"
                  name="konu"
                  value={formData.konu}
                  onChange={(e) => setFormData({ ...formData, konu: e.target.value })}
                  required
                >
                  <option value="">Konu seçin</option>
                  <option value="teknik">Teknik Sorun</option>
                  <option value="kullanim">Kullanım Desteği</option>
                  <option value="fatura">Faturalama</option>
                  <option value="ozellik">Özellik İsteği</option>
                  <option value="diger">Diğer</option>
                </select>
              </div>

              <div className="modal-react-teknik-destek-form-group">
                <label htmlFor="destekOncelik">Öncelik</label>
                <select
                  id="destekOncelik"
                  name="oncelik"
                  value={formData.oncelik}
                  onChange={(e) => setFormData({ ...formData, oncelik: e.target.value })}
                >
                  <option value="Normal">Normal</option>
                  <option value="Yüksek">Yüksek</option>
                  <option value="Acil">Acil</option>
                </select>
              </div>

              <div className="modal-react-teknik-destek-form-group">
                <label htmlFor="destekMesaj">Mesajınız *</label>
                <textarea
                  id="destekMesaj"
                  name="mesaj"
                  placeholder="Sorununuzu veya talebinizi detaylı olarak açıklayın..."
                  value={formData.mesaj}
                  onChange={(e) => setFormData({ ...formData, mesaj: e.target.value })}
                  required
                  rows={5}
                />
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {!showSuccess && (
          <div className="modal-react-teknik-destek-footer">
            <button
              type="button"
              className="btn-modal-secondary secondary-button btn-vazgec"
              onClick={onClose}
            >
              İPTAL
            </button>
            <button
              type="submit"
              form="teknikDestekForm"
              className="btn-modal-primary modal-react-teknik-destek-btn modal-react-teknik-destek-btn-primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Gönderiliyor...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane"></i> GÖNDER
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

