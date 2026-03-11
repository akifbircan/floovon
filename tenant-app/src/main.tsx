import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { initErrorLogger } from './lib/errorLogger';
import App from './app/App';
import './index.css';

initErrorLogger();
import './styles/css-variables.css';
import './styles/floovon-dashboard.css';
import './styles/floovon-dashboard-codes.css';
import './styles/login-custom.css';
import './styles/header-custom.css';
import './styles/dashboard-custom.css';
import './styles/dashboard-grid.css';
import './styles/dashboard-cards.css';
import './styles/layout-custom.css';
import './styles/sidebar-custom.css';
import './styles/tooltip.css';
import './styles/right-panel.css';
import './styles/buttons-common.css';
import './styles/profil-ayarlari.css';
import './styles/ciceksepeti-toast.css';
import './styles/ciceksepeti-modal.css';
/* Modal stilleri: tek dosyada (modal-styles.css = base + override + responsive + body:has); modal-styles-important içeriği buraya taşındı */
import './styles/modal-styles.css';
import './styles/siparis-modal-legacy.css';
import './styles/toast-override.css';
import './styles/phone-landscape-warning.css';
import './styles/tablet-notebook.css';
/* Select Lucide ok – en sonda yüklenir, tüm select’lere uygulanır */
import './styles/select-arrow-global.css';

// React Query client configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 dakika
    },
    mutations: {
      retry: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

