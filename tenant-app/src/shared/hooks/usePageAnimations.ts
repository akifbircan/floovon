import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

/**
 * Sayfa animasyonları hook'u
 * Örnek sayfadaki GSAP yapısına göre düzenlendi
 * İçerik, kartlar için animasyonlar
 */
export const usePageAnimations = (
  pageType: 'dashboard' | 'customers' | 'partners' | 'campaigns' | 'reports' | 'settings' | 'profile' | 'orders' | 'forgot-password' | 'other' = 'other'
) => {
  const hasAnimated = useRef(false);
  const animationRunningRef = useRef(false);

  useEffect(() => {
    // ✅ KRİTİK: Çift çalışmayı önle (React Strict Mode ve sayfa geçişleri için)
    if (hasAnimated.current || animationRunningRef.current) return;
    
    // Global flag ile çift çalışmayı önle
    const globalKey = `__gsap_animation_${pageType}`;
    if ((window as any)[globalKey]) return;
    (window as any)[globalKey] = true;

    // DOM hazır olana kadar bekle
    const initAnimations = () => {
      // GSAP kontrolü
      if (typeof gsap === 'undefined') {
        requestAnimationFrame(initAnimations);
        return;
      }
      
      // Animasyon başladığını işaretle
      animationRunningRef.current = true;

      // Elementlerin hazır olmasını bekle (daha esnek selector'lar)
      const mainContent = document.querySelector('[data-main-content]') || document.querySelector('main') || document.querySelector('.main-content');

      // En az bir element bulunmalı, ama hepsi olmasa da devam et
      if (!mainContent) {
        requestAnimationFrame(initAnimations);
        return;
      }

      hasAnimated.current = true;

      // Dashboard özel animasyonlar
      if (pageType === 'dashboard') {
        // Dashboard tabs
        const tabs = document.querySelectorAll('[data-dashboard-tab]');
        if (tabs.length > 0) {
          gsap.fromTo(
            tabs,
            { y: -10, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out', stagger: 0.04, delay: 0.35 }
          );
        }

        // Kanban columns stagger - örnek sayfadaki gibi
        const columns = document.querySelectorAll('[data-kanban-column]');
        if (columns.length > 0) {
          gsap.fromTo(
            columns,
            { y: 30, opacity: 0, scale: 0.97 },
            { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out', stagger: 0.08, delay: 0.4 }
          );

          // Siparis cards stagger (within each column) - ikinci stagger, örnek sayfadaki gibi
          setTimeout(() => {
            columns.forEach((column) => {
              const cards = column.querySelectorAll('[data-order-card]');
              if (cards.length > 0) {
                gsap.fromTo(
                  cards,
                  { y: 15, opacity: 0 },
                  { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out', stagger: 0.05, delay: 0.2 }
                );
              }
            });
          }, 600); // İlk kolon animasyonundan sonra
        }

        // Right panel sections - SAĞDAN SOLA animasyon (x: 100 -> x: 0)
        // ✅ KRİTİK: Sayfa yenilendiğinde animasyon çalışmalı
        const calendarSection = document.querySelector('[data-calendar-section]');
        if (calendarSection) {
          // ✅ KRİTİK: SAĞDAN SOLA animasyon (x: 100 -> x: 0)
          gsap.set(calendarSection, { 
            x: 100, 
            y: 0, 
            opacity: 0
          });
          gsap.to(calendarSection, {
            x: 0,
            y: 0,
            opacity: 1,
            duration: 0.6,
            ease: 'power3.out',
            delay: 0.5,
            force3D: true
          });
        }

        const statsSection = document.querySelector('[data-stats-section]');
        if (statsSection) {
          gsap.set(statsSection, { 
            x: 100, 
            y: 0, 
            opacity: 0
          });
          gsap.to(statsSection, {
            x: 0,
            y: 0,
            opacity: 1,
            duration: 0.6,
            ease: 'power3.out',
            delay: 0.6,
            force3D: true,
            onComplete: () => {
              window.dispatchEvent(new CustomEvent('dashboard-stats-section-visible'));
            }
          });
        }

        const vehicleSection = document.querySelector('[data-vehicle-section]');
        if (vehicleSection) {
          gsap.set(vehicleSection, { 
            x: 100, 
            y: 0, 
            opacity: 0, 
            visibility: 'visible'
          });
          gsap.to(vehicleSection, {
            x: 0,
            y: 0,
            opacity: 1,
            duration: 0.6,
            ease: 'power3.out',
            delay: 0.7,
            force3D: true
          });
        }
        
        // ✅ KRİTİK: sag-panel içindeki diğer elementler için animasyon (SAĞDAN SOLA)
        const sagPanel = document.querySelector('.sag-panel');
        if (sagPanel) {
          // sag-panel içindeki tüm direkt çocuklar için animasyon
          const panelChildren = sagPanel.querySelectorAll('.sag-panel-icerik > *:not([data-calendar-section]):not([data-stats-section]):not([data-vehicle-section])');
          if (panelChildren.length > 0) {
            gsap.fromTo(
              panelChildren,
              { x: 50, opacity: 0 },
              { x: 0, opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.1, delay: 0.8 }
            );
          }
        }
      }

      // page-panel-sag-inner: sağdan sola GSAP animasyonu (Müşteriler, Partner, Kampanyalar)
      const panelSagInner = document.querySelector('.page-panel-sag-inner');
      if (panelSagInner) {
        gsap.set(panelSagInner, { x: 80, opacity: 0 });
        gsap.to(panelSagInner, {
          x: 0,
          opacity: 1,
          duration: 0.5,
          ease: 'power3.out',
          delay: 0.25,
          force3D: true,
        });
      }

      // Raporlar sayfası: reports-panel-inner ve içerik animasyonu
      if (pageType === 'reports') {
        const reportsPanel = document.querySelector('.reports-panel-inner');
        if (reportsPanel) {
          gsap.set(reportsPanel, { opacity: 0, y: 22 });
          gsap.to(reportsPanel, {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: 'power3.out',
            delay: 0.12,
            force3D: true,
          });
        }
        const reportsContent = document.querySelector('.reports-content');
        if (reportsContent) {
          const sections = reportsContent.querySelectorAll('.reports-filtreler, .istatistikler, .reports-chart-box, .reports-table-wrapper');
          if (sections.length > 0) {
            gsap.fromTo(
              sections,
              { opacity: 0, y: 14 },
              { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', stagger: 0.05, delay: 0.3 }
            );
          }
        }
      }

      // Ayarlar sayfası: reports gibi panel giriş animasyonu
      if (pageType === 'settings') {
        const settingsPanel = document.querySelector('.ayarlar-page-inner');
        if (settingsPanel) {
          gsap.set(settingsPanel, { opacity: 0, y: 22 });
          gsap.to(settingsPanel, {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: 'power3.out',
            delay: 0.12,
            force3D: true,
          });
        }
      }

      // Ana içerik animasyonu (tüm sayfalar – diğer sayfalarla aynı)
      if (mainContent) {
        const contentChildren = mainContent.querySelectorAll(':scope > *:not([data-sidebar]):not([data-header])');
        if (contentChildren.length > 0) {
          gsap.fromTo(
            contentChildren,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', stagger: 0.05, delay: 0.2 }
          );
        }
      }

      // Tablo satırları animasyonu (genel)
      const tableRows = document.querySelectorAll('table tbody tr');
      if (tableRows.length > 0) {
        gsap.fromTo(
          tableRows,
          { opacity: 0, x: -20 },
          { opacity: 1, x: 0, duration: 0.25, ease: 'power2.out', stagger: 0.02, delay: 0.3 }
        );
      }

      // Kartlar animasyonu (genel)
      const cards = document.querySelectorAll('[data-card]:not([data-order-card])');
      if (cards.length > 0) {
        gsap.fromTo(
          cards,
          { opacity: 0, scale: 0.95, y: 30 },
          { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'back.out(1.2)', stagger: 0.03, delay: 0.4 }
        );
      }
    };

    // Sayfa geçişinde hemen çalıştır – requestAnimationFrame ile bir sonraki paint'te
    const rafId = requestAnimationFrame(() => {
      initAnimations();
    });

    return () => {
      cancelAnimationFrame(rafId);
      // Cleanup - global flag'i temizle
      const globalKey = `__gsap_animation_${pageType}`;
      delete (window as any)[globalKey];
      animationRunningRef.current = false;
    };
  }, [pageType]);
};

