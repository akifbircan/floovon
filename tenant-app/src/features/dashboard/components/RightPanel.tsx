import React, { useMemo, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { gsap } from 'gsap';
import type { OrganizasyonKart } from '../types';
import type { WeekDate } from '../hooks/useWeekDates';
import { useDashboardStatistics } from '../hooks/useDashboardStatistics';
import { PrimaryFeatureContainer } from './PrimaryFeatureContainer';
import { getWeeksInYear } from '../../../shared/utils/dateUtils';

const isDashboardPath = (path: string) => path === '/' || path === '/siparisler';

interface RightPanelProps {
  kartlar?: OrganizasyonKart[] | null;
  selectedWeek?: string;
  weekDates?: WeekDate[];
  onWeekChange?: (week: string) => void;
  onDayClick?: (dateString: string) => void;
  selectedDay?: string | null; // ✅ DÜZELTME: Parent'tan gelen seçili gün
  kartlarLoading?: boolean; // ✅ DÜZELTME: Loading state'i
}

/**
 * Sağ Panel - Takvim ve İstatistikler
 * Eski HTML yapısına göre düzenlendi (index.html satır 1297-1447)
 */
const RightPanelComponent: React.FC<RightPanelProps> = ({ 
  kartlar, 
  selectedWeek,
  weekDates = [],
  onWeekChange,
  onDayClick,
  selectedDay, // ✅ DÜZELTME: Parent'tan gelen seçili gün
  kartlarLoading = false, // ✅ DÜZELTME: Loading state'i
}) => {
  const weekPickerRef = useRef<HTMLInputElement>(null);
  const yearMonthLabelRef = useRef<HTMLDivElement>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const sagPanelRef = useRef<HTMLDivElement>(null);
  const panelMergedRef = useRef<HTMLDivElement>(null);
  const panelWrapperRef = useRef<HTMLDivElement>(null);
  const toplamSiparisBilgiKartRef = useRef<HTMLDivElement>(null);
  const toplamOrganizasyonSayisiRef = useRef<HTMLDivElement>(null);
  const toplamSiparisSayisiRef = useRef<HTMLDivElement>(null);
  const toplamTeslimEdilenSayisiRef = useRef<HTMLDivElement>(null);
  const hasAnimatedStatsRef = useRef(false);
  const previousPathnameRef = useRef<string | null>(null);
  const statsTargetRef = useRef({ org: 0, kalan: 0, teslim: 0 });
  const location = useLocation();

  // Index sayfasına her geçişte counter animasyonunun tekrar çalışması için
  useEffect(() => {
    const path = location.pathname;
    if (isDashboardPath(path)) {
      if (previousPathnameRef.current !== null && !isDashboardPath(previousPathnameRef.current)) {
        hasAnimatedStatsRef.current = false;
      }
      previousPathnameRef.current = path;
    } else {
      previousPathnameRef.current = path;
    }
  }, [location.pathname]);

  // ✅ REACT: Seçili gün state'i (gün tıklama için)

  // ✅ REACT: Gün adının kısa versiyonunu al (örn: "Pazartesi" -> "Pzt")
  const getDayShortName = (dayName: string): string => {
    const dayMap: Record<string, string> = {
      'Pazartesi': 'Pzt',
      'Salı': 'Sal',
      'Çarşamba': 'Çar',
      'Perşembe': 'Per',
      'Cuma': 'Cum',
      'Cumartesi': 'Cmt',
      'Pazar': 'Paz',
    };
    return dayMap[dayName] || dayName.substring(0, 3);
  };
  
  // ✅ REACT: Bugün mü kontrolü
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };
  
  // ✅ REACT: Gün tıklama handler'ı
  const handleDayClick = (weekDate: WeekDate, e?: React.MouseEvent) => {
    // ✅ DÜZELTME: Event propagation'ı durdur ve parent'a bildir
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      // ✅ KRİTİK: Sayfa yenilenmesini engelle
      if (e.nativeEvent) {
        (e.nativeEvent as any).stopImmediatePropagation?.();
      }
    }
    try {
      if (onDayClick) {
        // ✅ DÜZELTME: dateString kullan (displayDate değil) - parent'ta dateString bekleniyor
        onDayClick(weekDate.dateString);
      }
    } catch (error) {
      // Sessizce devam et
    }
  };
  
  // ✅ REACT: Hafta numarasını hesapla (ISO 8601)
  const getWeekNumber = (date: Date): number => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const jan4 = new Date(d.getFullYear(), 0, 4);
    const jan4Day = jan4.getDay();
    const daysToMonday = jan4Day === 0 ? -6 : 1 - jan4Day;
    const firstMonday = new Date(d.getFullYear(), 0, 4 + daysToMonday);
    const dateDay = d.getDay();
    const daysToDateMonday = dateDay === 0 ? -6 : 1 - dateDay;
    const dateMonday = new Date(d);
    dateMonday.setDate(d.getDate() + daysToDateMonday);
    const diffTime = dateMonday.getTime() - firstMonday.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
  };

  // Ay/Yıl etiketi
  const yearMonthLabel = useMemo(() => {
    if (weekDates.length === 0) return '';
    const firstDate = weekDates[0].date;
    const monthNames = [
      'OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN',
      'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'
    ];
    return `${monthNames[firstDate.getMonth()]} ${firstDate.getFullYear()}`;
  }, [weekDates]);

  // ✅ REACT: İstatistikleri React hook ile hesapla
  const statistics = useDashboardStatistics(
    kartlar ?? null, 
    selectedWeek ?? null,
    kartlarLoading
  );

  // İstatistikleri ref'te tut (counter event handler güncel değeri okusun diye)
  useEffect(() => {
    statsTargetRef.current = {
      org: statistics.toplamOrganizasyon,
      kalan: Math.max(0, statistics.toplamSiparis - statistics.teslimEdilen),
      teslim: statistics.teslimEdilen,
    };
  }, [statistics.toplamOrganizasyon, statistics.toplamSiparis, statistics.teslimEdilen]);

  // GSAP counter: sağ paneldeki stats bölümü animasyonu bittikten SONRA çalışır (0→hedef)
  useEffect(() => {
    if (!isDashboardPath(location.pathname) || hasAnimatedStatsRef.current) return;

    let started = false;
    const runCounter = () => {
      if (started) return;
      const orgEl = toplamOrganizasyonSayisiRef.current;
      const kalanEl = toplamSiparisSayisiRef.current;
      const teslimEl = toplamTeslimEdilenSayisiRef.current;
      if (!orgEl || !kalanEl || !teslimEl) return;

      const { org: orgTarget, kalan: kalanTarget, teslim: teslimTarget } = statsTargetRef.current;
      started = true;
      const hadRealData = orgTarget + kalanTarget + teslimTarget > 0;
      if (hadRealData) hasAnimatedStatsRef.current = true;

      orgEl.textContent = '0';
      kalanEl.textContent = '0';
      teslimEl.textContent = '0';

      const obj = { org: 0, kalan: 0, teslim: 0 };
      gsap.to(obj, {
        org: orgTarget,
        kalan: kalanTarget,
        teslim: teslimTarget,
        duration: 1.2,
        ease: 'power2.out',
        onUpdate: () => {
          orgEl.textContent = String(Math.round(obj.org));
          kalanEl.textContent = String(Math.round(obj.kalan));
          teslimEl.textContent = String(Math.round(obj.teslim));
        },
      });
    };

    const onStatsVisible = () => runCounter();
    window.addEventListener('dashboard-stats-section-visible', onStatsVisible);
    const fallbackId = setTimeout(runCounter, 1500);

    return () => {
      window.removeEventListener('dashboard-stats-section-visible', onStatsVisible);
      clearTimeout(fallbackId);
    };
  }, [location.pathname]);

  // İstatistik değiştiğinde (hafta vb.) sayıları güncelle (animasyon yok)
  useEffect(() => {
    if (!hasAnimatedStatsRef.current) return;
    if (toplamOrganizasyonSayisiRef.current)
      toplamOrganizasyonSayisiRef.current.textContent = String(statistics.toplamOrganizasyon);
    if (toplamSiparisSayisiRef.current)
      toplamSiparisSayisiRef.current.textContent = String(Math.max(0, statistics.toplamSiparis - statistics.teslimEdilen));
    if (toplamTeslimEdilenSayisiRef.current)
      toplamTeslimEdilenSayisiRef.current.textContent = String(statistics.teslimEdilen);
  }, [statistics]);

  // ✅ REACT: İstatistikler artık direkt JSX'te gösteriliyor, DOM manipülasyonu yok

  // Year/Month label'ı güncelle
  useEffect(() => {
    if (yearMonthLabelRef.current) {
      yearMonthLabelRef.current.textContent = yearMonthLabel;
    }
  }, [yearMonthLabel]);

  // ✅ REACT: Günler artık React component olarak render ediliyor (weekDates prop'undan)

  const handleWeekChange = (e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    
    // ✅ KRİTİK: Programatik değişiklik ise ignore et (sayfa yenilenmesini önle)
    if (target.getAttribute('data-programmatic-change') === 'true') {
      target.removeAttribute('data-programmatic-change');
      return;
    }
    
    const newWeek = target.value;
    
    // ✅ KRİTİK: Değer değiştiyse ve geçerli bir hafta formatındaysa işle
    if (newWeek && newWeek.includes('-W') && newWeek !== selectedWeek) {
      // Form submit'i engelle (sadece native form submit için)
      if ('preventDefault' in e) {
        e.preventDefault();
      }
      
      // React state güncelle - weekDates otomatik güncellenecek
      onWeekChange?.(newWeek);
      
      // ✅ KRİTİK: Window.location değişikliğini engelle
      if (window.history) {
        const currentUrl = window.location.href;
        window.history.replaceState(null, '', currentUrl);
      }
    }
  };

  // ✅ REACT: Bu haftaya git - tamamen React ile
  const handleBuHaftayaGit = () => {
    const now = new Date();
    const year = now.getFullYear();
    const week = getWeekNumber(now);
    const weekString = `${year}-W${week.toString().padStart(2, '0')}`;
    
    // Week input'un değerini güncelle
    if (weekPickerRef.current) {
      weekPickerRef.current.setAttribute('data-programmatic-change', 'true');
      weekPickerRef.current.value = weekString;
    }
    
    // ✅ DÜZELTME: Seçili günü sıfırla - TÜM HAFTAYI GÖSTER
    // onDayClick callback'i ile selectedDay'i null yap
    if (onDayClick) {
      // Boş string göndererek selectedDay'i null yap
      onDayClick('');
    }
    
    // React state'i güncelle
    onWeekChange?.(weekString);
  };

  const handleWeekIndicatorClick = () => {
    if (weekPickerRef.current) {
      // Modern tarayıcılarda showPicker() API'sini kullan
      if (typeof weekPickerRef.current.showPicker === 'function') {
        try {
          weekPickerRef.current.showPicker();
        } catch (err) {
          // Fallback: focus
          weekPickerRef.current.focus();
        }
      } else {
        weekPickerRef.current.focus();
      }
    }
  };

  // Toggle panel fonksiyonu
  const handleTogglePanel = () => {
    setIsPanelOpen(!isPanelOpen);
  };

  const handleClosePanel = () => {
    setIsPanelOpen(false);
  };

  // Tablet görünümü kontrolü ve toggle button görünürlüğü
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      const isTablet = width >= 1024 && width <= 1199;
      const panel = document.querySelector('.sag-panel');
      const toggleBtn = document.getElementById('sagPanelToggleBtn');
      
      if (panel && toggleBtn) {
        if (isTablet) {
          toggleBtn.style.display = 'flex';
          panel.classList.add('tablet-hidden');
          if (isPanelOpen) {
            panel.classList.add('tablet-open');
          } else {
            panel.classList.remove('tablet-open');
          }
        } else {
          toggleBtn.style.display = 'none';
          panel.classList.remove('tablet-hidden', 'tablet-open');
          setIsPanelOpen(false);
        }
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, [isPanelOpen]);

  // Panel açık/kapalı durumunu güncelle
  useEffect(() => {
    const panel = document.querySelector('.sag-panel');
    const overlay = document.getElementById('sagPanelOverlay');
    const toggleIcon = document.getElementById('toggleIcon');
    
    if (panel && overlay && toggleIcon) {
      if (isPanelOpen) {
        panel.classList.add('tablet-open');
        overlay.classList.add('active');
        toggleIcon.className = 'fa-solid fa-chevron-right';
      } else {
        panel.classList.remove('tablet-open');
        overlay.classList.remove('active');
        toggleIcon.className = 'fa-solid fa-chevron-left';
      }
    }
  }, [isPanelOpen]);

  // ESC tuşu ile kapat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPanelOpen) {
        handleClosePanel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPanelOpen]);

  // ✅ REACT: İlk mount'ta weekPicker input'unu ayarla
  useEffect(() => {
    if (weekPickerRef.current) {
      // Eğer selectedWeek prop'u varsa onu kullan, yoksa mevcut haftayı hesapla
      if (!selectedWeek || selectedWeek.trim() === '') {
        const now = new Date();
        const year = now.getFullYear();
        const week = getWeekNumber(now);
        const weekString = `${year}-W${week.toString().padStart(2, '0')}`;
        weekPickerRef.current.setAttribute('data-programmatic-change', 'true');
        weekPickerRef.current.value = weekString;
        onWeekChange?.(weekString);
      } else {
        weekPickerRef.current.setAttribute('data-programmatic-change', 'true');
        weekPickerRef.current.value = selectedWeek;
      }
    }
  }, []); // Sadece mount'ta çalış

  // ✅ REACT: selectedWeek değiştiğinde weekPicker input'unu güncelle
  useEffect(() => {
    if (weekPickerRef.current && selectedWeek) {
      weekPickerRef.current.setAttribute('data-programmatic-change', 'true');
      weekPickerRef.current.value = selectedWeek;
    }
    // ✅ DÜZELTME: Seçili gün parent'tan yönetiliyor, burada sıfırlamaya gerek yok
  }, [selectedWeek]);

  // Mobil başlıkta "mobile-baslik-metin-tarihler" tıklanınca week picker açılsın
  useEffect(() => {
    const openWeekPicker = () => {
      if (weekPickerRef.current) {
        if (typeof weekPickerRef.current.showPicker === 'function') {
          try {
            weekPickerRef.current.showPicker();
          } catch {
            weekPickerRef.current.focus();
          }
        } else {
          weekPickerRef.current.focus();
        }
      }
    };
    window.addEventListener('floovon-open-week-picker', openWeekPicker);
    return () => window.removeEventListener('floovon-open-week-picker', openWeekPicker);
  }, []);

  // ✅ KRİTİK: Sayfa yenilenmesini engelle - Legacy JS event listener'larını kaldır
  useEffect(() => {
    // ✅ KRİTİK: initTakvimSistemi fonksiyonunu tamamen devre dışı bırak
    const originalInitTakvimSistemi = (window as any).initTakvimSistemi;
    (window as any).initTakvimSistemi = function() {
      // ✅ KRİTİK: React SPA'da initTakvimSistemi hiçbir şey yapmasın!
      return; // Early return - hiçbir şey yapma!
    };
    
    // ✅ KRİTİK: Eski JS'in navigateWeek fonksiyonunu override et - React SPA'da HER ZAMAN hiçbir şey yapmasın
    const originalNavigateWeek = (window as any).navigateWeek;
    (window as any).navigateWeek = function(_direction: number) {
      // ✅ KRİTİK: React SPA'da HER ZAMAN hiçbir şey yapma - override et!
      return; // Early return - hiçbir şey yapma!
    };
    
    // ✅ KRİTİK: Eski JS'in buHaftayaGit fonksiyonunu override et
    const originalBuHaftayaGit = (window as any).buHaftayaGit;
    (window as any).buHaftayaGit = function() {
      // ✅ KRİTİK: React SPA'da HER ZAMAN hiçbir şey yapma - override et!
      return; // Early return - hiçbir şey yapma!
    };
    
    // ✅ KRİTİK: Eski JS'in butonlara eklediği event listener'ları engelle
    // Butonları clone etmek yerine, sadece form submit'i engellemek yeterli
    // React'in onClick handler'ları zaten çalışıyor, eski JS listener'ları override ediyor
    
    // ✅ KRİTİK: Legacy JS'in butonlara eklediği event listener'ları engelle
    // Legacy JS butonları bulup listener ekliyorsa, onları override et
    // Ama React'in onClick handler'ları korunmalı
    // Bu yüzden sadece navigateWeek ve buHaftayaGit fonksiyonlarını override etmek yeterli
    
    // ✅ KRİTİK: Eski JS'in event listener'larını kaldır - ama React handler'ları koru!
    // Butonları clone etmek yerine, sadece eski JS listener'larını engelle
    // React'in kendi event handler'ları zaten çalışıyor
    
    // Sayfa yenilenmesini engelle
    const preventUnload = (e: BeforeUnloadEvent) => {
      // Sadece butonlara tıklandığında engelle
      const activeElement = document.activeElement as HTMLElement;
      if (
        activeElement?.id === 'prevWeekButton' ||
        activeElement?.id === 'nextWeekButton' ||
        activeElement?.id === 'buHaftaButton' ||
        activeElement?.id === 'weekPicker'
      ) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    
    // Form submit'i engelle - document seviyesinde
    const preventFormSubmit = (e: Event) => {
      const target = e.target as HTMLElement;
      const submitter = (e as SubmitEvent).submitter as HTMLElement;
      const form = target as HTMLFormElement;
      
      // ✅ KRİTİTİK: Eğer form içinde takvim butonları varsa TÜM submit'leri engelle
      if (form && (
        form.querySelector('#prevWeekButton') ||
        form.querySelector('#nextWeekButton') ||
        form.querySelector('#buHaftaButton') ||
        form.querySelector('#weekPicker') ||
        form.closest('.takvim-hafta') ||
        form.closest('.baslik-ve-nav')
      )) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
      
      // ✅ KRİTİK: Week input veya takvim butonları ile ilgili TÜM form submit'leri engelle
      if (
        target?.id === 'prevWeekButton' ||
        target?.id === 'nextWeekButton' ||
        target?.id === 'buHaftaButton' ||
        target?.id === 'weekPicker' ||
        submitter?.id === 'prevWeekButton' ||
        submitter?.id === 'nextWeekButton' ||
        submitter?.id === 'buHaftaButton' ||
        submitter?.id === 'weekPicker' ||
        document.activeElement?.id === 'prevWeekButton' ||
        document.activeElement?.id === 'nextWeekButton' ||
        document.activeElement?.id === 'buHaftaButton' ||
        document.activeElement?.id === 'weekPicker' ||
        target?.closest('#prevWeekButton') ||
        target?.closest('#nextWeekButton') ||
        target?.closest('#buHaftaButton') ||
        target?.closest('#weekPicker') ||
        target?.closest('.takvim-hafta') ||
        target?.closest('.baslik-ve-nav')
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
    };
    
    // ✅ KRİTİK: TÜM form'ları yakala ve submit'i engelle (eğer takvim ile ilgiliyse)
    const preventAllFormSubmits = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      const submitter = e.submitter as HTMLElement;
      
      // Eğer form içinde takvim butonları varsa engelle
      if (
        form?.querySelector('#prevWeekButton') ||
        form?.querySelector('#nextWeekButton') ||
        form?.querySelector('#buHaftaButton') ||
        form?.querySelector('#weekPicker') ||
        submitter?.id === 'prevWeekButton' ||
        submitter?.id === 'nextWeekButton' ||
        submitter?.id === 'buHaftaButton' ||
        submitter?.closest('#prevWeekButton') ||
        submitter?.closest('#nextWeekButton') ||
        submitter?.closest('#buHaftaButton') ||
        submitter?.closest('.takvim-hafta') ||
        submitter?.closest('.baslik-ve-nav')
      ) {
        e.preventDefault();
        e.stopPropagation();
        // ✅ DÜZELTME: Native DOM event'inde stopImmediatePropagation var, kontrol et
        if (typeof (e as any).stopImmediatePropagation === 'function') {
          (e as any).stopImmediatePropagation();
        }
        return false;
      }
    };
    
    // ✅ KRİTİK: Butonların form içinde olmadığından emin ol
    const ensureButtonsNotInForm = () => {
      const prevButton = document.getElementById('prevWeekButton');
      const nextButton = document.getElementById('nextWeekButton');
      const buHaftaButton = document.getElementById('buHaftaButton');
      
      [prevButton, nextButton, buHaftaButton].forEach(button => {
        if (button) {
          const form = button.closest('form');
          if (form) {
            // Buton bir form içindeyse, form'dan çıkar (ama bu durumda zaten olmamalı)
          }
          // Butonun type'ını kontrol et
          if (button.getAttribute('type') !== 'button') {
            button.setAttribute('type', 'button');
          }
          // Butonun form attribute'unu kontrol et
          if (!button.hasAttribute('form') || button.getAttribute('form') !== '') {
            button.setAttribute('form', '');
          }
        }
      });
    };
    
    // ✅ KRİTİK: Click event'lerini YAKALAMA - React'in onClick handler'larını engelliyor!
    // preventClickEvents fonksiyonu kaldırıldı - React event'lerini engellememeli
    
    // ✅ KRİTİK: window.location değişikliklerini engelle - basit yaklaşım
    // window.location property'sini redefine edemeyiz, bu yüzden sadece event'leri engelleyelim
    
    // ✅ KRİTİK: Butonların form içinde olmadığından emin ol - mount'ta ve periyodik olarak kontrol et
    ensureButtonsNotInForm();
    const buttonCheckInterval = setInterval(ensureButtonsNotInForm, 1000); // Her saniye kontrol et
    
    // ✅ KRİTİK: Sayfa yenilenmesini yakala ve logla
    const originalLocation = window.location.href;
    let lastCheckUrl = originalLocation;
    const checkLocationChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastCheckUrl) {
        lastCheckUrl = currentUrl;
      }
    };
    
    // Periyodik kontrol (sayfa yenilenmesini yakalamak için)
    const locationCheckInterval = setInterval(checkLocationChange, 50); // Daha sık kontrol et
    
    // ✅ KRİTİK: Sayfa yenilenmesini yakalamak için visibility change listener
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const lastClickTime = (window as any).__LAST_BUTTON_CLICK_TIME__;
        const timeSinceClick = lastClickTime ? Date.now() - lastClickTime : null;
        if (timeSinceClick && timeSinceClick < 2000) {
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    window.addEventListener('beforeunload', preventUnload);
    document.addEventListener('submit', preventFormSubmit, true); // Capture phase
    document.addEventListener('submit', preventAllFormSubmits, true); // Capture phase - ekstra koruma
    // ✅ DÜZELTME: preventClickEvents kaldırıldı - React onClick handler'larını engelliyordu!
    
    // ✅ KRİTİK: Event listener'ların zaten eklenip eklenmediğini kontrol et
    const listenerKey = '__RIGHT_PANEL_LISTENERS_ADDED__';
    if ((window as any)[listenerKey]) {
      return;
    }
    
    (window as any)[listenerKey] = true;
    
    
    return () => {
      (window as any)[listenerKey] = false;
      clearInterval(buttonCheckInterval);
      clearInterval(locationCheckInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Cleanup - orijinal fonksiyonları geri yükle
      if (originalInitTakvimSistemi) {
        (window as any).initTakvimSistemi = originalInitTakvimSistemi;
      }
      if (originalNavigateWeek) {
        (window as any).navigateWeek = originalNavigateWeek;
      }
      if (originalBuHaftayaGit) {
        (window as any).buHaftayaGit = originalBuHaftayaGit;
      }
      window.removeEventListener('beforeunload', preventUnload);
      document.removeEventListener('submit', preventFormSubmit, true);
      document.removeEventListener('submit', preventAllFormSubmits, true);
      // ✅ DÜZELTME: preventClickEvents kaldırıldı
    };
  }, []); // Sadece mount'ta çalış

  // Primary feature container artık PrimaryFeatureContainer component'i tarafından yönetiliyor

  // ✅ REACT: İstatistikler artık useDashboardStatistics hook'u ile hesaplanıyor
  // Bu useEffect kaldırıldı - artık gerekli değil

  // ✅ KRİTİK: RightPanel animasyonları usePageAnimations.ts'de yapılıyor
  // Bu useEffect artık gerekli değil - animasyonlar usePageAnimations.ts'de yönetiliyor
  // useEffect(() => {}, []) kaldırıldı - boş useEffect gereksiz

  return (
    <>
      <div className="sag-panel" ref={sagPanelRef}>
        <div className="sag-panel-icerik">
          {/* #region Sağ Panel --- Takvim Hafta Seçim */}
          <div className="panel-merged" ref={panelMergedRef} data-calendar-section>
            <img className="takvim-imaj" src="/assets/sp-takvim.svg" alt="Takvim" />
            <div className="takvim-hafta">
              <div className="gorsel-baslik">
                Organizasyon Takvimi
                <span>Seçtiğiniz tarihteki siparişleri görüntüleyin</span>
              </div>
              <div className="takvim-header">
                <div className="year-month-label" ref={yearMonthLabelRef} id="yearMonthLabel"></div>
              </div>
              <div className="label-container week-wrapper">
                {/* ✅ KRİTİK: Form dışında, hiçbir form submit'i tetiklenmesin */}
                <div className="input-kapsayici">
                  <input 
                    type="week" 
                    id="weekPicker"
                    ref={weekPickerRef}
                    value={selectedWeek || ''}
                    onChange={handleWeekChange}
                    onInput={handleWeekChange}
                    onKeyDown={(e) => {
                      // ✅ KRİTİK: Tüm tuşlarda form submit'i engelle
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.nativeEvent) {
                        e.nativeEvent.stopImmediatePropagation();
                      }
                      // Enter tuşuna basıldığında da form submit'i engelle
                      if (e.key === 'Enter') {
                        return false;
                      }
                    }}
                    onClick={(e) => {
                      // ✅ KRİTİK: Input tıklamasında da form submit'i engelle
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.nativeEvent) {
                        e.nativeEvent.stopImmediatePropagation();
                      }
                    }}
                    onFocus={(e) => {
                      // ✅ KRİTİK: Focus'ta da form submit'i engelle
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    form=""
                    autoComplete="off"
                  />
                  <i className="icon-input-week-indicator" onClick={handleWeekIndicatorClick}></i>
                </div>
                <div className="baslik-ve-nav">
                  <div className="label-container nav">
                    <button 
                      type="button" 
                      id="prevWeekButton"
                      form=""
                      onMouseDown={(e) => {
                        // ✅ KRİTİK: MouseDown'da da engelle - form submit'i önlemek için
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                      }}
                      onMouseUp={(e) => {
                        // ✅ KRİTİK: MouseUp'da da engelle
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                      }}
                      onSubmit={(e) => {
                        // ✅ KRİTİK: Form submit'i engelle
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                      }}
                      onClick={(e) => {
                        // ✅ KRİTİK: Sayfa yenilenmesini engelle
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // ✅ KRİTİK: Window location değişikliğini engelle
                        if (window.history) {
                          const currentUrl = window.location.href;
                          window.history.replaceState(null, '', currentUrl);
                        }
                        
                        // ✅ KRİTİK: Native event'te de engelle
                        if (e.nativeEvent) {
                          (e.nativeEvent as any).preventDefault?.();
                          (e.nativeEvent as any).stopPropagation?.();
                          if (typeof (e.nativeEvent as any).stopImmediatePropagation === 'function') {
                            (e.nativeEvent as any).stopImmediatePropagation();
                          }
                        }
                        
                        // ✅ KRİTİK: Form submit'i engelle - eğer buton bir form içindeyse
                        const form = (e.target as HTMLElement).closest('form');
                        if (form) {
                          e.preventDefault();
                          e.stopPropagation();
                          // Native event'te stopImmediatePropagation zaten yukarıda çağrıldı
                        }
                        
                        // ✅ KRİTİK: Legacy JS'i engelle
                        (window as any)._navigatingWeek = true;
                        
                        // ✅ REACT: Hafta hesapla ve güncelle
                        // Önce selectedWeek prop'unu kullan, yoksa weekPickerRef'ten al
                        let currentWeek = selectedWeek || weekPickerRef.current?.value || '';
                        
                        // Eğer hala boşsa, bugünün haftasını hesapla
                        if (!currentWeek || !currentWeek.includes('-W')) {
                          const now = new Date();
                          const year = now.getFullYear();
                          const week = getWeekNumber(now);
                          currentWeek = `${year}-W${week.toString().padStart(2, '0')}`;
                        }
                        
                        const parts = currentWeek.split('-W');
                        const year = parseInt(parts[0]);
                        const weekNumber = parseInt(parts[1]);
                        
                        if (isNaN(year) || isNaN(weekNumber)) {
                          console.error('❌ Hafta parse edilemedi:', currentWeek);
                          return false; // ✅ KRİTİK: return false ekle
                        }
                        
                        let newWeekNumber = weekNumber - 1;
                        let newYear = year;
                        
                        if (newWeekNumber < 1) {
                          newYear = year - 1;
                          const lastWeekOfPrevYear = getWeeksInYear(newYear);
                          newWeekNumber = lastWeekOfPrevYear;
                        }
                        
                        const newWeek = `${newYear}-W${String(newWeekNumber).padStart(2, '0')}`;
                        
                        // ✅ KRİTİK: ESKİ SİSTEM GİBİ - Önce input value'yu güncelle, sonra React state'i güncelle
                        // Bu sayede component unmount edilmez
                        if (weekPickerRef.current) {
                          weekPickerRef.current.setAttribute('data-programmatic-change', 'true');
                          weekPickerRef.current.value = newWeek;
                        }
                        
                        // ✅ KRİTİK: React state'i güncelle - requestAnimationFrame ile geciktir
                        requestAnimationFrame(() => {
                          if (onWeekChange) {
                            onWeekChange(newWeek);
                          }
                        });
                        
                        setTimeout(() => {
                          delete (window as any)._navigatingWeek;
                        }, 100);
                        return false; // ✅ KRİTİK: ESKİ SİSTEM GİBİ return false
                      }}
                    >
                      <i className="fa-solid fa-chevron-left"></i>
                    </button>
                    <button 
                      type="button" 
                      id="nextWeekButton"
                      form=""
                      onMouseDown={(e) => {
                        // ✅ KRİTİK: MouseDown'da da engelle - form submit'i önlemek için
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                      }}
                      onMouseUp={(e) => {
                        // ✅ KRİTİK: MouseUp'da da engelle
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                      }}
                      onSubmit={(e) => {
                        // ✅ KRİTİK: Form submit'i engelle
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                      }}
                      onClick={(e) => {
                        // ✅ KRİTİK: Sayfa yenilenmesini engelle
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // ✅ KRİTİK: Window location değişikliğini engelle
                        if (window.history) {
                          const currentUrl = window.location.href;
                          window.history.replaceState(null, '', currentUrl);
                        }
                        
                        // ✅ KRİTİK: Native event'te de engelle
                        if (e.nativeEvent) {
                          (e.nativeEvent as any).preventDefault?.();
                          (e.nativeEvent as any).stopPropagation?.();
                          if (typeof (e.nativeEvent as any).stopImmediatePropagation === 'function') {
                            (e.nativeEvent as any).stopImmediatePropagation();
                          }
                        }
                        
                        // ✅ KRİTİK: Form submit'i engelle - eğer buton bir form içindeyse
                        const form = (e.target as HTMLElement).closest('form');
                        if (form) {
                          e.preventDefault();
                          e.stopPropagation();
                          // Native event'te stopImmediatePropagation zaten yukarıda çağrıldı
                        }
                        
                        // ✅ KRİTİK: Legacy JS'i engelle
                        (window as any)._navigatingWeek = true;
                        
                        // ✅ REACT: Hafta hesapla ve güncelle
                        // Önce selectedWeek prop'unu kullan, yoksa weekPickerRef'ten al
                        let currentWeek = selectedWeek || weekPickerRef.current?.value || '';
                        
                        // Eğer hala boşsa, bugünün haftasını hesapla
                        if (!currentWeek || !currentWeek.includes('-W')) {
                          const now = new Date();
                          const year = now.getFullYear();
                          const week = getWeekNumber(now);
                          currentWeek = `${year}-W${week.toString().padStart(2, '0')}`;
                        }
                        
                        const parts = currentWeek.split('-W');
                        const year = parseInt(parts[0]);
                        const weekNumber = parseInt(parts[1]);
                        
                        if (isNaN(year) || isNaN(weekNumber)) {
                          console.error('❌ Hafta parse edilemedi:', currentWeek);
                          return false; // ✅ KRİTİK: return false ekle
                        }
                        
                        let newWeekNumber = weekNumber + 1;
                        let newYear = year;
                        
                        const weeksInYear = getWeeksInYear(year);
                        if (newWeekNumber > weeksInYear) {
                          newYear = year + 1;
                          newWeekNumber = 1;
                        }
                        
                        const newWeek = `${newYear}-W${String(newWeekNumber).padStart(2, '0')}`;
                        
                        // ✅ KRİTİK: ESKİ SİSTEM GİBİ - Önce input value'yu güncelle, sonra React state'i güncelle
                        // Bu sayede component unmount edilmez
                        if (weekPickerRef.current) {
                          weekPickerRef.current.setAttribute('data-programmatic-change', 'true');
                          weekPickerRef.current.value = newWeek;
                        }
                        
                        // ✅ KRİTİK: React state'i güncelle - requestAnimationFrame ile geciktir
                        requestAnimationFrame(() => {
                          if (onWeekChange) {
                            onWeekChange(newWeek);
                          }
                        });
                        
                        setTimeout(() => {
                          delete (window as any)._navigatingWeek;
                        }, 100);
                        return false; // ✅ KRİTİK: ESKİ SİSTEM GİBİ return false
                      }}
                    >
                      <i className="fa-solid fa-chevron-right"></i>
                    </button>
                  </div>
                </div>
              </div>
              {/* ✅ REACT: Günleri React component olarak render et */}
              <div className="clickable-day-container" id="clickableDayContainer">
                {weekDates.map((weekDate, index) => {
                  const isTodayDay = isToday(weekDate.date);
                  // ✅ DÜZELTME: dateString ile karşılaştır (displayDate değil)
                  const isSelected = selectedDay === weekDate.dateString;
                  
                  // ✅ KRİTİK: Bugünün günü her zaman today class'ına sahip olmalı
                  // Ama başka bir gün seçiliyse bugünün stili görünmemeli
                  const hasOtherSelected = selectedDay && !isSelected;
                  const todayClass = isTodayDay && !hasOtherSelected ? 'today' : '';
                  const selectedClass = isSelected ? 'secili' : '';
                  
                  return (
                    <div
                      key={`${weekDate.dateString}-${index}`}
                      className={`clickable-day ${todayClass} ${selectedClass}`.trim()}
                      onClick={(e) => {
                        // ✅ KRİTİK: Tüm event propagation'ı durdur
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.nativeEvent) {
                          (e.nativeEvent as any).stopImmediatePropagation?.();
                        }
                        try {
                          handleDayClick(weekDate, e);
                        } catch (error) {
                          // Sessizce devam et
                        }
                      }}
                      onMouseDown={(e) => {
                        // ✅ KRİTİK: Mouse down event'ini de engelle
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      <span className="day-number">{weekDate.date.getDate()}</span>
                      <span className="day-name">{getDayShortName(weekDate.dayName)}</span>
                    </div>
                  );
                })}
              </div>
              <button 
                type="button"
                className="buHaftaButton" 
                id="buHaftaButton"
                form=""
                onClick={(e) => {
                  // ✅ KRİTİK: Sadece sayfa yenilenmesini engelle, React event'ini çalıştır
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // ✅ KRİTİK: Native event'leri engelle (legacy JS için)
                  if (e.nativeEvent) {
                    e.nativeEvent.preventDefault();
                    e.nativeEvent.stopPropagation();
                    if (typeof e.nativeEvent.stopImmediatePropagation === 'function') {
                      e.nativeEvent.stopImmediatePropagation();
                    }
                  }
                  
                  // ✅ KRİTİK: Eski JS'in buHaftayaGit fonksiyonunu engelle
                  (window as any)._navigatingWeek = true;
                  
                  // ✅ KRİTİK: URL değişikliğini engelle
                  try {
                    window.history.replaceState(null, '', window.location.href);
                  } catch (err) {
                    // Sessizce devam et
                  }
                  
                  // ✅ DÜZELTME: requestAnimationFrame ile sarmala
                  requestAnimationFrame(() => {
                    handleBuHaftayaGit();
                    setTimeout(() => {
                      delete (window as any)._navigatingWeek;
                    }, 100);
                  });
                  
                  return false;
                }}
              >
                Bu Haftaya Git
              </button>
            </div>
          </div>
          {/* #endregion Sağ Panel --- Takvim Hafta Seçim */}

          {/* #region Sağ Panel --- Haftanın Toplam Siparişleri ve Araç Takip */}
          <div className="panel-wrapper" ref={panelWrapperRef}>
            <div className="toplam-siparis-bilgi-kart" ref={toplamSiparisBilgiKartRef} data-stats-section>
              <div className="baslik">
                Haftanın Organizasyon ve Siparişleri
              </div>
              <div className="siparis-toplamlar-kart">
                <div className="toplam-organizasyon-adet-alan">
                  <div ref={toplamOrganizasyonSayisiRef} className="toplam-organizasyon-sayisi" aria-live="polite">0</div>
                  <span>Toplam Organizasyon</span>
                </div>
                <div className="vr"></div>
                <div className="toplam-siparis-adet-alan">
                  <div className="siparis-adet-kapsayici">
                    <div
                      ref={toplamSiparisSayisiRef}
                      className="toplam-siparis-sayisi"
                      data-tooltip="Teslim Edilmeyi Bekleyen Toplam Sipariş Sayısı"
                      aria-live="polite"
                    >0</div>
                    <i className="icon-org-line"></i>
                  </div>
                  <span>Kalan Sipariş</span>
                  <div className="toplam-teslim-edilen-siparisler-kapsayici">
                    <div className="text">Teslim Edilen:</div>
                    <div ref={toplamTeslimEdilenSayisiRef} className="toplam-teslim-edilen-sayisi" aria-live="polite">0</div>
                  </div>
                </div>
              </div>
            </div>

            {/* #region Dinamik Özellik Alanı (Araç Takip veya Reklam) */}
            {/* React component - Plan'a göre araç takip veya reklam alanı gösterir */}
            <div data-vehicle-section>
              <PrimaryFeatureContainer />
            </div>
            {/* #endregion Dinamik Özellik Alanı */}
          </div>
          {/* #endregion Sağ Panel --- Haftanın Toplam Siparişleri ve Araç Takip */}
        </div>
      </div>
      {/* #endregion Sag Panel */}

      {/* Toggle Button ve Overlay */}
      <button 
        className="sag-panel-toggle-btn" 
        id="sagPanelToggleBtn"
        onClick={handleTogglePanel}
      >
        <i id="toggleIcon" className="fa-solid fa-chevron-left"></i>
      </button>
      <div 
        className="sag-panel-overlay" 
        id="sagPanelOverlay"
        onClick={handleClosePanel}
      ></div>
    </>
  );
};

// ✅ KRİTİK: React.memo ile wrap et - component'in gereksiz yeniden render edilmesini önle
// ✅ DÜZELTME: kartlar, selectedWeek, selectedDay veya kartlarLoading değiştiğinde yeniden render et
export const RightPanel = React.memo(RightPanelComponent, (prevProps, nextProps) => {
  // ✅ KRİTİK: kartlar değiştiğinde yeniden render et (istatistikler için gerekli!)
  const kartlarChanged = prevProps.kartlar !== nextProps.kartlar;
  const weekChanged = prevProps.selectedWeek !== nextProps.selectedWeek;
  const dayChanged = prevProps.selectedDay !== nextProps.selectedDay;
  const loadingChanged = prevProps.kartlarLoading !== nextProps.kartlarLoading;
  
  // ✅ DÜZELTME: Herhangi bir değişiklik varsa yeniden render et
  return !(kartlarChanged || weekChanged || dayChanged || loadingChanged); // false = yeniden render et, true = render etme
});
