/**
 * @deprecated Bu hook artık kullanılmıyor. PrimaryFeatureContainer component'ini kullanın.
 * Bu dosya geriye dönük uyumluluk için bırakıldı.
 */
import { useRef } from 'react';

/**
 * Primary Feature Container Hook
 * @deprecated PrimaryFeatureContainer component'ini kullanın
 */
export function usePrimaryFeature() {
  const containerRef = useRef<HTMLDivElement>(null);
  return containerRef;
}

