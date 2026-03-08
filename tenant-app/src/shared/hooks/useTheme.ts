import { useState, useEffect } from 'react';

const THEME_CHANGED_EVENT = 'floovon-theme-changed';

/** Tenant panel tema anahtarı (console panelinden bağımsız) */
export const TENANT_PANEL_THEME_KEY = 'tenant_panel_theme';

/** Tema değiştiğinde bileşenlerin yeniden render olması için event dispatch eder */
export function dispatchThemeChanged(): void {
  window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT));
}

function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false;
  return document.body.classList.contains('dark-mode') || document.documentElement.classList.contains('dark-mode');
}

/** Login / Şifremi Unuttum gibi Header olmayan sayfalarda: localStorage'daki temayı body/html'e uygular */
export function applySavedThemeToDocument(): void {
  if (typeof document === 'undefined' || typeof localStorage === 'undefined') return;
  let saved = localStorage.getItem(TENANT_PANEL_THEME_KEY);
  if (saved == null) {
    const legacy = localStorage.getItem('theme');
    if (legacy != null) {
      localStorage.setItem(TENANT_PANEL_THEME_KEY, legacy);
      saved = legacy;
    }
  }
  const isDark = saved === 'dark';
  if (isDark) {
    document.body.classList.add('dark-mode');
    document.documentElement.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
    document.documentElement.classList.remove('dark-mode');
  }
}

/** Mevcut tema (dark/light) ve tema değiştiğinde re-render tetikler */
export function useTheme(): boolean {
  const [isDark, setIsDark] = useState(() => isDarkMode());

  useEffect(() => {
    const update = () => setIsDark(isDarkMode());

    /** Başka sekmede tema değiştiğinde bu sekmede de body/html class ve buton ikonlarını güncelle */
    const applyThemeFromStorage = (newValue: string | null) => {
      const isDark = newValue === 'dark';
      if (isDark) {
        document.body.classList.add('dark-mode');
        document.documentElement.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
        document.documentElement.classList.remove('dark-mode');
      }
      document.querySelectorAll('.btn-theme-mode').forEach((btn: Element) => {
        const btnIcon = (btn as HTMLElement).querySelector('i');
        if (btnIcon) {
          btnIcon.className = '';
          btnIcon.classList.add(isDark ? 'fa-regular' : 'fa-solid');
          btnIcon.classList.add(isDark ? 'fa-sun' : 'fa-moon');
        }
      });
      dispatchThemeChanged();
      update();
    };

    window.addEventListener(THEME_CHANGED_EVENT, update);
    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key === TENANT_PANEL_THEME_KEY) applyThemeFromStorage(e.newValue);
    });

    return () => {
      window.removeEventListener(THEME_CHANGED_EVENT, update);
    };
  }, []);

  return isDark;
}
