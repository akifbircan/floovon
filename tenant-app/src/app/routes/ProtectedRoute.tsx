import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { usePagePermissions } from '../providers/PagePermissionsProvider';
import { usePlan } from '../providers/PlanProvider';
import { getPageIdFromPath } from '../utils/pagePermissions';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
  /** Backend page_id - yoksa path'ten çıkarılır. İzin yoksa /'e yönlendirilir */
  pageId?: string;
  /** true ise Başlangıç planında (plan_id=1) bu sayfaya erişim yok, /'e yönlendirilir */
  requirePremiumPlan?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  pageId: pageIdProp,
  requirePremiumPlan,
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { hasAccess, isLoading: permissionsLoading } = usePagePermissions();
  const { isBaslangicPlan, isLoading: planLoading } = usePlan();
  const location = useLocation();

  // Loading state (auth, izinler veya plan yükleniyor)
  if (isLoading || permissionsLoading || (requirePremiumPlan && planLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Yükleniyor...</div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Role check
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/403" replace />;
  }

  const pathname = location.pathname;

  // Sayfa erişim izni (profil-ayarlari dahil) - pagePermissions + sistem yöneticisi kuralı
  const pageId = pageIdProp ?? getPageIdFromPath(pathname);
  if (pageId && !permissionsLoading && !hasAccess(pageId)) {
    return <Navigate to="/" replace />;
  }

  // Plan kısıtı: Başlangıç planında premium sayfalara (örn. Kampanya Yönetimi) erişim yok
  if (requirePremiumPlan && isBaslangicPlan === true) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};




