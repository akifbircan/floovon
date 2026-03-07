import { useCallback } from 'react';
import { showToast } from '../../../shared/utils/toastUtils';
import { formatPhoneNumber, appendIlceIlToAddress } from '../../../shared/utils/formatUtils';
import { 
  filterOrdersForWeek, 
  generatePrintHTML, 
  openPrintWindow, 
  exportToExcel,
  getWeekDays,
  formatDateForExport,
  getPrintLogoMarkup,
  getPrintDateDDMMYYYY
} from '../utils/exportUtils';
import type { OrganizasyonKart } from '../types';

/**
 * Export hook'u - Yazdırma ve Excel export işlemleri
 * ✅ REACT: Tamamen React'e taşındı, eski JS bağımlılığı yok
 */
export function useExport() {
  // Yazdırma işlemi
  const handlePrint = useCallback(async (
    kartlar: OrganizasyonKart[] | null | undefined,
    selectedWeek: string | null | undefined
  ) => {
    try {
      if (!kartlar || !selectedWeek) {
        showToast('warning', 'Yazdırılacak sipariş bulunamadı');
        return;
      }
      
      // Hafta günlerini hesapla
      const weekDays = getWeekDays(selectedWeek);
      if (weekDays.length === 0) {
        showToast('error', 'Hafta bilgisi geçersiz');
        return;
      }
      
      // Hafta başlangıç ve bitiş tarihlerini formatla
      // weekDays[0] = "DD MMMM YYYY dddd" formatında string
      // Parse et
      const weekStartStr = weekDays[0];
      const weekEndStr = weekDays[6];
      
      // "DD MMMM YYYY dddd" formatını parse et
      const parseWeekDay = (dayStr: string): Date => {
        const parts = dayStr.split(' ');
        const day = parseInt(parts[0]);
        const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        const month = monthNames.indexOf(parts[1]);
        const year = parseInt(parts[2]);
        return new Date(year, month, day);
      };
      
      const weekStart = parseWeekDay(weekStartStr);
      const weekEnd = parseWeekDay(weekEndStr);
      const haftaninIlkGunuFormatted = formatDateForExport(weekStart);
      const haftaninSonGunuFormatted = formatDateForExport(weekEnd);
      
      const tarihBilgisiYazisi = `
        <span class="tarih-vurgulu">${haftaninIlkGunuFormatted}</span> ile 
        <span class="tarih-vurgulu">${haftaninSonGunuFormatted}</span> tarihleri arasındaki siparişler.
      `;
      
      // Siparişleri filtrele (async)
      const filteredOrders = await filterOrdersForWeek(kartlar, selectedWeek);
      
      if (filteredOrders.length === 0) {
        showToast('info', 'Seçili hafta için sipariş bulunamadı');
        return;
      }
      
      // Logo markup'ı al
      const logoMarkup = await getPrintLogoMarkup();
      
      // HTML oluştur
      const html = await generatePrintHTML(tarihBilgisiYazisi, logoMarkup, filteredOrders);

      const title = `Sipariş Teslim Listesi – ${getPrintDateDDMMYYYY()}`;
      openPrintWindow(html, title, tarihBilgisiYazisi);
    } catch (error: any) {
      console.error('❌ Yazdırma hatası:', error);
      const errorMsg = error?.message || 'Yazdırma işlemi başarısız';
      showToast('error', errorMsg);
    }
  }, []);

  // Excel export işlemi
  const handleExcelExport = useCallback(async (
    kartlar: OrganizasyonKart[] | null | undefined,
    selectedWeek: string | null | undefined
  ) => {
    try {
      if (!kartlar || !selectedWeek) {
        showToast('warning', 'Dışa aktarılacak sipariş bulunamadı');
        return;
      }
      
      // Hafta günlerini hesapla
      const weekDays = getWeekDays(selectedWeek);
      if (weekDays.length === 0) {
        showToast('error', 'Hafta bilgisi geçersiz');
        return;
      }
      
      // Hafta başlangıç ve bitiş tarihlerini formatla
      // weekDays[0] = "DD MMMM YYYY dddd" formatında string
      // Parse et
      const weekStartStr = weekDays[0];
      const weekEndStr = weekDays[6];
      
      // "DD MMMM YYYY dddd" formatını parse et
      const parseWeekDay = (dayStr: string): Date => {
        const parts = dayStr.split(' ');
        const day = parseInt(parts[0]);
        const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        const month = monthNames.indexOf(parts[1]);
        const year = parseInt(parts[2]);
        return new Date(year, month, day);
      };
      
      const weekStart = parseWeekDay(weekStartStr);
      const weekEnd = parseWeekDay(weekEndStr);
      const haftaninIlkGunuFormatted = formatDateForExport(weekStart);
      const haftaninSonGunuFormatted = formatDateForExport(weekEnd);
      
      const tarihBilgisiYazisi = `
        <span class="tarih-vurgulu">${haftaninIlkGunuFormatted}</span> ile 
        <span class="tarih-vurgulu">${haftaninSonGunuFormatted}</span> tarihleri arasındaki siparişler.
      `;
      
      // Siparişleri filtrele (async)
      const filteredOrders = await filterOrdersForWeek(kartlar, selectedWeek);
      
      if (filteredOrders.length === 0) {
        showToast('info', 'Seçili hafta için sipariş bulunamadı');
        return;
      }
      
      // Excel export
      await exportToExcel(filteredOrders, tarihBilgisiYazisi);
      showToast('success', 'Excel dosyası indirildi');
      
    } catch (error: any) {
      console.error('❌ Excel export hatası:', error);
      const errorMsg = error?.message || 'Excel export işlemi başarısız';
      showToast('error', errorMsg);
    }
  }, []);

  // Sipariş künyesi yazdırma (organizasyon kartı için)
  const handlePrintKunye = useCallback(async (kart: OrganizasyonKart) => {
    let kunyeLogoUrl = '';
    try {
      const { apiRequest } = await import('../../../lib/api');
      const { getApiBaseUrl } = await import('../../../lib/runtime');
      const res = await apiRequest<{ success?: boolean; data?: { logo_png_url?: string; logo_png_path?: string } }>('/ayarlar/yazdirma');
      const data = (res as any)?.data;
      if (data && (data.logo_png_url || data.logo_png_path)) {
        const backendBase = getApiBaseUrl().replace(/\/api\/?$/, '');
        const raw = String(data.logo_png_url || data.logo_png_path || '').trim();
        if (raw) {
          kunyeLogoUrl = /^https?:\/\//i.test(raw) ? raw : backendBase + (raw.startsWith('/') ? raw : '/' + raw);
        }
        (window as any).floovonYazdirmaAyarlar = { ...data, logo_png_url: kunyeLogoUrl || data.logo_png_url };
      }
    } catch (_) {}

    try {
    const { getSiparisKartlariByOrganizasyon } = await import('../api');
    const siparisler = await getSiparisKartlariByOrganizasyon(kart.id);
    if (!siparisler || siparisler.length === 0) {
      showToast('warning', 'Sipariş bulunamadı!');
      return;
    }

    const tempContainer = document.createElement('div');
    tempContainer.className = 'ana-kart';
    tempContainer.setAttribute('data-organizasyon-id', String(kart.id));
    tempContainer.setAttribute('data-kart-id', String(kart.id));
    if (kunyeLogoUrl) {
      tempContainer.setAttribute('data-kunye-logo-url', kunyeLogoUrl);
    }
      
      // Tarih ve saat bilgisini ekle (yazdir-kunye .teslim-zaman .tarih ve .teslim-zaman .saat arar)
      if (kart.teslim_tarih) {
        const teslimZaman = document.createElement('div');
        teslimZaman.className = 'teslim-zaman';
        const tarih = document.createElement('div');
        tarih.className = 'tarih';
        const date = new Date(kart.teslim_tarih);
        const day = date.getDate();
        const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        const month = monthNames[date.getMonth()];
        const year = date.getFullYear();
        tarih.textContent = `${day} ${month} ${year}`;
        teslimZaman.appendChild(tarih);
        if (kart.teslim_saat) {
          const saat = document.createElement('div');
          saat.className = 'saat';
          saat.textContent = kart.teslim_saat;
          teslimZaman.appendChild(saat);
        }
        tempContainer.appendChild(teslimZaman);
      } else if (kart.teslim_saat) {
        const saat = document.createElement('div');
        saat.className = 'saat';
        saat.textContent = kart.teslim_saat;
        tempContainer.appendChild(saat);
      }
      
      // Kart türü ve alt türü (künye siyah alanda "Ana tür > Alt tür" gösterilecek; etiket yok)
      const kartTurEl = document.createElement('div');
      kartTurEl.className = 'kart-tur';
      kartTurEl.textContent = kart.kart_tur_display || kart.kart_tur || '';
      tempContainer.appendChild(kartTurEl);
      if (kart.alt_tur) {
        const kartAltTurEl = document.createElement('div');
        kartAltTurEl.className = 'kart-alt-tur';
        kartAltTurEl.textContent = kart.alt_tur;
        tempContainer.appendChild(kartAltTurEl);
      }
      
      // Konum bilgisini ekle
      if (kart.mahalle) {
        const konum = document.createElement('div');
        konum.className = 'konum';
        konum.textContent = kart.mahalle;
        tempContainer.appendChild(konum);
      }
      
      // Teslim kişisi bilgisini ekle
      if (kart.teslim_kisisi) {
        const teslimKisisi = document.createElement('div');
        teslimKisisi.className = 'teslim-kisisi';
        teslimKisisi.textContent = kart.teslim_kisisi;
        tempContainer.appendChild(teslimKisisi);
      }
      // Teslim kişisi telefonu (yazdir-kunye .teslim-kisisi-telefon arar) — format: +90 (506) 659 35 45
      if (kart.teslim_kisisi_telefon) {
        const teslimTel = document.createElement('div');
        teslimTel.className = 'teslim-kisisi-telefon';
        teslimTel.id = 'teslim-kisisi-telefon';
        teslimTel.textContent = formatPhoneNumber(kart.teslim_kisisi_telefon);
        tempContainer.appendChild(teslimTel);
      }

      // Her sipariş için siparis-kart elementi oluştur (backend hem kısa hem uzun kolon isimleri dönebiliyor; _raw ile ikisini de kullan)
      siparisler.forEach((siparis) => {
        const raw = (siparis as any)._raw ?? siparis;
        const siparisKart = document.createElement('div');
        siparisKart.className = 'siparis-kart';
        siparisKart.setAttribute('data-order-id', `ORD-${siparis.id}`);
        const siparisVerenTelRaw = raw?.siparis_veren_telefon ?? siparis.telefon;
        const teslimTelRaw = raw?.teslim_kisisi_telefon ?? raw?.organizasyon_teslim_kisisi_telefon ?? kart.teslim_kisisi_telefon;
        const siparisVerenTel = siparisVerenTelRaw ? formatPhoneNumber(siparisVerenTelRaw) : '';
        const teslimTel = teslimTelRaw ? formatPhoneNumber(teslimTelRaw) : '';
        // Künyede teslim kişisi HER ZAMAN teslim_kisisi (asla teslim_kisisi_baskasi). Organizasyonda kart.teslim_kisisi; özel gün/özel siparişte sipariş teslim_kisisi.
        const teslimKisi = kart.teslim_kisisi ?? (raw?.teslim_kisisi ?? siparis.teslimKisisi ?? '');
        const mahalle = siparis.mahalle ?? kart.mahalle;
        // Organizasyon (nişan/düğün) künyesinde açık adres: önce kart/org adresi, sonra sipariş teslim adresi.
        const acikAdresRaw = kart.acik_adres ?? (raw?.org_acik_adres || raw?.organizasyon_acik_adres) ?? siparis.acikAdres ?? (raw?.teslim_acik_adres || raw?.acik_adres);
        const ilce = kart.organizasyon_ilce ?? (raw?.teslim_ilce) ?? (kart as any).ilce;
        const il = kart.organizasyon_il ?? (raw?.teslim_il) ?? (kart as any).il;
        const acikAdres = acikAdresRaw ? appendIlceIlToAddress(acikAdresRaw, ilce, il) : '';

        // Sipariş veren
        if (siparis.musteriAdi) {
          const siparisVeren = document.createElement('div');
          siparisVeren.className = 'siparis-veren';
          siparisVeren.textContent = siparis.musteriAdi;
          siparisKart.appendChild(siparisVeren);
        }
        // Sipariş veren telefon (yazdir-kunye .siparis-veren-telefon arar) — format: +90 (506) 659 35 45
        if (siparisVerenTel) {
          const telEl = document.createElement('div');
          telEl.className = 'siparis-veren-telefon';
          telEl.id = 'siparis-veren-telefon';
          telEl.textContent = siparisVerenTel;
          siparisKart.appendChild(telEl);
        }
        // Ürün
        if (siparis.urun) {
          const siparisUrun = document.createElement('div');
          siparisUrun.className = 'siparis-urun';
          siparisUrun.textContent = siparis.urun;
          siparisKart.appendChild(siparisUrun);
        }
        // Eski davranış: .telefon (fallback) — formatlı
        if (siparis.telefon) {
          const telefon = document.createElement('div');
          telefon.className = 'telefon';
          telefon.textContent = formatPhoneNumber(siparis.telefon);
          siparisKart.appendChild(telefon);
        }
        // Teslim kişisi (sipariş veya kart)
        if (teslimKisi) {
          const tk = document.createElement('div');
          tk.className = 'teslim-kisisi';
          tk.textContent = teslimKisi;
          siparisKart.appendChild(tk);
        }
        // Teslim kişisi telefonu (sipariş kartında da olmalı) — formatlı
        if (teslimTel) {
          const tt = document.createElement('div');
          tt.className = 'teslim-kisisi-telefon';
          tt.textContent = teslimTel;
          siparisKart.appendChild(tt);
        }
        // Mahalle/konum (yazdir-kunye .mahalle veya .konum arar)
        if (mahalle) {
          const mahalleEl = document.createElement('div');
          mahalleEl.className = 'mahalle';
          mahalleEl.textContent = mahalle;
          siparisKart.appendChild(mahalleEl);
        }
        // Saat (organizasyon künyesinde görünsün; sipariş veya kart teslim saati)
        const saatDeger = siparis.teslimSaati ?? (raw?.teslim_saat) ?? kart.teslim_saat;
        if (saatDeger) {
          const saatWrap = document.createElement('div');
          saatWrap.className = 'teslim-zaman';
          const saatEl = document.createElement('div');
          saatEl.className = 'saat';
          saatEl.textContent = String(saatDeger).trim();
          saatWrap.appendChild(saatEl);
          siparisKart.appendChild(saatWrap);
        }
        // Açık adres (sipariş veya kart, ilçe/il eklenmiş)
        if (acikAdres) {
          const acikAdresEl = document.createElement('div');
          acikAdresEl.className = 'acik-adres';
          acikAdresEl.textContent = acikAdres;
          siparisKart.appendChild(acikAdresEl);
        }
        tempContainer.appendChild(siparisKart);
      });
      
      // Eski fonksiyonu çağır
      if (typeof (window as any).yazdirSiparisKunyeToplu === 'function') {
        await (window as any).yazdirSiparisKunyeToplu(tempContainer);
      } else {
        // Eğer eski fonksiyon yüklenmemişse, yükle
        showToast('error', 'Yazdırma fonksiyonu yüklenemedi. Lütfen sayfayı yenileyin.');
      }
      
    } catch (error: any) {
      console.error('❌ Künye yazdırma hatası:', error);
      showToast('error', error.message || 'Künye yazdırma işlemi başarısız');
    }
  }, []);

  return {
    handlePrint,
    handleExcelExport,
    handlePrintKunye,
  };
}

