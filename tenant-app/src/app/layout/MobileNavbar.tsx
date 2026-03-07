import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePagePermissions } from '../providers/PagePermissionsProvider';
import { usePlan } from '../providers/PlanProvider';

// Eski sistemle uyumlu: dashboard, müşteriler, partner, kampanya, raporlar, arşiv, ayarlar + toggle (sadece index)
const navItems = [
  { path: '/', iconClass: 'icon-sm-i-dashboard', label: 'Siparişler', pageId: 'index' as const },
  { path: '/musteriler', iconClass: 'icon-sm-i-musteriler', label: 'Müşteriler', pageId: 'musteriler' as const },
  { path: '/partner-firmalar', iconClass: 'icon-sm-i-partner', label: 'Partner', pageId: 'partner-firmalar' as const },
  { path: '/kampanya-yonetimi', iconClass: 'icon-sm-i-kampanyalar', label: 'Kampanya', pageId: 'kampanya-yonetimi' as const },
  { path: '/raporlar', iconClass: 'icon-sm-i-raporlar', label: 'Raporlar', pageId: 'raporlar' as const },
  { path: '/arsiv-siparisler', iconClass: 'icon-kart-menu-arsivle', label: 'Arşiv', pageId: 'arsiv-siparisler' as const },
  { path: '/ayarlar', iconClass: 'icon-sm-i-ayarlar', label: 'Ayarlar', pageId: 'ayarlar' as const },
];

/**
 * Mobil bottom navbar - sadece mobilde görünür.
 * Index sayfasındayken "header gizle/göster" butonu eklenir.
 */
export const MobileNavbar: React.FC = () => {
  const location = useLocation();
  const { hasAccess } = usePagePermissions();
  const { isBaslangicPlan } = usePlan();
  const filteredNavItems = navItems.filter((item) => {
    if (!hasAccess(item.pageId)) return false;
    if (item.pageId === 'kampanya-yonetimi' && isBaslangicPlan === true) return false;
    return true;
  });

  const isIndexPage = location.pathname === '/' || location.pathname === '/siparisler';

  const [headerBandCollapsed, setHeaderBandCollapsed] = useState(false);

  useEffect(() => {
    setHeaderBandCollapsed(document.body.classList.contains('header-hidden'));
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ collapsed: boolean }>;
      if (ev.detail?.collapsed !== undefined) setHeaderBandCollapsed(ev.detail.collapsed);
    };
    window.addEventListener('headerBandState', handler);
    return () => window.removeEventListener('headerBandState', handler);
  }, []);

  useEffect(() => {
    if (isIndexPage) setHeaderBandCollapsed(document.body.classList.contains('header-hidden'));
  }, [isIndexPage]);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '/siparisler';
    return location.pathname.startsWith(path);
  };

  const handleToggleHeader = () => {
    window.dispatchEvent(new CustomEvent('toggleHeaderBand'));
  };

  return (
    <nav className="mobile-navbar-wrapper fixed bottom-0 left-0 right-0 md:hidden z-50">
      <div className="mobile-navbar flex items-center justify-around px-1 py-2">
        {filteredNavItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              title={item.label}
              className={`menu-ikon flex items-center justify-center p-2 rounded-lg transition-colors shrink-0 ${
                active ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-900'
              }`}
              aria-label={item.label}
            >
              <i className={`${item.iconClass} text-2xl`}></i>
            </Link>
          );
        })}
        {/* Header band gizle/göster - sadece index sayfasında */}
        {isIndexPage && (
          <button
            type="button"
            className="gizle-goster-buton flex items-center justify-center shrink-0 w-9 h-9 rounded-lg"
            onClick={handleToggleHeader}
            aria-label={headerBandCollapsed ? 'Arama bandını göster' : 'Arama bandını gizle'}
          >
            <i className={`fa-solid ${headerBandCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}`}></i>
          </button>
        )}
      </div>
    </nav>
  );
};
