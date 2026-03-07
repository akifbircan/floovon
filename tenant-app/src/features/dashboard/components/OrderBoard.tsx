import React, { useRef, useEffect } from 'react';
import { OrganizasyonKart } from './OrganizasyonKart';
import { useDashboardIntroAnimation } from '../../../shared/hooks/useDashboardIntroAnimation';
import type { OrganizasyonKart as OrganizasyonKartType, Order } from '../types';

interface OrderBoardProps {
  kartlar: OrganizasyonKartType[];
  onOrderAction?: (action: string, order: Order) => void;
  onKartAction?: (action: string, kartId: number) => void;
  baglantiliSiparislerMap?: Record<string, number>;
  onOrderContextMenu?: (event: React.MouseEvent, order: Order) => void;
  onOpenWhatsAppQRForShare?: (kart: OrganizasyonKartType, siparisler: Order[]) => void;
}

/**
 * Organizasyon kartları board'u
 * Her kart kendi başına bir .item div'i içinde gösterilir
 * Tarih bazlı kolonlar YOK - her kart kendi tarihine sahip
 */
export const OrderBoard: React.FC<OrderBoardProps> = ({ kartlar, onOrderAction, onKartAction, baglantiliSiparislerMap, onOrderContextMenu, onOpenWhatsAppQRForShare }) => {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const itemsContainerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    isDown: boolean;
    startX: number;
    scrollLeft: number;
  }>({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
  });

  // Animasyon için tüm item ref'lerini topla
  const allItemRefs = itemRefs.current.filter(Boolean) as HTMLDivElement[];
  useDashboardIntroAnimation(
    allItemRefs.map((ref) => ({ current: ref })) as React.RefObject<HTMLElement>[]
  );

  // Kartlar render edildikten sonra recheckWeekMatch'i çağır (debounce ile)
  useEffect(() => {
    if (kartlar && kartlar.length > 0) {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let rafId1: number | null = null;
      let rafId2: number | null = null;
      
      // React'in render'ının tamamlanmasını beklemek için requestAnimationFrame kullan
      // Önce bir frame bekle, sonra DOM'un güncellenmesi için bir gecikme daha ekle
      rafId1 = requestAnimationFrame(() => {
        rafId2 = requestAnimationFrame(() => {
          timeoutId = setTimeout(() => {
            // ✅ REACT: İstatistikler artık useDashboardStatistics hook'u ile hesaplanıyor (RightPanel'de)
            // Bu eski JS çağrıları kaldırıldı - artık gerekli değil
          }, 500); // React render'ı için daha uzun gecikme
        });
      });
      
      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (rafId1 !== null) cancelAnimationFrame(rafId1);
        if (rafId2 !== null) cancelAnimationFrame(rafId2);
      };
    }
  }, [kartlar]);

  // Drag-to-scroll özelliği
  useEffect(() => {
    const container = itemsContainerRef.current;
    if (!container) return;

    const handleMouseDown = (e: MouseEvent) => {
      // Sipariş kartı, buton veya link üzerinde değilse drag-to-scroll aktif et
      const target = e.target as HTMLElement;
      if (
        target.closest('.siparis-kart') ||
        target.closest('button') ||
        target.closest('a') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('.ana-kart .kart-menu') ||
        target.closest('.ana-kart .siparis-kart-filtrele-buton')
      ) {
        return;
      }

      dragStateRef.current.isDown = true;
      dragStateRef.current.startX = e.pageX - container.offsetLeft;
      dragStateRef.current.scrollLeft = container.scrollLeft;
      container.style.cursor = 'grabbing';
      container.classList.add('active');
      e.preventDefault();
    };

    const handleMouseLeave = () => {
      dragStateRef.current.isDown = false;
      if (container) {
        container.style.cursor = 'grab';
        container.classList.remove('active');
      }
    };

    const handleMouseUp = () => {
      dragStateRef.current.isDown = false;
      if (container) {
        container.style.cursor = 'grab';
        container.classList.remove('active');
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current.isDown) return;
      e.preventDefault();
      e.stopPropagation();
      const x = e.pageX - container.offsetLeft;
      const walkX = (x - dragStateRef.current.startX) * 2; // Scroll hızı (2x)
      container.scrollLeft = dragStateRef.current.scrollLeft - walkX;
    };

    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mousemove', handleMouseMove);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // ✅ KRİTİK: Kartlar yoksa sadece items container'ı render et, empty-message DashboardPage'de gösterilecek
  if (!kartlar || kartlar.length === 0) {
    return (
      <div className="items" id="itemsContainer" ref={itemsContainerRef}>
        {/* Empty message DashboardPage.tsx'te gösteriliyor */}
      </div>
    );
  }

  return (
    <div className="items" id="itemsContainer" ref={itemsContainerRef}>
      {kartlar.map((kart, index) => (
        <div
          key={kart.id}
          ref={(el) => {
            itemRefs.current[index] = el;
          }}
          className="item"
          data-organizasyon-id={kart.id}
        >
          <OrganizasyonKart
            organizasyonKart={kart}
            onOrderAction={onOrderAction}
            onKartAction={onKartAction}
            baglantiliSiparislerMap={baglantiliSiparislerMap}
            onOrderContextMenu={onOrderContextMenu}
            onOpenWhatsAppQRForShare={onOpenWhatsAppQRForShare}
          />
        </div>
      ))}
    </div>
  );
};

