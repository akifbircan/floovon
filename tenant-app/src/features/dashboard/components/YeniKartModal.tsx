/**
 * Yeni Kart Oluşturma Modal Component
 * Tamamen React ile yeniden yazıldı
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { gsap } from 'gsap';
import { useModalOpenAnimation } from '../../../shared/hooks/useModalOpenAnimation';
import {
  createOrganizasyonKart,
  createAracSuslemeKart,
  createOzelSiparisKart,
  createOzelGunKart,
  getOrganizasyonTurleri,
  getOrganizasyonEtiketleri,
  getOrganizasyonGruplari,
  createOrganizasyonTuru,
  createOrganizasyonEtiketi,
  getTeslimatKonumlari,
  getKonumAyarlari,
  type OrganizasyonKartFormData,
  type AracSuslemeKartFormData,
  type OzelSiparisKartFormData,
  type OzelGunKartFormData,
  type OrganizasyonTuru,
  type TeslimatKonumuItem,
} from '../api/formActions';
import { useAddressSelect } from '../hooks/useAddressSelect';
import { showToast, showToastInteractive } from '../../../shared/utils/toastUtils';
import { invalidateOrganizasyonKartQueries } from '../../../lib/invalidateQueries';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { usePhoneInput } from '../../../shared/hooks/usePhoneInput';
import { Layers, MapPin, CalendarClock, User, Tag, Upload } from 'lucide-react';

interface YeniKartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newKartId?: number) => void;
}

type KartTuru = 'organizasyon' | 'aracsusleme' | 'ozelsiparis' | 'ozelgun';

export const YeniKartModal: React.FC<YeniKartModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<KartTuru>('organizasyon');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [isDirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const markDirty = useCallback(() => setDirty(true), []);

  // Organizasyon form state
  const [orgTur, setOrgTur] = useState<string>('');
  const [orgEtiket, setOrgEtiket] = useState<string>('');
  const [davetiyeGorsel, setDavetiyeGorsel] = useState<File | null>(null);
  const [davetiyeGorselPreview, setDavetiyeGorselPreview] = useState<string>('');
  const [isDragOverDavetiye, setIsDragOverDavetiye] = useState(false);
  const [teslimatKonumu, setTeslimatKonumu] = useState<string>('');
  const [teslimatKonumuOptions, setTeslimatKonumuOptions] = useState<TeslimatKonumuItem[]>([]);
  const [teslimTarih, setTeslimTarih] = useState<string>('');
  const [teslimSaat, setTeslimSaat] = useState<string>('');
  const [teslimKisisi, setTeslimKisisi] = useState<string>('');
  const teslimKisisiTelefonInput = usePhoneInput('');
  const [acikAdres, setAcikAdres] = useState<string>('');

  // Araç süsleme form state
  const [aracRandevuTarih, setAracRandevuTarih] = useState<string>('');

  // Özel sipariş form state
  const [aracEtiket, setAracEtiket] = useState<string>('');
  const [ozelSiparisTarih, setOzelSiparisTarih] = useState<string>('');
  const [ozelSiparisEtiket, setOzelSiparisEtiket] = useState<string>('');

  // Özel gün form state (tarih + etiket + alt tür)
  const [ozelGunTarih, setOzelGunTarih] = useState<string>('');
  const [ozelGunAltTur, setOzelGunAltTur] = useState<string>('');
  const [ozelGunEtiket, setOzelGunEtiket] = useState<string>('');

  // Araç süsleme ve özel sipariş alt tür
  const [aracSuslemeAltTur, setAracSuslemeAltTur] = useState<string>('');
  const [ozelSiparisAltTur, setOzelSiparisAltTur] = useState<string>('');

  // Popup state: Yeni alt tür (tüm ana türler için)
  const [showTurPopup, setShowTurPopup] = useState(false);
  const [showEtiketPopup, setShowEtiketPopup] = useState(false);
  const [turPopupTab, setTurPopupTab] = useState<KartTuru>('organizasyon');
  const [etiketPopupTipi, setEtiketPopupTipi] = useState<string>('organizasyon');
  const [turPopupInput, setTurPopupInput] = useState('');
  const [etiketPopupInput, setEtiketPopupInput] = useState('');
  const [turPopupSaving, setTurPopupSaving] = useState(false);
  const [etiketPopupSaving, setEtiketPopupSaving] = useState(false);
  const turPopupInputRef = useRef<HTMLInputElement>(null);
  const etiketPopupInputRef = useRef<HTMLInputElement>(null);

  const addressSelect = useAddressSelect();

  // Seçilen teslimat konumundan gelen mahalle, TRAddress listesinde yoksa mahalle select'te görünsün diye listeye eklenir
  const mahalleOptionsForSelect = useMemo(() => {
    const base = addressSelect.mahalleOptions;
    const konum = teslimatKonumuOptions.find((k) => (k.konum_adi || '') === teslimatKonumu);
    const konumMahalle = konum && ((konum.mahalle ?? (konum as any).mahalle_adi ?? '') as string).trim();
    if (konumMahalle && !base.some((o) => o.name === konumMahalle)) {
      return [{ id: 'konum-mahalle', name: konumMahalle }, ...base];
    }
    return base;
  }, [addressSelect.mahalleOptions, teslimatKonumu, teslimatKonumuOptions]);

  // Çiçekçi varsayılan konumu (ayarlar_genel_konum_ayarlari) – il/ilçe otomatik doldur, teslimat konumları da dolacak
  useEffect(() => {
    if (!isOpen || activeTab !== 'organizasyon') return;
    getKonumAyarlari().then((ayar) => {
      const il = (ayar.il_adi || '').trim();
      const ilce = (ayar.ilce_adi || '').trim();
      if (il && ilce) {
        addressSelect.setIl(il, { skipClear: true });
        addressSelect.setIlce(ilce, { skipClear: true });
      }
    });
  }, [isOpen, activeTab]);

  // İl ve ilçe seçildiğinde teslimat konumlarını yükle (ayarlar_genel_teslimat_konumlari)
  useEffect(() => {
    if (!isOpen || activeTab !== 'organizasyon') return;
    const il = addressSelect.il?.trim();
    const ilce = addressSelect.ilce?.trim();
    if (!il || !ilce) {
      setTeslimatKonumuOptions([]);
      setTeslimatKonumu('');
      return;
    }
    let cancelled = false;
    getTeslimatKonumlari({ il, ilce })
      .then((list) => {
        if (!cancelled) {
          setTeslimatKonumuOptions(list);
          setTeslimatKonumu((prev) => (list.some((k) => (k.konum_adi || '') === prev) ? prev : ''));
        }
      })
      .catch(() => {
        if (!cancelled) setTeslimatKonumuOptions([]);
      });
    return () => { cancelled = true; };
  }, [isOpen, activeTab, addressSelect.il, addressSelect.ilce]);

  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tabContentRef = useRef<HTMLDivElement>(null);
  const davetiyeInputRef = useRef<HTMLInputElement>(null);
  const prevActiveTabRef = useRef<KartTuru | null>(null);
  useModalOpenAnimation(isOpen, overlayRef, panelRef, { variant: 'right', contentRef: tabContentRef });

  // Sekme geçişlerinde içeriğe aynı animasyon (aşağıdan yukarı + fade) – sadece masaüstü, ilk açılış hariç
  useEffect(() => {
    if (!isOpen) {
      prevActiveTabRef.current = null;
      return;
    }
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 767;
    if (isMobile) return;
    const tabIds: Record<KartTuru, string> = {
      organizasyon: 'organizasyon-kart',
      aracsusleme: 'aracsusleme-kart',
      ozelsiparis: 'ozelsiparis-kart',
      ozelgun: 'ozelgun-kart',
    };
    const tabId = tabIds[activeTab];
    const el = tabId ? document.getElementById(tabId) : null;
    if (el && prevActiveTabRef.current !== null && prevActiveTabRef.current !== activeTab) {
      gsap.fromTo(
        el,
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.36, ease: 'power2.out' }
      );
    }
    prevActiveTabRef.current = activeTab;
  }, [isOpen, activeTab]);

  // Organizasyon türleri ve etiketleri
  const { data: organizasyonTurleri = [], refetch: refetchTurler } = useQuery<OrganizasyonTuru[]>({
    queryKey: ['organizasyon-turleri'],
    queryFn: () => getOrganizasyonTurleri(),
    enabled: isOpen,
    refetchOnMount: true,
    staleTime: 0,
  });

  const { data: organizasyonGruplari = [] } = useQuery({
    queryKey: ['organizasyon-gruplari'],
    queryFn: getOrganizasyonGruplari,
    enabled: isOpen,
    refetchOnMount: true,
    staleTime: 0,
  });

  const { data: organizasyonEtiketleri = [], refetch: refetchEtiketler } = useQuery({
    queryKey: ['organizasyon-etiketleri'],
    queryFn: () => getOrganizasyonEtiketleri(),
    enabled: isOpen,
    refetchOnMount: true,
    staleTime: 0,
  });

  // Sekmeye göre grup id eşlemesi (organizasyon, aracsusleme, ozelsiparis, ozelgun)
  const getGrupIdForTab = useCallback((tab: KartTuru): number | null => {
    const t = (organizasyonGruplari as { id: number; tur_adi?: string; grup_adi?: string }[]).find((g) => {
      const ad = ((g.tur_adi || g.grup_adi || '') as string).toLowerCase();
      if (tab === 'organizasyon') return ad.includes('organizasyon') && !ad.includes('özel') && !ad.includes('araç');
      if (tab === 'aracsusleme') return ad.includes('araç') || ad.includes('arac');
      if (tab === 'ozelsiparis') return ad.includes('özel sipariş') || ad.includes('ozel siparis');
      if (tab === 'ozelgun') return ad.includes('özel gün') || ad.includes('ozel gun');
      return false;
    });
    return t ? t.id : null;
  }, [organizasyonGruplari]);

  const etiketleriOrganizasyon = organizasyonEtiketleri.filter((e) => e.grup_id === getGrupIdForTab('organizasyon') || (getGrupIdForTab('organizasyon') == null && (e.grup_id == null || e.grup_id === 0)));
  const etiketleriAracSusleme = organizasyonEtiketleri.filter((e) => e.grup_id === getGrupIdForTab('aracsusleme'));
  const etiketleriOzelSiparis = organizasyonEtiketleri.filter((e) => e.grup_id === getGrupIdForTab('ozelsiparis'));
  const etiketleriOzelGun = organizasyonEtiketleri.filter((e) => e.grup_id === getGrupIdForTab('ozelgun'));

  // Organizasyon sekmesi: sadece organizasyon grubunun alt türleri; diğer sekmeler için de filtrele
  const organizasyonGrupId = getGrupIdForTab('organizasyon');
  const ozelGunGrupId = getGrupIdForTab('ozelgun');
  const ozelSiparisGrupId = getGrupIdForTab('ozelsiparis');
  const aracSuslemeGrupId = getGrupIdForTab('aracsusleme');
  const turleriOrganizasyon = organizasyonTurleri.filter((t) => t.grup_id === organizasyonGrupId || (organizasyonGrupId == null && (t.grup_id == null || t.grup_id === 0)));
  const turleriOzelGun = organizasyonTurleri.filter((t) => t.grup_id === ozelGunGrupId);
  const turleriOzelSiparis = organizasyonTurleri.filter((t) => t.grup_id === ozelSiparisGrupId);
  const turleriAracSusleme = organizasyonTurleri.filter((t) => t.grup_id === aracSuslemeGrupId);

  // Bugünün tarihini set et
  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;
      
      setTeslimTarih(todayStr);
      setAracRandevuTarih(todayStr);
      setOzelSiparisTarih(todayStr);
      setOzelGunTarih(todayStr);
    }
  }, [isOpen]);

  // Form reset (modal kapatıldığında veya iptal edildiğinde)
  const resetForm = useCallback(() => {
    setActiveTab('organizasyon');
    setOrgTur('');
    setOrgEtiket('');
    setDavetiyeGorsel(null);
    setDavetiyeGorselPreview('');
    setTeslimatKonumu('');
    setTeslimTarih('');
    setTeslimSaat('');
    setTeslimKisisi('');
    teslimKisisiTelefonInput.setDisplayValue('');
    setAcikAdres('');
    setAracRandevuTarih('');
    setAracEtiket('');
    setOzelSiparisTarih('');
    setOzelSiparisEtiket('');
    setOzelGunTarih('');
    setOzelGunEtiket('');
    setOzelGunAltTur('');
    setAracSuslemeAltTur('');
    setOzelSiparisAltTur('');
    addressSelect.reset();
    setError('');
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Modal kapandığında formu resetle; açıldığında dirty sıfırla ve etiket/tür listelerini tazele (çok sayfa gezdikten sonra etiket isimleri görünsün)
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    } else {
      setDirty(false);
      refetchTurler();
      refetchEtiketler();
    }
  }, [isOpen, resetForm, refetchTurler, refetchEtiketler]);

  const requestClose = useCallback(() => {
    if (!isDirty) {
      resetForm();
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

  // Davetiye görseli: tıklama veya sürükle-bırak ile tek dosya
  const applyDavetiyeFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setDavetiyeGorsel(file);
    markDirty();
    const reader = new FileReader();
    reader.onloadend = () => setDavetiyeGorselPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleDavetiyeGorselChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) applyDavetiyeFile(file);
  };

  const handleDavetiyeDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverDavetiye(false);
    const file = e.dataTransfer.files?.[0];
    if (file) applyDavetiyeFile(file);
  };

  const handleDavetiyeDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Yeni alt tür ekle: popup aç (hangi ana tür için)
  const openTurPopup = (tab: KartTuru = 'organizasyon') => {
    setTurPopupTab(tab);
    setTurPopupInput('');
    setShowTurPopup(true);
    setTimeout(() => turPopupInputRef.current?.focus(), 100);
  };

  const closeTurPopup = () => {
    setShowTurPopup(false);
    setTurPopupInput('');
    setTurPopupSaving(false);
  };

  const handleTurPopupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const turAdi = turPopupInput.trim();
    if (!turAdi) {
      showToast('warning', 'Lütfen tür adını girin.');
      return;
    }
    setTurPopupSaving(true);
    const grupId = getGrupIdForTab(turPopupTab);
    try {
      const result = await createOrganizasyonTuru(turAdi, grupId);
      if (result.success && result.data?.tur_adi) {
        showToast('success', 'Tür başarıyla eklendi!');
        refetchTurler();
        closeTurPopup();
        if (turPopupTab === 'organizasyon') setOrgTur(result.data.tur_adi);
        else if (turPopupTab === 'aracsusleme') setAracSuslemeAltTur(result.data.tur_adi);
        else if (turPopupTab === 'ozelsiparis') setOzelSiparisAltTur(result.data.tur_adi);
        else if (turPopupTab === 'ozelgun') setOzelGunAltTur(result.data.tur_adi);
      } else {
        showToast('error', 'Tür eklenemedi!');
      }
    } catch (error) {
      console.error('Tür ekleme hatası:', error);
      showToast('error', 'Tür eklenemedi!');
    } finally {
      setTurPopupSaving(false);
    }
  };

  // Sekme tipinden grup id (etiketlerin hangi sekmeye ait olduğu)
  const getGrupIdByEtiketTipi = useCallback((etiketTipi: string): number | null => {
    const tab: KartTuru =
      etiketTipi === 'organizasyon' ? 'organizasyon' :
      etiketTipi === 'aracsusleme' ? 'aracsusleme' :
      etiketTipi === 'ozel-siparis' ? 'ozelsiparis' :
      etiketTipi === 'ozel-gun' ? 'ozelgun' : 'organizasyon';
    return getGrupIdForTab(tab);
  }, [getGrupIdForTab]);

  // Yeni etiket ekle: popup aç (tarayıcı prompt yok)
  const openEtiketPopup = (etiketTipi: string) => {
    setEtiketPopupTipi(etiketTipi);
    setEtiketPopupInput('');
    setShowEtiketPopup(true);
    setTimeout(() => etiketPopupInputRef.current?.focus(), 100);
  };

  const closeEtiketPopup = () => {
    setShowEtiketPopup(false);
    setEtiketPopupInput('');
    setEtiketPopupSaving(false);
  };

  const handleEtiketPopupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const etiketAdi = etiketPopupInput.trim();
    if (!etiketAdi) {
      showToast('warning', 'Lütfen etiket adını girin.');
      return;
    }
    setEtiketPopupSaving(true);
    const grupId = getGrupIdByEtiketTipi(etiketPopupTipi);
    try {
      const result = await createOrganizasyonEtiketi(etiketAdi, grupId);
      if (result.success && result.data?.etiket_adi) {
        showToast('success', 'Etiket başarıyla eklendi!');
        refetchEtiketler();
        closeEtiketPopup();
        if (etiketPopupTipi === 'organizasyon') setOrgEtiket(result.data.etiket_adi);
        else if (etiketPopupTipi === 'aracsusleme') setAracEtiket(result.data.etiket_adi);
        else if (etiketPopupTipi === 'ozel-siparis') setOzelSiparisEtiket(result.data.etiket_adi);
        else if (etiketPopupTipi === 'ozel-gun') setOzelGunEtiket(result.data.etiket_adi);
      } else {
        showToast('error', 'Etiket eklenemedi!');
      }
    } catch (error) {
      console.error('Etiket ekleme hatası:', error);
      showToast('error', 'Etiket eklenemedi!');
    } finally {
      setEtiketPopupSaving(false);
    }
  };

  const getEtiketSekmeAdi = (tip: string) => {
    if (tip === 'organizasyon') return 'ORGANİZASYON';
    if (tip === 'aracsusleme') return 'ARAÇ SÜSLEME';
    if (tip === 'ozel-siparis') return 'ÖZEL SİPARİŞ';
    if (tip === 'ozel-gun') return 'ÖZEL GÜN';
    return 'Organizasyon';
  };

  // ESC ile tür/etiket popup kapatma (setState ile doğrudan kapatma, fonksiyon bağımlılığı yok)
  useEffect(() => {
    if (!showTurPopup && !showEtiketPopup) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showTurPopup) {
          setShowTurPopup(false);
          setTurPopupInput('');
          setTurPopupSaving(false);
        } else if (showEtiketPopup) {
          setShowEtiketPopup(false);
          setEtiketPopupInput('');
          setEtiketPopupSaving(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showTurPopup, showEtiketPopup]);

  // Form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Tüm sekmelerde alt tür zorunlu – önce bunu kontrol et
      if (activeTab === 'organizasyon') {
        if (!orgTur || !orgTur.trim()) {
          setError('Lütfen organizasyon alt türünü seçin!');
          setLoading(false);
          return;
        }
      } else if (activeTab === 'aracsusleme') {
        if (!aracSuslemeAltTur || !aracSuslemeAltTur.trim()) {
          setError('Lütfen araç süsleme alt türünü seçin!');
          setLoading(false);
          return;
        }
      } else if (activeTab === 'ozelsiparis') {
        if (!ozelSiparisAltTur || !ozelSiparisAltTur.trim()) {
          setError('Lütfen özel sipariş alt türünü seçin!');
          setLoading(false);
          return;
        }
      } else if (activeTab === 'ozelgun') {
        if (!ozelGunAltTur || !ozelGunAltTur.trim()) {
          setError('Lütfen özel gün alt türünü seçin!');
          setLoading(false);
          return;
        }
      }

      let result;

      if (activeTab === 'organizasyon') {
        // Validasyon
        if (!orgTur) {
          const msg = 'Lütfen organizasyon türünü seçin!';
          setError(msg);
          showToast('error', msg);
          setLoading(false);
          return;
        }
        if (!teslimTarih) {
          const msg = 'Lütfen teslim tarihini seçin!';
          setError(msg);
          showToast('error', msg);
          setLoading(false);
          return;
        }
        if (!teslimKisisi.trim()) {
          const msg = 'Lütfen organizasyon sahibi bilgisini girin!';
          setError(msg);
          showToast('error', msg);
          setLoading(false);
          return;
        }
        if (!teslimKisisiTelefonInput.cleanValue.trim()) {
          const msg = 'Lütfen organizasyon sahibi telefonunu girin!';
          setError(msg);
          showToast('error', msg);
          setLoading(false);
          return;
        }
        // Telefon format kontrolü
        const cleanPhone = teslimKisisiTelefonInput.cleanValue;
        if (cleanPhone.length < 12) {
          const msg = 'Lütfen geçerli bir telefon numarası girin!';
          setError(msg);
          showToast('error', msg);
          setLoading(false);
          return;
        }
        if (!addressSelect.il || !addressSelect.ilce || !addressSelect.mahalle) {
          const msg = 'Lütfen adres bilgilerini eksiksiz doldurun!';
          setError(msg);
          showToast('error', msg);
          setLoading(false);
          return;
        }
        if (!acikAdres.trim()) {
          const msg = 'Lütfen açık adresi girin!';
          setError(msg);
          showToast('error', msg);
          setLoading(false);
          return;
        }

        const formData: OrganizasyonKartFormData = {
          kart_tur: 'Organizasyon',
          alt_tur: orgTur,
          kart_etiket: orgEtiket || undefined,
          il: addressSelect.il,
          ilce: addressSelect.ilce,
          mahalle: addressSelect.mahalle,
          acik_adres: acikAdres,
          teslim_kisisi: teslimKisisi,
          teslim_kisisi_telefon: teslimKisisiTelefonInput.cleanValue,
          teslim_tarih: teslimTarih,
          teslim_saat: teslimSaat,
          teslimat_konumu: teslimatKonumu || undefined,
          davetiye_gorsel: davetiyeGorsel || undefined,
        };

        result = await createOrganizasyonKart(formData);
      } else if (activeTab === 'aracsusleme') {
        if (!aracRandevuTarih) {
          const msg = 'Lütfen randevu tarihini seçin!';
          setError(msg);
          showToast('error', msg);
          setLoading(false);
          return;
        }
        if (!aracSuslemeAltTur || !aracSuslemeAltTur.trim()) {
          const msg = 'Lütfen alt türü seçin!';
          setError(msg);
          showToast('error', msg);
          setLoading(false);
          return;
        }

        const formData: AracSuslemeKartFormData = {
          teslim_tarih: aracRandevuTarih,
          alt_tur: aracSuslemeAltTur || undefined,
        };

        result = await createAracSuslemeKart(formData);
      } else if (activeTab === 'ozelsiparis') {
        if (!ozelSiparisTarih) {
          const msg = 'Lütfen teslim tarihini seçin!';
          setError(msg);
          showToast('error', msg);
          setLoading(false);
          return;
        }
        if (!ozelSiparisAltTur || !ozelSiparisAltTur.trim()) {
          const msg = 'Lütfen alt türü seçin!';
          setError(msg);
          showToast('error', msg);
          setLoading(false);
          return;
        }

        const formData: OzelSiparisKartFormData = {
          teslim_tarih: ozelSiparisTarih,
          kart_etiket: ozelSiparisEtiket || undefined,
          alt_tur: ozelSiparisAltTur || undefined,
        };

        result = await createOzelSiparisKart(formData);
      } else if (activeTab === 'ozelgun') {
        if (!ozelGunTarih) {
          const msg = 'Lütfen teslim tarihini seçin!';
          setError(msg);
          showToast('error', msg);
          setLoading(false);
          return;
        }
        if (!ozelGunAltTur || !ozelGunAltTur.trim()) {
          const msg = 'Lütfen alt türü seçin!';
          setError(msg);
          showToast('error', msg);
          setLoading(false);
          return;
        }

        const formData: OzelGunKartFormData = {
          teslim_tarih: ozelGunTarih,
          kart_etiket: ozelGunEtiket || undefined,
          alt_tur: ozelGunAltTur || undefined,
        };

        result = await createOzelGunKart(formData);
      }

      if (result?.success) {
        showToast('success', 'Kart başarıyla oluşturuldu!');
        invalidateOrganizasyonKartQueries(queryClient);
        resetForm();
        const newKartId = (result as { data?: { id?: number } })?.data?.id;
      onSuccess?.(newKartId);
      onClose();
      } else {
        setError(result?.message || 'Kart oluşturulamadı!');
      }
    } catch (err: any) {
      console.error('Kart oluşturma hatası:', err);
      const errorMessage = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Kart oluşturulamadı!';
      setError(errorMessage);
      showToast('error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Modal açık değilse portal render etme (tüm hook'lar yukarıda çağrıldı)
  if (!isOpen) return null;

  return createPortal(
    <>
      <div
        ref={overlayRef}
        className={`overlay-yeni-kart-container ${isOpen ? 'show' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            requestClose();
          }
        }}
      >
      <div
        ref={panelRef}
        className={`yeni-kart-container ${isOpen ? 'show' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="yeni-kart-organizasyon">
          <div className="header-alan">
            <div className="modal-yeni-kart-header-baslik">Yeni Kart Oluştur</div>
            <button className="btn-close-modal" onClick={requestClose} type="button">
              <i className="icon-btn-kapat"></i>
            </button>
          </div>
          <div className="tab-kapsayici">
            <div className="tab">
              <button
                className={`tablinks ${activeTab === 'organizasyon' ? 'active' : ''}`}
                onClick={() => setActiveTab('organizasyon')}
                type="button"
              >
                Organizasyon
                <div className="aciklamasatir">Düğün, nişan, açılış, yemek vb. organizasyonlar için kart oluşturun.</div>
              </button>
              <button
                className={`tablinks ${activeTab === 'aracsusleme' ? 'active' : ''}`}
                onClick={() => setActiveTab('aracsusleme')}
                type="button"
              >
                Araç Süsleme
                <div className="aciklamasatir">Gelin arabası vb. araç süslemeleri için kart oluşturun.</div>
              </button>
              <button
                className={`tablinks ${activeTab === 'ozelsiparis' ? 'active' : ''}`}
                onClick={() => setActiveTab('ozelsiparis')}
                type="button"
              >
                Özel Sipariş
                <div className="aciklamasatir">Kişilere ait (buket vb.) özel siparişler için kart oluşturun.</div>
              </button>
              <button
                className={`tablinks ${activeTab === 'ozelgun' ? 'active' : ''}`}
                onClick={() => setActiveTab('ozelgun')}
                type="button"
              >
                Özel Gün
                <div className="aciklamasatir">Anneler Günü vb. özel gün organizasyonları için kart oluşturun.</div>
              </button>
            </div>
            <div className="tab-content-alan" ref={tabContentRef}>
              <form ref={formRef} onSubmit={handleSubmit}>
                {/* Organizasyon Kartı Form */}
                {activeTab === 'organizasyon' && (
                  <div id="organizasyon-kart" className="tabcontent" style={{ display: 'block' }}>
                    <div className="input-alan-container">
                      <div className="input-alan">
                        <div className="kart-baslik">Organizasyon Kartı Oluştur</div>
                        
                        {/* Organizasyon Türü */}
                        <div className="input-form">
                          <div className="modal-yeni-kart-form-baslik">
                            <Layers size={18} strokeWidth={1.5} aria-hidden /> Organizasyon Alt Türü
                          </div>
                          <div className="label-kapsayici-org-tipler">
                            {turleriOrganizasyon.map((tur) => (
                              <label key={tur.id} className="radio-label">
                                <input
                                  type="radio"
                                  name="orgtur-etiket"
                                  value={tur.tur_adi}
                                  checked={orgTur === tur.tur_adi}
                                  onChange={(e) => { setOrgTur(e.target.value); markDirty(); }}
                                  required
                                />
                                <span>{tur.tur_adi}</span>
                              </label>
                            ))}
                            <button
                              type="button"
                              className="btn-yeni-ekle btn-yeni-tur"
                              onClick={() => openTurPopup('organizasyon')}
                            >
                              +YENİ ALT TÜR EKLE
                            </button>
                          </div>
                        </div>

                        {/* Görsel Yükleme – tıklayın veya sürükleyip bırakın, "Dosya Seç" yok */}
                        <div
                          className={`dosya-yukle-alan ${davetiyeGorselPreview ? 'dosya-secildi' : ''} ${isDragOverDavetiye ? 'drag-over' : ''}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => !davetiyeGorselPreview && davetiyeInputRef.current?.click()}
                          onKeyDown={(e) => e.key === 'Enter' && !davetiyeGorselPreview && davetiyeInputRef.current?.click()}
                          onDragEnter={() => !davetiyeGorselPreview && setIsDragOverDavetiye(true)}
                          onDragLeave={(e) => {
                            const el = e.currentTarget;
                            const next = e.relatedTarget as Node | null;
                            if (!next || !el.contains(next)) setIsDragOverDavetiye(false);
                          }}
                          onDragOver={handleDavetiyeDragOver}
                          onDrop={handleDavetiyeDrop}
                        >
                          <input
                            ref={davetiyeInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleDavetiyeGorselChange}
                            style={{ display: 'none' }}
                            id="davetiye-gorsel-input"
                          />
                          {davetiyeGorselPreview ? (
                            <>
                              <img src={davetiyeGorselPreview} alt="Preview" className="davetiye-preview-img" />
                              <span className="secilen-dosya-metin">
                                <strong>Seçilen dosya:</strong> {davetiyeGorsel?.name ?? ''}
                              </span>
                              <button
                                type="button"
                                className="remove-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDavetiyeGorsel(null);
                                  setDavetiyeGorselPreview('');
                                }}
                              >
                                Kaldır
                              </button>
                            </>
                          ) : (
                            <>
                              <Upload size={18} strokeWidth={1.5} aria-hidden />
                              <span className="file-label">Davetiye görselini bu alana sürükleyin veya tıklayın</span>
                            </>
                          )}
                        </div>
                        <hr />

                        {/* Teslimat Konumu */}
                        <div className="input-form">
                          <div className="modal-yeni-kart-form-baslik">
                            <MapPin size={18} strokeWidth={1.5} aria-hidden /> Teslimat Konumu
                          </div>
                          <div className="input-grup">
                            <select
                              value={teslimatKonumu}
                              onChange={(e) => {
                                const value = e.target.value;
                                setTeslimatKonumu(value);
                                const konum = teslimatKonumuOptions.find((k) => (k.konum_adi || '') === value);
                                if (konum) {
                                  const mahalleVal = (konum.mahalle ?? (konum as any).mahalle_adi ?? '').toString().trim();
                                  if (mahalleVal) addressSelect.setMahalle(mahalleVal);
                                  if (konum.acik_adres != null && konum.acik_adres !== '') {
                                    setAcikAdres(konum.acik_adres);
                                  }
                                } else {
                                  addressSelect.setMahalle('');
                                  setAcikAdres('');
                                }
                                markDirty();
                              }}
                            >
                              <option value="">
                                {teslimatKonumu === ''
                                  ? 'Teslimat Konumu (Opsiyonel)'
                                  : 'Teslimat Konumu Yok'}
                              </option>
                              {teslimatKonumuOptions.map((k) => (
                                <option key={k.id ?? k.konum_adi} value={k.konum_adi || ''}>
                                  {k.konum_adi}
                                </option>
                              ))}
                            </select>
                            <small className="input-help">Organizasyon teslimat konumu varsa seçiniz, yoksa aşağıdaki adres bilgilerini eksiksiz doldurunuz.</small>
                          </div>
                        </div>
                        <hr />

                        {/* Teslimat Adresi Bilgileri */}
                        <div className="input-form">
                          <div className="modal-yeni-kart-form-baslik">
                            <MapPin size={18} strokeWidth={1.5} aria-hidden /> Teslimat Adresi Bilgileri
                          </div>
                          <div className="input-grup">
                            <div className="input-grup-il-ilce">
                              <select
                                value={addressSelect.il}
                                onChange={(e) => { addressSelect.setIl(e.target.value); markDirty(); }}
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
                                value={addressSelect.ilce}
                                onChange={(e) => { addressSelect.setIlce(e.target.value); markDirty(); }}
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
                              value={addressSelect.mahalle}
                              onChange={(e) => { addressSelect.setMahalle(e.target.value); markDirty(); }}
                              required
                              disabled={!addressSelect.ilce}
                            >
                              <option value="">Mahalle/Semt Seçiniz</option>
                              {mahalleOptionsForSelect.map((mahalle) => (
                                <option key={mahalle.id} value={mahalle.name}>
                                  {mahalle.name}
                                </option>
                              ))}
                            </select>
                            <textarea
                              value={acikAdres}
                              onChange={(e) => { setAcikAdres(e.target.value); markDirty(); }}
                              placeholder="Açık adresi yazınız"
                              rows={3}
                              required
                            />
                          </div>
                        </div>
                        <hr />

                        {/* Teslimat Tarih Saat */}
                        <div className="input-form">
                          <div className="modal-yeni-kart-form-baslik">
                            <CalendarClock size={18} strokeWidth={1.5} aria-hidden /> Teslimat Tarihi & Saati
                          </div>
                          <div className="tarih-saat-container">
                            <div className="input-tarih-saat">
                              <div className="siparis-tarih">
                                <input
                                  type="date"
                                  value={teslimTarih}
                                  onChange={(e) => { setTeslimTarih(e.target.value); markDirty(); }}
                                  required
                                />
                              </div>
                              <div className="siparis-saat">
                                <input
                                  type="time"
                                  value={teslimSaat}
                                  onChange={(e) => { setTeslimSaat(e.target.value); markDirty(); }}
                                  required
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <hr />

                        {/* Organizasyon Sahibi */}
                        <div className="input-form">
                          <div className="modal-yeni-kart-form-baslik">
                            <User size={18} strokeWidth={1.5} aria-hidden /> Organizasyon Sahibi Bilgileri
                          </div>
                          <div className="input-grup-column">
                            <label>
                              ORGANİZASYON SAHİBİ
                              <input
                                type="text"
                                value={teslimKisisi}
                                onChange={(e) => { setTeslimKisisi(e.target.value); markDirty(); }}
                                placeholder="İsim Soyisim"
                                required
                              />
                            </label>
                            <label>
                              TELEFON NUMARASI
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
                                required
                                data-phone-input="standard"
                              />
                            </label>
                          </div>
                        </div>
                        <hr />

                        {/* Etiketler */}
                        <div className="input-form">
                          <div className="baslik-etiketler">
                            <div className="modal-yeni-kart-baslik-alan">
                              <Tag size={18} strokeWidth={1.5} aria-hidden /> Kart Etiketi
                            </div>
                          </div>
                          <div className="etiket-grup">
                            {etiketleriOrganizasyon.map((etiket) => (
                              <label key={etiket.id} className="radio-label">
                                <input
                                  type="radio"
                                  name="organizasyon-etiketler"
                                  value={etiket.etiket_adi}
                                  checked={orgEtiket === etiket.etiket_adi}
                                  onChange={(e) => { setOrgEtiket(e.target.value); markDirty(); }}
                                />
                                <span>{etiket.etiket_adi}</span>
                              </label>
                            ))}
                            <button
                              type="button"
                              className="btn-yeni-ekle btn-yeni-etiket"
                              onClick={() => openEtiketPopup('organizasyon')}
                            >
                              +YENİ ETİKET EKLE
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="butonlar">
                        <button type="button" className="secondary-button btn-vazgec" onClick={requestClose}>
                          VAZGEÇ
                        </button>
                        <button type="submit" className="primary-button btn-kart-olustur" disabled={loading}>
                          {loading ? <LoadingSpinner size="sm" /> : 'KART OLUŞTUR'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Araç Süsleme Kartı Form */}
                {activeTab === 'aracsusleme' && (
                  <div id="aracsusleme-kart" className="tabcontent" style={{ display: 'block' }}>
                    <div className="input-alan-container">
                      <div className="input-alan">
                        <div className="kart-baslik">Araç Süsleme Kartı Oluştur</div>
                        <div className="input-form">
                          <div className="modal-yeni-kart-form-baslik">
                            <Layers size={18} strokeWidth={1.5} aria-hidden /> Araç Süsleme Alt Türü
                          </div>
                          <div className="label-kapsayici-org-tipler">
                            {turleriAracSusleme.map((tur) => (
                              <label key={tur.id} className="radio-label">
                                <input
                                  type="radio"
                                  name="aracsusleme-alt-tur"
                                  value={tur.tur_adi}
                                  checked={aracSuslemeAltTur === tur.tur_adi}
                                  onChange={(e) => { setAracSuslemeAltTur(e.target.value); markDirty(); }}
                                  required
                                />
                                <span>{tur.tur_adi}</span>
                              </label>
                            ))}
                            <button
                              type="button"
                              className="btn-yeni-ekle btn-yeni-tur"
                              onClick={() => openTurPopup('aracsusleme')}
                            >
                              +YENİ ALT TÜR EKLE
                            </button>
                          </div>
                        </div>
                        <hr />
                        <div className="input-form">
                          <div className="modal-yeni-kart-form-baslik">
                            <CalendarClock size={18} strokeWidth={1.5} aria-hidden /> Randevu Tarihi
                          </div>
                          <div className="input-grup">
                            <div className="tarih-saat-container">
                              <div className="input-tarih-saat">
                                <div className="siparis-tarih">
                                  <input
                                    type="date"
                                    value={aracRandevuTarih}
                                    onChange={(e) => { setAracRandevuTarih(e.target.value); markDirty(); }}
                                    required
                                  />
                                </div>
                              </div>
                              <div className="aciklama">
                                Araç süsleme kartları için kartların üzerindeki tek bir randevu tarihi bulunur.{' '}
                                <span>Sipariş kartları üzerindeki randevu saatini dikkate alınız.</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <hr />
                        <div className="input-form">
                          <div className="baslik-etiketler">
                            <div className="modal-yeni-kart-baslik-alan">
                              <Tag size={18} strokeWidth={1.5} aria-hidden /> Kart Etiketi
                            </div>
                          </div>
                          <div className="etiket-grup">
                            {etiketleriAracSusleme.map((etiket) => (
                              <label key={etiket.id} className="radio-label">
                                <input
                                  type="radio"
                                  name="aracsusleme-etiketler"
                                  value={etiket.etiket_adi}
                                  checked={aracEtiket === etiket.etiket_adi}
                                  onChange={(e) => { setAracEtiket(e.target.value); markDirty(); }}
                                />
                                <span>{etiket.etiket_adi}</span>
                              </label>
                            ))}
                            <button
                              type="button"
                              className="btn-yeni-ekle btn-yeni-etiket"
                              onClick={() => openEtiketPopup('aracsusleme')}
                            >
                              +YENİ ETİKET EKLE
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="butonlar">
                        <button type="button" className="secondary-button btn-vazgec" onClick={requestClose}>
                          VAZGEÇ
                        </button>
                        <button type="submit" className="primary-button btn-kart-olustur" disabled={loading}>
                          {loading ? <LoadingSpinner size="sm" /> : 'KART OLUŞTUR'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Özel Sipariş Kartı Form */}
                {activeTab === 'ozelsiparis' && (
                  <div id="ozelsiparis-kart" className="tabcontent" style={{ display: 'block' }}>
                    <div className="input-alan-container">
                      <div className="input-alan">
                        <div className="kart-baslik">Özel Sipariş Kartı Oluştur</div>
                        <div className="input-form">
                          <div className="modal-yeni-kart-form-baslik">
                            <Layers size={18} strokeWidth={1.5} aria-hidden /> Özel Sipariş Alt Türü
                          </div>
                          <div className="label-kapsayici-org-tipler">
                            {turleriOzelSiparis.map((tur) => (
                              <label key={tur.id} className="radio-label">
                                <input
                                  type="radio"
                                  name="ozelsiparis-alt-tur"
                                  value={tur.tur_adi}
                                  checked={ozelSiparisAltTur === tur.tur_adi}
                                  onChange={(e) => { setOzelSiparisAltTur(e.target.value); markDirty(); }}
                                  required
                                />
                                <span>{tur.tur_adi}</span>
                              </label>
                            ))}
                            <button
                              type="button"
                              className="btn-yeni-ekle btn-yeni-tur"
                              onClick={() => openTurPopup('ozelsiparis')}
                            >
                              +YENİ ALT TÜR EKLE
                            </button>
                          </div>
                        </div>
                        <hr />
                        <div className="input-form">
                          <div className="modal-yeni-kart-form-baslik">
                            <CalendarClock size={18} strokeWidth={1.5} aria-hidden /> Teslimat Tarihi
                          </div>
                          <div className="input-grup">
                            <div className="tarih-saat-container">
                              <div className="input-tarih-saat">
                                <div className="siparis-tarih">
                                  <input
                                    type="date"
                                    value={ozelSiparisTarih}
                                    onChange={(e) => { setOzelSiparisTarih(e.target.value); markDirty(); }}
                                    required
                                  />
                                </div>
                              </div>
                              <div className="aciklama">
                                Özel siparişler için kartlar üzerinde tek bir teslim tarihi bulunur.{' '}
                                <span>Sipariş kartları üzerindeki teslim saatini dikkate alınız.</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <hr />
                        <div className="input-form">
                          <div className="baslik-etiketler">
                            <div className="modal-yeni-kart-baslik-alan">
                              <Tag size={18} strokeWidth={1.5} aria-hidden /> Kart Etiketi
                            </div>
                          </div>
                          <div className="etiket-grup">
                            {etiketleriOzelSiparis.map((etiket) => (
                              <label key={etiket.id} className="radio-label">
                                <input
                                  type="radio"
                                  name="ozelsiparis-etiketler"
                                  value={etiket.etiket_adi}
                                  checked={ozelSiparisEtiket === etiket.etiket_adi}
                                  onChange={(e) => { setOzelSiparisEtiket(e.target.value); markDirty(); }}
                                />
                                <span>{etiket.etiket_adi}</span>
                              </label>
                            ))}
                            <button
                              type="button"
                              className="btn-yeni-ekle btn-yeni-etiket"
                              onClick={() => openEtiketPopup('ozel-siparis')}
                            >
                              +YENİ ETİKET EKLE
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="butonlar">
                        <button type="button" className="secondary-button btn-vazgec" onClick={requestClose}>
                          VAZGEÇ
                        </button>
                        <button type="submit" className="primary-button btn-kart-olustur" disabled={loading}>
                          {loading ? <LoadingSpinner size="sm" /> : 'KART OLUŞTUR'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Özel Gün Kartı Form */}
                {activeTab === 'ozelgun' && (
                  <div id="ozelgun-kart" className="tabcontent" style={{ display: 'block' }}>
                    <div className="input-alan-container">
                      <div className="input-alan">
                        <div className="kart-baslik">Özel Gün Kartı Oluştur</div>
                        <div className="input-form">
                          <div className="modal-yeni-kart-form-baslik">
                            <Layers size={18} strokeWidth={1.5} aria-hidden /> Özel Gün Alt Türü
                          </div>
                          <div className="label-kapsayici-org-tipler">
                            {turleriOzelGun.map((tur) => (
                              <label key={tur.id} className="radio-label">
                                <input
                                  type="radio"
                                  name="ozelgun-alt-tur"
                                  value={tur.tur_adi}
                                  checked={ozelGunAltTur === tur.tur_adi}
                                  onChange={(e) => { setOzelGunAltTur(e.target.value); markDirty(); }}
                                  required
                                />
                                <span>{tur.tur_adi}</span>
                              </label>
                            ))}
                            <button
                              type="button"
                              className="btn-yeni-ekle btn-yeni-tur"
                              onClick={() => openTurPopup('ozelgun')}
                            >
                              +YENİ ALT TÜR EKLE
                            </button>
                          </div>
                        </div>
                        <hr />
                        <div className="input-form">
                          <div className="modal-yeni-kart-form-baslik">
                            <CalendarClock size={18} strokeWidth={1.5} aria-hidden /> Teslimat Tarihi
                          </div>
                          <div className="input-grup">
                            <div className="tarih-saat-container">
                              <div className="input-tarih-saat">
                                <div className="siparis-tarih">
                                  <input
                                    type="date"
                                    value={ozelGunTarih}
                                    onChange={(e) => { setOzelGunTarih(e.target.value); markDirty(); }}
                                    required
                                  />
                                </div>
                              </div>
                              <div className="aciklama">
                                Özel gün siparişleri için kartların üzerindeki tek bir teslim tarihi bulunur.{' '}
                                <span>Siparişler için sipariş kartları üzerindeki teslim saatini dikkate alınız.</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <hr />
                        <div className="input-form">
                          <div className="baslik-etiketler">
                            <div className="modal-yeni-kart-baslik-alan">
                              <Tag size={18} strokeWidth={1.5} aria-hidden /> Kart Etiketi
                            </div>
                          </div>
                          <div className="etiket-grup">
                            {etiketleriOzelGun.map((etiket) => (
                              <label key={etiket.id} className="radio-label">
                                <input
                                  type="radio"
                                  name="ozelgun-etiketler"
                                  value={etiket.etiket_adi}
                                  checked={ozelGunEtiket === etiket.etiket_adi}
                                  onChange={(e) => { setOzelGunEtiket(e.target.value); markDirty(); }}
                                />
                                <span>{etiket.etiket_adi}</span>
                              </label>
                            ))}
                            <button
                              type="button"
                              className="btn-yeni-ekle btn-yeni-etiket"
                              onClick={() => openEtiketPopup('ozel-gun')}
                            >
                              +YENİ ETİKET EKLE
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="butonlar">
                        <button type="button" className="secondary-button btn-vazgec" onClick={requestClose}>
                          VAZGEÇ
                        </button>
                        <button type="submit" className="primary-button btn-kart-olustur" disabled={loading}>
                          {loading ? <LoadingSpinner size="sm" /> : 'KART OLUŞTUR'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Hata mesajı artık sadece toast üzerinden gösteriliyor; form altında kırmızı blok yok */}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* Yeni tür ekle popup (eski sistemdeki gibi) */}
      {showTurPopup && (
        <div
          className="yeni-etiket-popup-overlay active"
          onClick={(e) => e.target === e.currentTarget && closeTurPopup()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tur-popup-title"
        >
          <div className="etiket-popup" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
                <h3 id="tur-popup-title" className="popup-title">
                Yeni Organizasyon Türü Ekle
              </h3>
              <button type="button" className="btn-close-form" onClick={closeTurPopup} aria-label="Kapat">
                <i className="icon-btn-kapat" />
              </button>
            </div>
            <div className="popup-info">
              Bu tür, ilgili kart formunda seçenek olarak görünecektir.
            </div>
            <form className="popup-form" onSubmit={handleTurPopupSubmit}>
              <div className="popup-input-group">
                <label className="popup-label" htmlFor="tur-popup-input">Tür adı</label>
                <input
                  ref={turPopupInputRef}
                  id="tur-popup-input"
                  type="text"
                  className="popup-input"
                  placeholder="Yeni organizasyon türü adını yazın"
                  value={turPopupInput}
                  onChange={(e) => setTurPopupInput(e.target.value)}
                  maxLength={50}
                  required
                />
              </div>
              <div className="popup-buttons">
                <button type="button" className="secondary-button btn-vazgec" onClick={closeTurPopup}>
                  VAZGEÇ
                </button>
                <button type="submit" className="primary-button btn-kaydet" disabled={turPopupSaving}>
                  {turPopupSaving ? <LoadingSpinner size="sm" /> : 'KAYDET'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Yeni etiket ekle popup (eski sistemdeki gibi) */}
      {showEtiketPopup && (
        <div
          className="yeni-etiket-popup-overlay active"
          onClick={(e) => e.target === e.currentTarget && closeEtiketPopup()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="etiket-popup-title"
        >
          <div className="etiket-popup" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3 id="etiket-popup-title" className="popup-title">Yeni Etiket Ekle</h3>
              <button type="button" className="btn-close-form" onClick={closeEtiketPopup} aria-label="Kapat">
                <i className="icon-btn-kapat" />
              </button>
            </div>
            <div className="popup-info">
              Bu etiket <strong>{getEtiketSekmeAdi(etiketPopupTipi)}</strong> sekmesine eklenecektir.
            </div>
            <form className="popup-form" onSubmit={handleEtiketPopupSubmit}>
              <div className="popup-input-group">
                <label className="popup-label" htmlFor="etiket-popup-input">Etiket adı</label>
                <input
                  ref={etiketPopupInputRef}
                  id="etiket-popup-input"
                  type="text"
                  className="popup-input"
                  placeholder="Yeni etiket adını yazın"
                  value={etiketPopupInput}
                  onChange={(e) => setEtiketPopupInput(e.target.value)}
                  maxLength={50}
                  required
                />
              </div>
              <div className="popup-buttons">
                <button type="button" className="secondary-button btn-vazgec" onClick={closeEtiketPopup}>
                  VAZGEÇ
                </button>
                <button type="submit" className="primary-button btn-kaydet" disabled={etiketPopupSaving}>
                  {etiketPopupSaving ? <LoadingSpinner size="sm" /> : 'KAYDET'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>,
    document.body
  );
};
