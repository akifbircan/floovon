/**
 * Sıcak Satış Ekle Modal
 * Eski sayfa yapısına birebir uyumlu: header + subtitle, Ürün Adı, Adet + Ürün Fiyatı yan yana, Satış Türü radyo (Nakit / Havale/EFT / POS), VAZGEÇ/KAYDET (müşteri ekle ile aynı buton stilleri).
 * Backend: POST /api/sicak-satislar (urun_adi, miktar, tutar, satis_turu)
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { showToast } from '../../../shared/utils/toastUtils';
import { parseTL, formatTutarInputLive, formatTutarInputKeyDown } from '../../../shared/utils/formatUtils';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { apiRequest } from '../../../lib/api';

interface SicakSatisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SicakSatisModal: React.FC<SicakSatisModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [urunAdi, setUrunAdi] = useState('');
  const [adet, setAdet] = useState('1');
  const [fiyat, setFiyat] = useState('');
  const [satisTuru, setSatisTuru] = useState<'nakit' | 'havale' | 'pos' | ''>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urunAdi.trim()) {
      showToast('warning', 'Ürün adı en az 2 karakter olmalı');
      return;
    }
    const fiyatNum = parseFloat(
      fiyat.replace(/\s*TL\s*/gi, '').replace(/\./g, '').replace(',', '.') || '0'
    );
    if (isNaN(fiyatNum) || fiyatNum <= 0) {
      showToast('warning', 'Geçerli bir ürün fiyatı giriniz');
      return;
    }
    if (!satisTuru) {
      showToast('warning', 'Satış türü seçiniz');
      return;
    }

    setLoading(true);
    try {
      await apiRequest<{ success?: boolean }>('/sicak-satislar', {
        method: 'POST',
        data: {
          urun_adi: urunAdi.trim(),
          miktar: parseInt(adet, 10) || 1,
          tutar: fiyatNum,
          satis_turu: satisTuru,
        },
      });
      showToast('success', 'Sıcak satış başarıyla eklendi!');
      setUrunAdi('');
      setAdet('1');
      setFiyat('');
      setSatisTuru('');
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
      const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Sıcak satış eklenemedi';
      showToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const overlay = (
    <div
      className={`sicak-satis-overlay ${isOpen ? 'show' : ''}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="sicak-satis-popup" onClick={(e) => e.stopPropagation()}>
        <div className="header-alan">
          <div className="sicak-satis-modal-baslik">
            <i className="fas fa-fire" aria-hidden />
            Sıcak Satış Ekle
            <div className="sicak-satis-modal-subtitle">
              Mağaza müşterisine yaptığınız sıcak satışı ekleyin
            </div>
          </div>
          <button type="button" className="btn-close-form" onClick={onClose} aria-label="Kapat">
            <i className="icon-btn-kapat" aria-hidden />
          </button>
        </div>

        <form className="sicak-satis-form" id="sicakSatisForm" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="sicak-urunAdi">Ürün Adı</label>
            <input
              type="text"
              id="sicak-urunAdi"
              placeholder="Ürün adını yazınız"
              value={urunAdi}
              onChange={(e) => setUrunAdi(e.target.value)}
              required
            />
          </div>

          <div className="form-group-wrapper">
            <div className="form-group">
              <label htmlFor="sicak-adet">Adet</label>
              <input
                type="number"
                id="sicak-adet"
                placeholder="1"
                min={1}
                max={999}
                value={adet}
                onChange={(e) => setAdet(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="sicak-fiyat">Ürün Fiyatı</label>
              <input
                type="text"
                inputMode="decimal"
                id="sicak-fiyat"
                className="tl-input"
                placeholder="0,00"
                value={fiyat}
                onChange={(e) => setFiyat(formatTutarInputLive(e.target.value))}
                onKeyDown={(e) => formatTutarInputKeyDown(e, fiyat)}
                required
                aria-label="Ürün fiyatı (TL)"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="sicak-satisTuru">Satış Türü Seçiniz</label>
            <select
              id="sicak-satisTuru"
              value={satisTuru}
              onChange={(e) => setSatisTuru(e.target.value as 'nakit' | 'havale' | 'pos')}
              required
            >
              <option value="">Seçiniz</option>
              <option value="nakit">Nakit</option>
              <option value="havale">Havale/EFT</option>
              <option value="pos">POS</option>
            </select>
          </div>
        </form>

        <div className="butonlar">
          <button
            type="button"
            className="secondary-button btn-vazgec"
            onClick={onClose}
            disabled={loading}
          >
            VAZGEÇ
          </button>
          <button
            type="submit"
            form="sicakSatisForm"
            className="primary-button btn-kaydet"
            disabled={loading}
          >
            {loading ? <LoadingSpinner size="sm" /> : 'KAYDET'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};
