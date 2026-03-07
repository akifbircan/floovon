/**
 * Ad Area Component
 * Başlangıç paketi için reklam alanı
 */

import React from 'react';

export const AdArea: React.FC = () => {

  const handleUpgrade = () => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    window.location.href = base ? `${base}/landing/dashboard` : '/landing/dashboard';
  };

  return (
    <div className="baslangic-paket-reklam" id="baslangicPaketReklam">
      <div className="reklam-content">
        <div>
          <h3 className="reklam-title">Daha Fazla Özellik Edinin</h3>
          <p className="reklam-subtitle">Aşağıdaki tüm özellikleri kullanmak için paketinizi yükseltebilirsiniz</p>
        </div>
        <div className="reklam-features">
          <div className="reklam-feature-item">
            <div className="reklam-feature-icon">
              <i className="fa-brands fa-whatsapp"></i>
            </div>
            <div className="reklam-feature-content">
              <div className="reklam-feature-title">WhatsApp Entegrasyonu</div>
              <div className="reklam-feature-desc">Sipariş bildirimleri gönderin</div>
            </div>
          </div>
          <div className="reklam-feature-item">
            <div className="reklam-feature-icon">
              <i className="fa-solid fa-truck"></i>
            </div>
            <div className="reklam-feature-content">
              <div className="reklam-feature-title">Araç Takip</div>
              <div className="reklam-feature-desc">Canlı araç takibi</div>
            </div>
          </div>
          <div className="reklam-feature-item">
            <div className="reklam-feature-icon">
              <i className="fa-solid fa-bullhorn"></i>
            </div>
            <div className="reklam-feature-content">
              <div className="reklam-feature-title">Kampanya Yönetimi</div>
              <div className="reklam-feature-desc">Kampanyalar oluşturun</div>
            </div>
          </div>
        </div>
        <button className="reklam-button" id="paketYukseltBtn" onClick={handleUpgrade}>
          Paketi Yükselt
        </button>
      </div>
    </div>
  );
};

