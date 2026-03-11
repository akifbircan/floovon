import { useEffect, useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';

const OVERLAY_DURATION = 0.2;
const PANEL_DURATION = 0.35;
const PANEL_EASE = 'back.out(1.2)' as const;
const OVERLAY_EASE = 'power2.out';
const MOBILE_BREAKPOINT = 767;

/** Sağdan kayan panel: tek yönde akıcı, overshoot yok */
const PANEL_RIGHT_DURATION = 0.42;
const PANEL_RIGHT_EASE = 'power2.out' as const;
/** Tab içeriği: aşağıdan yukarı hafif + fade */
const CONTENT_Y_OFFSET = 14;
const CONTENT_DURATION = 0.36;
const CONTENT_DELAY = 0.1;
const CONTENT_EASE = 'power2.out' as const;

export type ModalAnimationVariant = 'center' | 'right';

export interface UseModalOpenAnimationOptions {
  onOpenComplete?: () => void;
  /** Masaüstünde: 'center' = ortadan scale, 'right' = sağdan kayarak giriş (yeni kart formu) */
  variant?: ModalAnimationVariant;
  /** variant='right' iken: tab içeriği ref'i – aşağıdan yukarı hafif + fade */
  contentRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Tüm modallarda açılış animasyonu:
 * - Masaüstü (viewport > 767px): GSAP ile overlay + panel animasyonu (variant'a göre)
 * - Mobil (≤767px): GSAP çalışmaz; CSS animasyonu (modal-styles.css @media) kullanılır
 * panelRef verilmezse overlayRef.current içinde [data-modal-content] aranır.
 */
export const useModalOpenAnimation = (
  isOpen: boolean,
  overlayRef: React.RefObject<HTMLElement | null>,
  panelRef?: React.RefObject<HTMLElement | null> | null,
  options?: UseModalOpenAnimationOptions
) => {
  const hasAnimated = useRef(false);
  const variant = options?.variant ?? 'center';

  useLayoutEffect(() => {
    if (!isOpen) return;
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT;
    if (isMobile) return;
    const overlay = overlayRef.current;
    const panel =
      panelRef?.current ??
      (overlayRef.current?.querySelector?.('[data-modal-content]') as HTMLElement) ??
      overlayRef.current;
    if (overlay) gsap.set(overlay, { opacity: 0 });
    if (panel) {
      if (variant === 'right') {
        gsap.set(panel, { xPercent: 100, opacity: 1 });
      } else {
        gsap.set(panel, { opacity: 0, scale: 0.99 });
      }
    }
    const content = options?.contentRef?.current;
    if (variant === 'right' && content) {
      gsap.set(content, { y: CONTENT_Y_OFFSET, opacity: 0 });
    }
  }, [isOpen, overlayRef, panelRef, variant, options?.contentRef]);

  useEffect(() => {
    if (!isOpen) {
      hasAnimated.current = false;
      return;
    }

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT;
    if (isMobile) {
      options?.onOpenComplete?.();
      return;
    }

    const overlay = overlayRef.current;
    const panel =
      panelRef?.current ??
      (overlay?.querySelector?.('[data-modal-content]') as HTMLElement) ??
      overlay;
    if (!overlay || !panel || hasAnimated.current) return;
    hasAnimated.current = true;

    if (variant === 'right') {
      const content = options?.contentRef?.current;
      const tl = gsap.timeline({ overwrite: true });
      tl.to(overlay, { opacity: 1, duration: OVERLAY_DURATION, ease: OVERLAY_EASE })
        .to(
          panel,
          {
            xPercent: 0,
            duration: PANEL_RIGHT_DURATION,
            ease: PANEL_RIGHT_EASE,
            onComplete: options?.onOpenComplete,
          },
          0.05
        );
      if (content) {
        tl.to(
          content,
          { y: 0, opacity: 1, duration: CONTENT_DURATION, ease: CONTENT_EASE },
          CONTENT_DELAY
        );
      }
      return () => {
        gsap.killTweensOf([overlay, panel, ...(content ? [content] : [])]);
        gsap.set([overlay, panel, ...(content ? [content] : [])], { clearProps: 'all' });
      };
    }

    const tl = gsap.timeline({ overwrite: true });
    tl.to(overlay, { opacity: 1, duration: OVERLAY_DURATION, ease: OVERLAY_EASE })
      .to(
        panel,
        {
          opacity: 1,
          scale: 1,
          duration: PANEL_DURATION,
          ease: PANEL_EASE,
          onComplete: options?.onOpenComplete,
        },
        0.05
      );

    return () => {
      gsap.killTweensOf([overlay, panel]);
      gsap.set([overlay, panel], { clearProps: 'all' });
    };
  }, [isOpen, overlayRef, panelRef, options?.onOpenComplete, variant]);
};
