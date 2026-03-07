import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

/**
 * Modal açılış animasyonu
 */
export const useModalOpenAnimation = (
  isOpen: boolean,
  modalRef: React.RefObject<HTMLElement>,
  backdropRef?: React.RefObject<HTMLElement>
) => {
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      hasAnimated.current = false;
      return;
    }

    if (!modalRef.current) return;
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    // Backdrop fade in (light, short)
    const backdrop = backdropRef?.current || modalRef.current.querySelector('[data-modal-backdrop]') as HTMLElement;
    if (backdrop) {
      gsap.fromTo(
        backdrop,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: 'power2.out' }
      );
    }

    // Modal content scale + fade (light, short, fluid - 0.3-0.5s)
    const content = modalRef.current.querySelector('[data-modal-content]') as HTMLElement || modalRef.current;
    if (content) {
      gsap.fromTo(
        content,
        { 
          opacity: 0, 
          scale: 0.96, // Light scale
          y: 8 // Light translate
        },
        { 
          opacity: 1, 
          scale: 1, 
          y: 0,
          duration: 0.35, // Light, short, fluid (0.3-0.5s)
          ease: 'power2.out' 
        }
      );
    }
  }, [isOpen, modalRef, backdropRef]);
};

