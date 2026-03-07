import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

/**
 * Liste elemanları için stagger animasyonu (ikinci stagger)
 * UI-map gereksinimleri:
 * - İkinci stagger (kolonlar sonrası)
 * - Light scale/translate
 * - 0.3-0.5s süre
 * - Sadece ilk mount'ta çalışır
 */
export const useStaggerListAnimation = (
  items: HTMLElement[]
) => {
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    if (items.length === 0) return;

    // Tüm item'ların hazır olup olmadığını kontrol et
    const allReady = items.every((item) => item && item.offsetParent !== null);
    if (!allReady) {
      // Retry after a short delay
      const timeout = setTimeout(() => {
        if (!hasAnimated.current && items.length > 0) {
          const allReadyRetry = items.every((item) => item && item.offsetParent !== null);
          if (allReadyRetry) {
            hasAnimated.current = true;
            animateItems();
          }
        }
      }, 150);
      return () => clearTimeout(timeout);
    }

    hasAnimated.current = true;
    animateItems();

    function animateItems() {
      // İkinci stagger: Light scale/translate animasyonu
      gsap.fromTo(
        items,
        {
          opacity: 0,
          scale: 0.97, // Light scale
          y: 8, // Light translate
        },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.35, // 0.3-0.5s arası
          stagger: 0.04, // İkinci stagger delay (daha kısa)
          ease: 'power2.out',
        }
      );
    }
  }, [items]);
};

