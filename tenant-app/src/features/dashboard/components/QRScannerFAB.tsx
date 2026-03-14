import React, { useState, useRef, useEffect } from 'react';
import { GripVertical, ScanBarcode, Flame } from 'lucide-react';

interface QRScannerFABProps {
  onOpen: () => void;
  /** Sıcak Satış Ekle menü öğesine tıklanınca (mobil index) */
  onOpenSicakSatis?: () => void;
  /** Index sayfasında navbar üstüne hizalamak için qr-fab-index */
  className?: string;
}

/**
 * Hızlı İşlemler FAB – Mobilde tıklanınca menü açar: Sipariş Künyesi Okut, Sıcak Satış Ekle
 */
export const QRScannerFAB: React.FC<QRScannerFABProps> = ({
  onOpen,
  onOpenSicakSatis,
  className,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current?.contains(target) ||
        btnRef.current?.contains(target)
      )
        return;
      setMenuOpen(false);
      btnRef.current?.blur();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Menü kapandığında buton focus'tan çıksın, border (focus ring) kalmasın
  const prevMenuOpen = useRef(false);
  useEffect(() => {
    if (prevMenuOpen.current && !menuOpen) {
      btnRef.current?.blur();
    }
    prevMenuOpen.current = menuOpen;
  }, [menuOpen]);

  const handleSiparisKunyesi = () => {
    setMenuOpen(false);
    btnRef.current?.blur();
    onOpen();
  };

  const handleSicakSatis = () => {
    setMenuOpen(false);
    btnRef.current?.blur();
    onOpenSicakSatis?.();
  };

  return (
    <div className="hizli-islemler-fab-wrapper">
      {menuOpen && (
        <div
          ref={menuRef}
          className="hizli-islemler-menu"
          role="menu"
          aria-label="Hızlı işlemler"
        >
          <button
            type="button"
            className="hizli-islemler-menu-item"
            role="menuitem"
            onClick={handleSiparisKunyesi}
          >
            <span className="hizli-islemler-menu-icon">
              <ScanBarcode size={20} strokeWidth={2} />
            </span>
            <span>Sipariş Künyesi Okut</span>
          </button>
          {typeof onOpenSicakSatis === 'function' && (
            <button
              type="button"
              className="hizli-islemler-menu-item"
              role="menuitem"
              onClick={handleSicakSatis}
            >
              <span className="hizli-islemler-menu-icon">
                <Flame size={20} strokeWidth={2} />
              </span>
              <span>Sıcak Satış Ekle</span>
            </button>
          )}
        </div>
      )}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className={`buton-hizli-islemler fixed bottom-6 right-6 md:hidden w-14 h-14 rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center justify-center transition-all hover:scale-110 ${menuOpen ? 'hizli-islemler-fab-open z-[10002]' : 'hizli-islemler-fab-closed z-50'} ${className ?? ''}`}
        aria-label="Hızlı işlemler"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <GripVertical className="w-6 h-6" strokeWidth={2} />
      </button>
    </div>
  );
};
