/**
 * Yeni Partner Firma Ekle / Düzenle – Sağdan açılan panel (drawer)
 * Eski form referansı: üstte bilgi notu, logo alanı, büyük harf etiketler
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { invalidatePartnerQueries } from '../../../lib/invalidateQueries';
import { getApiBaseUrl } from '../../../lib/runtime';
import { getUploadUrl } from '../../../shared/utils/urlUtils';
import { showToast, showToastInteractive } from '../../../shared/utils/toastUtils';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { usePhoneInput } from '../../../shared/hooks/usePhoneInput';
import { useAddressSelect } from '../hooks/useAddressSelect';
import { X, Upload } from 'lucide-react';

export interface PartnerFormData {
  partner_firma_adi: string;
  partner_yetkili_kisi?: string;
  partner_telefon: string;
  partner_eposta?: string;
  partner_acik_adres?: string;
  partner_il?: string;
  partner_ilce?: string;
  partner_mahalle?: string;
}

interface PartnerForModal {
  id: number;
  partner_firma_adi?: string;
  firma_adi?: string;
  partner_logo?: string;
  partner_yetkili_kisi?: string;
  partner_telefon?: string;
  partner_eposta?: string;
  partner_acik_adres?: string;
  partner_il?: string;
  partner_ilce?: string;
  partner_mahalle?: string;
}

interface YeniPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
  partner?: PartnerForModal;
}

export const YeniPartnerModal: React.FC<YeniPartnerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  mode = 'create',
  partner,
}) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [firmaAdi, setFirmaAdi] = useState('');
  const [yetkiliKisi, setYetkiliKisi] = useState('');
  const phoneInput = usePhoneInput('');
  const [email, setEmail] = useState('');
  const [acikAdres, setAcikAdres] = useState('');
  const [isDirty, setDirty] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoIsNewUpload, setLogoIsNewUpload] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const addressSelect = useAddressSelect();

  const revokeLogoBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const resetForm = useCallback(() => {
    setFirmaAdi('');
    setYetkiliKisi('');
    phoneInput.setDisplayValue('');
    setEmail('');
    setAcikAdres('');
    revokeLogoBlob();
    setLogoPreviewUrl(null);
    setLogoIsNewUpload(false);
    setPendingLogoFile(null);
    addressSelect.reset();
    setDirty(false);
  }, [addressSelect, phoneInput, revokeLogoBlob]);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
      return;
    }
    if (mode === 'edit' && partner) {
      setFirmaAdi(partner.partner_firma_adi || partner.firma_adi || '');
      setYetkiliKisi(partner.partner_yetkili_kisi || '');
      phoneInput.setDisplayValue(partner.partner_telefon || '');
      setEmail(partner.partner_eposta || '');
      setAcikAdres(partner.partner_acik_adres || '');
      revokeLogoBlob();
      setLogoPreviewUrl(partner.partner_logo ? getUploadUrl(partner.partner_logo) : null);
      setLogoIsNewUpload(false);
      setPendingLogoFile(null);
      if (partner.partner_il) addressSelect.setIl(partner.partner_il, { skipClear: true });
      if (partner.partner_ilce) addressSelect.setIlce(partner.partner_ilce, { skipClear: true });
      if (partner.partner_mahalle) addressSelect.setMahalle(partner.partner_mahalle);
      setDirty(false);
    } else {
      revokeLogoBlob();
      setLogoPreviewUrl(null);
      setLogoIsNewUpload(false);
      setPendingLogoFile(null);
    }
    // resetForm / addressSelect / phoneInput değişince tekrar çalışmasın (max update depth önlenir)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, partner?.id]);

  /** Sadece dosya seçildiğinde önizleme yapar; sunucuya göndermez (Güncelle ile kaydedilir). */
  const handleLogoFileSelect = useCallback(
    (file: File) => {
      if (mode !== 'edit' || !partner?.id) {
        showToast('info', 'Önce partner firmayı kaydedin, ardından düzenle ile logo yükleyebilirsiniz.');
        return;
      }
      if (!/^image\//.test(file.type)) return;
      revokeLogoBlob();
      blobUrlRef.current = URL.createObjectURL(file);
      setLogoPreviewUrl(blobUrlRef.current);
      setPendingLogoFile(file);
      setLogoIsNewUpload(true);
      setDirty(true);
    },
    [mode, partner?.id, revokeLogoBlob]
  );

  /** Sunucuya logo yükler (toast/onSuccess yok; handleSubmit içinde kullanılır). */
  const uploadLogoToServer = useCallback(
    async (file: File): Promise<void> => {
      if (!partner?.id) return;
      const formData = new FormData();
      formData.append('logo', file);
      const token = localStorage.getItem('floovon_token') || localStorage.getItem('token');
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/partner-firmalar/${partner.id}/logo`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (json as { message?: string }).message || 'Logo yüklenemedi.';
        throw new Error(msg);
      }
    },
    [partner?.id]
  );

  const requestClose = useCallback(() => {
    if (!isDirty) {
      onClose();
      return;
    }
    showToastInteractive({
      title: 'Değişiklikleri Kaydet',
      message: 'Kaydedilmeyen değişiklikler var! Değişiklikleri kaydetmek istiyor musunuz?',
      confirmText: 'Evet, Kaydet',
      cancelText: 'İptal',
      onConfirm: async () => {
        (window as unknown as { closeInteractiveToastIfOpen?: () => void }).closeInteractiveToastIfOpen?.();
        if (formRef.current) {
          const form = formRef.current;
          if (form.checkValidity()) {
            form.requestSubmit();
          } else {
            form.reportValidity();
          }
        }
      },
      onCancel: () => {
        (window as unknown as { closeInteractiveToastIfOpen?: () => void }).closeInteractiveToastIfOpen?.();
        resetForm();
        onClose();
      },
    });
  }, [isDirty, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // HTML5 validation kontrolü - geçersizse tarayıcı kendi mesajını gösterir
    if (formRef.current && !formRef.current.checkValidity()) {
      formRef.current.reportValidity();
      return;
    }
    
    setLoading(true);
    try {
      const payload: Record<string, string | undefined> = {
        partner_firma_adi: firmaAdi.trim(),
        partner_yetkili_kisi: yetkiliKisi.trim() || undefined,
        partner_telefon: phoneInput.cleanValue,
        partner_eposta: email.trim() || undefined,
        partner_acik_adres: acikAdres.trim() || undefined,
        partner_il: addressSelect.il || undefined,
        partner_ilce: addressSelect.ilce || undefined,
        partner_mahalle: addressSelect.mahalle || undefined,
      };
      if (mode === 'edit' && partner?.id) {
        await apiRequest(`/partner-firmalar/${partner.id}`, {
          method: 'PUT',
          data: payload,
        });
        if (pendingLogoFile) {
          setLogoUploading(true);
          try {
            await uploadLogoToServer(pendingLogoFile);
          } catch (err: any) {
            setLogoUploading(false);
            showToast('error', err?.message || 'Logo yüklenemedi.');
            return;
          }
          setLogoUploading(false);
        }
        showToast('success', 'Partner firma güncellendi.');
      } else {
        await apiRequest('/partner-firmalar', {
          method: 'POST',
          data: payload,
        });
        showToast('success', 'Partner firma eklendi.');
      }
      invalidatePartnerQueries(queryClient, mode === 'edit' ? partner?.id : undefined);
      resetForm();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'İşlem başarısız.';
      showToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="partner-modal-drawer-overlay"
      onClick={(e) => e.target === e.currentTarget && requestClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-modal-title"
    >
      <div className="partner-modal-drawer">
        <div className="partner-modal-drawer-header">
          <h2 id="partner-modal-title" className="partner-modal-drawer-title">
            {mode === 'edit' ? 'Partner Firmayı Düzenle' : 'Yeni Partner Firma Ekle'}
          </h2>
          <button
            type="button"
            className="partner-modal-drawer-close"
            onClick={requestClose}
            aria-label="Kapat"
          >
            <X size={22} aria-hidden />
          </button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} className="partner-modal-drawer-body">
          <div className="partner-modal-info-note">
            <i className="partner-modal-info-icon" aria-hidden />
            <p>
              Lütfen partner firma bilgilerini doğru ve eksiksiz girdiğinizden emin olun. Organizasyon ve sipariş
              işlemlerindeki partner siparişi işlemlerinde bu bilgiler kullanılacaktır.
            </p>
          </div>

          <div className="partner-modal-field">
            <label className="partner-modal-label-uppercase">PARTNER LOGOSU</label>
            <div
              className={`partner-modal-logo-zone dosya-yukle-alan ${logoPreviewUrl ? 'dosya-secildi' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('partner-modal-logo-zone-dragover'); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove('partner-modal-logo-zone-dragover'); }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('partner-modal-logo-zone-dragover');
                const file = e.dataTransfer?.files?.[0];
                if (file) handleLogoFileSelect(file);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="partner-modal-logo-input file-input"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoFileSelect(file);
                  e.target.value = '';
                }}
              />
              {logoUploading && (
                <div className="partner-modal-logo-loading">
                  <LoadingSpinner size="sm" />
                </div>
              )}
              {logoPreviewUrl ? (
                <>
                  <img src={logoPreviewUrl} alt="" className="partner-modal-logo-preview" onError={() => { revokeLogoBlob(); setLogoPreviewUrl(null); setPendingLogoFile(null); setLogoIsNewUpload(false); }} />
                  <span className="secilen-dosya-metin">
                    {logoIsNewUpload ? 'Logo yüklendi' : 'Mevcut logo'}
                    {!logoIsNewUpload && <strong className="partner-modal-logo-hint-inline"> Yeni logo yüklemek için tıklayın</strong>}
                  </span>
                  <button
                    type="button"
                    className="remove-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      revokeLogoBlob();
                      setLogoPreviewUrl(null);
                      setPendingLogoFile(null);
                      setLogoIsNewUpload(false);
                      setDirty(true);
                    }}
                  >
                    Kaldır
                  </button>
                </>
              ) : (
                <>
                  <Upload size={18} strokeWidth={1.5} className="partner-modal-logo-zone-icon" aria-hidden />
                  <span className="file-label">Logo görselini sürükleyin veya tıklayın</span>
                </>
              )}
            </div>
            {mode === 'create' && (
              <p className="partner-modal-logo-hint">Partner kaydedildikten sonra düzenle ile logo yükleyebilirsiniz.</p>
            )}
          </div>

          <div className="partner-modal-field">
            <label htmlFor="partner-firma-adi" className="partner-modal-label-uppercase">PARTNER FİRMA ADI</label>
            <input
              id="partner-firma-adi"
              type="text"
              value={firmaAdi}
              onChange={(e) => {
                setFirmaAdi(e.target.value);
                setDirty(true);
              }}
              placeholder="Partner firma adını yazın"
              required
            />
          </div>
          <div className="partner-modal-field">
            <label htmlFor="partner-yetkili" className="partner-modal-label-uppercase">YETKİLİ KİŞİ</label>
            <input
              id="partner-yetkili"
              type="text"
              value={yetkiliKisi}
              onChange={(e) => {
                setYetkiliKisi(e.target.value);
                setDirty(true);
              }}
              placeholder="Yetkili kişi isim soyisim"
              required
            />
          </div>
          <div className="partner-modal-field">
            <label htmlFor="partner-telefon" className="partner-modal-label-uppercase">TELEFON NUMARASI</label>
            <input
              id="partner-telefon"
              type="tel"
              value={phoneInput.displayValue}
              onChange={(e) => {
                phoneInput.setDisplayValue(e.target.value);
                setDirty(true);
              }}
              placeholder="+90 (5XX) XXX XX XX"
              required
            />
          </div>
          <div className="partner-modal-field">
            <label htmlFor="partner-email" className="partner-modal-label-uppercase">E-POSTA ADRESİ</label>
            <input
              id="partner-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setDirty(true);
              }}
              placeholder="E-posta adresini yazın"
              required
            />
          </div>
          <div className="partner-modal-address-row partner-modal-address-il-ilce">
            <div className="partner-modal-field partner-modal-field-half">
              <label className="partner-modal-label-uppercase">İL</label>
              <select
                id="partner-adres-il"
                value={addressSelect.il}
                onChange={(e) => { addressSelect.setIl(e.target.value); setDirty(true); }}
                required
              >
                <option value="">İl Seçiniz</option>
                {addressSelect.ilOptions.map((il) => (
                  <option key={il.id} value={il.name}>{il.name}</option>
                ))}
              </select>
            </div>
            <div className="partner-modal-field partner-modal-field-half">
              <label className="partner-modal-label-uppercase">İLÇE</label>
              <select
                id="partner-adres-ilce"
                value={addressSelect.ilce}
                onChange={(e) => { addressSelect.setIlce(e.target.value); setDirty(true); }}
                disabled={!addressSelect.il}
                required
              >
                <option value="">İlçe Seçiniz</option>
                {addressSelect.ilceOptions.map((ilce) => (
                  <option key={ilce.id} value={ilce.name}>{ilce.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="partner-modal-field">
            <label className="partner-modal-label-uppercase">MAHALLE</label>
            <select
              id="partner-adres-mahalle"
              value={addressSelect.mahalle}
              onChange={(e) => { addressSelect.setMahalle(e.target.value); setDirty(true); }}
              disabled={!addressSelect.ilce}
              required
            >
              <option value="">Mahalle/Semt Seçiniz</option>
              {addressSelect.mahalleOptions.map((mahalle) => (
                <option key={mahalle.id} value={mahalle.name}>{mahalle.name}</option>
              ))}
            </select>
          </div>
          <div className="partner-modal-field">
            <label htmlFor="partner-adres" className="partner-modal-label-uppercase">AÇIK ADRES</label>
            <textarea
              id="partner-adres"
              value={acikAdres}
              onChange={(e) => {
                setAcikAdres(e.target.value);
                setDirty(true);
              }}
              placeholder="Sokak, bina no, vb."
              rows={3}
              required
            />
          </div>
          <div className="partner-modal-drawer-actions">
            <button type="button" className="secondary-button btn-vazgec" onClick={requestClose}>
              VAZGEÇ
            </button>
            <button type="submit" className="primary-button btn-kaydet" disabled={loading}>
              {loading ? <LoadingSpinner size="sm" /> : 'KAYDET'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};



















