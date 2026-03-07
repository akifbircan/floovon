import React from 'react';
import type { OrganizasyonKart } from '../types';

interface DashboardTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  kartlar?: OrganizasyonKart[] | null;
}

/**
 * Dashboard Tab'ları - Filtreleme için
 * TÜM SİPARİŞLER, ORGANİZASYON SİPARİŞLERİ, vb.
 */
export const DashboardTabs: React.FC<DashboardTabsProps> = ({
  activeTab,
  onTabChange,
  kartlar,
}) => {
  // Her tab için sayıları hesapla
  const tabCounts = React.useMemo(() => {
    if (!kartlar) {
      return {
        all: 0,
        organizasyon: 0,
        aracsusleme: 0,
        ozelgun: 0,
        ozelsiparis: 0,
        ciceksepeti: 0,
      };
    }

    return {
      all: kartlar.length,
      organizasyon: kartlar.filter((k) => k.kart_tur === 'organizasyon').length,
      aracsusleme: kartlar.filter((k) => k.kart_tur === 'aracsusleme').length,
      ozelgun: kartlar.filter((k) => k.kart_tur === 'ozelgun').length,
      ozelsiparis: kartlar.filter((k) => k.kart_tur === 'ozelsiparis').length,
      ciceksepeti: 0, // TODO: Çiçek Sepeti kart türü eklenecek
    };
  }, [kartlar]);

  const tabs = [
    { id: 'all', label: 'TÜM SİPARİŞLER', count: tabCounts.all },
    { id: 'organizasyon', label: 'ORGANİZASYON SİPARİŞLERİ', count: tabCounts.organizasyon },
    { id: 'aracsusleme', label: 'ARAÇ SÜSLEME RANDEVULARI', count: tabCounts.aracsusleme },
    { id: 'ozelgun', label: 'ÖZEL GÜN SİPARİŞLERİ', count: tabCounts.ozelgun },
    { id: 'ozelsiparis', label: 'ÖZEL SİPARİŞLER', count: tabCounts.ozelsiparis },
    { id: 'ciceksepeti', label: 'ÇİÇEK SEPETİ', count: tabCounts.ciceksepeti },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          data-dashboard-tab
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
            activeTab === tab.id
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {tab.label} {tab.count > 0 && `(${tab.count})`}
        </button>
      ))}
    </div>
  );
};

