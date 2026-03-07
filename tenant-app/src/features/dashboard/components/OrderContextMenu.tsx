import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
import type { Order, OrganizasyonKart as OrganizasyonKartType } from '../types';

// ✅ KRİTİK: moment CDN'den yükleniyor, window.moment kullan (moment paketi yok, tip tanımı)
declare global {
  interface Window {
    moment?: (value: string | Date) => { format: (fmt: string) => string };
  }
}

interface OrderContextMenuProps {
  order: Order;
  sourceKart: OrganizasyonKartType;
  targetKartlar: OrganizasyonKartType[];
  position: { x: number; y: number };
  onClose: () => void;
  onMove: (orderId: number, targetKartId: number) => Promise<void>;
}

export const OrderContextMenu: React.FC<OrderContextMenuProps> = ({
  order,
  sourceKart,
  targetKartlar,
  position,
  onClose,
  onMove,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLUListElement>(null);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [submenuPosition, setSubmenuPosition] = useState<'right' | 'left'>('right');
  const [submenuVertical, setSubmenuVertical] = useState<'down' | 'up'>('down');

  // Menü dışına tıklama kontrolü
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Menü pozisyonunu ayarla (ESKİ SİSTEM GİBİ - viewport sınırlarını kontrol et)
  useLayoutEffect(() => {
    if (!menuRef.current) return;

    // Menü render edildikten sonra viewport sınırlarını kontrol et
    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = position.x;
    let top = position.y;

    // Sağdan taşıyor mu kontrol et (ESKİ SİSTEM GİBİ)
    if (menuRect.right > viewportWidth - 20) {
      left = position.x - menuRect.width;
      menuRef.current.style.left = `${left}px`;
    }

    // Aşağıdan taşıyor mu kontrol et (ESKİ SİSTEM GİBİ)
    if (menuRect.bottom > viewportHeight - 20) {
      top = position.y - menuRect.height;
      menuRef.current.style.top = `${top}px`;
    }
  }, [position]);

  // Submenu pozisyonunu ayarla
  useEffect(() => {
    if (!submenuRef.current || !submenuOpen) return;

    const submenuRect = submenuRef.current.getBoundingClientRect();
    const menuRect = menuRef.current?.getBoundingClientRect();
    if (!menuRect) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Sağdan taşıyor mu kontrol et
    if (menuRect.right + submenuRect.width > viewportWidth - 20) {
      setSubmenuPosition('left');
    } else {
      setSubmenuPosition('right');
    }

    // Aşağıdan taşıyor mu kontrol et
    if (menuRect.top + submenuRect.height > viewportHeight - 20) {
      setSubmenuVertical('up');
    } else {
      setSubmenuVertical('down');
    }
  }, [submenuOpen]);

  // Hedef kartları filtrele (aynı türdeki kartlar)
  const filteredTargetKartlar = targetKartlar.filter((kart) => {
    // Aynı kart türünde olmalı
    if (kart.kart_tur !== sourceKart.kart_tur) return false;
    // Kaynak kartın kendisi olmamalı
    if (kart.id === sourceKart.id) return false;
    return true;
  });

  // Teslim tarih/saat formatı
  const formatTeslimZaman = (kart: OrganizasyonKartType) => {
    if (!kart.teslim_tarih) return '';
    const tarih = window.moment
      ? window.moment(kart.teslim_tarih).format('DD.MM.YYYY')
      : new Date(kart.teslim_tarih).toLocaleDateString('tr-TR');
    const saat = kart.teslim_saat ? ` ${kart.teslim_saat}` : '';
    return `${tarih}${saat}`;
  };

  // Ayırıcı ikon (tek satır, gap yok)
  const Sep = () => (
    <ChevronRight size={12} className="siparis-tasi-sep" aria-hidden />
  );

  // Kart etiketi: Ana/alt tür bold, tek satır, Lucide ikon ayırıcı
  const getKartLabel = (kart: OrganizasyonKartType): React.ReactNode => {
    const Bold = ({ children }: { children: React.ReactNode }) => (
      <span className="siparis-tasi-label-bold">{children}</span>
    );

    if (kart.kart_tur === 'organizasyon') {
      const altTur = kart.alt_tur ?? kart.kart_tur_display ?? 'Organizasyon';
      const teslimKisi = kart.teslim_kisisi || '';
      const konum = kart.organizasyon_teslimat_konumu || kart.mahalle || '';
      return (
        <span className="siparis-tasi-li-content">
          <Bold>{altTur}</Bold>
          {teslimKisi && <><Sep /><Bold>{teslimKisi}</Bold></>}
          {konum && <><Sep />{konum}</>}
        </span>
      );
    }

    if (kart.kart_tur === 'ozelgun' || kart.kart_tur === 'ozelsiparis') {
      const altTur = kart.alt_tur ?? kart.kart_tur_display ?? (kart.kart_tur === 'ozelgun' ? 'Özel Gün' : 'Özel Sipariş');
      const zaman = formatTeslimZaman(kart);
      return (
        <span className="siparis-tasi-li-content">
          <Bold>{altTur}</Bold>
          {zaman && <><Sep />{zaman}</>}
        </span>
      );
    }

    if (kart.kart_tur === 'aracsusleme') {
      const zaman = formatTeslimZaman(kart);
      return (
        <span className="siparis-tasi-li-content">
          <Bold>Araç Süsleme</Bold>
          {zaman && <><Sep />{zaman}</>}
        </span>
      );
    }

    return <span className="siparis-tasi-li-content">{kart.kart_tur_display ?? 'Organizasyon'}</span>;
  };

  const handleMove = async (targetKartId: number) => {
    try {
      await onMove(Number(order.id), targetKartId);
      onClose();
    } catch (error) {
      console.error('Kart taşıma hatası:', error);
    }
  };

  // ✅ ESKİ SİSTEM GİBİ: Menüyü body içine render et (Portal kullan)
  const menuContent = (
    <div
      ref={menuRef}
      className="siparis-tasi-menu"
      style={{
        position: 'absolute',
        zIndex: 100000,
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="liste-baslik">Sipariş Kartı İşlemleri</div>
      <hr />
      <ul>
        <li
          onMouseEnter={() => setSubmenuOpen(true)}
          onMouseLeave={() => setSubmenuOpen(false)}
        >
          Kartı şuraya taşı
          <i className="fa-solid fa-angle-right"></i>
          {submenuOpen && (
            <ul
              ref={submenuRef}
              className={`siparis-tasi-submenu ${submenuPosition === 'left' ? 'open-left' : ''} ${submenuVertical === 'up' ? 'open-up' : ''}`}
              style={{ display: 'block' }}
            >
              {filteredTargetKartlar.length > 0 ? (
                filteredTargetKartlar.map((kart) => (
                  <li
                    key={kart.id}
                    onClick={() => handleMove(kart.id)}
                  >
                    {getKartLabel(kart)}
                  </li>
                ))
              ) : (
                <li className="uyari-liste-ici">
                  Taşınacak organizasyon bulunamadı
                </li>
              )}
            </ul>
          )}
        </li>
        <div className="not-alan">
          <i className="fa-solid fa-circle-info"></i>
          <div className="not">
            Sipariş kartlarını sadece aynı türdeki organizasyon kartları arasında taşıyabilirsiniz
          </div>
        </div>
      </ul>
    </div>
  );

  // Portal ile body içine render et (eski sistem gibi - body içinde position: absolute)
  return createPortal(menuContent, document.body);
};

