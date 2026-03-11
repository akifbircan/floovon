/**
 * Kart Düzenleme Modal Component
 * Eski sistemdeki gibi YeniKartModal ile aynı yapıyı kullanır, sadece düzenleme modunda
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useModalOpenAnimation } from '../../../shared/hooks/useModalOpenAnimation';
import {
  updateOrganizasyonKart,
  getOrganizasyonTurleri,
  getOrganizasyonEtiketleri,
  getOrganizasyonGruplari,
  createOrganizasyonTuru,
  createOrganizasyonEtiketi,
  getTeslimatKonumlari,
  type OrganizasyonKartFormData,
  type TeslimatKonumuItem,
  type OrganizasyonTuru,
  type OrganizasyonEtiketi,
} from '../api/formActions';
import { getUploadUrl } from '../../../shared/utils/urlUtils';
import { getOrganizasyonKartDetay } from '../api/kartActions';
import { useAddressSelect } from '../hooks/useAddressSelect';
import { showToast } from '../../../shared/utils/toastUtils';
import { invalidateOrganizasyonKartQueries } from '../../../lib/invalidateQueries';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { usePhoneInput } from '../../../shared/hooks/usePhoneInput';
import { Layers, MapPin, CalendarClock, User, Tag, Upload } from 'lucide-react';
import type { OrganizasyonKart } from '../types';

interface EditKartModalProps {
  isOpen: boolean;
  kart: OrganizasyonKart | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EditKartModal: React.FC<EditKartModalProps> = ({
  isOpen,
  kart,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [kartData, setKartData] = useState<OrganizasyonKart | null>(null);

  // Kart türüne göre aktif tab belirle (backend slug: ozel-gun, arac-susleme, ozel-siparis veya Türkçe etiket)
  const getActiveTabFromKartTur = (kartTur: string): string => {
    const raw = (kartTur || '').trim();
    const t = raw.toLowerCase().replace(/-/g, '').replace(/\s/g, '');
    if (t === 'organizasyon' || t === 'dugun' || t === 'nisan' || t === 'sunnet') return 'organizasyon';
    if (t === 'aracsusleme' || t === 'araçsüsleme') return 'aracsusleme';
    if (t === 'ozelsiparis' || t === 'özelsipariş') return 'ozelsiparis';
    if (t === 'ozelgun' || t === 'özelgün') return 'ozelgun';
    // Türkçe tam ifadeler
    if (/özel\s*gün|ozel\s*gun/i.test(raw)) return 'ozelgun';
    if (/özel\s*sipariş|ozel\s*siparis/i.test(raw)) return 'ozelsiparis';
    if (/araç\s*süsleme|arac\s*susleme/i.test(raw)) return 'aracsusleme';
    return 'organizasyon';
  };

  const [activeTab, setActiveTab] = useState<string>('organizasyon');

  // Organizasyon türleri ve etiketleri
  const { data: organizasyonTurleri = [], refetch: refetchTurler } = useQuery<OrganizasyonTuru[]>({
    queryKey: ['organizasyon-turleri'],
    queryFn: () => getOrganizasyonTurleri(),
    enabled: isOpen,
  });

  const { data: organizasyonEtiketleri = [], refetch: refetchEtiketler } = useQuery<OrganizasyonEtiketi[]>({
    queryKey: ['organizasyon-etiketleri'],
    queryFn: () => getOrganizasyonEtiketleri(),
    enabled: isOpen,
  });

  const { data: organizasyonGruplari = [] } = useQuery({
    queryKey: ['organizasyon-gruplari'],
    queryFn: getOrganizasyonGruplari,
    enabled: isOpen,
  });

  // Sekmeye göre grup id (alt tür / etiket filtreleme)
  const getGrupIdForTab = useCallback((tab: string): number | null => {
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

  const organizasyonGrupId = getGrupIdForTab('organizasyon');
  const ozelGunGrupId = getGrupIdForTab('ozelgun');
  const ozelSiparisGrupId = getGrupIdForTab('ozelsiparis');
  const aracSuslemeGrupId = getGrupIdForTab('aracsusleme');
  const turleriOrganizasyon = organizasyonTurleri.filter((t) => t.grup_id === organizasyonGrupId || (organizasyonGrupId == null && (t.grup_id == null || t.grup_id === 0)));
  const turleriOzelGun = organizasyonTurleri.filter((t) => t.grup_id === ozelGunGrupId);
  const turleriOzelSiparis = organizasyonTurleri.filter((t) => t.grup_id === ozelSiparisGrupId);
  const turleriAracSusleme = organizasyonTurleri.filter((t) => t.grup_id === aracSuslemeGrupId);
  const etiketleriOrganizasyon = organizasyonEtiketleri.filter((e) => e.grup_id === organizasyonGrupId || (organizasyonGrupId == null && (e.grup_id == null || e.grup_id === 0)));
  const etiketleriAracSusleme = organizasyonEtiketleri.filter((e) => e.grup_id === aracSuslemeGrupId);
  const etiketleriOzelSiparis = organizasyonEtiketleri.filter((e) => e.grup_id === ozelSiparisGrupId);
  const etiketleriOzelGun = organizasyonEtiketleri.filter((e) => e.grup_id === ozelGunGrupId);

  // Form state - Organizasyon kartı için
  const [orgTur, setOrgTur] = useState<string>('');
  const [altTur, setAltTur] = useState<string>(''); // Diğer kart türleri (Araç Süsleme, Özel Sipariş, Özel Gün) için alt tür
  const [orgEtiket, setOrgEtiket] = useState<string>('');
  const [teslimTarih, setTeslimTarih] = useState<string>('');
  const [teslimSaat, setTeslimSaat] = useState<string>('');
  const [teslimKisisi, setTeslimKisisi] = useState<string>('');
  const teslimKisisiTelefonInput = usePhoneInput('');
  const [acikAdres, setAcikAdres] = useState<string>('');
  const [davetiyeGorsel, setDavetiyeGorsel] = useState<File | null>(null);
  const [davetiyeGorselPreview, setDavetiyeGorselPreview] = useState<string>('');
  const [isDragOverDavetiye, setIsDragOverDavetiye] = useState(false);
  const [teslimatKonumu, setTeslimatKonumu] = useState<string>('');
  const [teslimatKonumuOptions, setTeslimatKonumuOptions] = useState<TeslimatKonumuItem[]>([]);

  // Popup: Yeni alt tür / yeni etiket (YeniKartModal ile aynı)
  const [showTurPopup, setShowTurPopup] = useState(false);
  const [showEtiketPopup, setShowEtiketPopup] = useState(false);
  const [turPopupTab, setTurPopupTab] = useState<string>('organizasyon');
  const [etiketPopupTipi, setEtiketPopupTipi] = useState<string>('organizasyon');
  const [turPopupInput, setTurPopupInput] = useState('');
  const [etiketPopupInput, setEtiketPopupInput] = useState('');
  const [turPopupSaving, setTurPopupSaving] = useState(false);
  const [etiketPopupSaving, setEtiketPopupSaving] = useState(false);
  const turPopupInputRef = useRef<HTMLInputElement>(null);
  const etiketPopupInputRef = useRef<HTMLInputElement>(null);

  // Adres seçimi (backend detayda organizasyon_il, organizasyon_ilce döner)
  const addressSelect = useAddressSelect(
    kartData?.organizasyon_il ?? kartData?.teslim_il,
    kartData?.organizasyon_ilce ?? kartData?.teslim_ilce,
    kartData?.mahalle
  );
  
  // ✅ DÜZELTME: addressSelect.reset() referansını sakla - sonsuz döngüyü önlemek için
  const addressSelectResetRef = React.useRef(addressSelect.reset);
  addressSelectResetRef.current = addressSelect.reset;

  // Kart detayını yükle
  useEffect(() => {
    const loadKartDetay = async () => {
      if (!isOpen || !kart) return;

      // Hemen listedeki kart türüne göre sekmeyi ayarla (detay gelmeden doğru form açılsın)
      const initialTab = getActiveTabFromKartTur(kart.kart_tur || (kart as any).kart_tur_display || '');
      setActiveTab(initialTab);

      try {
        const detay = await getOrganizasyonKartDetay(kart.id);
        if (detay) {
          setKartData(detay);
          const d = detay as any;
          // Backend: kart_turu, alt_tur, kart_etiket, organizasyon_il, organizasyon_ilce, mahalle, adres, organizasyon_sahibi, organizasyon_sahibi_telefon, teslim_tarihi, teslim_saati, kart_gorsel
          const tab = getActiveTabFromKartTur(d.kart_turu || d.kart_tur || '');
          setActiveTab(tab);
          // Organizasyon sekmesi: alt tür = orgTur (Düğün, Nişan vb.)
          setOrgTur(d.alt_tur || d.kart_turu || d.kart_tur || '');
          setOrgEtiket(d.kart_etiket || '');
          setAltTur(d.alt_tur || '');
          const tarihRaw = d.teslim_tarihi || d.teslim_tarih;
          setTeslimTarih(tarihRaw ? new Date(tarihRaw).toISOString().split('T')[0] : '');
          setTeslimSaat(d.teslim_saati || d.teslim_saat || '');
          setTeslimKisisi(d.organizasyon_sahibi || d.teslim_kisisi || '');
          teslimKisisiTelefonInput.setDisplayValue(d.organizasyon_sahibi_telefon || d.teslim_kisisi_telefon || '');
          setAcikAdres(d.adres || d.organizasyon_acik_adres || d.teslim_acik_adres || '');
          // Adres: il/ilçe/mahalle - restore sırasında hook'un temizlemesini atla
          const ilVal = d.organizasyon_il || d.teslim_il || '';
          const ilceVal = d.organizasyon_ilce || d.teslim_ilce || '';
          const mahalleVal = d.mahalle || d.organizasyon_mahalle || d.teslim_mahalle || '';
          addressSelect.setIl(ilVal, { skipClear: true });
          addressSelect.setIlce(ilceVal, { skipClear: true });
          addressSelect.setMahalle(mahalleVal);
          if (d.kart_gorsel) {
            setDavetiyeGorselPreview(getUploadUrl(d.kart_gorsel));
          }
          setTeslimatKonumu(d.organizasyon_teslimat_konumu || d.teslimat_konumu || '');
        } else {
          setError('Kart detayı yüklenemedi');
        }
      } catch (err: any) {
        console.error('Kart detayı yükleme hatası:', err);
        setError('Kart detayı yüklenemedi');
      }
    };

    loadKartDetay();
  }, [isOpen, kart, addressSelect.setIl, addressSelect.setIlce, addressSelect.setMahalle]);

  // İl ve ilçe seçildiğinde teslimat konumlarını yükle (ayarlar_genel_teslimat_konumlari)
  useEffect(() => {
    if (!isOpen || activeTab !== 'organizasyon') return;
    const il = addressSelect.il?.trim();
    const ilce = addressSelect.ilce?.trim();
    if (!il || !ilce) {
      setTeslimatKonumuOptions([]);
      return;
    }
    let cancelled = false;
    getTeslimatKonumlari({ il, ilce })
      .then((list) => {
        if (!cancelled) setTeslimatKonumuOptions(list);
      })
      .catch(() => {
        if (!cancelled) setTeslimatKonumuOptions([]);
      });
    return () => { cancelled = true; };
  }, [isOpen, activeTab, addressSelect.il, addressSelect.ilce]);

  // Teslimat konumu seçiliyken açık adres forma gelsin (konum kaydındaki acik_adres)
  useEffect(() => {
    if (!isOpen || activeTab !== 'organizasyon' || !teslimatKonumu || teslimatKonumuOptions.length === 0) return;
    const konum = teslimatKonumuOptions.find((k) => (k.konum_adi || '') === teslimatKonumu);
    const konumAcikAdres = (konum?.acik_adres ?? (konum as any)?.acik_adres)?.trim?.() ?? '';
    if (!konumAcikAdres) return;
    setAcikAdres((prev) => {
      if (prev.trim()) return prev;
      return konumAcikAdres;
    });
  }, [isOpen, activeTab, teslimatKonumu, teslimatKonumuOptions]);

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

  // Modal kapandığında formu resetle
  useEffect(() => {
    if (!isOpen) {
      setOrgTur('');
      setOrgEtiket('');
      setAltTur('');
      setTeslimTarih('');
      setTeslimSaat('');
      setTeslimKisisi('');
      teslimKisisiTelefonInput.setDisplayValue('');
      setAcikAdres('');
      setTeslimatKonumu('');
      setDavetiyeGorsel(null);
      setDavetiyeGorselPreview('');
      setShowTurPopup(false);
      setShowEtiketPopup(false);
      setTurPopupInput('');
      setEtiketPopupInput('');
      addressSelectResetRef.current();
      setError('');
      setKartData(null);
      setActiveTab('organizasyon');
    }
  }, [isOpen]);

  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const davetiyeInputRef = useRef<HTMLInputElement>(null);
  useModalOpenAnimation(isOpen, overlayRef, panelRef);

  // Davetiye görseli: tıklama veya sürükle-bırak ile tek dosya ("Dosya Seç" butonu yok)
  const applyDavetiyeFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setDavetiyeGorsel(file);
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

  // Sekme tipinden grup id (etiketlerin hangi sekmeye ait olduğu)
  const getGrupIdByEtiketTipi = useCallback((etiketTipi: string): number | null => {
    const tab =
      etiketTipi === 'organizasyon' ? 'organizasyon' :
      etiketTipi === 'aracsusleme' ? 'aracsusleme' :
      etiketTipi === 'ozel-siparis' ? 'ozelsiparis' :
      etiketTipi === 'ozel-gun' ? 'ozelgun' : 'organizasyon';
    return getGrupIdForTab(tab);
  }, [getGrupIdForTab]);

  const getEtiketSekmeAdi = (tip: string) => {
    if (tip === 'organizasyon') return 'ORGANİZASYON';
    if (tip === 'aracsusleme') return 'ARAÇ SÜSLEME';
    if (tip === 'ozel-siparis') return 'ÖZEL SİPARİŞ';
    if (tip === 'ozel-gun') return 'ÖZEL GÜN';
    return 'Organizasyon';
  };

  const openTurPopup = (tab: string = 'organizasyon') => {
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
        else setAltTur(result.data.tur_adi);
      } else {
        showToast('error', 'Tür eklenemedi!');
      }
    } catch (err) {
      console.error('Tür ekleme hatası:', err);
      showToast('error', 'Tür eklenemedi!');
    } finally {
      setTurPopupSaving(false);
    }
  };

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
        setOrgEtiket(result.data.etiket_adi);
      } else {
        showToast('error', 'Etiket eklenemedi!');
      }
    } catch (err) {
      console.error('Etiket ekleme hatası:', err);
      showToast('error', 'Etiket eklenemedi!');
    } finally {
      setEtiketPopupSaving(false);
    }
  };

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
    if (!kart) return;

    setError('');
    setLoading(true);

    try {
      // Organizasyon sekmesi: tüm alanlar zorunlu
      if (isOrganizasyonTab) {
        if (!teslimTarih) {
          setError('Lütfen teslim tarihini seçin!');
          setLoading(false);
          return;
        }
        if (!teslimKisisi.trim()) {
          setError('Lütfen organizasyon sahibi bilgisini girin!');
          setLoading(false);
          return;
        }
        if (!teslimKisisiTelefonInput.cleanValue.trim()) {
          setError('Lütfen organizasyon sahibi telefonunu girin!');
          setLoading(false);
          return;
        }
        if (!orgTur) {
          setError('Lütfen organizasyon türünü seçin!');
          setLoading(false);
          return;
        }
      } else {
        // Araç Süsleme / Özel Sipariş / Özel Gün: sadece tarih ve alt tür zorunlu
        if (!teslimTarih) {
          setError('Lütfen teslim tarihini seçin!');
          setLoading(false);
          return;
        }
        if (!altTur?.trim()) {
          setError('Lütfen alt türü seçin!');
          setLoading(false);
          return;
        }
      }

      const formData: Partial<OrganizasyonKartFormData> = {
        kart_tur: isOrganizasyonTab
          ? 'Organizasyon'
          : activeTab === 'aracsusleme'
            ? 'Araç Süsleme'
            : activeTab === 'ozelsiparis'
              ? 'Özel Sipariş'
              : 'Özel Gün',
        alt_tur: isOrganizasyonTab ? (orgTur || undefined) : (altTur || undefined),
        kart_etiket: orgEtiket || undefined,
        teslim_tarih: teslimTarih,
        teslim_saat: teslimSaat || undefined,
        teslim_kisisi: isOrganizasyonTab ? teslimKisisi : undefined,
        teslim_kisisi_telefon: isOrganizasyonTab ? teslimKisisiTelefonInput.cleanValue : undefined,
        il: addressSelect.il || undefined,
        ilce: addressSelect.ilce || undefined,
        mahalle: addressSelect.mahalle || undefined,
        acik_adres: isOrganizasyonTab ? acikAdres : undefined,
        teslimat_konumu: isOrganizasyonTab ? (teslimatKonumu || undefined) : undefined,
        davetiye_gorsel: isOrganizasyonTab ? davetiyeGorsel : undefined,
        davetiye_kaldir: isOrganizasyonTab && !!(
          (kartData?.organizasyon_davetiye_gorsel || kartData?.kart_gorsel) &&
          !davetiyeGorsel &&
          !davetiyeGorselPreview
        ) ? true : undefined,
      };

      const result = await updateOrganizasyonKart(kart.id, formData);

      if (result?.success) {
        showToast('success', 'Kart başarıyla güncellendi!');
        invalidateOrganizasyonKartQueries(queryClient, kart.id);
        onSuccess?.();
        onClose();
      } else {
        setError(result?.message || 'Kart güncellenemedi!');
      }
    } catch (err: any) {
      console.error('Kart güncelleme hatası:', err);
      const errorMessage = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Kart güncellenemedi!';
      setError(errorMessage);
      showToast('error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !kart) return null;

  const kartTur = kart.kart_tur || 'organizasyon';
  const isOrganizasyonTab = activeTab === 'organizasyon';

  return createPortal(
    <>
      <div
        ref={overlayRef}
        className={`overlay-yeni-kart-container ${isOpen ? 'show' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
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
          <div className="modal-yeni-kart-header-baslik">Kartı Düzenle</div>
          <button className="btn-close-modal" onClick={onClose} type="button">
            <i className="icon-btn-kapat"></i>
          </button>
        </div>
        <div className="tab-kapsayici">
          <div className="tab">
            {/* Sadece ilgili sekme görünsün; form içeriği Yeni Kart ile aynı */}
            {isOrganizasyonTab && (
              <button className="tablinks active" type="button" disabled>
                Organizasyon
                <div className="aciklamasatir">Mevcut organizasyon kartınızı düzenleyin.</div>
              </button>
            )}
            {activeTab === 'aracsusleme' && (
              <button className="tablinks active" type="button" disabled>
                Araç Süsleme
                <div className="aciklamasatir">Mevcut araç süsleme kartınızı düzenleyin.</div>
              </button>
            )}
            {activeTab === 'ozelsiparis' && (
              <button className="tablinks active" type="button" disabled>
                Özel Sipariş
                <div className="aciklamasatir">Mevcut özel sipariş kartınızı düzenleyin.</div>
              </button>
            )}
            {activeTab === 'ozelgun' && (
              <button className="tablinks active" type="button" disabled>
                Özel Gün
                <div className="aciklamasatir">Mevcut özel gün kartınızı düzenleyin.</div>
              </button>
            )}
          </div>
          <div className="tab-content-alan">
            <form onSubmit={handleSubmit}>
              {/* Organizasyon Kartı Form */}
              {isOrganizasyonTab && (
                <div id="organizasyon-kart" className="tabcontent" style={{ display: 'block' }}>
                  <div className="input-alan-container">
                    <div className="input-alan">
                      <div className="kart-baslik">Organizasyon Kartı Düzenle</div>
                      
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
                                onChange={(e) => setOrgTur(e.target.value)}
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
                              Seçilen dosya: {davetiyeGorsel?.name ?? (davetiyeGorselPreview ? 'Mevcut görsel' : '')}
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
                                // Teslimat konumu yok seçildi – mahalle ve açık adresi temizle
                                addressSelect.setMahalle('');
                                setAcikAdres('');
                              }
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
                              onChange={(e) => addressSelect.setIl(e.target.value)}
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
                              onChange={(e) => addressSelect.setIlce(e.target.value)}
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
                            onChange={(e) => addressSelect.setMahalle(e.target.value)}
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
                            onChange={(e) => setAcikAdres(e.target.value)}
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
                                onChange={(e) => setTeslimTarih(e.target.value)}
                                required
                              />
                            </div>
                            <div className="siparis-saat">
                              <input
                                type="time"
                                value={teslimSaat}
                                onChange={(e) => setTeslimSaat(e.target.value)}
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
                              onChange={(e) => setTeslimKisisi(e.target.value)}
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
                              onChange={teslimKisisiTelefonInput.handleChange}
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
                                onChange={(e) => setOrgEtiket(e.target.value)}
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
                      <button type="button" className="secondary-button btn-vazgec" onClick={onClose}>
                        VAZGEÇ
                      </button>
                      <button type="submit" className="primary-button btn-guncelle" disabled={loading}>
                        {loading ? <LoadingSpinner size="sm" /> : 'GÜNCELLE'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Araç Süsleme Kartı Düzenle - YeniKart ile aynı görünüm */}
              {activeTab === 'aracsusleme' && (
                <div id="aracsusleme-kart" className="tabcontent" style={{ display: 'block' }}>
                  <div className="input-alan-container">
                    <div className="input-alan">
                      <div className="kart-baslik">Araç Süsleme Kartı Düzenle</div>
                      <div className="input-form">
                        <div className="modal-yeni-kart-form-baslik">
                          <Layers size={18} strokeWidth={1.5} aria-hidden /> Araç Süsleme Alt Türü
                        </div>
                        <div className="label-kapsayici-org-tipler">
                          {turleriAracSusleme.map((tur: { id: number; tur_adi: string }) => (
                            <label key={tur.id} className="radio-label">
                              <input
                                type="radio"
                                name="aracsusleme-alt-tur"
                                value={tur.tur_adi}
                                checked={altTur === tur.tur_adi}
                                onChange={(e) => setAltTur(e.target.value)}
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
                                  value={teslimTarih}
                                  onChange={(e) => setTeslimTarih(e.target.value)}
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
                          {etiketleriAracSusleme.map((etiket: { id: number; etiket_adi: string }) => (
                            <label key={etiket.id} className="radio-label">
                              <input
                                type="radio"
                                name="aracsusleme-etiketler"
                                value={etiket.etiket_adi}
                                checked={orgEtiket === etiket.etiket_adi}
                                onChange={(e) => setOrgEtiket(e.target.value)}
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
                      <button type="button" className="secondary-button btn-vazgec" onClick={onClose}>
                        VAZGEÇ
                      </button>
                      <button type="submit" className="primary-button btn-guncelle" disabled={loading}>
                        {loading ? <LoadingSpinner size="sm" /> : 'GÜNCELLE'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Özel Sipariş Kartı Düzenle - YeniKart ile aynı görünüm */}
              {activeTab === 'ozelsiparis' && (
                <div id="ozelsiparis-kart" className="tabcontent" style={{ display: 'block' }}>
                  <div className="input-alan-container">
                    <div className="input-alan">
                      <div className="kart-baslik">Özel Sipariş Kartı Düzenle</div>
                      <div className="input-form">
                        <div className="modal-yeni-kart-form-baslik">
                          <Layers size={18} strokeWidth={1.5} aria-hidden /> Özel Sipariş Alt Türü
                        </div>
                        <div className="label-kapsayici-org-tipler">
                          {turleriOzelSiparis.map((tur: { id: number; tur_adi: string }) => (
                            <label key={tur.id} className="radio-label">
                              <input
                                type="radio"
                                name="ozelsiparis-alt-tur"
                                value={tur.tur_adi}
                                checked={altTur === tur.tur_adi}
                                onChange={(e) => setAltTur(e.target.value)}
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
                                  value={teslimTarih}
                                  onChange={(e) => setTeslimTarih(e.target.value)}
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
                          {etiketleriOzelSiparis.map((etiket: { id: number; etiket_adi: string }) => (
                            <label key={etiket.id} className="radio-label">
                              <input
                                type="radio"
                                name="ozelsiparis-etiketler"
                                value={etiket.etiket_adi}
                                checked={orgEtiket === etiket.etiket_adi}
                                onChange={(e) => setOrgEtiket(e.target.value)}
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
                      <button type="button" className="secondary-button btn-vazgec" onClick={onClose}>
                        VAZGEÇ
                      </button>
                      <button type="submit" className="primary-button btn-guncelle" disabled={loading}>
                        {loading ? <LoadingSpinner size="sm" /> : 'GÜNCELLE'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Özel Gün Kartı Düzenle - YeniKart ile aynı görünüm */}
              {activeTab === 'ozelgun' && (
                <div id="ozelgun-kart" className="tabcontent" style={{ display: 'block' }}>
                  <div className="input-alan-container">
                    <div className="input-alan">
                      <div className="kart-baslik">Özel Gün Kartı Düzenle</div>
                      <div className="input-form">
                        <div className="modal-yeni-kart-form-baslik">
                          <Layers size={18} strokeWidth={1.5} aria-hidden /> Özel Gün Alt Türü
                        </div>
                        <div className="label-kapsayici-org-tipler">
                          {turleriOzelGun.map((tur: { id: number; tur_adi: string }) => (
                            <label key={tur.id} className="radio-label">
                              <input
                                type="radio"
                                name="ozelgun-alt-tur"
                                value={tur.tur_adi}
                                checked={altTur === tur.tur_adi}
                                onChange={(e) => setAltTur(e.target.value)}
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
                                  value={teslimTarih}
                                  onChange={(e) => setTeslimTarih(e.target.value)}
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
                          {etiketleriOzelGun.map((etiket: { id: number; etiket_adi: string }) => (
                            <label key={etiket.id} className="radio-label">
                              <input
                                type="radio"
                                name="ozelgun-etiketler"
                                value={etiket.etiket_adi}
                                checked={orgEtiket === etiket.etiket_adi}
                                onChange={(e) => setOrgEtiket(e.target.value)}
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
                      <button type="button" className="secondary-button btn-vazgec" onClick={onClose}>
                        VAZGEÇ
                      </button>
                      <button type="submit" className="primary-button btn-guncelle" disabled={loading}>
                        {loading ? <LoadingSpinner size="sm" /> : 'GÜNCELLE'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

                {error && (
                  <div style={{ color: 'red', padding: '10px', marginTop: '10px' }}>
                    {error}
                  </div>
                )}
            </form>
          </div>
        </div>
        </div>
      </div>
    </div>

      {showTurPopup && (
        <div
          className="yeni-etiket-popup-overlay active"
          onClick={(e) => e.target === e.currentTarget && closeTurPopup()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-tur-popup-title"
        >
          <div className="etiket-popup" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3 id="edit-tur-popup-title" className="popup-title">Yeni Organizasyon Türü Ekle</h3>
              <button type="button" className="btn-close-form" onClick={closeTurPopup} aria-label="Kapat">
                <i className="icon-btn-kapat" />
              </button>
            </div>
            <div className="popup-info">Bu tür, ilgili kart formunda seçenek olarak görünecektir.</div>
            <form className="popup-form" onSubmit={handleTurPopupSubmit}>
              <div className="popup-input-group">
                <label className="popup-label" htmlFor="edit-tur-popup-input">Tür adı</label>
                <input
                  ref={turPopupInputRef}
                  id="edit-tur-popup-input"
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
                <button type="button" className="secondary-button btn-vazgec" onClick={closeTurPopup}>VAZGEÇ</button>
                <button type="submit" className="primary-button btn-kaydet" disabled={turPopupSaving}>
                  {turPopupSaving ? <LoadingSpinner size="sm" /> : 'KAYDET'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEtiketPopup && (
        <div
          className="yeni-etiket-popup-overlay active"
          onClick={(e) => e.target === e.currentTarget && closeEtiketPopup()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-etiket-popup-title"
        >
          <div className="etiket-popup" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3 id="edit-etiket-popup-title" className="popup-title">Yeni Etiket Ekle</h3>
              <button type="button" className="btn-close-form" onClick={closeEtiketPopup} aria-label="Kapat">
                <i className="icon-btn-kapat" />
              </button>
            </div>
            <div className="popup-info">Bu etiket <strong>{getEtiketSekmeAdi(etiketPopupTipi)}</strong> sekmesine eklenecektir.</div>
            <form className="popup-form" onSubmit={handleEtiketPopupSubmit}>
              <div className="popup-input-group">
                <label className="popup-label" htmlFor="edit-etiket-popup-input">Etiket adı</label>
                <input
                  ref={etiketPopupInputRef}
                  id="edit-etiket-popup-input"
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
                <button type="button" className="secondary-button btn-vazgec" onClick={closeEtiketPopup}>VAZGEÇ</button>
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
