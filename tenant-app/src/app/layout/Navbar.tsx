import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePagePermissions } from '../providers/PagePermissionsProvider';
import { usePlan } from '../providers/PlanProvider';

const navItems = [
  { path: '/', iconClass: 'icon-sm-i-dashboard', tooltip: 'Siparişler', pageId: 'index' as const },
  { path: '/musteriler', iconClass: 'icon-sm-i-musteriler', tooltip: 'Müşteriler', pageId: 'musteriler' as const },
  { path: '/partner-firmalar', iconClass: 'icon-sm-i-partner', tooltip: 'Partner Firmalar', pageId: 'partner-firmalar' as const },
  { path: '/kampanya-yonetimi', iconClass: 'icon-sm-i-kampanyalar', tooltip: 'Kampanya Yönetimi', pageId: 'kampanya-yonetimi' as const },
  { path: '/raporlar', iconClass: 'icon-sm-i-raporlar', tooltip: 'Raporlar', pageId: 'raporlar' as const },
  { path: '/arsiv-siparisler', iconClass: 'icon-kart-menu-arsivle', tooltip: 'Arşiv Siparişler', pageId: 'arsiv-siparisler' as const },
];

const bottomNavItems = [
  { path: '/ayarlar', iconClass: 'icon-sm-i-ayarlar', tooltip: 'Ayarlar', pageId: 'ayarlar' as const },
];

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { hasAccess } = usePagePermissions();
  const { isBaslangicPlan } = usePlan();
  const filteredNavItems = navItems.filter((item) => {
    if (!hasAccess(item.pageId)) return false;
    // Kampanya sadece premium planda
    if (item.pageId === 'kampanya-yonetimi' && isBaslangicPlan === true) return false;
    return true;
  });
  const filteredBottomNavItems = bottomNavItems.filter((item) => hasAccess(item.pageId));

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/siparisler';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="w-16 bg-white hidden md:flex md:flex-col h-screen" data-sidebar>
      {/* Logo */}
      <div className="p-4">
        <Link to="/" className="flex items-center justify-center logo-link">
          <img src="/assets/logo-emblem-dark.svg" alt="Floovon" className="w-8 h-8" />
        </Link>
      </div>

      {/* Top Navigation - Sadece İkonlar */}
      <div className="flex-1 py-4">
        <ul className="space-y-2 px-2">
          {filteredNavItems.map((item) => {
            const active = isActive(item.path);
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center justify-center py-3 rounded-lg transition-colors relative group ${
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  title={item.tooltip}
                >
                  <i className={`${item.iconClass}`} style={{ fontSize: '1.25rem' }}></i>
                  {/* Tooltip */}
                  <span className="absolute left-full ml-2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 sidebar-tooltip">
                    {item.tooltip}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Bottom Navigation - Ayarlar */}
      <div className="py-4">
        <ul className="space-y-2 px-2">
          {filteredBottomNavItems.map((item) => {
            const active = isActive(item.path);
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center justify-center py-3 rounded-lg transition-colors relative group ${
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  title={item.tooltip}
                >
                  <i className={`${item.iconClass}`} style={{ fontSize: '1.25rem' }}></i>
                  {/* Tooltip */}
                  <span className="absolute left-full ml-2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 sidebar-tooltip">
                    {item.tooltip}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};

