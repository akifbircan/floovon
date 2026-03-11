import { useEffect, useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';

const OVERLAY_DURATION = 0.2;
const PANEL_DURATION = 0.35;
const PANEL_EASE = 'back.out(1.2)' as const;
const OVERLAY_EASE = 'power2.out';

/**
 * Tüm modallarda tek tip açılış animasyonu:
 * - Overlay: opacity 0 → 1
 * - Panel: scale 0.99 → 1 (back.out)
 * panelRef verilmezse overlayRef.current içinde [data-modal-content] aranır.
 */
export const useModalOpenAnimation = (
  isOpen: boolean,
  overlayRef: React.RefObject<HTMLElement | null>,
  panelRef?: React.RefObject<HTMLElement | null> | null,
  options?: { onOpenComplete?: () => void }
) => {
  const hasAnimated = useRef(false);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const overlay = overlayRef.current;
    const panel =
      panelRef?.current ??
      (overlayRef.current?.querySelector?.('[data-modal-content]') as HTMLElement) ??
      overlayRef.current;
    if (overlay) gsap.set(overlay, { opacity: 0 });
    if (panel) gsap.set(panel, { opacity: 0, scale: 0.99 });
  }, [isOpen, overlayRef, panelRef]);

  useEffect(() => {
    if (!isOpen) {
      hasAnimated.current = false;
      return;
    }

    const overlay = overlayRef.current;
    const panel =
      panelRef?.current ??
      (overlay?.querySelector?.('[data-modal-content]') as HTMLElement) ??
      overlay;
    if (!overlay || !panel || hasAnimated.current) return;
    hasAnimated.current = true;
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
  }, [isOpen, overlayRef, panelRef, options?.onOpenComplete]);
};
