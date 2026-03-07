/**
 * Sipariş Düzenleme Modal Component
 * Eski sistemdeki gibi ortada açılır; tüm alanlar eski form yapısına uygun.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { updateSiparis, createSiparis, type SiparisFormData } from '../api/siparisActions';
import { invalidateSiparisGuncellemeQueries } from '../../../lib/invalidateQueries';
import { getOrganizasyonKartDetay } from '../api/kartActions';
import { useSiparisKartlari } from '../hooks/useDashboardData';
import { useAddressSelect } from '../hooks/useAddressSelect';
import { useUrunVerileri } from '../hooks/useUrunVerileri';
import { useMusteriler } from '../hooks/useMusteriler';
import { usePartnerFirmalar } from '../hooks/usePartnerFirmalar';
import { useAuth } from '../../../app/providers/AuthProvider';
import { apiRequest } from '../../../lib/api';
import { showToast, showToastInteractive } from '../../../shared/utils/toastUtils';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { usePhoneInput } from '../../../shared/hooks/usePhoneInput';
import { getUploadUrl } from '../../../shared/utils/urlUtils';
import { getProfileImageUrl } from '../../../shared/utils/userUtils';
import { getApiBaseUrl } from '../../../lib/runtime';
import { formatDateToDisplay } from '../../../shared/utils/dateUtils';
import { appendIlceIlToAddress, formatPhoneNumber, formatTLDisplayValue, parseTL, formatTutarInputLive, formatTutarInputKeyDown } from '../../../shared/utils/formatUtils';
import type { Order } from '../types';
import { Lightbox } from '../../../shared/components/Lightbox';
import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import { User, FileText, Package, Banknote, Car, MapPin, Upload, Tag } from 'lucide-react';

interface SiparisEditModalProps {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SiparisEditModal: React.FC<SiparisEditModalProps> = ({
  isOpen,
  order,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [organizasyonData, setOrganizasyonData] = useState<any>(null);
  const [siparisFormLightboxOpen, setSiparisFormLightboxOpen] = useState(false);
  const [isDirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const partnerValidationInputRef = useRef<HTMLInputElement>(null);
  const markDirty = useCallback(() => setDirty(true), []);

  // Müşteri ve ürün verileri
  const { musteriler } = useMusteriler();
  const { partnerFirmalar } = usePartnerFirmalar();
  const { urunVerileriArray } = useUrunVerileri();

  // Araç süsleme kartındayken sadece araç süsleme kategorisindeki ürünleri listele
  const isAracSuslemeKart = useMemo(() => {
    const raw = organizasyonData?.kart_tur || organizasyonData?.kart_turu || '';
    const t = raw.toLowerCase().replace(/-/g, '').replace(/\s/g, '');
    return t === 'aracsusleme' || t === 'araçsüsleme';
  }, [organizasyonData?.kart_tur, organizasyonData?.kart_turu]);

  // Araç süsleme kartında sadece araç süsleme ürünleri; diğer organizasyonlarda araç süsleme ürünleri listelenmez
  const urunListesiForSelect = useMemo(() => {
    const isAracSuslemeUrun = (u: { kategori?: string | null }) => {
      const k = (u.kategori || '').toLowerCase();
      return k.includes('araç') || k.includes('arac') || k.includes('süsleme') || k.includes('susleme');
    };
    if (isAracSuslemeKart) {
      return urunVerileriArray.filter(isAracSuslemeUrun);
    }
    return urunVerileriArray.filter((u) => !isAracSuslemeUrun(u));
  }, [urunVerileriArray, isAracSuslemeKart]);

  // Form state
  const [secilenMusteriId, setSecilenMusteriId] = useState<number | string>('');
  const [musteriUnvani, setMusteriUnvani] = useState<string>('');
  const [musteriIsimSoyisim, setMusteriIsimSoyisim] = useState<string>('');
  const siparisVerenTelefonInput = usePhoneInput('');
  const [urunYazisi, setUrunYazisi] = useState<string>('');
  const [urunYazisiDosya, setUrunYazisiDosya] = useState<File | null>(null);
  const [, setUrunYazisiDosyaPreview] = useState<string>('');
  const [isDragOverUrunYazisi, setIsDragOverUrunYazisi] = useState(false);
  const urunYazisiFileInputRef = useRef<HTMLInputElement>(null);
  /** Müşteriye ait mevcut ürün yazı dosyalarından seçilen dosya adı (string). Yükleme değil, mevcut dosya seçimi. */
  const [secilenMevcutDosyaAdi, setSecilenMevcutDosyaAdi] = useState<string | null>(null);
  const [musteriUrunYaziDosyalari, setMusteriUrunYaziDosyalari] = useState<Array<{ name: string; url?: string; path?: string }>>([]);
  const [musteriDosyalarLoading, setMusteriDosyalarLoading] = useState(false);
  const [secilenUrunId, setSecilenUrunId] = useState<number | string>('');
  const [siparisUrun, setSiparisUrun] = useState<string>('');
  const [siparisUrunAciklama, setSiparisUrunAciklama] = useState<string>('');
  const [siparisTutari, setSiparisTutari] = useState<string>('');
  const [odemeYontemi, setOdemeYontemi] = useState<string>('nakit');
  const [ekstraNot, setEkstraNot] = useState<string>('');
  const [ekstraUcretAciklama, setEkstraUcretAciklama] = useState<string>('');
  const [ekstraUcretTutari, setEkstraUcretTutari] = useState<string>('');
  
  // Partner sipariş – eski sistemle birebir: checkbox + detay (radio + partner firma listesi)
  const [partnerSiparis, setPartnerSiparis] = useState(false);
  const [partnerSiparisTuru, setPartnerSiparisTuru] = useState<'verilen' | 'gelen'>('verilen');
  const [secilenPartnerId, setSecilenPartnerId] = useState<number | string>('');
  const [partnerFirmaAdi, setPartnerFirmaAdi] = useState<string>('');
  const [partnerFirmaTelefon, setPartnerFirmaTelefon] = useState<string>('');
  
  // Araç süsleme için
  const [aracMarkaModel, setAracMarkaModel] = useState<string>('');
  const [aracRenk, setAracRenk] = useState<string>('');
  const [aracPlaka, setAracPlaka] = useState<string>('');
  const [aracRandevuSaat, setAracRandevuSaat] = useState<string>('');

  // Teslim bilgileri
  const [teslimKisisi, setTeslimKisisi] = useState<string>('');
  const teslimKisisiTelefonInput = usePhoneInput('');
  const [teslimSaat, setTeslimSaat] = useState<string>('');
  const [teslimAcikAdres, setTeslimAcikAdres] = useState<string>('');

  // Adres state'leri - controlled component olarak
  const [selectedIl, setSelectedIl] = useState<string>('');
  const [selectedIlce, setSelectedIlce] = useState<string>('');
  const [selectedMahalle, setSelectedMahalle] = useState<string>('');
  
  // Adres seçimi hook'u - sadece options için
  const addressSelect = useAddressSelect(selectedIl, selectedIlce, selectedMahalle);
  const orderIdRef = React.useRef<string | number | null>(null);
  const davetiyeHizliYukleRef = React.useRef<HTMLInputElement>(null);
  const [davetiyeYukleniyor, setDavetiyeYukleniyor] = useState(false);

  // Organizasyon verilerini yükle
  useEffect(() => {
    if (isOpen && order?.organizasyon_id) {
      getOrganizasyonKartDetay(order.organizasyon_id).then((data) => {
        if (data) {
          setOrganizasyonData(data);
        }
      });
    }
  }, [isOpen, order?.organizasyon_id]);

  // Org kartındaki gibi: teslim edilen / toplam sipariş (0/3 formatı)
  const { data: siparisler = [] } = useSiparisKartlari(order?.organizasyon_id ?? null);
  const toplamSiparisDisplay = useMemo(() => {
    const teslimEdilen = siparisler.filter((s) => s.durum === 'teslim').length;
    const toplam = siparisler.length > 0
      ? siparisler.length
      : (organizasyonData?.toplam_siparis_sayisi ?? organizasyonData?.siparis_sayisi ?? 0);
    return { teslimEdilen, toplam };
  }, [siparisler, organizasyonData?.toplam_siparis_sayisi, organizasyonData?.siparis_sayisi]);

  // Form'u order verileriyle doldur - sadece modal açıldığında ve order değiştiğinde
  useEffect(() => {
    if (!isOpen || !order) {
      orderIdRef.current = null;
      return;
    }

    // Sadece order ID değiştiğinde güncelle (sonsuz döngüyü önle)
    if (orderIdRef.current === order.id) return;
    orderIdRef.current = order.id;

    // State'leri set et
    const rawOrder = (order as any)._raw || order;
    setSecilenMusteriId(rawOrder.musteri_id || '');
    setMusteriUnvani(order.musteriAdi || rawOrder.musteri_unvan || '');
    setMusteriIsimSoyisim(rawOrder.musteri_isim_soyisim || '');
    siparisVerenTelefonInput.setDisplayValue(order.telefon || rawOrder.siparis_veren_telefon || '');
    setUrunYazisi(order.urunYazisi || rawOrder.urun_yazisi || '');
    setEkstraNot((rawOrder as any).notes || (rawOrder as any).comment || '');
    setSecilenMevcutDosyaAdi((order as any).secilenUrunYaziDosyasi || rawOrder.secilen_urun_yazi_dosyasi || null);
    setSecilenUrunId(rawOrder.siparis_urun_id || '');
    setSiparisUrun(order.urun || rawOrder.siparis_urun || '');
    setSiparisUrunAciklama((rawOrder as any).siparis_urun_aciklama || '');
    setSiparisTutari(formatTLDisplayValue(order.tutar ?? rawOrder.siparis_tutari ?? 0));
    setEkstraUcretTutari(formatTLDisplayValue((rawOrder as any).ekstra_ucret_tutari ?? 0));
    const oy = (order.odemeYontemi || rawOrder.odeme_yontemi || 'nakit') as string;
    const oyNorm = (v: string) => {
      const l = (v || '').toLowerCase();
      if (l.includes('cari') || l.includes('hesap')) return 'cari';
      if (l.includes('havale') || l.includes('eft')) return 'havale_eft';
      if (l.includes('pos') || l.includes('kredi') || l.includes('kart')) return 'pos';
      return 'nakit';
    };
    setOdemeYontemi(oyNorm(oy));
    const pAdi = rawOrder.partner_firma_adi || order.partnerFirmaAdi || '';
    const pTel = order.partnerFirmaTelefon || rawOrder.partner_firma_telefon || '';
    const pTur = rawOrder.partner_siparis_turu || (order as any).partnerSiparisTuru || 'verilen';
    const pTurNorm = String(pTur).toLowerCase().trim();
    setPartnerSiparis(!!pAdi);
    setPartnerFirmaAdi(pAdi);
    setPartnerFirmaTelefon(pTel);
    setPartnerSiparisTuru(pTurNorm === 'gelen' || pTurNorm === 'alinan' || pTurNorm === 'alınan' ? 'gelen' : 'verilen');
    setAracMarkaModel(order.aracMarkaModel || rawOrder.arac_markamodel || '');
    setAracRenk(order.aracRenk || rawOrder.arac_renk || '');
    setAracPlaka(order.aracPlaka || rawOrder.arac_plaka || '');
    setAracRandevuSaat(order.aracRandevuSaat || rawOrder.arac_randevu_saat || '');
    setTeslimKisisi(order.teslimKisisi || rawOrder.teslim_kisisi || '');
    teslimKisisiTelefonInput.setDisplayValue(order.teslimKisisiTelefon || rawOrder.teslim_kisisi_telefon || '');
    setTeslimSaat(order.teslimSaati || rawOrder.teslim_saat || '');

    // Adres state'lerini set et - controlled component
    setSelectedIl(order.teslimIl || rawOrder.teslim_il || '');
    setSelectedIlce(order.teslimIlce || rawOrder.teslim_ilce || '');
    setSelectedMahalle(order.mahalle || rawOrder.teslim_mahalle || '');
    setTeslimAcikAdres((rawOrder as any).teslim_acik_adres || order.acikAdres || '');
  }, [isOpen, order?.id]);

  // Partner listesi yüklendiğinde mevcut siparişteki partner adına göre secilenPartnerId'yi eşle
  useEffect(() => {
    if (!partnerFirmaAdi || partnerFirmalar.length === 0) return;
    const found = partnerFirmalar.find(
      (p) => (p.partner_firma_adi || '').trim() === partnerFirmaAdi.trim()
    );
    if (found) setSecilenPartnerId(found.id);
  }, [partnerFirmalar, partnerFirmaAdi]);

  // Müşteri seçilince ürün yazı dosyalarını listele
  useEffect(() => {
    if (!secilenMusteriId) {
      setMusteriUrunYaziDosyalari([]);
      return;
    }
    let cancelled = false;
    setMusteriDosyalarLoading(true);
    apiRequest<unknown>(`/customers/${secilenMusteriId}/urun-yazi-dosyalari`, { method: 'GET' })
      .then((result) => {
        if (cancelled) return;
        const files = Array.isArray(result) ? result : (result && typeof result === 'object' && (result as any).data != null) ? (Array.isArray((result as any).data) ? (result as any).data : []) : [];
        setMusteriUrunYaziDosyalari(Array.isArray(files) ? files.map((f: any) => ({ name: f.name || f.fileName, url: f.url, path: f.path })) : []);
      })
      .catch(() => {
        if (!cancelled) setMusteriUrunYaziDosyalari([]);
      })
      .finally(() => {
        if (!cancelled) setMusteriDosyalarLoading(false);
      });
    return () => { cancelled = true; };
  }, [secilenMusteriId]);

  // Form reset
  const resetForm = useCallback(() => {
    setSecilenMusteriId('');
    setMusteriUnvani('');
    setMusteriIsimSoyisim('');
    siparisVerenTelefonInput.setDisplayValue('');
    setUrunYazisi('');
    setUrunYazisiDosya(null);
    setUrunYazisiDosyaPreview('');
    setSecilenMevcutDosyaAdi(null);
    setMusteriUrunYaziDosyalari([]);
    setSecilenUrunId('');
    setSiparisUrun('');
    setSiparisUrunAciklama('');
    setSiparisTutari('');
    setOdemeYontemi('nakit');
    setEkstraNot('');
    setEkstraUcretAciklama('');
    setEkstraUcretTutari('');
    setPartnerSiparis(false);
    setPartnerSiparisTuru('verilen');
    setSecilenPartnerId('');
    setPartnerFirmaAdi('');
    setPartnerFirmaTelefon('');
    setAracMarkaModel('');
    setAracRenk('');
    setAracPlaka('');
    setAracRandevuSaat('');
    setTeslimKisisi('');
    teslimKisisiTelefonInput.setDisplayValue('');
    setTeslimSaat('');
    setSelectedIl('');
    setSelectedIlce('');
    setSelectedMahalle('');
    setTeslimAcikAdres('');
    addressSelect.reset();
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Modal kapandığında formu resetle; açıldığında dirty sıfırla
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    } else {
      setDirty(false);
    }
  }, [isOpen, resetForm]);

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
      onConfirm: () => {
        formRef.current?.requestSubmit();
      },
      onCancel: () => {
        resetForm();
        onClose();
      },
    });
  }, [isDirty, onClose, resetForm]);

  // Ürün yazısı dosyası seçildiğinde preview oluştur
  const handleUrunYazisiDosyaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSecilenMevcutDosyaAdi(null);
      setUrunYazisiDosya(file);
      markDirty();
      const reader = new FileReader();
      reader.onloadend = () => {
        setUrunYazisiDosyaPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };
  const handleUrunYazisiDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!urunYazisiDosya) setIsDragOverUrunYazisi(true);
  };
  const handleUrunYazisiDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverUrunYazisi(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSecilenMevcutDosyaAdi(null);
      setUrunYazisiDosya(file);
      markDirty();
      const reader = new FileReader();
      reader.onloadend = () => setUrunYazisiDosyaPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };
  const truncateFileName = (name: string, max = 24) =>
    name.length <= max ? name : name.slice(0, max - 3) + '...';

  // Form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isNewOrder = !order || !order.id || order.id === 0 || order.id === '0';
    
    if (!order && !isOpen) return;

    setLoading(true);

    try {
      // Validasyon
      if (!musteriUnvani.trim() && !musteriIsimSoyisim.trim()) {
        showToast('error', 'Lütfen müşteri unvanı veya isim soyisim girin!');
        setLoading(false);
        return;
      }
      if (!siparisVerenTelefonInput.cleanValue.trim()) {
        showToast('error', 'Lütfen telefon numarasını girin!');
        setLoading(false);
        return;
      }
      const cleanPhone = siparisVerenTelefonInput.cleanValue;
      if (cleanPhone.length < 12) {
        showToast('error', 'Lütfen geçerli bir telefon numarası girin!');
        setLoading(false);
        return;
      }
      if (!secilenUrunId || !siparisUrun.trim()) {
        showToast('error', 'Lütfen ürün seçin!');
        setLoading(false);
        return;
      }
      if (parseTL(siparisTutari) <= 0) {
        showToast('error', 'Lütfen geçerli bir tutar girin!');
        setLoading(false);
        return;
      }
      if (isNewOrder && !order?.organizasyon_id) {
        showToast('error', 'Organizasyon kartı seçilmedi!');
        setLoading(false);
        return;
      }
      if (partnerSiparis && !secilenPartnerId) {
        const msg = 'Partner siparişi işaretlendiğinde lütfen partner firma seçin.';
        showToast('error', msg);
        partnerValidationInputRef.current?.setCustomValidity(msg);
        formRef.current?.reportValidity();
        setLoading(false);
        return;
      }

      const toplamTutar = parseTL(siparisTutari) + parseTL(ekstraUcretTutari);

      const secilenUrunYaziField: string | File | undefined =
        secilenMevcutDosyaAdi != null
          ? secilenMevcutDosyaAdi
          : urunYazisiDosya
            ? urunYazisiDosya
            : '';

      const formData: Partial<SiparisFormData> = {
        organizasyon_kart_id: order.organizasyon_id || undefined,
        musteri_id: secilenMusteriId || undefined,
        musteri_unvan: musteriUnvani || undefined,
        musteri_isim_soyisim: musteriIsimSoyisim || undefined,
        siparis_veren_telefon: siparisVerenTelefonInput.cleanValue,
        urun_yazisi: urunYazisi || undefined,
        siparis_urun_id: secilenUrunId || undefined,
        siparis_urun: siparisUrun,
        siparis_urun_aciklama: siparisUrunAciklama || undefined,
        siparis_tutari: parseTL(siparisTutari),
        odeme_yontemi: odemeYontemi,
        ekstra_ucret_aciklama: ekstraUcretAciklama || undefined,
        ekstra_ucret_tutari: parseTL(ekstraUcretTutari) || undefined,
        toplam_tutar: toplamTutar,
        partner_firma_adi: partnerSiparis ? (partnerFirmaAdi || undefined) : undefined,
        partner_siparis_turu: partnerSiparis ? partnerSiparisTuru : undefined,
        partner_firma_telefon: partnerSiparis ? (partnerFirmaTelefon || undefined) : undefined,
        arac_markamodel: aracMarkaModel || undefined,
        arac_renk: aracRenk || undefined,
        arac_plaka: aracPlaka || undefined,
        arac_randevu_saat: aracRandevuSaat || undefined,
        teslim_kisisi: teslimKisisi || undefined,
        teslim_kisisi_telefon: teslimKisisiTelefonInput.cleanValue || undefined,
        teslim_il: selectedIl || undefined,
        teslim_ilce: selectedIlce || undefined,
        teslim_mahalle: selectedMahalle || undefined,
        teslim_acik_adres: teslimAcikAdres || undefined,
        teslim_saat: teslimSaat || undefined,
        notes: ekstraNot || undefined,
        secilen_urun_yazi_dosyasi: secilenUrunYaziField,
      };

      let result;
      if (isNewOrder) {
        // Yeni sipariş oluştur
        result = await createSiparis(formData as SiparisFormData);
        if (result?.success) {
          showToast('success', 'Sipariş başarıyla oluşturuldu!');
        } else {
          showToast('error', result?.message || 'Sipariş oluşturulamadı!');
        }
      } else {
        result = await updateSiparis(order.id, formData);
        if (result?.success) {
          showToast('success', 'Sipariş başarıyla güncellendi!');
        } else {
          showToast('error', result?.message || 'Sipariş güncellenemedi!');
        }
      }

      if (result?.success) {
        invalidateSiparisGuncellemeQueries(queryClient, {
          organizasyonKartId: order?.organizasyon_id ?? undefined,
          musteriId: secilenMusteriId || (order as any)?.musteri_id || undefined,
        });
        resetForm();
        onSuccess?.();
        onClose();
      }
    } catch (err: any) {
      console.error('Sipariş işlemi hatası:', err);
      const errorMessage = err?.response?.data?.error || err?.response?.data?.message || err?.message || (isNewOrder ? 'Sipariş oluşturulamadı!' : 'Sipariş güncellenemedi!');
      showToast('error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isAracSusleme = (() => {
    const raw = organizasyonData?.kart_tur || organizasyonData?.kart_turu || '';
    const t = raw.toLowerCase().replace(/-/g, '').replace(/\s/g, '');
    return t === 'aracsusleme' || t === 'araçsüsleme';
  })();
  const isOzelSiparisOrOzelGun = (() => {
    const raw = organizasyonData?.kart_tur || organizasyonData?.kart_turu || '';
    const t = raw.toLowerCase().replace(/-/g, '').replace(/\s/g, '');
    return t === 'ozelsiparis' || t === 'özelsipariş' || t === 'ozelgun' || t === 'özelgün';
  })();
  const isOrganizasyonTur = !isAracSusleme && !isOzelSiparisOrOzelGun;
  const kartTurRaw = organizasyonData?.kart_tur || organizasyonData?.kart_turu || '';
  const kartTurSlug = isAracSusleme ? 'aracsusleme' : isOzelSiparisOrOzelGun
    ? (kartTurRaw.toLowerCase().includes('gun') || kartTurRaw.toLowerCase().includes('gün') ? 'ozelgun' : 'ozelsiparis')
    : 'organizasyon';
  const isNewOrder = !order || order.id === 0 || order.id === '0';

  return createPortal(
    <div 
      className={`overlay-yeni-siparis-container ${isOpen ? 'show' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          requestClose();
        }
      }}
    >
      <div 
        className={`yeni-siparis-container ${isOpen ? 'show' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="header-alan">
          <div className="modal-yeni-siparis-header-baslik">{isNewOrder ? 'Yeni Sipariş Ekle' : 'Sipariş Düzenle'}</div>
          <div className="header-sag">
            <button className="btn-close-modal" onClick={requestClose} type="button">
            <i className="icon-btn-kapat"></i>
          </button>
        </div>
        </div>
        {/* Organizasyon Kutu – tüm kart türlerinde aynı yapı (organizasyon, araç süsleme, özel sipariş, özel gün) */}
        {order?.organizasyon_id && (
          <div className={`container container-${organizasyonData ? kartTurSlug : 'organizasyon'} show`}>
            <div className="organizasyon-kutu">
              {!organizasyonData ? (
                <>
                  <div className="kart-gorseli kart-gorseli-loading">
                    <LoadingSpinner />
                  </div>
                  <div className="organizasyon-bilgileri organizasyon-bilgileri-loading">
                    <div className="org-turu-band"><div className="left"><div className="org-tur">Yükleniyor...</div></div></div>
                    <div className="org-adres-bilgileri"><div className="konum">—</div><div className="acik-adres">—</div></div>
                    <div className="sahip-ve-zaman"><div className="organizasyon-sahibi"><div className="modal-yeni-siparis-baslik">—</div><div className="teslim-kisisi">—</div></div><div className="vr" /><div className="teslim-zaman"><div className="modal-yeni-siparis-baslik">—</div><div className="tarih">—</div><div className="saat">—</div></div></div>
                  </div>
                </>
              ) : (
                <>
              {/* Görsel: Organizasyon türünde davetiye (yoksa placeholder); Araç/Özel'de sabit görsel */}
              <div
                className={`kart-gorseli ${!isOrganizasyonTur ? 'kart-gorseli-relative' : ''} ${isOrganizasyonTur && (organizasyonData.organizasyon_davetiye_gorsel || organizasyonData.kart_gorsel) ? 'kart-gorseli-clickable' : ''}`}
                onClick={() => {
                  if (isOrganizasyonTur && (organizasyonData.organizasyon_davetiye_gorsel || organizasyonData.kart_gorsel)) {
                    setSiparisFormLightboxOpen(true);
                  }
                }}
                onKeyDown={(e) => e.key === 'Enter' && isOrganizasyonTur && (organizasyonData.organizasyon_davetiye_gorsel || organizasyonData.kart_gorsel) && setSiparisFormLightboxOpen(true)}
                role={isOrganizasyonTur && (organizasyonData.organizasyon_davetiye_gorsel || organizasyonData.kart_gorsel) ? 'button' : undefined}
                tabIndex={isOrganizasyonTur && (organizasyonData.organizasyon_davetiye_gorsel || organizasyonData.kart_gorsel) ? 0 : undefined}
              >
                {isOrganizasyonTur ? (
                  (organizasyonData.organizasyon_davetiye_gorsel || organizasyonData.kart_gorsel) ? (
                    <img
                      src={getUploadUrl(organizasyonData.organizasyon_davetiye_gorsel || organizasyonData.kart_gorsel)}
                  alt="Davetiye görseli"
                      className="kart-gorsel-img"
                    />
                  ) : (
                    <div className="gorsel-placeholder">
                      Bu organizasyona davetiye görseli eklenmemiş
                      <span className="gorsel-placeholder-yardim">
                        Dilerseniz organizasyon kartını düzenle formundan davetiye görseli ekleyebilirsiniz.
                      </span>
                      <input
                        ref={davetiyeHizliYukleRef}
                        type="file"
                        accept="image/*"
                        className="file-input-hidden"
                        aria-hidden
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !order?.organizasyon_id) return;
                          setDavetiyeYukleniyor(true);
                          try {
                            const formData = new FormData();
                            formData.append('davetiye_gorsel', file);
                            const baseUrl = getApiBaseUrl();
                            const res = await fetch(`${baseUrl}/organizasyon-kartlar/${order.organizasyon_id}/davetiye-gorseli`, {
                              method: 'POST',
                              body: formData,
                              credentials: 'include',
                            });
                            if (!res.ok) throw new Error('Yükleme başarısız');
                            showToast('success', 'Davetiye görseli yüklendi');
                            const data = await getOrganizasyonKartDetay(order.organizasyon_id);
                            if (data) setOrganizasyonData(data);
                            invalidateSiparisGuncellemeQueries(queryClient, { organizasyonKartId: order.organizasyon_id });
                          } catch (err) {
                            showToast('error', (err as Error)?.message || 'Görsel yüklenemedi');
                          } finally {
                            setDavetiyeYukleniyor(false);
                            e.target.value = '';
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn-davetiye-hizli-yukle"
                        disabled={davetiyeYukleniyor}
                        onClick={() => davetiyeHizliYukleRef.current?.click()}
                      >
                        <Upload size={16} aria-hidden />
                        {davetiyeYukleniyor ? 'Yükleniyor...' : 'Davetiye görseli yükle'}
                      </button>
                    </div>
                  )
                ) : (
                  <img
                    src={isAracSusleme ? '/assets/kart-gorsel-statik-arac-susleme.jpg' : '/assets/kart-gorsel-statik-ozel-siparis-ve-gun.jpg'}
                    alt={isAracSusleme ? 'Araç süsleme' : 'Kart görseli'}
                    className="kart-gorsel-img"
                  />
                )}
              </div>
              {/* Organizasyon Bilgileri */}
              <div className="organizasyon-bilgileri">
                <div className="org-turu-band">
                  <div className="left">
                    <div className="left-ust">
                      <div className="org-tur">{organizasyonData.kart_tur_display || organizasyonData.kart_tur || organizasyonData.kart_turu || 'Organizasyon'}</div>
                      {organizasyonData.alt_tur && (
                        <span className="kart-alt-tur">{organizasyonData.alt_tur}</span>
                      )}
                    </div>
                    {organizasyonData.kart_etiket && (
                      <div className="kart-etiket">
                        <Tag className="kart-etiket-icon" aria-hidden />
                        {organizasyonData.kart_etiket}
                      </div>
                    )}
                  </div>
                  <div className="right">
                    <div className="toplam-siparis" title="Teslim edilen / Toplam sipariş">
                      <i className="icon-toplam-siparis"></i>
                      {toplamSiparisDisplay.teslimEdilen}/{toplamSiparisDisplay.toplam}
                    </div>
                    <div className="partner-siparisler" title="Bu organizasyondaki partner sipariş sayısı">
                      <i className="icon-partner-siparis"></i>
                      <span className="partner-siparis-sayisi">{organizasyonData.partner_siparis_sayisi ?? 0}</span>
                  </div>
                </div>
                </div>
                {isOrganizasyonTur && (
                <div className="org-adres-bilgileri">
                  <div className="konum">
                    {organizasyonData.organizasyon_teslimat_konumu ||
                      organizasyonData.mahalle ||
                      'Mahalle Belirtilmemiş'}
                  </div>
                  <div className="acik-adres">
                      {(() => {
                        const tc = organizasyonData.organizasyon_teslimat_konumu;
                        const mahalle = organizasyonData.mahalle;
                        const acik = organizasyonData.acik_adres;
                        const baseAdres =
                          tc && mahalle && acik
                            ? `${mahalle}, ${acik}`
                            : acik;
                        const ilce = organizasyonData.organizasyon_ilce;
                        const il = organizasyonData.organizasyon_il;
                        return baseAdres
                          ? appendIlceIlToAddress(baseAdres, ilce, il)
                          : 'Adres Belirtilmemiş';
                      })()}
                  </div>
                </div>
                )}
                <div className="sahip-ve-zaman">
                  {isOrganizasyonTur ? (
                    <>
                  <div className="organizasyon-sahibi">
                    <div className="modal-yeni-siparis-baslik">
                      <i className="icon-organizasyon-sahibi"></i>
                      Organizasyon Sahibi
                    </div>
                    <div className="teslim-kisisi">
                      {organizasyonData.teslim_kisisi || 'Belirtilmemiş'}
                    </div>
                    <div className="teslim-kisisi-telefon">
                      <i className="icon-telefon"></i>
                      <span>
                        {organizasyonData.teslim_kisisi_telefon ? (
                          <a href={`tel:${organizasyonData.teslim_kisisi_telefon}`}>
                            {formatPhoneNumber(organizasyonData.teslim_kisisi_telefon)}
                          </a>
                        ) : (
                          <span>Telefon Belirtilmemiş</span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="vr"></div>
                  <div className="teslim-zaman">
                    <div className="modal-yeni-siparis-baslik">
                      <i className="icon-teslim-tarihi-ve-saati"></i>
                      Teslim Zamanı
                    </div>
                    <div className="tarih">
                      {organizasyonData.teslim_tarih
                        ? formatDateToDisplay(organizasyonData.teslim_tarih)
                        : 'Belirtilmemiş'}
                    </div>
                    <div className="saat">
                      Saat {organizasyonData.teslim_saat || 'Belirtilmemiş'}
                    </div>
                  </div>
                    </>
                  ) : (
                    <>
                      <div className="kart-aciklama">
                        {isAracSusleme && (
                          <>
                            Araç randevuları için sipariş kartları üzerindeki{' '}
                            <span>randevu saatini dikkate alınız</span>
                          </>
                        )}
                        {kartTurSlug === 'ozelsiparis' && (
                          <>
                            Özel siparişler için sipariş kartları üzerindeki{' '}
                            <span>teslim saatini dikkate alınız</span>
                          </>
                        )}
                        {kartTurSlug === 'ozelgun' && (
                          <>
                            Özel gün siparişleri için sipariş kartları üzerindeki{' '}
                            <span>teslim saatini dikkate alınız</span>
                          </>
                        )}
                </div>
                      <div className="vr"></div>
                      <div className="teslim-zaman">
                        <div className="modal-yeni-siparis-baslik">
                          <i className="icon-teslim-tarihi-ve-saati"></i>
                          {isAracSusleme ? 'Randevu Tarihi' : 'Teslim Zamanı'}
              </div>
                        <div className="tarih">
                          {organizasyonData.teslim_tarih
                            ? formatDateToDisplay(organizasyonData.teslim_tarih)
                            : 'Belirtilmemiş'}
            </div>
          </div>
                    </>
        )}
                </div>
              </div>
                </>
              )}
            </div>
          </div>
        )}
        {organizasyonData && (organizasyonData.organizasyon_davetiye_gorsel || organizasyonData.kart_gorsel) && isOrganizasyonTur && createPortal(
          <Lightbox
            isOpen={siparisFormLightboxOpen}
            images={[{ src: getUploadUrl(organizasyonData.organizasyon_davetiye_gorsel || organizasyonData.kart_gorsel), alt: 'Davetiye görseli' }]}
            initialIndex={0}
            onClose={() => setSiparisFormLightboxOpen(false)}
          />,
          document.body
        )}
        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="siparis-form-alan">
            <div className="sol-alan">
              {/* Partner Sipariş – eski sistemle birebir: checkbox + partner-siparis-detaylari (radio + partner firma) */}
              <div className="partner-siparisi-isaretle">
                <label className="cbox-alan">
                  <input
                    type="checkbox"
                    name="is_partner_order"
                    className="cbox-partner-order"
                    value={1}
                    checked={partnerSiparis}
                    onChange={(e) => {
                      setPartnerSiparis(e.target.checked);
                      if (!e.target.checked) {
                        setPartnerFirmaAdi('');
                        setPartnerFirmaTelefon('');
                        setSecilenPartnerId('');
                        setPartnerSiparisTuru('verilen');
                        partnerValidationInputRef.current?.setCustomValidity('');
                      }
                      markDirty();
                    }}
                  />
                  <span className="cbox-label-text">Partner siparişi olarak ekleyin</span>
                </label>
                <div className="aciklama">Bu siparişi partnerden gelen veya partnere vereceğiniz sipariş olarak işaretleyin</div>
                <div className={`partner-siparis-detaylari ${partnerSiparis ? '' : 'hidden'}`}>
                  <input
                    type="text"
                    ref={partnerValidationInputRef}
                    required={partnerSiparis}
                    value={partnerSiparis && secilenPartnerId ? '1' : ''}
                    readOnly
                    aria-hidden
                    tabIndex={-1}
                    style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                    onChange={() => {}}
                    title="Partner siparişi işaretlendiğinde lütfen partner firma seçin."
                  />
                  <div className="partner-tipi checkbox-alan">
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="partner_type"
                        value="verilen"
                        checked={partnerSiparisTuru === 'verilen'}
                        onChange={() => {
                          setPartnerSiparisTuru('verilen');
                          setSecilenPartnerId('');
                          setPartnerFirmaAdi('');
                          setPartnerFirmaTelefon('');
                          markDirty();
                        }}
                        disabled={!partnerSiparis}
                      />
                      <span>Partnere Verilen</span>
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="partner_type"
                        value="gelen"
                        checked={partnerSiparisTuru === 'gelen'}
                        onChange={() => {
                          setPartnerSiparisTuru('gelen');
                          setSecilenPartnerId('');
                          setPartnerFirmaAdi('');
                          setPartnerFirmaTelefon('');
                          markDirty();
                        }}
                        disabled={!partnerSiparis}
                      />
                      <span>Partnerden Gelen</span>
                    </label>
                  </div>
                  <div className="wrapper-acilirliste partner" id="partner-firma-liste" data-type="partnerfirma">
                    <SearchableSelect
                      value={secilenPartnerId}
                      options={partnerFirmalar.map((p) => ({
                        value: p.id,
                        label: p.partner_firma_adi || `Partner #${p.id}`,
                      }))}
                      onChange={(partnerId) => {
                        setSecilenPartnerId(partnerId);
                        partnerValidationInputRef.current?.setCustomValidity('');
                        if (partnerId) {
                          const p = partnerFirmalar.find((x) => x.id.toString() === String(partnerId));
                          if (p) {
                            setPartnerFirmaAdi(p.partner_firma_adi || '');
                            setPartnerFirmaTelefon(p.partner_telefon || '');
                          }
                        } else {
                          setPartnerFirmaAdi('');
                          setPartnerFirmaTelefon('');
                        }
                        markDirty();
                      }}
                      placeholder="Partner firma seçin"
                      aria-label="Partner firma"
                      disabled={!partnerSiparis}
                    />
                  </div>
                </div>
              </div>

              <div className="kisi-bilgi-alanlar">
              {/* Sipariş Veren Müşteri */}
              <div className="siparis-veren-musteri">
                <div className="alan-baslik">
                  <div className="modal-yeni-siparis-baslik">
                    <User size={18} strokeWidth={1.5} aria-hidden />
                    Sipariş Veren Müşteri
                  </div>
                  <span>Sipariş veren müşteri bilgileri</span>
                </div>
                <div className="input-alan">
                  {/* Müşteri - arama destekli seçim */}
                  <SearchableSelect
                    value={secilenMusteriId}
                    options={musteriler.map((m) => ({
                      value: m.id,
                      label: m.musteri_unvani || (m as any).musteri_unvan || (m as any).musteri_adi || `Müşteri #${m.id}`,
                    }))}
                    onChange={(musteriId) => {
                      setSecilenMusteriId(musteriId);
                      if (musteriId) {
                        const secilenMusteri = musteriler.find((m) => m.id.toString() === String(musteriId));
                        if (secilenMusteri) {
                          setMusteriUnvani(secilenMusteri.musteri_unvani || (secilenMusteri as any).musteri_unvan || (secilenMusteri as any).musteri_adi || '');
                          setMusteriIsimSoyisim(secilenMusteri.yetkili_ad_soyad || '');
                          siparisVerenTelefonInput.setDisplayValue(secilenMusteri.yetkili_telefon || (secilenMusteri as any).telefon || '');
                          setUrunYazisi(secilenMusteri.musteri_urun_yazisi || '');
                        }
                      } else {
                        setMusteriUnvani('');
                        setMusteriIsimSoyisim('');
                        siparisVerenTelefonInput.setDisplayValue('');
                        setUrunYazisi('');
                      }
                      markDirty();
                    }}
                    placeholder="Müşteri seçiniz"
                    aria-label="Sipariş veren müşteri"
                  />
                  <input
                    type="text"
                    value={musteriUnvani}
                    onChange={(e) => { setMusteriUnvani(e.target.value); markDirty(); }}
                    placeholder="(veya kendiniz ekleyin) Müşteri/Firma Adı"
                    required
                  />
                  <div className="siparis-veren-isim-telefon-grup">
                    <input
                      type="text"
                      value={musteriIsimSoyisim}
                      onChange={(e) => { setMusteriIsimSoyisim(e.target.value); markDirty(); }}
                      placeholder="İsim Soyisim"
                    />
                    <input
                      ref={siparisVerenTelefonInput.inputRef}
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      value={siparisVerenTelefonInput.displayValue}
                      onChange={(e) => { siparisVerenTelefonInput.handleChange(e); markDirty(); }}
                      onKeyDown={siparisVerenTelefonInput.handleKeyDown}
                      onFocus={siparisVerenTelefonInput.handleFocus}
                      onPaste={siparisVerenTelefonInput.handlePaste}
                      placeholder="+90 (5xx xxx xx xx)"
                      required
                      data-phone-input="standard"
                    />
                  </div>
                  <textarea
                    value={urunYazisi}
                    onChange={(e) => { setUrunYazisi(e.target.value); markDirty(); }}
                    placeholder="Ürün yazısı (veya Sipariş ürün üzeri not)"
                    rows={3}
                    required
                  />
                  <textarea
                    value={ekstraNot}
                    onChange={(e) => { setEkstraNot(e.target.value); markDirty(); }}
                    placeholder="Ekstra not veya açıklama"
                    rows={3}
                  />
                </div>
                {musteriUrunYaziDosyalari.length > 0 && (
                  <div className="musteri-urun-dosya-listesi">
                    <div className="alan-baslik">
                      <div className="modal-yeni-siparis-baslik">
                        <FileText size={18} strokeWidth={1.5} aria-hidden />
                        Mevcut Ürün Yazı Dosyaları
                      </div>
                      <span className="input-help">Müşteriye ait ürün yazı dosyası seçebilirsiniz.</span>
                    </div>
                    {secilenMevcutDosyaAdi && (
                      <div className="secilen-dosya-ozet">
                        <span className="secilen-dosya-metin">Seçilen: {secilenMevcutDosyaAdi}</span>
                        <button type="button" className="remove-button" onClick={() => { setSecilenMevcutDosyaAdi(null); markDirty(); }}>Kaldır</button>
                      </div>
                    )}
                    {musteriDosyalarLoading ? (
                      <div className="musteri-dosya-loading">Yükleniyor...</div>
                    ) : (
                      <ul className="musteri-urun-dosya-ul">
                        {musteriUrunYaziDosyalari.map((f) => (
                          <li
                            key={f.name}
                            className={secilenMevcutDosyaAdi === f.name ? 'secili' : ''}
                        onClick={() => {
                              setSecilenMevcutDosyaAdi(f.name);
                          setUrunYazisiDosya(null);
                          setUrunYazisiDosyaPreview('');
                              markDirty();
                        }}
                      >
                            <FileText size={14} aria-hidden />
                            <span>{f.name}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    </div>
                )}
                <div className="file-input-alan dosya-yukle-alan">
                      <input
                    ref={urunYazisiFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleUrunYazisiDosyaChange}
                    className="file-input file-input-hidden"
                        id="urun-yazisi-dosya-input"
                    name="urun-yazisi-dosya"
                    aria-label="Ürün yazısı dosyası yükle"
                  />
                  <label
                    htmlFor="urun-yazisi-dosya-input"
                    className={`file-input-trigger ${urunYazisiDosya ? 'dosya-secildi' : ''} ${isDragOverUrunYazisi ? 'drag-over' : ''}`}
                    onDragEnter={() => !urunYazisiDosya && setIsDragOverUrunYazisi(true)}
                    onDragLeave={(e) => {
                      const el = e.currentTarget;
                      const next = e.relatedTarget as Node | null;
                      if (!next || !el.contains(next)) setIsDragOverUrunYazisi(false);
                    }}
                    onDragOver={handleUrunYazisiDragOver}
                    onDrop={handleUrunYazisiDrop}
                  >
                    {urunYazisiDosya ? (
                      <>
                        <span className="secilen-dosya-metin">
                          Seçilen dosya: {truncateFileName(urunYazisiDosya.name)}
                        </span>
                        <button
                          type="button"
                          className="remove-button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setUrunYazisiDosya(null);
                            setUrunYazisiDosyaPreview('');
                          }}
                        >
                          Kaldır
                        </button>
                      </>
                    ) : (
                    <>
                        <Upload size={18} strokeWidth={1.5} aria-hidden />
                        <span className="file-label">Ürün yazısı dosyası seçin veya sürükleyin</span>
                    </>
                  )}
                  </label>
                </div>
              </div>
                  </div>

              {/* Teslim Bilgileri – Özel Sipariş ve Özel Gün: Sipariş Veren Müşteri'nin altında, sol tarafta */}
              {isOzelSiparisOrOzelGun && (
                <div className="teslim-bilgileri">
                  <div className="alan-baslik">
                    <div className="modal-yeni-siparis-baslik">
                      <MapPin size={18} strokeWidth={1.5} aria-hidden />
                      Teslim Bilgileri
                    </div>
                  </div>
                  <div className="input-alan">
                    <div className="input-grup">
                      <input
                        type="text"
                        value={teslimKisisi}
                        onChange={(e) => { setTeslimKisisi(e.target.value); markDirty(); }}
                        placeholder="Teslim Kişisi"
                      />
                        <input
                        ref={teslimKisisiTelefonInput.inputRef}
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        value={teslimKisisiTelefonInput.displayValue}
                        onChange={(e) => { teslimKisisiTelefonInput.handleChange(e); markDirty(); }}
                        onKeyDown={teslimKisisiTelefonInput.handleKeyDown}
                        onFocus={teslimKisisiTelefonInput.handleFocus}
                        onPaste={teslimKisisiTelefonInput.handlePaste}
                        placeholder="+90 (5xx xxx xx xx)"
                        data-phone-input="standard"
                      />
                    </div>
                    <div className="input-grup-il-ilce">
                      <select
                        value={selectedIl}
                        onChange={(e) => {
                          setSelectedIl(e.target.value);
                          addressSelect.setIl(e.target.value);
                          setSelectedIlce('');
                          setSelectedMahalle('');
                          markDirty();
                        }}
                        className="org-adres-select"
                      >
                        <option value="">İl Seçiniz</option>
                        {addressSelect.ilOptions.map((il) => (
                          <option key={il.id} value={il.name}>
                            {il.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedIlce}
                        onChange={(e) => {
                          setSelectedIlce(e.target.value);
                          addressSelect.setIlce(e.target.value);
                          setSelectedMahalle('');
                          markDirty();
                        }}
                        disabled={!selectedIl}
                        className="org-adres-select"
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
                      value={selectedMahalle}
                      onChange={(e) => {
                        setSelectedMahalle(e.target.value);
                        addressSelect.setMahalle(e.target.value);
                        markDirty();
                      }}
                      disabled={!selectedIlce}
                      className="org-adres-select"
                    >
                      <option value="">Mahalle/Semt Seçiniz</option>
                      {addressSelect.mahalleOptions.map((mahalle) => (
                        <option key={mahalle.id} value={mahalle.name}>
                          {mahalle.name}
                        </option>
                      ))}
                    </select>
                    <textarea
                      value={teslimAcikAdres}
                      onChange={(e) => { setTeslimAcikAdres(e.target.value); markDirty(); }}
                      placeholder="Açık adresi yazınız"
                      rows={3}
                      required
                      className="org-adres-textarea"
                    />
                    <div className="randevu-teslim-saati">
                      <div className="baslik">TESLİM SAATİ</div>
                      <div className="saat-ve-aciklama">
                    <input
                      type="time"
                          id="teslim-saat-ozel"
                          name="teslim-saat"
                      value={teslimSaat}
                          onChange={(e) => { setTeslimSaat(e.target.value); markDirty(); }}
                      placeholder="Teslim Saati"
                    />
                        <div className="aciklama">
                          {kartTurSlug === 'ozelgun'
                            ? <>Özel gün siparişleri için sipariş kartları üzerindeki <span>teslim saatini dikkate alınız</span>.</>
                            : <>Özel siparişler için sipariş kartları üzerindeki <span>teslim saatini dikkate alınız</span>.</>
                          }
                  </div>
                </div>
            </div>
          </div>
                </div>
              )}
          
              {/* Araç Süsleme Bilgileri – sol alanda aşağıda (sadece araç süsleme kartında) */}
              {isAracSusleme && (
                <div className="arac-susleme-bilgileri">
                  <div className="alan-baslik">
                    <div className="modal-yeni-siparis-baslik">
                      <Car size={18} strokeWidth={1.5} aria-hidden />
                      Araç Bilgileri
                    </div>
                  </div>
                  <div className="input-alan">
                    <input
                      type="text"
                      value={aracMarkaModel}
                      onChange={(e) => { setAracMarkaModel(e.target.value); markDirty(); }}
                      placeholder="Araç Marka/Model"
                    />
                    <div className="input-grup">
                      <input
                        type="text"
                        value={aracRenk}
                        onChange={(e) => { setAracRenk(e.target.value); markDirty(); }}
                        placeholder="Araç Rengi"
                      />
                      <input
                        type="text"
                        value={aracPlaka}
                        onChange={(e) => { setAracPlaka(e.target.value); markDirty(); }}
                        placeholder="Araç Plakası"
                      />
                    </div>
                    <div className="randevu-teslim-saati">
                      <div className="baslik">RANDEVU SAATİ</div>
                      <div className="saat-ve-aciklama">
                        <input
                          type="time"
                          id="arac-randevu-saat"
                          name="arac-randevu-saat"
                          value={aracRandevuSaat}
                          onChange={(e) => setAracRandevuSaat(e.target.value)}
                          required
                        />
                        <div className="aciklama">
                          Araç randevuları için sipariş kartları üzerindeki <span>randevu saatini dikkate alınız</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="sag-alan">
              {/* Ürün/Hizmet */}
              <div className="urun-hizmet">
                <div className="alan-baslik">
                  <div className="modal-yeni-siparis-baslik">
                    <Package size={18} strokeWidth={1.5} aria-hidden />
                    Sipariş Ürün
                  </div>
                  <span>Sipariş ürün bilgisi</span>
                </div>
                <div className="input-alan">
                  {/* Ürün/Hizmet - arama destekli seçim */}
                  <SearchableSelect
                    value={secilenUrunId}
                    options={urunListesiForSelect.map((u) => ({
                      value: u.id,
                      label: u.adi,
                      imageUrl: u.gorsel ? getUploadUrl(u.gorsel) : undefined,
                    }))}
                    onChange={(urunId) => {
                      setSecilenUrunId(urunId);
                      if (urunId) {
                        const secilenUrun = urunListesiForSelect.find((u) => u.id.toString() === String(urunId))
                          ?? urunVerileriArray.find((u) => u.id.toString() === String(urunId));
                        if (secilenUrun) {
                          setSiparisUrun(secilenUrun.adi);
                          setSiparisTutari(formatTLDisplayValue(secilenUrun.fiyat ?? 0));
                        }
                      } else {
                        setSiparisUrun('');
                        setSiparisTutari('');
                      }
                      markDirty();
                    }}
                    placeholder={isAracSuslemeKart ? "Araç süsleme ürünü seçin" : "Ürün veya hizmet seçin"}
                    aria-label="Sipariş ürünü"
                  />
                  <div className="input-grup urun-aciklama-fiyat-grup">
                    <input
                      type="text"
                      value={siparisUrunAciklama}
                      onChange={(e) => { setSiparisUrunAciklama(e.target.value); markDirty(); }}
                      placeholder="(Varsa) Açıklama"
                    />
                    <input
                      type="text"
                      className="tl-input"
                      name="urunfiyat"
                      id="urunfiyat"
                      value={siparisTutari}
                      readOnly
                      disabled
                      placeholder="0,00 TL"
                      aria-label="Sipariş tutarı (TL)"
              />
            </div>
              </div>
              </div>
              <hr />
              <div className="siparis-ucreti">
                <div className="alan-baslik">
                  <div className="modal-yeni-siparis-baslik">
                    <Banknote size={18} strokeWidth={1.5} aria-hidden />
                    Sipariş Ücreti
                  </div>
                  <span>Siparişe ait ürün ücret/hesap bilgileri</span>
                </div>
                <div className="input-alan siparis-ucreti-input-alan">
                  <select
                    name="ucret-tip"
                    value={odemeYontemi}
                    onChange={(e) => { setOdemeYontemi(e.target.value); markDirty(); }}
                    className="org-adres-select odeme-yontemi-select"
                    aria-label="Ödeme yöntemi"
                  >
                    <option value="cari">CARİ HESAP</option>
                    <option value="nakit">NAKİT</option>
                    <option value="havale_eft">HAVALE/EFT</option>
                    <option value="pos">POS</option>
                  </select>
                </div>
              </div>
              <hr />
              <div className="ekstra-ucretlendirmeler">
                <div className="alan-baslik">
                  <div className="modal-yeni-siparis-baslik">
                    <Banknote size={18} strokeWidth={1.5} aria-hidden />
                    Ekstra Ücretlendirmeler
                  </div>
                  <span>Siparişe ait ekstra ücretlendirmeler</span>
                </div>
                <div className="input-alan">
                  <div className="input-grup ekstra-aciklama-tutar-grup">
                    <input
                      type="text"
                      value={ekstraUcretAciklama}
                      onChange={(e) => setEkstraUcretAciklama(e.target.value)}
                      placeholder="Açıklama yazınız"
                      className="ekstra-aciklama-input"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      className="tl-input"
                      id="ekstraucrettutar"
                      name="ekstra-ucret-tutari"
                      value={ekstraUcretTutari}
                      onChange={(e) => { setEkstraUcretTutari(formatTutarInputLive(e.target.value)); markDirty(); }}
                      onKeyDown={(e) => formatTutarInputKeyDown(e, ekstraUcretTutari)}
                      onBlur={() => setEkstraUcretTutari(formatTLDisplayValue(parseTL(ekstraUcretTutari)))}
                      placeholder="0,00"
                      aria-label="Ekstra ücret tutarı (TL)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`alt-alan ${isNewOrder ? 'alt-alan--sadece-butonlar' : ''}`}>
            {/* Düzenleyen - Sadece sipariş düzenleme modunda; solda */}
            {!isNewOrder && (
              <div className="duzenleyen">
                <img
                  className="duzenleyen-profil-resmi"
                  src={getProfileImageUrl(currentUser ?? undefined)}
                  alt={(currentUser as any)?.kullaniciadi || (currentUser as any)?.username || 'Kullanıcı'}
                  onError={(e) => {
                    const backendBase = getApiBaseUrl().replace('/api', '');
                    (e.target as HTMLImageElement).src = `${backendBase}/assets/profil-default.jpg`;
                  }}
                />
                <div className="duzenleme-tarih">
                  Son Dzn: <span>
                    {(() => {
                      const raw = (order as any)?._raw || order;
                      const updatedAt = raw?.updated_at ?? raw?.updatedAt ?? order?.updatedAt ?? (order as any)?.createdAt ?? raw?.created_at;
                      if (!updatedAt) return 'Henüz düzenlenmedi';
                      const d = typeof updatedAt === 'string' && updatedAt.match(/^\d{4}-\d{2}-\d{2}/)
                        ? new Date(updatedAt.replace(' ', 'T'))
                        : new Date(updatedAt);
                      if (isNaN(d.getTime())) return 'Henüz düzenlenmedi';
                      return `${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}, ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
                    })()}
                  </span>
                </div>
              </div>
            )}
          <div className="butonlar">
              <button type="button" className="btn-modal-secondary secondary-button btn-vazgec" onClick={requestClose}>
              VAZGEÇ
            </button>
              <button type="submit" className="btn-modal-primary primary-button btn-kaydet" disabled={loading}>
              {loading ? <LoadingSpinner size="sm" /> : (!order || order.id === 0 || order.id === '0' ? 'KAYDET' : 'GÜNCELLE')}
            </button>
          </div>
            </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
