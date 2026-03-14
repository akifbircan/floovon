import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './providers/AuthProvider';
import { PagePermissionsProvider } from './providers/PagePermissionsProvider';
import { PlanProvider } from './providers/PlanProvider';
import { TenantSubscriptionGuard } from './providers/TenantSubscriptionGuard';
import { CrossTabInvalidateListener } from './CrossTabInvalidateListener';
import { RealtimeSSEListener } from './RealtimeSSEListener';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { MainLayout } from './layout/MainLayout';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage';
import { CustomersPage } from '../features/customers/pages/CustomersPage';
import { CustomerDetailPage } from '../features/customers/pages/CustomerDetailPage';
import { OrdersPage } from '../features/orders/pages/OrdersPage';
import { OrderDetailPage } from '../features/orders/pages/OrderDetailPage';
import { PartnersPage } from '../features/partners/pages/PartnersPage';
import { PartnerDetailPage } from '../features/partners/pages/PartnerDetailPage';
import PotansiyelPartnerlerPage from '../features/partners/pages/PotansiyelPartnerlerPage';
import { CampaignsPage } from '../features/campaigns/pages/CampaignsPage';
import { ReportsPage } from '../features/reports/pages/ReportsPage';
import { ProfilePage } from '../features/profile/pages/ProfilePage';
import { SettingsPage } from '../features/settings/pages/SettingsPage';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { NotFoundPage } from './pages/NotFoundPage';

function App() {
  return (
    <>
      <CrossTabInvalidateListener />
      <AuthProvider>
        <RealtimeSSEListener />
        <PagePermissionsProvider>
          <PlanProvider>
            <TenantSubscriptionGuard>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login-sifremi-unuttum" element={<ForgotPasswordPage />} />
        
        {/* Protected routes with layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout>
                <DashboardPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/siparisler"
          element={
            <ProtectedRoute>
              <MainLayout>
                <DashboardPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/musteriler"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CustomersPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/arsiv-siparisler"
          element={
            <ProtectedRoute>
              <MainLayout>
                <OrdersPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/partner-firmalar"
          element={
            <ProtectedRoute>
              <MainLayout>
                <PartnersPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/kampanya-yonetimi"
          element={
            <ProtectedRoute requirePremiumPlan>
              <MainLayout>
                <CampaignsPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/raporlar"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ReportsPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profil-ayarlari"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ProfilePage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ayarlar"
          element={
            <ProtectedRoute>
              <MainLayout>
                <SettingsPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/siparis-kart-detay/:id"
          element={
            <ProtectedRoute>
              <MainLayout>
                <OrderDetailPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/musteriler-cari/:id"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CustomerDetailPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/partner-firmalar-cari/:id"
          element={
            <ProtectedRoute>
              <MainLayout>
                <PartnerDetailPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/partnerler-potansiyel"
          element={
            <ProtectedRoute>
              <MainLayout>
                <PotansiyelPartnerlerPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        {/* Error pages */}
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="/404" element={<NotFoundPage />} />
        
        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
            </TenantSubscriptionGuard>
          </PlanProvider>
        </PagePermissionsProvider>
    </AuthProvider>
    </>
  );
}

export default App;

