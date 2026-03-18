import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { startAracTakip } from '../api/aracTakip';
import { useModalOpenAnimation } from '../../../shared/hooks/useModalOpenAnimation';
import { apiRequest } from '../../../lib/api';
import { useAuth } from '../../../app/providers/AuthProvider';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { showToast } from '../../../shared/utils/toastUtils';
import { Van, User as UserIcon } from 'lucide-react';

interface AracTakipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Arac {
  id: number;
  plaka: string;
  marka?: string;
  model?: string;
  is_active?: number | boolean | string;
}

/**
 * Araç Takip Modal - "Teslimata Çıktım" aksiyonu
 */
export const AracTakipModal: React.FC<AracTakipModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const overlayCloseReadyRef = useRef(false);
  const { user } = useAuth();
  useModalOpenAnimation(isOpen, overlayRef, panelRef);

  useEffect(() => {
    if (!isOpen) {
      overlayCloseReadyRef.current = false;
      return;
    }
    overlayCloseReadyRef.current = false;
    const t = window.setTimeout(() => {
      overlayCloseReadyRef.current = true;
    }, 400);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [araclar, setAraclar] = useState<Arac[]>([]);
  const [araclarLoading, setAraclarLoading] = useState(false);
  const [selectedAracId, setSelectedAracId] = useState<string>('');
  const [surucuAdi, setSurucuAdi] = useState<string>('');

  // Sürücü adını al
  useEffect(() => {
    const fetchDriverName = async () => {
      if (!user) {
        setSurucuAdi('Henüz sürücü atanmadı');
        return;
      }

      try {
        const userId = (user as any).id || 1;
        const userData = await apiRequest<any>(`/auth/me?id=${userId}`, {
          method: 'GET',
        });

        if (userData) {
          if (userData.name && userData.surname) {
            setSurucuAdi(`${userData.name} ${userData.surname}`);
          } else if (userData.isim && userData.soyisim) {
            setSurucuAdi(`${userData.isim} ${userData.soyisim}`);
          } else if (userData.name || userData.isim) {
            setSurucuAdi(userData.name || userData.isim);
          } else if (userData.kullaniciadi) {
            setSurucuAdi(userData.kullaniciadi);
          } else {
            setSurucuAdi('Sürücü');
          }
        }
      } catch (error) {
        setSurucuAdi('Henüz sürücü atanmadı');
      }
    };

    if (isOpen) {
      fetchDriverName();
    }
  }, [isOpen, user]);

  // Araç listesini al
  useEffect(() => {
    const fetchAraclar = async () => {
      if (!isOpen) return;

      setAraclarLoading(true);
      try {
        // Önce aktif olanları al
        let aracResponse = await apiRequest<Arac[] | { success: boolean; data?: Arac[] }>('/araclar?aktif_only=true', {
          method: 'GET',
        });

        let aracList: Arac[] = [];
        
        // Response formatını kontrol et
        if (aracResponse && typeof aracResponse === 'object' && 'success' in aracResponse) {
          const apiResponse = aracResponse as { success: boolean; data?: Arac[] };
          if (apiResponse.success && apiResponse.data && Array.isArray(apiResponse.data)) {
            aracList = apiResponse.data;
          }
        } else if (Array.isArray(aracResponse)) {
          aracList = aracResponse;
        }

        // Eğer aktif araç yoksa, tüm araçları al
        if (aracList.length === 0) {
          aracResponse = await apiRequest<Arac[] | { success: boolean; data?: Arac[] }>('/araclar', {
            method: 'GET',
          });

          if (aracResponse && typeof aracResponse === 'object' && 'success' in aracResponse) {
            const apiResponse = aracResponse as { success: boolean; data?: Arac[] };
            if (apiResponse.success && apiResponse.data && Array.isArray(apiResponse.data)) {
              aracList = apiResponse.data;
            }
          } else if (Array.isArray(aracResponse)) {
            aracList = aracResponse;
          }
        }

        // Filtrele: Plakası olan ve aktif olan araçları göster
        aracList = aracList.filter((arac) => {
          const plaka = arac.plaka || '';
          if (!plaka || plaka.trim() === '' || plaka === 'Plaka yok') {
            return false;
          }

          // is_active kontrolü
          if (arac.is_active !== undefined && arac.is_active !== null) {
            const isActiveValue = arac.is_active;
            if (
              isActiveValue === 0 ||
              isActiveValue === false ||
              isActiveValue === '0' ||
              isActiveValue === 'false'
            ) {
              return false;
            }
          }

          return true;
        });

        setAraclar(aracList);
        
        if (aracList.length === 0) {
          setError('Aktif araç bulunamadı');
        }
      } catch (error: any) {
        const errorMessage = error?.message || error?.response?.data?.error || 'Araç listesi yüklenemedi';
        setError(errorMessage);
        showToast('error', errorMessage);
      } finally {
        setAraclarLoading(false);
      }
    };

    fetchAraclar();
  }, [isOpen]);

  // Modal kapandığında seçimi sıfırla
  useEffect(() => {
    if (!isOpen) {
      setSelectedAracId('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!selectedAracId) {
      setError('Lütfen bir araç seçiniz');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Seçilen araç ID'sini localStorage'a kaydet (eski sistem uyumluluğu için)
      localStorage.setItem('secilenAracId', selectedAracId);
      
      // Kullanıcı ID'sini al
      const userId = (user as any)?.id || (user as any)?.user_id || (user as any)?.userId;
      
      // apiRequest, success:false durumda zaten hata fırlatıyor;
      // buraya kadar geldiysek başarılı kabul edebiliriz.
      await startAracTakip(selectedAracId, userId);

      showToast('success', 'Araç takibi başlatıldı!');
      window.dispatchEvent(new CustomEvent('aracTakipDurumGuncellendi'));
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Araç takibi başlatılamadı';
      setError(errMessage);
      showToast('error', errMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const overlay = (
    <div
      ref={overlayRef}
      className="modal-react-arac-takip-overlay"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--toast-overlay-bg)',
        padding: 16,
      }}
      onClick={(e) => {
        if (!overlayCloseReadyRef.current) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={backdropRef} aria-hidden style={{ display: 'none' }} />
      <div
        ref={panelRef}
        className="modal-react-arac-takip-container relative overflow-hidden rounded-lg bg-white text-left shadow-xl sm:my-8 sm:w-full sm:max-w-lg"
        style={{
          background: '#fff',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
          {/* Header */}
          <div className="modal-react-arac-takip-content bg-white px-4 pt-5 pb-4 sm:p-6">
            <div className="modal-react-arac-takip-header flex items-start justify-between mb-4">
              <h3 className="modal-react-arac-takip-title text-lg font-medium leading-6 text-gray-900">
                Araç Takip
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="btn-close-modal"
                aria-label="Kapat"
              >
                <i className="icon-btn-kapat" aria-hidden />
              </button>
            </div>

            {/* Content */}
            <div className="modal-react-arac-takip-body mb-4">
              {araclarLoading ? (
                <div className="modal-react-arac-takip-loading flex items-center justify-center py-8">
                  <LoadingSpinner size="sm" />
                  <span className="modal-react-arac-takip-loading-text ml-2 text-sm text-gray-600">Araçlar yükleniyor...</span>
                </div>
              ) : (
                <>
                  {/* Araç Seçimi */}
                  <div className="modal-react-arac-takip-arac-secimi mb-4">
                    <label className="modal-react-arac-takip-label block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Van size={16} strokeWidth={2} className="vehicle-tracking-lucide-icon" />
                      <span>Araç Seçiniz</span>
                    </label>
                    <select
                      value={selectedAracId}
                      onChange={(e) => setSelectedAracId(e.target.value)}
                      className="modal-react-arac-takip-select w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={loading || araclar.length === 0}
                    >
                      <option value="">Araç seçiniz...</option>
                      {araclar.map((arac) => (
                        <option key={arac.id} value={arac.id.toString()}>
                          {arac.plaka} {arac.marka && arac.model ? `- ${arac.marka} ${arac.model}` : ''}
                        </option>
                      ))}
                    </select>
                    {araclar.length === 0 && !araclarLoading && (
                      <p className="modal-react-arac-takip-empty-text mt-2 text-sm text-gray-500">
                        Henüz araç eklenmemiş. Araç eklemek için Ayarlar &gt; Araç Takip ayarlarından yeni araç ekleyebilirsiniz.
                      </p>
                    )}
                  </div>

                  {/* Sürücü Bilgisi */}
                  <div className="modal-react-arac-takip-surucu-bilgisi mb-4">
                    <label className="modal-react-arac-takip-label block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <UserIcon size={16} strokeWidth={2} />
                      <span>Sürücü</span>
                    </label>
                    <input
                      type="text"
                      value={surucuAdi}
                      disabled
                      className="modal-react-arac-takip-surucu-input w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                  </div>

                  {error && (
                    <div className="modal-react-arac-takip-error mb-4 rounded-md bg-red-50 p-3">
                      <div className="modal-react-arac-takip-error-text text-sm text-red-800">{error}</div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Actions */}
            <div className="modal-react-arac-takip-actions flex">
              <button
                onClick={handleSubmit}
                disabled={loading || araclarLoading || !selectedAracId || araclar.length === 0}
                className="modal-react-arac-takip-submit btn-teslimata-ciktim flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'İşleniyor...' : 'Teslimata Çıktım'}
              </button>
            </div>
          </div>
        </div>
    </div>
  );

  return createPortal(overlay, document.body);
};

