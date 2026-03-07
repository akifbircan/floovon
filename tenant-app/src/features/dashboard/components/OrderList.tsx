import React, { useRef, useEffect } from 'react';
import { OrderCard } from './OrderCard';
import { useStaggerListAnimation } from '../../../shared/hooks/useStaggerListAnimation';
import type { Order, KartTur } from '../types';
import { updateKartSira } from '../api/siparisActions';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateOrganizasyonKartQueries } from '../../../lib/invalidateQueries';

interface OrderListProps {
  orders: Order[];
  organizasyonKartTur?: KartTur;
  onOrderAction?: (action: string, order: Order) => void;
  baglantiliSiparislerMap?: { [musteriUnvan: string]: number };
  onOrderContextMenu?: (event: React.MouseEvent, order: Order) => void;
  organizasyonKartId?: number;
}

/**
 * Grupsuz düz liste (Organizasyon Siparişleri, Araç Süsleme)
 */
export const OrderList: React.FC<OrderListProps> = ({ 
  orders, 
  organizasyonKartTur, 
  onOrderAction, 
  baglantiliSiparislerMap, 
  onOrderContextMenu,
  organizasyonKartId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    itemRefs.current = [];
  }, [orders]);

  const allItemRefs = itemRefs.current.filter(Boolean) as HTMLElement[];
  useStaggerListAnimation(allItemRefs);

  // Drag & Drop: Aynı organizasyon içindeki sipariş kartlarını sıralama
  useEffect(() => {
    if (!organizasyonKartId || !containerRef.current) return;

    const container = containerRef.current;
    let draggedElement: HTMLElement | null = null;
    let draggedWrapper: HTMLElement | null = null;

    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      const siparisKart = target.closest('.siparis-kart') as HTMLElement;
      if (!siparisKart) return;

      draggedElement = siparisKart;
      draggedWrapper = siparisKart.parentElement as HTMLElement;
      siparisKart.classList.add('dragging');

      e.dataTransfer!.effectAllowed = 'move';
      e.dataTransfer!.setData('text/plain', String(siparisKart.getAttribute('data-order-id')));
    };

    const handleDragOver = (e: DragEvent) => {
      if (!draggedElement) return;
      
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer!.dropEffect = 'move';

      const target = e.target as HTMLElement;
      const targetKart = target.closest('.siparis-kart') as HTMLElement;
      
      // Önceki over class'larını temizle
      container.querySelectorAll('.siparis-kart.over').forEach((kart) => {
        if (kart !== targetKart) {
          kart.classList.remove('over');
        }
      });
      
      // Hedef karta over class'ı ekle
      if (targetKart && targetKart !== draggedElement) {
        targetKart.classList.add('over');
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      const targetKart = target.closest('.siparis-kart') as HTMLElement;
      if (targetKart) {
        targetKart.classList.remove('over');
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!draggedElement || !draggedWrapper) return;

      const target = e.target as HTMLElement;
      const targetKart = target.closest('.siparis-kart') as HTMLElement;
      if (!targetKart || targetKart === draggedElement) {
        draggedElement.classList.remove('dragging');
        draggedElement = null;
        draggedWrapper = null;
        return;
      }

      const targetWrapper = targetKart.parentElement as HTMLElement;
      if (!targetWrapper || targetWrapper === draggedWrapper) {
        draggedElement.classList.remove('dragging');
        draggedElement = null;
        draggedWrapper = null;
        return;
      }

      // Wrapper'ları taşı
      const allWrappers = Array.from(container.children) as HTMLElement[];
      const draggedIndex = allWrappers.indexOf(draggedWrapper);
      const targetIndex = allWrappers.indexOf(targetWrapper);

      if (draggedIndex === -1 || targetIndex === -1) {
        draggedElement.classList.remove('dragging');
        draggedElement = null;
        draggedWrapper = null;
        return;
      }

      // DOM'da sıralamayı değiştir
      if (draggedIndex < targetIndex) {
        const nextSibling = targetWrapper.nextSibling;
        draggedWrapper.remove();
        if (nextSibling) {
          container.insertBefore(draggedWrapper, nextSibling);
        } else {
          container.appendChild(draggedWrapper);
        }
      } else {
        draggedWrapper.remove();
        container.insertBefore(draggedWrapper, targetWrapper);
      }

      // Görsel efektleri temizle
      container.querySelectorAll('.siparis-kart').forEach((kart) => {
        kart.classList.remove('dragging', 'over');
      });

      // Backend'e yeni sıralamayı gönder
      try {
        const siparisKartlari = container.querySelectorAll('.siparis-kart');
        const siparisUpdates: Array<{ siparis_id: string | number; kart_sira: number }> = [];

        siparisKartlari.forEach((kart, index) => {
          const orderIdAttr = kart.getAttribute('data-order-id');
          if (!orderIdAttr || orderIdAttr.startsWith('CS-')) return;

          let orderId: string | number = orderIdAttr;
          if (orderIdAttr.startsWith('ORD-')) {
            orderId = orderIdAttr.replace('ORD-', '');
          }
          const orderIdNum = typeof orderId === 'string' ? parseInt(orderId, 10) : orderId;
          if (isNaN(orderIdNum)) return;

          siparisUpdates.push({
            siparis_id: orderIdNum,
            kart_sira: index + 1,
          });
        });

        if (siparisUpdates.length > 0) {
          await updateKartSira(organizasyonKartId, siparisUpdates);
          invalidateOrganizasyonKartQueries(queryClient, organizasyonKartId);
        }
      } catch (error) {
        console.error('❌ Kart sıra güncelleme hatası:', error);
      }

      draggedElement = null;
      draggedWrapper = null;
    };

    const handleDragEnd = () => {
      if (draggedElement) {
        draggedElement.classList.remove('dragging');
      }
      container.querySelectorAll('.siparis-kart').forEach((kart) => {
        kart.classList.remove('over');
      });
      draggedElement = null;
      draggedWrapper = null;
    };

    // Context menu handler
    const handleContextMenu = (e: MouseEvent) => {
      if (draggedElement) {
        e.preventDefault();
        return;
      }
      const target = e.target as HTMLElement;
      const siparisKart = target.closest('.siparis-kart') as HTMLElement;
      if (!siparisKart || !onOrderContextMenu) return;

      const orderId = siparisKart.getAttribute('data-order-id');
      if (!orderId) return;

      e.preventDefault();
      const order = orders.find(o => String(o.id) === orderId);
      if (order) {
        onOrderContextMenu({
          preventDefault: () => e.preventDefault(),
          stopPropagation: () => e.stopPropagation(),
          currentTarget: siparisKart,
          target: e.target,
          pageX: e.pageX,
          pageY: e.pageY,
        } as any, order);
      }
    };

    // Event listener'ları ekle
    const setupListeners = () => {
      const siparisKartlari = container.querySelectorAll('.siparis-kart');
      
      if (siparisKartlari.length === 0) {
        setTimeout(setupListeners, 200);
        return;
      }

      siparisKartlari.forEach((kart) => {
        const kartEl = kart as HTMLElement;
        kartEl.setAttribute('draggable', 'true');
        kartEl.style.userSelect = 'none';
        kartEl.style.webkitUserSelect = 'none';
        kartEl.style.cursor = 'move';

        kartEl.addEventListener('dragstart', handleDragStart);
        kartEl.addEventListener('dragover', handleDragOver, { passive: false });
        kartEl.addEventListener('dragleave', handleDragLeave);
        kartEl.addEventListener('drop', handleDrop, { passive: false });
        kartEl.addEventListener('dragend', handleDragEnd);
      });

      container.addEventListener('dragover', handleDragOver, { passive: false });
      container.addEventListener('drop', handleDrop, { passive: false });
      container.addEventListener('contextmenu', handleContextMenu);
    };

    // Orders değiştiğinde event listener'ları yeniden ekle
    const timeoutId = setTimeout(setupListeners, 200);

    return () => {
      clearTimeout(timeoutId);

      const siparisKartlari = container.querySelectorAll('.siparis-kart');
      siparisKartlari.forEach((kart) => {
        const kartEl = kart as HTMLElement;
        kartEl.removeEventListener('dragstart', handleDragStart);
        kartEl.removeEventListener('dragover', handleDragOver);
        kartEl.removeEventListener('dragleave', handleDragLeave);
        kartEl.removeEventListener('drop', handleDrop);
        kartEl.removeEventListener('dragend', handleDragEnd);
      });

      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('drop', handleDrop);
      container.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [organizasyonKartId, orders, queryClient, onOrderContextMenu]);

  if (orders.length === 0) {
    return (
      <div className="bos-siparis-mesaji">
        <i className="icon-kart-menu-tumu-teslim-edildi"></i>
        <div>Bu kolonda sipariş bulunmamaktadır.</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="order-list-container">
      {orders.map((order, index) => (
        <div
          key={order.id}
          ref={(el) => {
            itemRefs.current[index] = el;
          }}
        >
          <OrderCard 
            order={order} 
            organizasyonKartTur={organizasyonKartTur} 
            onAction={onOrderAction}
            baglantiliSiparisSayisi={
              baglantiliSiparislerMap
                ? (baglantiliSiparislerMap[order.musteriAdi] ?? 
                   baglantiliSiparislerMap[order.musteriUnvani || ''] ?? 
                   0)
                : 0
            }
          />
        </div>
      ))}
    </div>
  );
};
