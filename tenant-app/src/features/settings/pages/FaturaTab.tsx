import React from 'react';
import { Info } from 'lucide-react';

export type FaturaBankaHesap = { id: number; banka_adi?: string; iban?: string; sube?: string; hesap_sahibi?: string; aciklama?: string; sira?: number };

export type FaturaFormState = {
  firma_adi: string; adres: string; il: string; ilce: string; vergi_dairesi: string; vergi_no: string;
  kdv_orani: number; fatura_not: string;
};

export interface FaturaTabProps {
  faturaLogoSrc: string;
  faturaLogoUploading: boolean;
  handleFaturaLogoFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  faturaForm: FaturaFormState;
  setFaturaForm: React.Dispatch<React.SetStateAction<FaturaFormState>>;
  faturaSaving: boolean;
  handleFaturaAyarlariSave: () => void;
  bankaHesaplari: FaturaBankaHesap[];
  faturadaSecilenBankaIds: number[];
  onFaturadaSecimChange: (ids: number[]) => void;
}

export function FaturaTab(props: FaturaTabProps) {
  const {
    faturaLogoSrc,
    faturaLogoUploading,
    handleFaturaLogoFile,
    faturaForm,
    setFaturaForm,
    faturaSaving,
    handleFaturaAyarlariSave,
    bankaHesaplari,
    faturadaSecilenBankaIds,
    onFaturadaSecimChange,
  } = props;

  const toggleFaturadaBanka = (id: number) => {
    if (faturadaSecilenBankaIds.includes(id)) {
      onFaturadaSecimChange(faturadaSecilenBankaIds.filter((x) => x !== id));
    } else {
      onFaturadaSecimChange([...faturadaSecilenBankaIds, id]);
    }
  };

  return (
    <div className="ayarlar-tab-icerik">
      <div className="ayarlar-subtab-nav ayarlar-subtab-nav--single">
        <button type="button" className="ayarlar-subtab-btn active" aria-current="true">
          Fatura Ayarları
        </button>
      </div>
      <div className="ayarlar-panel ayarlar-fatura-panel">
        <div className="ayarlar-panel-header">
          <h2 className="ayarlar-panel-title">Fatura Ayarları</h2>
          <p className="ayarlar-panel-desc">
            <Info size={18} className="ayarlar-help-icon ayarlar-panel-desc-icon" aria-hidden />
            Müşteri faturasında görünecek logo, işletme bilgileri, banka hesapları, KDV oranı ve notu buradan yönetin.
          </p>
        </div>

        <div className="ayarlar-fatura-logo-row">
          <div className="ayarlar-form-group">
            <label className="ayarlar-label">Fatura logosu</label>
            <div className="ayarlar-logo-alan ayarlar-logo-alan-inline">
              {faturaLogoSrc ? (
                <img src={faturaLogoSrc} alt="Fatura logosu" className="ayarlar-logo-img" />
              ) : (
                <div className="ayarlar-logo-placeholder">Logo yok — yükleyin</div>
              )}
              <div className="ayarlar-logo-butonlar">
                <button
                  type="button"
                  className="ayarlar-btn ayarlar-btn-primary"
                  disabled={faturaLogoUploading}
                  onClick={() => document.getElementById('fatura-logo-input')?.click()}
                >
                  {faturaLogoUploading ? 'Yükleniyor...' : 'Logo Yükle'}
                </button>
              </div>
              <input
                id="fatura-logo-input"
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={handleFaturaLogoFile}
              />
            </div>
            <small className="ayarlar-help">PNG veya JPG. Faturada sol üstte görünür. Önerilen: 140×56 px civarı.</small>
          </div>
        </div>

        <div className="ayarlar-fatura-row">
          <div className="ayarlar-fatura-sol">
            <div className="ayarlar-form-group">
              <div className="ayarlar-fatura-isletme-kutu ayarlar-fatura-isletme-kutu--no-bg">
                <div className="ayarlar-sekme-baslik-wrapper">
                  <label className="ayarlar-label ayarlar-sekme-baslik">İşletme Bilgileri</label>
                  <p className="ayarlar-fatura-bolum-aciklama">Faturada sol üstte görünen firma adı, adres ve vergi bilgileri.</p>
                </div>
                <div className="ayarlar-form-group">
                  <label className="ayarlar-label">Firma / İşletme adı</label>
                  <input
                    type="text"
                    className="ayarlar-input"
                    placeholder="Firma / İşletme adı"
                    value={faturaForm.firma_adi}
                    onChange={(e) => setFaturaForm((p) => ({ ...p, firma_adi: e.target.value }))}
                  />
                </div>
                <div className="ayarlar-form-group">
                  <label className="ayarlar-label">Adres</label>
                  <textarea
                    className="ayarlar-input"
                    placeholder="Adres"
                    rows={2}
                    value={faturaForm.adres}
                    onChange={(e) => setFaturaForm((p) => ({ ...p, adres: e.target.value }))}
                  />
                </div>
                <div className="ayarlar-fatura-isletme-ikili">
                  <div className="ayarlar-form-group">
                    <label className="ayarlar-label">İl</label>
                    <input
                      type="text"
                      className="ayarlar-input"
                      placeholder="İl"
                      value={faturaForm.il}
                      onChange={(e) => setFaturaForm((p) => ({ ...p, il: e.target.value }))}
                    />
                  </div>
                  <div className="ayarlar-form-group">
                    <label className="ayarlar-label">İlçe</label>
                    <input
                      type="text"
                      className="ayarlar-input"
                      placeholder="İlçe"
                      value={faturaForm.ilce}
                      onChange={(e) => setFaturaForm((p) => ({ ...p, ilce: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="ayarlar-fatura-isletme-ikili">
                  <div className="ayarlar-form-group">
                    <label className="ayarlar-label">Vergi dairesi</label>
                    <input
                      type="text"
                      className="ayarlar-input"
                      placeholder="Vergi dairesi"
                      value={faturaForm.vergi_dairesi}
                      onChange={(e) => setFaturaForm((p) => ({ ...p, vergi_dairesi: e.target.value }))}
                    />
                  </div>
                  <div className="ayarlar-form-group">
                    <label className="ayarlar-label">Vergi numarası</label>
                    <input
                      type="text"
                      className="ayarlar-input"
                      placeholder="Vergi numarası"
                      value={faturaForm.vergi_no}
                      onChange={(e) => setFaturaForm((p) => ({ ...p, vergi_no: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="ayarlar-fatura-kdv-kutu">
              <div className="ayarlar-sekme-baslik-wrapper">
                <label className="ayarlar-label ayarlar-sekme-baslik">Fatura KDV Oranı ve Notlar</label>
                <p className="ayarlar-fatura-bolum-aciklama">Fatura üzerindeki KDV oranı ve faturanın en altında görünecek not metni.</p>
              </div>
              <div className="ayarlar-form-group">
                <label className="ayarlar-label">KDV oranı (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  className="ayarlar-input"
                  style={{ maxWidth: 120 }}
                  value={faturaForm.kdv_orani}
                  onChange={(e) => setFaturaForm((p) => ({ ...p, kdv_orani: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="ayarlar-form-group">
                <label className="ayarlar-label">Fatura notu (faturanın en altında)</label>
                <textarea
                  className="ayarlar-input"
                  placeholder="Örn: Ödeme 10 gün içinde yapılmalıdır."
                  rows={3}
                  value={faturaForm.fatura_not}
                  onChange={(e) => setFaturaForm((p) => ({ ...p, fatura_not: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="ayarlar-fatura-sag ayarlar-fatura-banka-alan">
          <div className="ayarlar-fatura-isletme-kutu ayarlar-fatura-isletme-kutu--no-bg">
            <div className="ayarlar-sekme-baslik-wrapper">
              <label className="ayarlar-label ayarlar-sekme-baslik">Banka Hesap Bilgileri</label>
              <p className="ayarlar-fatura-bolum-aciklama">Faturada göstermek istediğiniz hesapları işaretleyin. Hesap eklemek/düzenlemek için Genel → Banka Hesap Bilgileri sekmesine gidin.</p>
            </div>
            {bankaHesaplari.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full ayarlar-tablosu">
                  <thead>
                    <tr>
                      <th className="ayarlar-banka-checkbox-col px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase w-10">Faturada göster</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Banka</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">IBAN</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Şube / Hesap sahibi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {bankaHesaplari.map((b) => (
                      <tr key={b.id}>
                        <td data-label="Faturada göster" className="ayarlar-banka-checkbox-col px-4 py-2">
                          <label className="ayarlar-label ayarlar-label-inline">
                            <input
                              type="checkbox"
                              className="ayarlar-checkbox"
                              checked={faturadaSecilenBankaIds.includes(b.id)}
                              onChange={() => toggleFaturadaBanka(b.id)}
                              aria-label={`Faturada göster: ${b.banka_adi || b.iban || ''}`}
                            />
                            <span className="sr-only">Faturada göster</span>
                          </label>
                        </td>
                        <td data-label="Banka">{b.banka_adi || '—'}</td>
                        <td data-label="IBAN" className="td-no-mobile-label ayarlar-banka-iban-col">{b.iban || '—'}</td>
                        <td data-label="Şube">{[b.sube, b.hesap_sahibi].filter(Boolean).join(' · ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ayarlar-panel-desc" style={{ marginTop: 0 }}>Henüz banka hesabı yok. Genel → Banka Hesap Bilgileri sekmesinden ekleyebilirsiniz.</p>
            )}
          </div>
        </div>
        </div>

        <div className="ayarlar-form-group ayarlar-fatura-kaydet-alan">
          <div className="ayarlar-form-actions" style={{ marginBottom: 0 }}>
            <button type="button" className="ayarlar-btn ayarlar-btn-primary" disabled={faturaSaving} onClick={handleFaturaAyarlariSave}>
              {faturaSaving ? 'Kaydediliyor...' : 'Fatura ayarlarını kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
