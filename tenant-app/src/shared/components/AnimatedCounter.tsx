/**
 * GSAP ile sayı animasyonu – sayfa açılışında 0'dan hedef değere sayar
 */
import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { formatTL } from '../utils/formatUtils';

export interface AnimatedCounterProps {
  value: number;
  format?: 'number' | 'currency';
  suffix?: string;
  duration?: number;
  delay?: number;
  decimals?: number;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  format = 'number',
  suffix = '',
  duration = 1.2,
  delay = 0.2,
  decimals = 0,
  className = '',
}) => {
  const elRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const obj = { v: 0 };
    const fmt = (v: number) => {
      if (format === 'currency') {
        return formatTL(v);
      }
      return v.toLocaleString('tr-TR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }) + (suffix ? ` ${suffix}` : '');
    };

    el.textContent = fmt(0);

    const tl = gsap.timeline({ delay });
    tl.to(obj, {
      v: value,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        if (el) el.textContent = fmt(obj.v);
      },
    });

    return () => {
      tl.kill();
    };
  }, [value, format, suffix, duration, delay, decimals]);

  return <span ref={elRef} className={className} />;
};

export default AnimatedCounter;
