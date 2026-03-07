import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

/**
 * Dashboard kolonları için giriş animasyonu
 * UI-map gereksinimleri:
 * - Fade + küçük translate + stagger (0.3-0.5s süre)
 * - Sadece ilk mount'ta çalışır
 */
export const useDashboardIntroAnimation = (
  columnRefs: React.RefObject<HTMLElement>[]
) => {
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    if (columnRefs.length === 0) return;

    // Tüm kolonların ref'lerinin hazır olup olmadığını kontrol et
    const allReady = columnRefs.every((ref) => ref.current);
    if (!allReady) {
      // Retry after a short delay
      const timeout = setTimeout(() => {
        if (!hasAnimated.current) {
          const allReadyRetry = columnRefs.every((ref) => ref.current);
          if (allReadyRetry) {
            hasAnimated.current = true;
            animateColumns();
          }
        }
      }, 100);
      return () => clearTimeout(timeout);
    }

    hasAnimated.current = true;
    animateColumns();

    function animateColumns() {
      const columns = columnRefs.map((ref) => ref.current).filter(Boolean) as HTMLElement[];
      if (columns.length === 0) return;

      // Fade + küçük translate + stagger animasyonu (0.3-0.5s süre)
      gsap.fromTo(
        columns,
        {
          opacity: 0,
          y: 15, // Küçük translate
          scale: 0.98, // Hafif scale
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.4, // 0.3-0.5s arası
          stagger: 0.08, // Stagger delay
          ease: 'power2.out',
        }
      );
    }
  }, [columnRefs]);
};

