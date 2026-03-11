import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone, RotateCw, Tablet, Monitor } from 'lucide-react';

/** Desteklenen görünümler: telefon (360–767), tablet benzeri (768–1439), masaüstü (1440+). Bunun dışı ara ekranlarda uyarı. */

/** Telefon yatayda → "dikey kullanın" */
const PHONE_LANDSCAPE_MEDIA = '(orientation: landscape) and (max-height: 500px)';
/** Tablet dikeyde → "yatay kullanın" */
const TABLET_PORTRAIT_MEDIA = '(orientation: portrait) and (min-width: 768px) and (max-width: 1439px)';
/** Ara ekran: çok dar (telefon altı) veya çok kısa → desteklenmeyen boyut uyarısı */
const UNSUPPORTED_WIDTH_MEDIA = '(max-width: 359px)';
const UNSUPPORTED_HEIGHT_MEDIA = '(max-height: 499px)';

export const PhoneLandscapeWarning: React.FC = () => {
  const [phoneLandscape, setPhoneLandscape] = useState(false);
  const [tabletPortrait, setTabletPortrait] = useState(false);
  const [unsupportedWidth, setUnsupportedWidth] = useState(false);
  const [unsupportedHeight, setUnsupportedHeight] = useState(false);

  useEffect(() => {
    const mqPhone = window.matchMedia(PHONE_LANDSCAPE_MEDIA);
    const mqTablet = window.matchMedia(TABLET_PORTRAIT_MEDIA);
    const mqWidth = window.matchMedia(UNSUPPORTED_WIDTH_MEDIA);
    const mqHeight = window.matchMedia(UNSUPPORTED_HEIGHT_MEDIA);
    const handler = () => {
      setPhoneLandscape(mqPhone.matches);
      setTabletPortrait(mqTablet.matches);
      setUnsupportedWidth(mqWidth.matches);
      setUnsupportedHeight(mqHeight.matches);
    };
    handler();
    mqPhone.addEventListener('change', handler);
    mqTablet.addEventListener('change', handler);
    mqWidth.addEventListener('change', handler);
    mqHeight.addEventListener('change', handler);
    return () => {
      mqPhone.removeEventListener('change', handler);
      mqTablet.removeEventListener('change', handler);
      mqWidth.removeEventListener('change', handler);
      mqHeight.removeEventListener('change', handler);
    };
  }, []);

  const unsupportedViewport = unsupportedWidth || unsupportedHeight;
  const show = unsupportedViewport || phoneLandscape || tabletPortrait;
  if (!show) return null;

  const isTabletPortrait = tabletPortrait && !phoneLandscape && !unsupportedViewport;

  if (unsupportedViewport) {
    return createPortal(
      <div className="phone-landscape-warning" role="alert" aria-live="polite">
        <div className="phone-landscape-warning-inner">
          <div className="phone-landscape-warning-icon" aria-hidden>
            <Monitor className="phone-landscape-warning-phone" size={80} strokeWidth={2} />
          </div>
          <p className="phone-landscape-warning-title">Desteklenmeyen ekran boyutu</p>
          <p className="phone-landscape-warning-desc">
            Bu dashboard yalnızca telefon (dikey), tablet (yatay), notebook ve masaüstü görünümlerinde desteklenir.
            Lütfen pencerenizi büyütün veya desteklenen bir cihaz kullanın.
          </p>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="phone-landscape-warning" role="alert" aria-live="polite">
      <div className="phone-landscape-warning-inner">
        <div className="phone-landscape-warning-icon" aria-hidden>
          {isTabletPortrait ? (
            <Tablet className="phone-landscape-warning-phone tablet-landscape-icon" size={80} strokeWidth={2} />
          ) : (
            <Smartphone className="phone-landscape-warning-phone" size={80} strokeWidth={2} />
          )}
          <RotateCw className="phone-landscape-warning-rotate" size={28} strokeWidth={2.5} />
        </div>
        <p className="phone-landscape-warning-title">
          {isTabletPortrait ? 'Lütfen cihazı yatay konumda kullanın' : 'Lütfen cihazı dikey konumda kullanın'}
        </p>
        <p className="phone-landscape-warning-desc">
          {isTabletPortrait
            ? 'Bu uygulama tabletinizi yatay (landscape) tutarak kullanılmak üzere tasarlanmıştır.'
            : 'Bu uygulama telefonunuzu dikey (portre) tutarak kullanılmak üzere tasarlanmıştır.'}
        </p>
      </div>
    </div>,
    document.body
  );
};
