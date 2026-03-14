import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import type { Order, KartTur } from '../types';
import { getApiBaseUrl } from '../../../lib/runtime';
import { apiClient } from '../../../lib/api';
import { formatPhoneNumber, formatTL, fixUploadUrl, appendIlceIlToAddress } from '../../../shared/utils/formatUtils';
import { getUrunAdiFromId, createUrunYazisiHTML } from '../../../shared/utils/productUtils';
import { createDuzenleyenHTML } from '../../../shared/utils/userUtils';
import { formatDuzenleyenTarih } from '../../../shared/utils/dateUtils';
import { useDeliveryTimeWarning } from '../hooks/useDeliveryTimeWarning';
import { FileText, Download, Pencil, Archive, SquareCheck, X, Plug } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  organizasyonKartTur?: KartTur;
  onAction?: (action: string, order: Order) => void;
  baglantiliSiparisSayisi?: number; // Bu müşterinin kaç farklı organizasyonda siparişi var
  onContextMenu?: (event: React.MouseEvent, order: Order) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, organizasyonKartTur, onAction, baglantiliSiparisSayisi }) => {
  const { user: currentUser } = useAuth();
  
  // Raw sipariş verisi (backend'den gelen ham veri)
  const rawSiparis = (order as any)._raw || order;
  
  // Telefon formatı - Legacy parity
  const telefonFormatted = useMemo(() => {
    const telefon = rawSiparis?.siparis_veren_telefon || rawSiparis?.customer_phone || order.telefon;
    if (!telefon) return null;
    return formatPhoneNumber(telefon);
  }, [rawSiparis, order.telefon]);

  // Telefon href - Legacy parity
  const telefonHref = useMemo(() => {
    const telefon = rawSiparis?.siparis_veren_telefon || rawSiparis?.customer_phone || order.telefon;
    if (!telefon) return '#';
    const digits = telefon.replace(/\D/g, '');
    if (digits.length >= 10) {
      const normalized = digits.length === 10 ? '90' + digits : digits;
      return `tel:+${normalized}`;
    }
    return `tel:${telefon}`;
  }, [rawSiparis, order.telefon]);

  // Müşteri adı (sipariş veren) – önce map'lenmiş order.musteriAdi, sonra _raw'taki tüm olası alanlar
  const musteriAdi = useMemo(() => {
    const fromOrder = order.musteriAdi?.trim();
    if (fromOrder) return fromOrder;
    const r = rawSiparis || {};
    const fallback = r.musteri_unvan || r.musteri_isim_soyisim || r.siparis_veren || (r as any).customer_name || (r as any).musteri_unvani || (r as any).musteri_ad_soyad || (r as any).musteri_adi || 'Müşteri Adı Yok';
    return fallback;
  }, [rawSiparis, order.musteriAdi]);

  // Müşteri ID - Legacy parity
  const musteriId = rawSiparis?.musteri_id || rawSiparis?.customer_id;

  // Araç bilgileri - Legacy parity (sadece araç süsleme kartları için)
  const isAracSusleme = organizasyonKartTur === 'aracsusleme';
  const isOzelGun = organizasyonKartTur === 'ozelgun';
  const isOzelSiparis = organizasyonKartTur === 'ozelsiparis';
  const isCiceksepeti = organizasyonKartTur === 'ciceksepeti';
  const aracMarkaModel = rawSiparis?.arac_markamodel || order.aracMarkaModel;
  const aracRenk = rawSiparis?.arac_renk || order.aracRenk;
  const aracPlaka = rawSiparis?.arac_plaka || order.aracPlaka;
  const aracRandevuSaat = rawSiparis?.arac_randevu_saat || order.aracRandevuSaat;
  
  // Teslim saati - Tüm kart türleri için (organizasyon kartından veya siparişten)
  const teslimSaat = useMemo(() => {
    // Önce sipariş kartından al, yoksa organizasyon kartından al
    return rawSiparis?.teslim_saat || 
           rawSiparis?.organizasyon_teslim_saat || 
           order.teslimSaati || 
           null;
  }, [rawSiparis, order.teslimSaati]);

  // Teslim tarihi - Saat uyarıları için (sadece bugünün siparişleri için uyarı gösterilecek)
  const teslimTarih = useMemo(() => {
    // Önce sipariş kartından al, yoksa organizasyon kartından al
    return rawSiparis?.teslim_tarih || 
           rawSiparis?.organizasyon_teslim_tarih || 
           (order as any).teslim_tarih || 
           null;
  }, [rawSiparis, order]);

  // Teslim edilecek kişi / organizasyon sahibi – SADECE teslim_kisisi (organizasyon_teslim_kisisi). siparis_teslim_kisisi_baskasi SADECE WhatsApp mesajlarında kullanılır, burada asla gösterilmez.
  const teslimKisisi = useMemo(() => {
    return rawSiparis?.organizasyon_teslim_kisisi || rawSiparis?.teslim_kisisi || order.teslimKisisi || 'Teslim Kişisi Belirtilmemiş';
  }, [rawSiparis, order.teslimKisisi]);

  const teslimKisisiTelefonRaw = useMemo(() => {
    if (isOzelGun || isOzelSiparis || isCiceksepeti) {
      return rawSiparis?.teslim_kisisi_telefon || rawSiparis?.organizasyon_teslim_kisisi_telefon || order.teslimKisisiTelefon || '';
    }
    return rawSiparis?.organizasyon_teslim_kisisi_telefon || rawSiparis?.teslim_kisisi_telefon || order.teslimKisisiTelefon || '';
  }, [rawSiparis, order.teslimKisisiTelefon, isOzelGun, isOzelSiparis, isCiceksepeti]);

  const teslimKisisiTelefonFormatted = useMemo(() => {
    if (!teslimKisisiTelefonRaw || teslimKisisiTelefonRaw === 'Telefon Belirtilmemiş') {
      return 'Telefon Belirtilmemiş';
    }
    return formatPhoneNumber(teslimKisisiTelefonRaw);
  }, [teslimKisisiTelefonRaw]);

  const teslimKisisiTelefonHref = useMemo(() => {
    if (!teslimKisisiTelefonRaw) return '#';
    const digits = teslimKisisiTelefonRaw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('90')) {
      return `tel:+${digits}`;
    }
    if (digits.length >= 10) {
      const normalized = digits.length === 10 
        ? '90' + digits 
        : (digits.length === 11 && digits.startsWith('0') 
          ? '90' + digits.substring(1) 
          : '90' + digits.substring(digits.length - 10));
      return `tel:+${normalized}`;
    }
    return '#';
  }, [teslimKisisiTelefonRaw]);

  // Ürün adı - React utility kullan
  const urunAdi = useMemo(() => {
    const urunId = rawSiparis?.siparis_urun_id || rawSiparis?.urun_id || rawSiparis?.product_id;
    // urunVerileri artık useUrunVerileri hook'u ile yönetiliyor
    // Geçici olarak window'dan al (hook entegrasyonu sonrası kaldırılacak)
    const urunVerileri = (window as any).urunVerileri;
    if (urunId) {
      return getUrunAdiFromId(
        urunId,
        rawSiparis?.siparis_urun || rawSiparis?.product_name || order.urun || 'Ürün Adı Yok',
        urunVerileri
      );
    }
    return rawSiparis?.siparis_urun || rawSiparis?.product_name || order.urun || 'Ürün Adı Yok';
  }, [rawSiparis, order.urun]);

  const urunAdiKisa = urunAdi.length > 17 ? `${urunAdi.substring(0, 17)}...` : urunAdi;

  // Açık adres - ilçe/il bilgisi ile birlikte (sipariş kartlarında gösterilmek üzere)
  const acikAdresWithIlceIl = useMemo(() => {
    const acikAdres = rawSiparis?.acik_adres || rawSiparis?.teslim_acik_adres || order.acikAdres;
    const ilce = rawSiparis?.organizasyon_ilce || rawSiparis?.teslim_ilce || rawSiparis?.ilce;
    const il = rawSiparis?.organizasyon_il || rawSiparis?.teslim_il || rawSiparis?.il;
    return appendIlceIlToAddress(acikAdres, ilce, il);
  }, [rawSiparis, order.acikAdres]);

  // Ürün görseli - Legacy parity: Önce urunVerileri'den ürün ID'si ile al, yoksa order'dan al
  const [urunGorsel, setUrunGorsel] = useState<string | undefined>(undefined);
  
  useEffect(() => {
    const updateUrunGorsel = () => {
      // Çiçek Sepeti siparişlerinde ürün görseli sabit: assets/cicek-sepeti/sp-urun-ciceksepeti.png
      if (organizasyonKartTur === 'ciceksepeti') {
        setUrunGorsel('/assets/cicek-sepeti/sp-urun-ciceksepeti.png');
        return;
      }
      // Önce ürün ID'si ile urunVerileri'den görsel al
      const urunId = rawSiparis?.siparis_urun_id || rawSiparis?.urun_id || rawSiparis?.product_id || order.urunId;
      // urunVerileri artık useUrunVerileri hook'u ile yönetiliyor
      // Geçici olarak window'dan al (hook entegrasyonu sonrası kaldırılacak)
      if (urunId && typeof (window as any).urunVerileri !== 'undefined') {
        const urunVerileri = (window as any).urunVerileri;
        let gorselFromUrunVerileri: string | undefined = undefined;
        
        // urunVerileri obje olabilir veya array olabilir
        if (typeof urunVerileri === 'object' && !Array.isArray(urunVerileri) && urunVerileri[urunId]?.gorsel) {
          gorselFromUrunVerileri = urunVerileri[urunId].gorsel;
        } else if (Array.isArray(urunVerileri)) {
          const urun = urunVerileri.find((u: any) => u && u.id == urunId);
          if (urun?.gorsel) {
            gorselFromUrunVerileri = urun.gorsel;
          }
        }
        
        // Eğer urunVerileri'den görsel bulunduysa, görsel yolunu düzelt
        if (gorselFromUrunVerileri) {
          const apiBaseUrl = getApiBaseUrl();
          const backendBase = apiBaseUrl.replace('/api', '');
          setUrunGorsel(fixUploadUrl(gorselFromUrunVerileri, backendBase));
          return;
        }
      }
      
      // urunVerileri'den bulunamadıysa, order'dan direkt görsel al
      const gorsel = rawSiparis?.urun_gorsel || rawSiparis?.product_gorsel || rawSiparis?.product_image || order.urunGorsel;
      if (!gorsel) {
        setUrunGorsel(undefined);
        return;
      }
      
      // React utility kullan
      const apiBaseUrl = getApiBaseUrl();
      const backendBase = apiBaseUrl.replace('/api', '');
      setUrunGorsel(fixUploadUrl(gorsel, backendBase));
      
      // Eğer zaten full URL ise, olduğu gibi kullan
      if (gorsel.startsWith('http') || gorsel.startsWith('data:')) {
        setUrunGorsel(gorsel);
        return;
      }
      
      // Eğer path zaten /uploads/tenants/ veya uploads/tenants/ içeriyorsa, tekrar path ekleme - sadece backend base ekle
      if (gorsel.includes('uploads/tenants/')) {
        // Eğer / ile başlıyorsa direkt ekle, yoksa / ekle
        const normalizedPath = gorsel.startsWith('/') ? gorsel : '/' + gorsel;
        setUrunGorsel(`${backendBase}${normalizedPath}`);
        return;
      }
      
      // Eğer path zaten /uploads ile başlıyorsa, direkt backend base'e ekle
      if (gorsel.startsWith('/uploads/')) {
        setUrunGorsel(`${backendBase}${gorsel}`);
        return;
      }
      
      // Eğer / ile başlıyorsa backend base'e ekle
      if (gorsel.startsWith('/')) {
        setUrunGorsel(`${backendBase}${gorsel}`);
        return;
      }
      
      // Tenant ID'yi al (localStorage'dan)
      const userStr = localStorage.getItem('floovon_user') || localStorage.getItem('user');
      let tenantId = '1'; // Default tenant ID
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          tenantId = user?.tenant_id || '1';
        } catch (e) {
          // Fallback
        }
      }
      
      // Sadece dosya adı ise tenant-based path oluştur
      setUrunGorsel(`${backendBase}/uploads/tenants/${tenantId}/products/${gorsel}`);
    };
    
    updateUrunGorsel();
    
    // urunVerileri yüklendiğinde güncelle
    const handleUrunVerileriYuklendi = () => {
      updateUrunGorsel();
    };
    
    window.addEventListener('urunVerileriYuklendi', handleUrunVerileriYuklendi);
    
    return () => {
      window.removeEventListener('urunVerileriYuklendi', handleUrunVerileriYuklendi);
    };
  }, [rawSiparis, order.urunGorsel, organizasyonKartTur]);

  // Ürün yazısı HTML - Legacy parity
  const urunYazisiHTML = useMemo(() => {
    const html = createUrunYazisiHTML(order);
    if (html && html.trim()) {
      return html;
    }
    // Fallback: Eğer createUrunYazisiHTML boş döndürürse, urun_yazisi alanını göster
    const urunYazisi = rawSiparis?.urun_yazisi || rawSiparis?.siparis_veren || rawSiparis?.customer_name || rawSiparis?.musteri_unvan || order.urunYazisi || '';
    if (urunYazisi) {
      return `<div class="urun-yazisi copy-text" data-tooltip="${urunYazisi.replace(/"/g, '&quot;')}"><i class="icon-urun-yazisi"></i>${urunYazisi}</div>`;
    }
    return null;
  }, [rawSiparis, order]);

  // Ürün yazısı mevcut butonu görünürlüğü kontrolü
  const [urunYazisiMevcutVisible, setUrunYazisiMevcutVisible] = useState(false);
  const [urunYazisiPopupOpen, setUrunYazisiPopupOpen] = useState(false);
  const [musteriDosyaListesi, setMusteriDosyaListesi] = useState<Array<{ name: string; url?: string; path?: string }>>([]);
  const [musteriDosyaListesiLoading, setMusteriDosyaListesiLoading] = useState(false);
  const secilenDosyaPath = order.secilenUrunYaziDosyasi || rawSiparis?.secilen_urun_yazi_dosyasi;
  const secilenDosyaAdi = secilenDosyaPath ? (() => {
    const parts = String(secilenDosyaPath).replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || secilenDosyaPath;
  })() : '';
  
  // Dosyayı gerçekten indirir (fetch + blob – sekmede açılmaz)
  const triggerDownload = async (downloadUrl: string, fileName: string) => {
    try {
      const res = await fetch(downloadUrl, { credentials: 'include', mode: 'cors' });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'dosya';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fetch başarısızsa (CORS vb.) eski yöntemle dene
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName || 'dosya';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Seçili dosyayı indir: müşteri dosya listesinden URL alıp indir
  const handleSeciliDosyaIndir = async () => {
    if (!musteriId || !secilenDosyaAdi) return;
    try {
      const res = await apiClient.get<{ success?: boolean; data?: Array<{ name: string; url?: string; path?: string }> }>(`/customers/${musteriId}/urun-yazi-dosyalari`);
      const data = res.data;
      const files = (data && (data as any).success && Array.isArray((data as any).data)) ? (data as any).data : Array.isArray(data) ? data : [];
      const file = files.find((f: any) => {
        const fName = f.name || f.fileName;
        const fPath = f.path || f.url;
        return fName === secilenDosyaAdi || fPath === secilenDosyaPath || (fPath && String(fPath).endsWith(secilenDosyaAdi));
      });
      if (file && (file.path || file.url)) {
        const baseUrl = getApiBaseUrl().replace(/\/api\/?$/, '') || getApiBaseUrl().split('/api')[0];
        const downloadUrl = `${baseUrl}${(file.path || file.url).startsWith('/') ? '' : '/'}${file.path || file.url}`;
        await triggerDownload(downloadUrl, file.name || secilenDosyaAdi);
      }
    } catch (_) {}
  };

  // Popup listesindeki "İndir" tıklanınca indir (sekmede açma)
  const handlePopupIndir = (e: React.MouseEvent, downloadUrl: string, fileName: string) => {
    e.preventDefault();
    e.stopPropagation();
    triggerDownload(downloadUrl, fileName);
  };
  
  useEffect(() => {
    if (!musteriId) {
      setUrunYazisiMevcutVisible(false);
      return;
    }

    // Müşteri ürün yazısı dosyaları – yalnızca tenant-app API (eski sistem global'ı yok)
    const checkFiles = async () => {
      try {
        const response = await apiClient.get<{ success: boolean; data?: unknown[] }>(`/customers/${musteriId}/urun-yazi-dosyalari`);
        if (response.data?.success && Array.isArray(response.data.data)) {
          setUrunYazisiMevcutVisible(response.data.data.length > 0);
        } else {
          setUrunYazisiMevcutVisible(false);
        }
      } catch {
        setUrunYazisiMevcutVisible(false);
      }
    };

    checkFiles();
  }, [musteriId]);

  // Popup açıldığında müşteri dosya listesini yükle
  useEffect(() => {
    if (!urunYazisiPopupOpen || !musteriId) {
      setMusteriDosyaListesi([]);
      return;
    }
    let cancelled = false;
    setMusteriDosyaListesiLoading(true);
    apiClient.get<{ success?: boolean; data?: Array<{ name: string; url?: string; path?: string }> }>(`/customers/${musteriId}/urun-yazi-dosyalari`)
      .then((res) => {
        if (cancelled) return;
        const data = res.data;
        const files = (data && (data as any).success && Array.isArray((data as any).data)) ? (data as any).data : Array.isArray(data) ? data : [];
        setMusteriDosyaListesi(files.map((f: any) => ({ name: f.name || f.fileName, url: f.url, path: f.path })));
      })
      .catch(() => { if (!cancelled) setMusteriDosyaListesi([]); })
      .finally(() => { if (!cancelled) setMusteriDosyaListesiLoading(false); });
    return () => { cancelled = true; };
  }, [urunYazisiPopupOpen, musteriId]);

  // Fiyat bilgisi - Legacy parity
  // Eski mantık: toplam_tutar = urun_fiyat (siparis_tutari) + ekstra_ucret
  const siparisTutari = useMemo(() => {
    // Önce rawSiparis'ten al, yoksa order'dan al
    const siparisTutariRaw = parseFloat(String(rawSiparis?.siparis_tutari || order.tutar || 0));
    const ekstraUcretRaw = parseFloat(String(rawSiparis?.ekstra_ucret || order.ekstraUcret || 0));
    const toplamTutarRaw = parseFloat(String(rawSiparis?.toplam_tutar || order.toplamTutar || 0));
    
    // Eğer toplam_tutar backend'den gelmemişse, hesapla: urun_fiyat + ekstra_ucret
    let gosterilecekTutar = toplamTutarRaw;
    if (toplamTutarRaw === 0 || isNaN(toplamTutarRaw)) {
      // Backend'den toplam_tutar gelmemişse, manuel hesapla
      gosterilecekTutar = siparisTutariRaw + ekstraUcretRaw;
    }
    
    // Eğer hala 0 ise ve siparis_tutari varsa, onu kullan
    if (gosterilecekTutar === 0 && siparisTutariRaw > 0) {
      gosterilecekTutar = siparisTutariRaw;
    }
    
    // Eğer ekstra ücret varsa veya toplam_tutar siparis_tutari'den büyükse, "+" ikonu göster
    const plusIcon = (ekstraUcretRaw > 0 || toplamTutarRaw > siparisTutariRaw) ? <i className="uil uil-plus"></i> : null;
    
    return (
      <>
        {plusIcon}
        {formatTL(gosterilecekTutar)}
      </>
    );
  }, [rawSiparis, order.tutar, order.ekstraUcret, order.toplamTutar]);

  // Ödeme yöntemi – veritabanındaki değere göre etiket (form select ile uyumlu: nakit, pos, cari, havale-eft)
  const odemeYontemi = useMemo(() => {
    const raw = (rawSiparis?.odeme_yontemi ?? order?.odemeYontemi ?? '').toString().toLowerCase().trim();
    if (raw === 'odendi' || raw === 'pos' || raw.includes('pos') || raw.includes('kredi') || raw.includes('kart')) return 'POS';
    if (raw === 'cari' || raw.includes('cari') || raw.includes('hesap')) return 'CARİ HESAP';
    if (raw === 'havale-eft' || raw.includes('havale') || raw.includes('eft')) return 'HAVALE/EFT';
    if (raw === 'nakit' || raw.includes('nakit')) return 'NAKİT';
    if (!raw) return 'NAKİT';
    return raw.toUpperCase();
  }, [rawSiparis?.odeme_yontemi, order?.odemeYontemi]);

  // ✅ REACT: getUserProfileImageUrl kaldırıldı - createDuzenleyenHTML içinde yapılıyor

  // Düzenleyen HTML - işlemi yapan kullanıcının profil resmi (backend'den); yoksa oturum sahibi
  const duzenleyenHTML = useMemo(() => {
    const updatedAt = rawSiparis?.updated_at || rawSiparis?.updatedAt || order.updatedAt;
    const editorUser = order.updatedByUser ?? (rawSiparis?.updated_by_profil_resmi != null || rawSiparis?.updated_by_name != null || rawSiparis?.updated_by_ad_soyad != null
      ? { profil_resmi: rawSiparis?.updated_by_profil_resmi, profile_image: rawSiparis?.updated_by_profil_resmi, name: rawSiparis?.updated_by_name, ad: rawSiparis?.updated_by_name, surname: rawSiparis?.updated_by_soyad, soyad: rawSiparis?.updated_by_soyad, adSoyad: rawSiparis?.updated_by_ad_soyad || [rawSiparis?.updated_by_name, rawSiparis?.updated_by_soyad].filter(Boolean).join(' ').trim() }
      : null);
    return createDuzenleyenHTML(updatedAt, editorUser ?? currentUser);
  }, [rawSiparis?.updated_at, rawSiparis?.updatedAt, rawSiparis?.updated_by_profil_resmi, rawSiparis?.updated_by_name, rawSiparis?.updated_by_soyad, rawSiparis?.updated_by_ad_soyad, order.updatedAt, order.updatedByUser, currentUser]);

  // Düzenleyen tarih: "13 Mart, 23:35" (backend updated_at – SQLite datetime yerel saat olarak parse)
  const duzenleyenApiTarih = useMemo(() => {
    const updatedAt = rawSiparis?.updated_at || rawSiparis?.updatedAt || order.updatedAt;
    const formatted = formatDuzenleyenTarih(updatedAt);
    return formatted === '—' ? 'Dzn: —' : `Dzn: ${formatted}`;
  }, [rawSiparis?.updated_at, rawSiparis?.updatedAt, order.updatedAt]);

  return (
    <div 
      className="siparis-kart"
      data-order-id={order.id}
      data-urun-id={rawSiparis?.siparis_urun_id || rawSiparis?.urun_id || rawSiparis?.product_id || undefined}
    >
      {/* Kart sıra + bağlantılı siparişler – üst sağ blok (her zaman görünsün; değer yoksa id veya —) */}
      <div className="kart-ust-sag">
      <span className="kart-sira">
        #{Math.max(1, Number(rawSiparis?.kart_sira ?? order.kartSira) || 1)}
      </span>
        <div 
          className={baglantiliSiparisSayisi && baglantiliSiparisSayisi > 1 ? 'baglantili-siparisler' : 'baglantili-siparisler-yok'}
          data-tooltip={
            baglantiliSiparisSayisi && baglantiliSiparisSayisi > 1
              ? `Bu müşterinin ${baglantiliSiparisSayisi} farklı organizasyon kartında siparişi var`
              : baglantiliSiparisSayisi === 0
              ? 'İlişkili sipariş yok'
              : 'Bu müşterinin sadece bu organizasyonda siparişi var (bağlantılı sipariş yok)'
          }
          data-tooltip-pos="top"
        >
          <i className="icon-baglantili-siparisler"></i>
          <span>{baglantiliSiparisSayisi !== undefined ? (baglantiliSiparisSayisi > 1 ? baglantiliSiparisSayisi : 0) : ''}</span>
        </div>
      </div>

      {/* Partner Bilgi - Eğer partner_firma_adi varsa göster */}
      {(rawSiparis?.partner_firma_adi || order.partnerFirmaAdi) && 
       (rawSiparis?.partner_firma_adi?.trim() || order.partnerFirmaAdi?.trim()) && (
        <div
          className={`partner-bilgi partner-siparis ${
          (rawSiparis?.partner_siparis_turu || order.partnerSiparisTuru) === 'verilen' 
            ? 'partner-verilen-siparisi' 
            : 'partner-alinan-siparisi'
          }`}
        >
          <i className="icon-partner-siparis"></i>
          <div className="partner-firma">
            <span className="partner-tur">
              {(rawSiparis?.partner_siparis_turu || order.partnerSiparisTuru) === 'verilen' 
                ? 'Partnere Verilen' 
                : 'Partnerden Gelen'}
            </span>
            {rawSiparis?.partner_firma_adi || order.partnerFirmaAdi}
          </div>
        </div>
      )}

      {/* Başlık - Araç süsleme için "Organizasyon veya Araç Sahibi", diğerleri için "Sipariş Veren" */}
      <div className="baslik">{isAracSusleme ? 'Organizasyon veya Araç Sahibi' : 'Sipariş Veren'}</div>
      <div className="siparis-veren">
        {musteriAdi}
        <i className="icon-siparis-tasi"></i>
      </div>
      <div className="siparis-veren-telefon">
        <i className="icon-telefon"></i>
        <span>
          {telefonFormatted ? (
            <a href={telefonHref}>{telefonFormatted}</a>
          ) : (
            <a href="#">Telefon Yok</a>
          )}
        </span>
      </div>

      {/* Teslim Saati - Organizasyon ve Çiçek Sepeti kartlarında sipariş kartında saat yok; diğerlerinde var */}
      {/* Çiçek Sepeti: sadece tarih (org kartında), sipariş kartında teslim saati gösterilmez */}
      {organizasyonKartTur !== 'organizasyon' && organizasyonKartTur !== 'ciceksepeti' && (isAracSusleme ? aracRandevuSaat : teslimSaat) && (() => {
        const warning = useDeliveryTimeWarning(isAracSusleme ? aracRandevuSaat : teslimSaat, teslimTarih);
        return (
          <div className="teslim-saat">
            <div className="saat-icerik">
              <span>Saat</span>
              {isAracSusleme ? (
                <div className="randevu-saat-veri">{aracRandevuSaat}</div>
              ) : (
                <div className="organizasyon-saat-veri">{teslimSaat}</div>
              )}
            </div>
            {warning && (
              <>
                {warning.durum === 'gecikti' && (
                  <div className="sure-gecti" style={{ display: 'flex' }}>
                    <span>{warning.mesaj}</span>
                  </div>
                )}
                {warning.durum === 'uyari' && (
                  <div className="kalan-sure-uyari sifir-kaldi" style={{ display: 'flex' }}>
                    <i className="icon-saat"></i>
                    <span>{warning.mesaj}</span>
                  </div>
                )}
                {warning.durum === 'normal' && (
                  <div className="daha-zaman-var" style={{ display: 'block' }}>
                    <i className="icon-saat"></i>
                    <span>{warning.mesaj}</span>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* Teslim Edilecek Kişi - Özel Gün, Özel Sipariş ve Çiçek Sepeti kartları için */}
      {(isOzelGun || isOzelSiparis || isCiceksepeti) && (
        <>
          <div className="baslik">Teslim Edilecek Kişi</div>
          <div className="teslim-kisisi">
            {teslimKisisi}
            <i className="icon-siparis-tasi"></i>
          </div>
          <div className="teslim-kisisi-telefon">
            <i className="icon-telefon"></i>
            <span>
              {teslimKisisiTelefonFormatted !== 'Telefon Belirtilmemiş' ? (
                <a href={teslimKisisiTelefonHref}>{teslimKisisiTelefonFormatted}</a>
              ) : (
                <a href="#">{teslimKisisiTelefonFormatted}</a>
              )}
            </span>
          </div>
        </>
      )}

      {/* Araç Bilgileri - Sadece araç süsleme kartları için */}
      {isAracSusleme && (
        <div className="arac-bilgileri">
          <div className="arac-marka-model">{aracMarkaModel || 'Araç Bilgisi Belirtilmemiş'}</div>
          <div className="arac-ozellikler">
            <div className="arac-renk">{aracRenk || '(Veri Yok)'}</div>
            <div className="arac-plaka">{aracPlaka || '(Veri Yok)'}</div>
          </div>
        </div>
      )}

      {/* Teslimat Konumu - Özel Gün, Özel Sipariş ve Çiçek Sepeti kartları için (mahalle ve açık adres) */}
      {(isOzelGun || isOzelSiparis || isCiceksepeti) && (rawSiparis?.mahalle || rawSiparis?.teslim_mahalle || acikAdresWithIlceIl) && (
        <div className="teslimat-konum">
          {(rawSiparis?.mahalle || rawSiparis?.teslim_mahalle) && (
            <div className="mahalle mahalle-sirala">{rawSiparis?.mahalle || rawSiparis?.teslim_mahalle}</div>
          )}
          {acikAdresWithIlceIl && (
            <div className="acik-adres">{acikAdresWithIlceIl}</div>
          )}
        </div>
      )}

      {/* Orta Alan */}
      <div className="orta-alan">
        <div className="urun-yazisi-wrapper">
          {/* Seçili ürün yazı dosyası varsa, ürün yazısı alanında dosya adı + indir ikonu göster ve tıklayınca indir */}
          {/* Ürün yazısı mevcut - üstte; altında metin veya seçili dosya alanı */}
          {musteriId && (
            <div 
              className="urun-yazisi-mevcut" 
              data-musteri-id={String(musteriId)} 
              data-siparis-id={order.id}
              data-musteri-unvan={musteriAdi}
              style={{ display: urunYazisiMevcutVisible ? 'flex' : 'none' }}
              onClick={() => setUrunYazisiPopupOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setUrunYazisiPopupOpen(true)}
            >
              <i className="fa-regular fa-file-lines"></i>
              <span>Mevcut ürün yazı dosyaları</span>
            </div>
          )}
          {secilenDosyaAdi ? (
            <div
              className="urun-yazisi-dosya"
              onClick={(e) => { e.stopPropagation(); handleSeciliDosyaIndir(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                  handleSeciliDosyaIndir();
                }
              }}
              role="button"
              tabIndex={0}
              data-tooltip="Ürün yazı dosyasını indirin"
            >
              <button
                type="button"
                className="urun-yazisi-download-btn"
                aria-label="Dosyayı indir"
              >
                <i className="uil uil-import"></i>
              </button>
              <span className="urun-yazisi-dosya-adi">{secilenDosyaAdi}</span>
            </div>
          ) : (
            urunYazisiHTML ? (
            <div dangerouslySetInnerHTML={{ __html: urunYazisiHTML }} />
            ) : null
          )}
          {/* Yazi Not - Legacy parity */}
          {(rawSiparis?.notes || rawSiparis?.not || rawSiparis?.siparis_not || rawSiparis?.siparis_notes || order.notes) && (
            <div
              className="yazi-not copy-text"
              data-tooltip={(rawSiparis?.notes || rawSiparis?.not || rawSiparis?.siparis_not || rawSiparis?.siparis_notes || order.notes) as string}
            >
              <i className="far fa-sticky-note"></i>
              {rawSiparis?.notes || rawSiparis?.not || rawSiparis?.siparis_not || rawSiparis?.siparis_notes || order.notes}
            </div>
          )}
        </div>
      </div>

      {/* Sipariş Ürün Bilgileri */}
      <div className="siparis-urun-bilgileri">
        <div className="urun-bilgisi">
          {/* Ürün görseli - Legacy parity (koşullu) */}
          {urunGorsel ? (
            <div className="urun-gorsel">
              <img 
                src={urunGorsel} 
                alt={urunAdi} 
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div className="urun-gorsel" style={{ display: 'none' }}></div>
          )}
          {/* Ürün adı - Legacy parity (data-tooltip ile unified tooltip görünür) */}
          <div className="siparis-urun" data-tooltip={urunAdi.replace(/"/g, '&quot;')}>
            {urunAdiKisa}
          </div>
        </div>
        {/* Fiyat Bilgisi - Legacy parity */}
        <div className="fiyat-bilgisi">
          <div className="siparis-tutari">
            {siparisTutari}
          </div>
          <div className="odeme-yontemi">
            {odemeYontemi}
          </div>
        </div>
      </div>

      {/* Alt Kart Alan */}
      <div className="alt-kart-alan">
        {isCiceksepeti ? (
          <div
            className="duzenleyen duzenleyen-api"
            data-updated-at={rawSiparis?.updated_at || rawSiparis?.updatedAt || order.updatedAt || undefined}
            title="Sipariş API üzerinden alındı"
          >
            <Plug size={16} className="duzenleyen-api-icon" aria-hidden />
            <span className="duzenleme-tarih">{duzenleyenApiTarih}</span>
          </div>
        ) : (
          <div 
            className="duzenleyen" 
            data-updated-at={rawSiparis?.updated_at || rawSiparis?.updatedAt || order.updatedAt || undefined}
            dangerouslySetInnerHTML={{ __html: duzenleyenHTML }}
          />
        )}
        <div className="kart-butonlar">
          <div 
            className="siparis-kart-icon" 
            data-siparis-arsivle 
            data-tooltip="Siparişi Arşivle"
            data-tooltip-pos="top"
            onClick={() => onAction && onAction('archive', order)}
            style={{ cursor: 'pointer' }}
          >
            <Archive size={18} aria-hidden />
          </div>
          {!isCiceksepeti && (
          <div 
            className="siparis-kart-icon" 
            data-tooltip="Düzenle"
            data-tooltip-pos="top"
            onClick={() => onAction && onAction('edit', order)}
            style={{ cursor: 'pointer' }}
          >
            <Pencil size={18} aria-hidden />
          </div>
          )}
          <div 
            className="siparis-kart-icon" 
            data-tooltip={organizasyonKartTur === 'aracsusleme' ? 'Tamamlandı İşaretle' : 'Teslim Edildi İşaretle'}
            data-tooltip-pos="top"
            onClick={() => {
              const orderWithKartTur = { ...order, organizasyonKartTur } as any;
              onAction && onAction('deliver', orderWithKartTur);
            }}
            style={{ cursor: 'pointer' }}
          >
            <SquareCheck size={18} aria-hidden />
          </div>
        </div>
      </div>

      {/* Ürün yazısı mevcut popup - tam sayfa (body'de), orgkart içinde değil */}
      {urunYazisiPopupOpen && createPortal(
        <div
          className="urun-yazisi-mevcut-popup-overlay"
          onClick={() => setUrunYazisiPopupOpen(false)}
          role="dialog"
          aria-label="Ürün yazısı dosyaları"
        >
          <div className="urun-yazisi-mevcut-popup" onClick={(e) => e.stopPropagation()}>
            <div className="urun-yazisi-popup-header">
              <span>Müşterinin mevcut ürün yazı dosyaları</span>
              <button type="button" className="btn-close-modal" onClick={() => setUrunYazisiPopupOpen(false)} aria-label="Kapat">
                <X size={20} aria-hidden />
              </button>
            </div>
            {musteriDosyaListesiLoading ? (
              <div className="urun-yazisi-popup-loading">Yükleniyor...</div>
            ) : musteriDosyaListesi.length === 0 ? (
              <div className="urun-yazisi-popup-bos">Dosya bulunamadı.</div>
            ) : (
              <ul className="urun-yazisi-popup-list">
                {musteriDosyaListesi.map((f) => {
                  const baseUrl = getApiBaseUrl().replace(/\/api\/?$/, '') || getApiBaseUrl().split('/api')[0];
                  const pathOrUrl = f.path || f.url;
                  const downloadUrl = pathOrUrl ? `${baseUrl}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}` : null;
                  const isSecili = secilenDosyaAdi === f.name;
                  return (
                    <li key={f.name} className={isSecili ? 'secili' : ''}>
                      <FileText size={16} aria-hidden />
                      <span className="dosya-adi">{f.name}</span>
                      {isSecili && <span className="urun-yazisi-popup-secilen-badge">Seçilen dosya</span>}
                      {downloadUrl && (
                        <a href={downloadUrl} download={f.name} className="urun-yazisi-popup-indir" title="İndir" onClick={(e) => handlePopupIndir(e, downloadUrl, f.name)}>
                          <Download size={16} aria-hidden />
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
