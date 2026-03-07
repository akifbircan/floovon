import React, { useMemo, useRef, useEffect, useState, useLayoutEffect } from 'react';
import { OrderCard } from './OrderCard';
import { useStaggerListAnimation } from '../../../shared/hooks/useStaggerListAnimation';
import type { Order, KartTur } from '../types';
import { useQueryClient } from '@tanstack/react-query';

interface GroupedOrderListProps {
  orders: Order[];
  organizasyonKartTur?: KartTur;
  onOrderAction?: (action: string, order: Order) => void;
  baglantiliSiparislerMap?: { [musteriUnvan: string]: number };
  onOrderContextMenu?: (event: React.MouseEvent, order: Order) => void;
  organizasyonKartId?: number;
}

/**
 * Mahalle bazlı gruplu liste (Özel Gün, Özel Sipariş)
 */
export const GroupedOrderList: React.FC<GroupedOrderListProps> = ({
  orders,
  organizasyonKartTur,
  onOrderAction,
  baglantiliSiparislerMap,
  onOrderContextMenu,
  organizasyonKartId,
}) => {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    itemRefs.current = [];
  }, [orders]);

  // Mahalle bazlı grupla
  const grouped = useMemo(() => {
    const groups = new Map<string, Order[]>();

    orders.forEach((order) => {
      const mahalle = order.mahalle || 'Belirtilmemiş';
      if (!groups.has(mahalle)) {
        groups.set(mahalle, []);
      }
      groups.get(mahalle)!.push(order);
    });

    // Her grup içinde teslim saatine göre sırala
    groups.forEach((groupOrders) => {
      groupOrders.sort((a, b) => {
        const timeA = a.teslimSaati || '';
        const timeB = b.teslimSaati || '';
        return timeA.localeCompare(timeB);
      });
    });

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [orders]);

  // Başlangıçta tüm grupları kapalı başlat
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set());
  const initializedGroupsRef = useRef<Set<string>>(new Set());

  // İlk render'da ve yeni gruplar eklendiğinde onları kapalı başlat - useLayoutEffect ile DOM'a render edilmeden önce çalışır
  useLayoutEffect(() => {
    if (grouped.length > 0) {
      const allMahalles = new Set(grouped.map(([mahalle]) => mahalle));
      // Yeni eklenen grupları kapalı başlat, mevcut grupların durumunu koru
      setClosedGroups((prev) => {
        const newSet = new Set(prev);
        // Yeni eklenen grupları kapalı başlat
        allMahalles.forEach((mahalle) => {
          if (!initializedGroupsRef.current.has(mahalle)) {
            newSet.add(mahalle);
          }
        });
        // Artık mevcut olmayan grupları kaldır
        prev.forEach((mahalle) => {
          if (!allMahalles.has(mahalle)) {
            newSet.delete(mahalle);
          }
        });
        return newSet;
      });
      // İlk kez görünen grupları işaretle
      allMahalles.forEach((mahalle) => {
        initializedGroupsRef.current.add(mahalle);
      });
    } else {
      setClosedGroups(new Set());
      initializedGroupsRef.current.clear();
    }
  }, [grouped]); // grouped değiştiğinde yeni grupları kapalı başlat

  // Tüm sipariş kartlarını topla
  const allOrderRefs = useMemo(() => {
    return itemRefs.current.filter(Boolean) as HTMLElement[];
  }, [grouped, orders]);

  useStaggerListAnimation(allOrderRefs);

  // ✅ Context menu handler'ı ekle (sağ tıklama için) - OrderList'teki gibi
  useEffect(() => {
    if (!containerRef.current || !onOrderContextMenu) return;

    const container = containerRef.current;
    
    const handleContextMenuNative = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const siparisKart = target.closest('.siparis-kart') as HTMLElement;
      if (!siparisKart) return;
      
      const orderId = siparisKart.getAttribute('data-order-id');
      if (!orderId) return;

      e.preventDefault();
      
      // React event'e benzer bir obje oluştur
      const reactEvent = {
        preventDefault: () => e.preventDefault(),
        stopPropagation: () => e.stopPropagation(),
        currentTarget: siparisKart,
        target: e.target,
        pageX: e.pageX,
        pageY: e.pageY,
      } as any;
      
      // Order'ı bul
      const order = orders.find(o => String(o.id) === orderId);
      if (order) {
        onOrderContextMenu(reactEvent, order);
      }
    };

    container.addEventListener('contextmenu', handleContextMenuNative, { passive: false });

    return () => {
      container.removeEventListener('contextmenu', handleContextMenuNative);
    };
  }, [orders, onOrderContextMenu]);

  if (grouped.length === 0) {
    return (
      <div className="bos-siparis-mesaji">
        <i className="icon-kart-menu-tumu-teslim-edildi"></i>
        <div>Bu kolonda sipariş bulunmamaktadır.</div>
      </div>
    );
  }

  const toggleGroup = (mahalle: string) => {
    setClosedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(mahalle)) {
        newSet.delete(mahalle);
      } else {
        newSet.add(mahalle);
      }
      return newSet;
    });
  };

  return (
    <div ref={containerRef} className="grouped-order-list-container" style={{ display: 'flex', flexDirection: 'column', width: '100%', visibility: 'visible', opacity: 1 }}>
      {grouped.map(([mahalle, groupOrders]) => {
        const globalIndex = grouped.findIndex(([m]) => m === mahalle);
        const mahalleDisplay = mahalle.length > 20 ? `${mahalle.substring(0, 20)}...` : mahalle;
        const isClosed = closedGroups.has(mahalle);
        return (
          <div 
            key={mahalle} 
            className={`konum-grup ${isClosed ? 'kapali' : ''}`}
            data-akordiyon-init="1"
          >
            <div 
              className="grup-mahalle-baslik"
              onClick={() => toggleGroup(mahalle)}
              style={{ cursor: 'pointer' }}
            >
              <div className="title-wrapper">
                <i className="uil uil-angle-down akordiyon-icon"></i>
                <div className="grup-mahalle">{mahalleDisplay.toLocaleUpperCase('tr-TR')}</div>
              </div>
              <div className="grup-mahalle-sp-sayisi">{groupOrders.length}</div>
            </div>
            <div>
              {groupOrders.map((order, orderIndex) => {
                const orderGlobalIndex = globalIndex * 100 + orderIndex;
                return (
                  <div
                    key={order.id}
                    ref={(el) => {
                      itemRefs.current[orderGlobalIndex] = el;
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
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

