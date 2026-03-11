/**
 * Yeni Müşteri Ekleme Modal Component
 * Tamamen React ile yeniden yazıldı
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useModalOpenAnimation } from '../../../shared/hooks/useModalOpenAnimation';
import { createMusteri, updateMusteri, type MusteriFormData } from '../api/formActions';
import { invalidateCustomerQueries } from '../../../lib/invalidateQueries';
import { useAddressSelect } from '../hooks/useAddressSelect';
import { showToast, showToastInteractive } from '../../../shared/utils/toastUtils';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { usePhoneInput } from '../../../shared/hooks/usePhoneInput';
import { User, FileText, FolderPen, MapPinHouse, Upload } from 'lucide-react';

interface YeniMusteriModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
  customer?: {
    id: number;
    musteri_unvani?: string;
    musteri_ad_soyad?: string;
    musteri_telefon?: string;
    musteri_eposta?: string;
    musteri_acik_adres?: string;
    musteri_il?: string;
    musteri_ilce?: string;
    musteri_mahalle?: string;
    musteri_tipi?: 'bireysel' | 'kurumsal';
    musteri_grubu?: string;
    musteri_vergi_kimlik_numarasi?: string;
    musteri_vergi_dairesi?: string;
    musteri_urun_yazisi?: string;
  };
}

export const YeniMusteriModal: React.FC<YeniMusteriModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  mode = 'create',
  customer,
}) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  // Form state
  const [musteriTipi, setMusteriTipi] = useState<'bireysel' | 'kurumsal'>('bireysel');
  const [musteriUnvani, setMusteriUnvani] = useState<string>('');
  const [yetkiliAdSoyad, setYetkiliAdSoyad] = useState<string>('');
  const yetkiliTelefonInput = usePhoneInput('');
  const [email, setEmail] = useState<string>('');
  const [musteriGrubu, setMusteriGrubu] = useState<string>('');
  const [vergiTipi, setVergiTipi] = useState<'gercekkisi' | 'tuzelkisi'>('gercekkisi');
  const [vergiUnvani, setVergiUnvani] = useState<string>('');
  const [vergiDairesi, setVergiDairesi] = useState<string>('');
  const [vergiNo, setVergiNo] = useState<string>('');
  const [urunYazisi, setUrunYazisi] = useState<string>('');
  const [urunYazisiGorsel, setUrunYazisiGorsel] = useState<File | null>(null);
  const [acikAdres, setAcikAdres] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [isDirty, setDirty] = useState(false);
  const [openAnimationDone, setOpenAnimationDone] = useState(false);
  const [isDragOverFile, setIsDragOverFile] = useState(false);

  // Adres seçimi
  const addressSelect = useAddressSelect();

  const markDirty = useCallback(() => setDirty(true), []);

  // Form reset
  const resetForm = useCallback(() => {
    setMusteriTipi('bireysel');
    setMusteriUnvani('');
    setYetkiliAdSoyad('');
    yetkiliTelefonInput.setDisplayValue('');
    setEmail('');
    setMusteriGrubu('');
    setVergiTipi('gercekkisi');
    setVergiUnvani('');
    setVergiDairesi('');
    setVergiNo('');
    setUrunYazisi('');
    setUrunYazisiGorsel(null);
    setAcikAdres('');
    addressSelect.reset();
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Çıkmak isteyince: değişiklik varsa onay sor
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
  }, [isDirty, onClose, resetForm]);

  // Modal kapandığında formu resetle ve animasyon bayrağını sıfırla
  useEffect(() => {
    if (!isOpen) {
      resetForm();
      setOpenAnimationDone(false);
    }
  }, [isOpen, resetForm]);

  // Edit modunda müşteri verilerini forma sadece modal açıldığında bir kez doldur (input'ları kilitlememek için)
  const editPopulatedIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isOpen) {
      editPopulatedIdRef.current = null;
      return;
    }
    if (mode !== 'edit' || !customer) return;
    if (editPopulatedIdRef.current === customer.id) return;
    editPopulatedIdRef.current = customer.id;

    setMusteriTipi(customer.musteri_tipi === 'kurumsal' ? 'kurumsal' : 'bireysel');
    setMusteriUnvani(customer.musteri_unvani || '');
    setYetkiliAdSoyad(customer.musteri_ad_soyad || '');
    yetkiliTelefonInput.setDisplayValue(customer.musteri_telefon || '');
    setEmail(customer.musteri_eposta || '');
    setMusteriGrubu(customer.musteri_grubu || '');
    setVergiUnvani(customer.musteri_unvani || '');
    setVergiDairesi(customer.musteri_vergi_dairesi || '');
    setVergiNo(customer.musteri_vergi_kimlik_numarasi || '');
    setUrunYazisi(customer.musteri_urun_yazisi || '');
    setAcikAdres(customer.musteri_acik_adres || '');
    // Adres: il/ilçe değişince hook ilçe ve mahallei temizliyor; doldurma sırasında temizlenmesin diye skipClear kullan
    if (customer.musteri_il) {
      addressSelect.setIl(customer.musteri_il, { skipClear: true });
    }
    if (customer.musteri_ilce) {
      addressSelect.setIlce(customer.musteri_ilce, { skipClear: true });
    }
    if (customer.musteri_mahalle) {
      addressSelect.setMahalle(customer.musteri_mahalle);
    }
    setDirty(false);
    // Sadece modal açıldığında / müşteri değiştiğinde doldur; addressSelect/yetkiliTelefonInput her render'da değişebildiği için deps'te yok
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, customer]);

  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useModalOpenAnimation(isOpen, overlayRef, panelRef, { onOpenComplete: () => setOpenAnimationDone(true) });

  // Hatalı alanı odakla; toast ile birlikte tarayıcının kendi uyarı balonunda da mesaj gösterilir (setCustomValidity + reportValidity)
  const focusInvalidField = useCallback((id: string, nativeMessage?: string) => {
    requestAnimationFrame(() => {
      const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
      if (!el) return;
      if (nativeMessage && typeof (el as HTMLInputElement).setCustomValidity === 'function') {
        (el as HTMLInputElement).setCustomValidity(nativeMessage);
      }
      if (el.focus) el.focus();
      if (typeof el.reportValidity === 'function') el.reportValidity();
    });
  }, []);

  // Form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // HTML5 validation kontrolü - geçersizse tarayıcı kendi mesajını gösterir
    if (formRef.current && !formRef.current.checkValidity()) {
      formRef.current.reportValidity();
      return;
    }
    
    // Özel validasyonlar (telefon formatı, email formatı)
    const cleanPhone = yetkiliTelefonInput.cleanValue;
    if (cleanPhone.length < 12) {
      const telInput = document.getElementById('musteriyetkilitelefon') as HTMLInputElement;
      if (telInput) {
        telInput.setCustomValidity('Lütfen geçerli bir telefon numarası girin (10 hane).');
        telInput.reportValidity();
      }
      return;
    }
    
    const emailTrimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      const emailInput = document.getElementById('musteri-email') as HTMLInputElement;
      if (emailInput) {
        emailInput.setCustomValidity('Lütfen e-posta adresini bu formatta yazın (örnek: ad@alan.com).');
        emailInput.reportValidity();
      }
      return;
    }
    
    setLoading(true);

    try {

      const formData: MusteriFormData = {
        name: musteriUnvani || yetkiliAdSoyad,
        musteri_unvani: musteriUnvani || undefined,
        musteri_ad_soyad: yetkiliAdSoyad || undefined,
        musteri_telefon: yetkiliTelefonInput.cleanValue,
        musteri_eposta: email || undefined,
        musteri_acik_adres: acikAdres || '',
        musteri_il: addressSelect.il,
        musteri_ilce: addressSelect.ilce,
        musteri_mahalle: addressSelect.mahalle,
        musteri_tipi: musteriTipi,
        musteri_grubu: musteriGrubu,
        musteri_vergi_kimlik_numarasi: vergiNo || undefined,
        musteri_vergi_dairesi: vergiDairesi || undefined,
        musteri_urun_yazisi: urunYazisi || undefined,
        urun_yazisi_gorsel: urunYazisiGorsel || undefined,
      };

      const result =
        mode === 'edit' && customer?.id
          ? await updateMusteri(customer.id, formData)
          : await createMusteri(formData);

      if (result?.success) {
        showToast('success', mode === 'edit' ? 'Müşteri başarıyla güncellendi!' : 'Müşteri başarıyla eklendi!');
        invalidateCustomerQueries(queryClient, mode === 'edit' ? customer?.id : undefined);
        resetForm();
        onSuccess?.();
        onClose();
      } else {
        const msg = result?.message || 'Müşteri eklenemedi!';
        showToast('error', msg);
      }
    } catch (err: any) {
      console.error('Müşteri ekleme hatası:', err);
      const errorMessage = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Müşteri eklenemedi!';
      showToast('error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Ürün yazısı görseli seçildiğinde (hook değil, erken dönüşten önce tanımlanabilir)
  const handleUrunYazisiGorselChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUrunYazisiGorsel(file);
      markDirty();
    }
  };

  const handleUrunYazisiDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setUrunYazisiGorsel(file);
      markDirty();
    }
  };

  const handleUrunYazisiDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Uzun dosya adını kısalt (taşmayı önlemek için, form genişliğini bozmasın)
  const truncateFileName = (name: string, maxLen = 18) => {
    if (!name || name.length <= maxLen) return name;
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
    const base = name.slice(0, name.length - ext.length);
    const keep = maxLen - ext.length - 3; // 3 = "..."
    return keep > 0 ? base.slice(0, keep) + '...' + ext : name.slice(0, maxLen - 3) + '...';
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      ref={overlayRef}
      className={`overlay-yeni-musteri-container ${isOpen ? 'show' : ''}`}
      style={isOpen && !openAnimationDone ? { opacity: 0 } : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          requestClose();
        }
      }}
    >
      <div 
        ref={panelRef}
        className={`yeni-musteri-container ${isOpen ? 'show' : ''}`}
        style={isOpen && !openAnimationDone ? { opacity: 0, transform: 'scale(0.99)' } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="header-alan">
          <div className="modal-yeni-musteri-header-baslik">
            {mode === 'edit' ? 'Müşteri Düzenle' : 'Yeni Müşteri Ekle'}
          </div>
          <button className="btn-close-modal" onClick={requestClose} type="button">
            <i className="icon-btn-kapat"></i>
          </button>
        </div>
        <form ref={formRef} id="form-musteri" onSubmit={handleSubmit} noValidate>
          <div className="container-musteri-bilgileri">
            <div className="musteri-form-alan">
              <div className="sol-alan">
                  {/* Kişi/Firma Bilgileri */}
                  <div className="kisi-firma-bilgileri">
                    <div className="alan-baslik">
                      <div className="modal-yeni-musteri-baslik">
                        <User size={18} strokeWidth={1.5} aria-hidden />
                        Kişi/Firma Bilgileri
                      </div>
                      <span>Müşteri/Firma bilgilerini yazınız</span>
                    </div>
                    <div className="input-icerik-alan">
                      <div className="radio-buttons">
                        <div className="radio-button">
                          <input
                            type="radio"
                            id="bireysel"
                            name="musteri-tipi"
                            value="bireysel"
                            checked={musteriTipi === 'bireysel'}
                            onChange={(e) => { setMusteriTipi(e.target.value as 'bireysel' | 'kurumsal'); markDirty(); }}
                          />
                          <label htmlFor="bireysel">BİREYSEL</label>
                        </div>
                        <div className="radio-button">
                          <input
                            type="radio"
                            id="kurumsal"
                            name="musteri-tipi"
                            value="kurumsal"
                            checked={musteriTipi === 'kurumsal'}
                            onChange={(e) => { setMusteriTipi(e.target.value as 'bireysel' | 'kurumsal'); markDirty(); }}
                          />
                          <label htmlFor="kurumsal">KURUMSAL</label>
                        </div>
                      </div>
                      
                      <input
                        id="musteriunvani"
                        type="text"
                        value={musteriUnvani}
                        onChange={(e) => { (e.target as HTMLInputElement).setCustomValidity(''); setMusteriUnvani(e.target.value); markDirty(); }}
                        placeholder="Müşteri Unvanı"
                        required
                      />
                      <div className="input-icerik-grup">
                        <input
                          id="musteriyetkiliadsoyad"
                          type="text"
                          value={yetkiliAdSoyad}
                          onChange={(e) => { (e.target as HTMLInputElement).setCustomValidity(''); setYetkiliAdSoyad(e.target.value); markDirty(); }}
                          placeholder="Yetkili Kişi"
                          required
                        />
                        <input
                          ref={yetkiliTelefonInput.inputRef}
                          id="musteriyetkilitelefon"
                          className="telefon-input"
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          value={yetkiliTelefonInput.displayValue}
                          onChange={(e) => { (e.target as HTMLInputElement).setCustomValidity(''); yetkiliTelefonInput.handleChange(e); markDirty(); }}
                          onKeyDown={yetkiliTelefonInput.handleKeyDown}
                          onFocus={yetkiliTelefonInput.handleFocus}
                          onPaste={(e) => { (e.target as HTMLInputElement).setCustomValidity(''); yetkiliTelefonInput.handlePaste(e); markDirty(); }}
                          placeholder="+90 (5xx xxx xx xx)"
                          required
                          data-phone-input="standard"
                        />
                      </div>
                      <input
                        id="musteri-email"
                        type="email"
                        value={email}
                        onChange={(e) => { (e.target as HTMLInputElement).setCustomValidity(''); setEmail(e.target.value); markDirty(); }}
                        placeholder="E-posta Adresi"
                        required
                      />
                      <div className="musteri-grubu-wrapper">
                        <label htmlFor="musterigrubu">Müşteri Grubu</label>
                        <span>Kampanya yönetiminde kullanılacak müşteri grubu bilgisidir.</span>
                        <input
                          id="musterigrubu"
                          type="text"
                          value={musteriGrubu}
                          onChange={(e) => { (e.target as HTMLInputElement).setCustomValidity(''); setMusteriGrubu(e.target.value); markDirty(); }}
                          placeholder="Müşteri Grubu (Kurumsal, Bireysel, VIP vb.)"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Vergi Kimlik Bilgileri */}
                  <div className="vergi-kimlik-bilgileri">
                    <div className="alan-baslik">
                      <div className="modal-yeni-musteri-baslik">
                        <FileText size={18} strokeWidth={1.5} aria-hidden />
                        Vergi Kimlik Bilgileri
                      </div>
                      <span>Müşteri/Firma vergi kimlik bilgilerini yazınız</span>
                    </div>
                    <div className="input-icerik-alan">
                      <div className="radio-buttons">
                        <div className="radio-button">
                          <input
                            type="radio"
                            id="gercekkisi"
                            name="vergitipi"
                            value="gercekkisi"
                            checked={vergiTipi === 'gercekkisi'}
                            onChange={(e) => { setVergiTipi(e.target.value as 'gercekkisi' | 'tuzelkisi'); markDirty(); }}
                          />
                          <label htmlFor="gercekkisi">GERÇEK KİŞİ</label>
                        </div>
                        <div className="radio-button">
                          <input
                            type="radio"
                            id="tuzelkisi"
                            name="vergitipi"
                            value="tuzelkisi"
                            checked={vergiTipi === 'tuzelkisi'}
                            onChange={(e) => { setVergiTipi(e.target.value as 'gercekkisi' | 'tuzelkisi'); markDirty(); }}
                          />
                          <label htmlFor="tuzelkisi">TÜZEL KİŞİ</label>
                        </div>
                      </div>
                      <input
                        id="musterivergiunvani"
                        type="text"
                        value={vergiUnvani}
                        onChange={(e) => { setVergiUnvani(e.target.value); markDirty(); }}
                        placeholder="Müşteri Vergi Unvanı"
                      />
                      <div className="input-icerik-grup">
                        <input
                          id="musterivergidairesi"
                          type="text"
                          value={vergiDairesi}
                          onChange={(e) => { setVergiDairesi(e.target.value); markDirty(); }}
                          placeholder="Vergi Dairesi"
                        />
                        <input
                          id="musterivergino"
                          type="text"
                          value={vergiNo}
                          onChange={(e) => { setVergiNo(e.target.value); markDirty(); }}
                          placeholder="Vergi Kimlik No"
                        />
                    </div>
                  </div>
                </div>
              </div>
              <div className="sag-alan">
                  {/* Ürün Yazısı veya Logo */}
                  <div className="musteri-logosu">
                    <div className="alan-baslik">
                      <div className="modal-yeni-musteri-baslik">
                        <FolderPen size={18} strokeWidth={1.5} aria-hidden />
                        Ürün Yazısı veya Logo
                      </div>
                      <span>Müşteri ürün yazısı yazın veya yazı dosyası yükleyin</span>
                    </div>
                    <div className="input-icerik-alan">
                      <textarea
                        id="urunyazisi"
                        rows={4}
                        cols={50}
                        name="urun_yazisi"
                        value={urunYazisi}
                        onChange={(e) => { (e.target as HTMLTextAreaElement).setCustomValidity(''); setUrunYazisi(e.target.value); markDirty(); }}
                        placeholder="Müşteri ürün üzeri yazısı (Örnek : Ahmet Örnek Mutlukuklar Dilerim vb.)"
                        required
                      />
                    </div>
                    <div
                      className={`dosya-yukle-alan ${urunYazisiGorsel ? 'dosya-secildi' : ''} ${isDragOverFile ? 'drag-over' : ''}`}
                      id="urun-yazisi-yukle"
                      role="button"
                      tabIndex={0}
                      onClick={() => !urunYazisiGorsel && fileInputRef.current?.click()}
                      onKeyDown={(e) => e.key === 'Enter' && !urunYazisiGorsel && fileInputRef.current?.click()}
                      onDragEnter={() => !urunYazisiGorsel && setIsDragOverFile(true)}
                      onDragLeave={(e) => {
                        const el = e.currentTarget;
                        const next = e.relatedTarget as Node | null;
                        if (!next || !el.contains(next)) setIsDragOverFile(false);
                      }}
                      onDragOver={handleUrunYazisiDragOver}
                      onDrop={handleUrunYazisiDrop}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="file-input"
                        accept="image/*"
                        onChange={handleUrunYazisiGorselChange}
                        style={{ display: 'none' }}
                        id="urun-yazisi-gorsel-input"
                      />
                      {urunYazisiGorsel ? (
                        <>
                          <span className="secilen-dosya-metin">
                            Seçilen dosya: {truncateFileName(urunYazisiGorsel.name)}
                          </span>
                          <button
                            type="button"
                            className="remove-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUrunYazisiGorsel(null);
                              markDirty();
                            }}
                          >
                            Kaldır
                          </button>
                        </>
                      ) : (
                        <>
                          <Upload size={18} strokeWidth={1.5} aria-hidden />
                          <span className="file-label">Ürün yazısını buraya sürükleyin veya tıklayın</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Adres Bilgileri */}
                  <div className="iletisim-bilgileri">
                    <div className="alan-baslik">
                      <div className="modal-yeni-musteri-baslik">
                        <MapPinHouse size={18} strokeWidth={1.5} aria-hidden />
                        Adres Bilgileri
                      </div>
                      <span>Müşteri adres bilgilerini ekleyin</span>
                    </div>
                    <div className="input-icerik-alan">
                      <div className="input-icerik-grup" id="il-ilce">
                        <select
                          id="adres-il"
                          value={addressSelect.il}
                          onChange={(e) => { (e.target as HTMLSelectElement).setCustomValidity(''); addressSelect.setIl(e.target.value); markDirty(); }}
                          required
                        >
                          <option value="">İl Seçiniz</option>
                          {addressSelect.ilOptions.map((il) => (
                            <option key={il.id} value={il.name}>
                              {il.name}
                            </option>
                          ))}
                        </select>
                        <select
                          id="adres-ilce"
                          value={addressSelect.ilce}
                          onChange={(e) => { (e.target as HTMLSelectElement).setCustomValidity(''); addressSelect.setIlce(e.target.value); markDirty(); }}
                          required
                          disabled={!addressSelect.il}
                        >
                          <option value="">İlçe Seçiniz</option>
                          {addressSelect.ilceOptions.map((ilce) => (
                            <option key={ilce.id} value={ilce.name}>
                              {ilce.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <select
                        id="adres-mahalle"
                        value={addressSelect.mahalle}
                        onChange={(e) => { (e.target as HTMLSelectElement).setCustomValidity(''); addressSelect.setMahalle(e.target.value); markDirty(); }}
                        required
                        disabled={!addressSelect.ilce}
                      >
                        <option value="">Mahalle/Semt Seçiniz</option>
                        {addressSelect.mahalleOptions.map((mahalle) => (
                          <option key={mahalle.id} value={mahalle.name}>
                            {mahalle.name}
                          </option>
                        ))}
                      </select>
                      <textarea
                        id="acikadres"
                        name="acikadres"
                        value={acikAdres}
                        onChange={(e) => { (e.target as HTMLTextAreaElement).setCustomValidity(''); setAcikAdres(e.target.value); markDirty(); }}
                        placeholder="Açık adresi yazınız"
                        rows={3}
                        required
                      />
                  </div>
                </div>
              </div>
            </div>
            <div className="alt-alan">
              <div className="butonlar">
                <button className="secondary-button btn-vazgec" type="button" onClick={requestClose}>
                  VAZGEÇ
                </button>
                <button id="kaydet" type="submit" className="primary-button btn-kaydet" disabled={loading}>
                  {loading ? <LoadingSpinner size="sm" /> : 'KAYDET'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
