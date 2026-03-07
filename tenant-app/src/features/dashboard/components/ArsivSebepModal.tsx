/**
 * Arşiv Sebep Seçim Modal Component
 * Sipariş veya organizasyon kartı arşivlenirken sebep seçimi için
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Archive, 
  AlertTriangle, 
  UserX, 
  XCircle, 
  CreditCard, 
  Copy,
  CheckCircle2,
  Calendar,
  File,
  UserMinus
} from 'lucide-react';

interface ArsivSebepModalProps {
  isOpen: boolean;
  tip: 'siparis' | 'organizasyon';
  onConfirm: (sebep: string) => void;
  onCancel: () => void;
}

const SIPARIS_SEBEPLERI = [
  { value: 'yanlis-siparis', label: 'Yanlış Sipariş', icon: AlertTriangle },
  { value: 'musteri-iptal', label: 'Müşteri İptal Etti', icon: UserX },
  { value: 'teslim-edilemedi', label: 'Teslim Edilemedi', icon: XCircle },
  { value: 'odeme-sorunu', label: 'Ödeme Sorunu', icon: CreditCard },
  { value: 'duplicate', label: 'Tekrar Eden Sipariş', icon: Copy },
];

const ORGANIZASYON_SEBEPLERI = [
  { value: 'siparisler-tamamlandi', label: 'Siparişler Tamamlandı', icon: CheckCircle2 },
  { value: 'organizasyon-iptal', label: 'Organizasyon İptal Edildi', icon: XCircle },
  { value: 'organizasyon-ertelendi', label: 'Organizasyon Ertelendi', icon: Calendar },
  { value: 'organizasyon-degisti', label: 'Organizasyon Değişti', icon: File },
  { value: 'yanlis-kart', label: 'Yanlış Kart', icon: AlertTriangle },
  { value: 'musteri-vazgecti', label: 'Müşteri Vazgeçti', icon: UserMinus },
];

/**
 * Sebep kodunu Türkçe metne çevir
 */
function getSebepText(sebepKodu: string): string {
  const sebepMetinleri: Record<string, string> = {
    // Sipariş sebepleri
    'yanlis-siparis': 'Yanlış Eklenmiş Sipariş',
    'musteri-iptal': 'Müşteri İptal Etti',
    'teslim-edilemedi': 'Teslim Edilemedi',
    'odeme-sorunu': 'Ödeme Sorunu',
    'duplicate': 'Tekrarlanmış Sipariş',
    
    // Organizasyon sebepleri
    'siparisler-tamamlandi': 'Teslim Edildi',
    'organizasyon-iptal': 'Organizasyon İptal Oldu',
    'organizasyon-ertelendi': 'Organizasyon Ertelendi',
    'organizasyon-degisti': 'Organizasyon Bilgileri Değişti',
    'yanlis-kart': 'Yanlış Oluşturulmuş Kart',
    'musteri-vazgecti': 'Müşteri Vazgeçti',
    
    // Eski kodlar (geriye dönük uyumluluk için)
    'teslim-edildi': 'Teslim Edildi'
  };
  return sebepMetinleri[sebepKodu] || sebepKodu;
}

export const ArsivSebepModal: React.FC<ArsivSebepModalProps> = ({
  isOpen,
  tip,
  onConfirm,
  onCancel,
}) => {
  const [selectedSebep, setSelectedSebep] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setSelectedSebep('');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (selectedSebep) {
      // Sebep kodunu Türkçe metne çevir ve gönder
      const sebepTurkce = getSebepText(selectedSebep);
      onConfirm(sebepTurkce);
      setSelectedSebep('');
    }
  };

  const handleCancel = () => {
    setSelectedSebep('');
    onCancel();
  };

  if (!isOpen) return null;

  const sebepler = tip === 'organizasyon' ? ORGANIZASYON_SEBEPLERI : SIPARIS_SEBEPLERI;

  const overlay = (
    <div
      className={`modal-react-arsiv-sebep-overlay ${isOpen ? 'show' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-react-arsiv-sebep-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleCancel();
        }
      }}
    >
      <div
        className="modal-react-arsiv-sebep-popup"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-react-arsiv-sebep-header">
          <div className="modal-react-arsiv-sebep-icon-wrapper">
            <Archive size={24} strokeWidth={1.5} />
          </div>
          <div className="modal-react-arsiv-sebep-header-content">
            <h2 id="modal-react-arsiv-sebep-title" className="modal-react-arsiv-sebep-title">
              {tip === 'organizasyon' ? 'Organizasyon Arşivleme' : 'Sipariş Arşivleme'}
            </h2>
            <p className="modal-react-arsiv-sebep-subtitle">
              {tip === 'organizasyon'
                ? 'Bu organizasyon kartını neden arşivliyorsunuz?'
                : 'Bu siparişi neden arşivliyorsunuz?'}
            </p>
          </div>
        </div>

        <div className="modal-react-arsiv-sebep-listesi">
          {sebepler.map((sebep) => {
            const IconComponent = sebep.icon;
            return (
              <label
                key={sebep.value}
                className={`modal-react-arsiv-sebep-option ${selectedSebep === sebep.value ? 'selected' : ''}`}
                onClick={() => setSelectedSebep(sebep.value)}
              >
                <input
                  type="radio"
                  name="modal-react-arsivSebep"
                  value={sebep.value}
                  checked={selectedSebep === sebep.value}
                  onChange={() => setSelectedSebep(sebep.value)}
                />
                <div className="modal-react-arsiv-sebep-option-content">
                  <IconComponent size={18} strokeWidth={1.5} className="modal-react-arsiv-sebep-option-icon" />
                  <span className="modal-react-arsiv-sebep-text">{sebep.label}</span>
                </div>
              </label>
            );
          })}
        </div>

        <div className="modal-react-arsiv-sebep-actions">
          <button
            type="button"
            className="modal-react-arsiv-sebep-btn modal-react-arsiv-sebep-cancel"
            onClick={handleCancel}
          >
            İPTAL
          </button>
          <button
            type="button"
            className="modal-react-arsiv-sebep-btn modal-react-arsiv-sebep-confirm"
            onClick={handleConfirm}
            disabled={!selectedSebep}
          >
            ONAYLA
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};
