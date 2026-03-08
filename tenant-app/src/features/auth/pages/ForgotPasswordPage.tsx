import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '../../../lib/api';
import { usePageAnimations } from '../../../shared/hooks/usePageAnimations';
import { showToast } from '../../../shared/utils/toastUtils';
import { applySavedThemeToDocument } from '../../../shared/hooks/useTheme';

const forgotPasswordSchema = z.object({
  tenant_code: z.string().min(1, 'Tenant kodu gereklidir'),
  emailOrPhone: z.string().min(1, 'Kullanıcı adı veya e-posta gereklidir'),
});

const resetPasswordSchema = z.object({
  yeniSifre: z.string().min(6, 'Şifre en az 6 karakter olmalıdır'),
  yeniSifreTekrar: z.string().min(6, 'Şifre en az 6 karakter olmalıdır'),
}).refine((data) => data.yeniSifre === data.yeniSifreTekrar, {
  message: 'Şifreler eşleşmiyor',
  path: ['yeniSifreTekrar'],
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

/**
 * Şifremi Unuttum sayfası
 * UI-map gereksinimlerine göre düzenlendi
 */
export const ForgotPasswordPage: React.FC = () => {
  usePageAnimations('forgot-password');
  const [searchParams] = useSearchParams();

  // Şifremi unuttum sayfası Header dışında render edildiği için: kayıtlı temayı uygula
  useEffect(() => {
    applySavedThemeToDocument();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'theme') applySavedThemeToDocument();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const isRequestMode = !token;
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [successResetLink, setSuccessResetLink] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Şifre sıfırlama isteği formu
  const {
    register: registerRequest,
    handleSubmit: handleSubmitRequest,
    formState: { errors: errorsRequest },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  // Şifre sıfırlama formu
  const {
    register: registerReset,
    handleSubmit: handleSubmitReset,
    formState: { errors: errorsReset },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmitRequest = async (data: ForgotPasswordFormData) => {
    setError('');
    setSuccess('');
    setSuccessResetLink('');
    setLoading(true);

    try {
      const result = await apiRequest<{ message?: string; mailSent?: boolean; resetLink?: string }>('/auth/forgot-password', {
        method: 'POST',
        data: {
          tenant_code: data.tenant_code.trim(),
          emailOrPhone: data.emailOrPhone.trim(),
        },
      });

      const msg = result?.message;
      if (msg) {
        setSuccess(msg);
      } else if (result?.mailSent === true) {
        setSuccess('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Lütfen e-postanızı kontrol edin.');
      } else {
        setSuccess(msg || 'İşlem tamamlandı.');
      }
      setSuccessResetLink(result?.resetLink || '');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Şifre sıfırlama bağlantısı gönderilemedi. Lütfen tekrar deneyin.';
      setError(msg);
      showToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  const onSubmitReset = async (data: ResetPasswordFormData) => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // apiRequest başarılı bir şekilde döndüyse (hata fırlatmadıysa), bu zaten başarılı bir response demektir
      await apiRequest<{ message?: string }>('/auth/reset-password', {
        method: 'POST',
        data: {
          token: token,
          yeniSifre: data.yeniSifre,
          yeniSifreTekrar: data.yeniSifreTekrar,
        },
      });

      // Eğer buraya geldiysek, istek başarılı demektir (apiRequest hata fırlatmadı)
      setSuccess('Şifreniz başarıyla güncellendi. Giriş sayfasına yönlendiriliyorsunuz...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: unknown) {
      // apiRequest hata fırlattıysa (ApiError)
      if (err instanceof Error) {
        setError(err.message || 'Şifre güncellenemedi. Lütfen tekrar deneyin.');
      } else {
        setError('Şifre güncellenemedi. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-login min-h-screen">
      {/* Sol Alan - Görsel - Login sayfasıyla aynı */}
      <div className="sol-alan">
        <div className="gorsel-alan">
          <div className="gorsel-yazi">
            <div className="ust-yazi">
              Siparişten teslimata kadar<br />tüm siparişlerinizi kolayca yönetin.
              <span> Zamandan tasarruf edin!</span>
            </div>
            <div className="alt-yazi">
              Floovon® Sipariş Yönetimi © {new Date().getFullYear()}
            </div>
          </div>
          <div className="image-wrapper">
            <img src="/assets/img-login-splash.jpg" alt="Floovon" />
            <div className="black-mask"></div>
          </div>
        </div>
      </div>

      {/* Sağ Alan - Form - Login sayfasıyla aynı */}
      <div className="sag-alan">
        {/* Yardım Butonu */}
        <div className="yardim-butonu">
          <div className="btn-yardim">
            <a href="mailto:destek@floovon.com">
              <i className="far fa-question-circle"></i>
              YARDIM
            </a>
          </div>
        </div>

        {/* Form Alanı */}
        <div className="form-alan">
          {/* Loading Animation */}
          {loading && (
            <div id="loading" style={{ display: 'flex' }}>
              <div className="loading-icon"></div>
              <div className="text-yukleniyor">
                {isRequestMode ? 'Gönderiliyor.' : 'Kaydediliyor.'}<br />Lütfen bekleyin.
              </div>
            </div>
          )}

          {isRequestMode ? (
            /* Şifre Sıfırlama İsteği Formu */
            <form id="forgotPasswordForm" onSubmit={handleSubmitRequest(onSubmitRequest)}>
              <div className="input-alan">
                {/* Logo */}
                <img className="logo" src="/assets/logo-floovon-light.svg" alt="Floovon" />
                
                {/* Başlık */}
                <div className="baslik">
                  Şifremi Unuttum?
                  <span>Kullanıcı adınız veya kayıtlı e-posta adresinizi yazın. Şifre sıfırlama bağlantısı gönderilecektir.</span>
                </div>

                {/* Hata/Success Mesajları */}
                {error && (
                  <div className="rounded-md bg-red-50 p-4">
                    <div className="text-sm text-red-800">{error}</div>
                  </div>
                )}

                {success && (
                  <div className="rounded-md bg-green-50 p-4">
                    <div className="text-sm text-green-800">{success}</div>
                    {successResetLink && (
                      <p className="mt-2 text-sm">
                        <a href={successResetLink} className="text-blue-600 underline font-medium">
                          Şifre sıfırlama bağlantısına tıklayın
                        </a>
                      </p>
                    )}
                  </div>
                )}

                {/* Tenant Kodu Input */}
                <div className="input-label tenant-input-wrapper">
                  <label htmlFor="tenant_code">Tenant Kodu</label>
                  <i className="icon-kart-menu-kunye-yazdir"></i>
                  <input
                    {...registerRequest('tenant_code')}
                    id="tenant_code"
                    type="text"
                    className="input-field"
                    placeholder="Tenant Kodu"
                    autoComplete="off"
                    required
                    inputMode="numeric"
                    pattern="[0-9]+"
                  />
                  {errorsRequest.tenant_code && (
                    <p className="mt-1 text-sm text-red-600">{errorsRequest.tenant_code.message}</p>
                  )}
                </div>

                {/* Kullanıcı Adı veya E-posta Input */}
                <div className="input-label">
                  <label htmlFor="emailOrPhone">Kullanıcı adı veya e-posta adresi</label>
                  <i className="icon-login-kullaniciadi"></i>
                  <input
                    {...registerRequest('emailOrPhone')}
                    id="emailOrPhone"
                    type="text"
                    className="input-field"
                    placeholder="Kullanıcı adı veya e-posta adresi"
                    autoComplete="username"
                  />
                  {errorsRequest.emailOrPhone && (
                    <p className="mt-1 text-sm text-red-600">{errorsRequest.emailOrPhone.message}</p>
                  )}
                </div>

                {/* Gönder Butonu */}
                <button id="btn-sifre-sifirla" type="submit" disabled={loading}>
                  {loading ? 'GÖNDERİLİYOR...' : 'SIFIRLAMA BAĞLANTISI GÖNDER'}
                </button>

                {/* veya GİRİŞ YAP Linki */}
                <button id="btn-veya-giris-yap" type="button" onClick={() => navigate('/login')}>
                  veya GİRİŞ YAP
                </button>
              </div>
            </form>
          ) : (
            /* Şifre Sıfırlama Formu (Token ile) */
            <form id="resetPasswordForm" onSubmit={handleSubmitReset(onSubmitReset)}>
              <div className="input-alan">
                {/* Logo */}
                <img className="logo" src="/assets/logo-floovon-light.svg" alt="Floovon" />
                
                {/* Başlık */}
                <div className="baslik">
                  Yeni Şifre Belirle
                  <span>Yeni şifrenizi belirleyin. Şifreniz en az 6 karakter olmalıdır.</span>
                </div>

                {/* Hata/Success Mesajları */}
                {error && (
                  <div className="rounded-md bg-red-50 p-4">
                    <div className="text-sm text-red-800">{error}</div>
                  </div>
                )}

                {success && (
                  <div className="rounded-md bg-green-50 p-4">
                    <div className="text-sm text-green-800">{success}</div>
                  </div>
                )}

                {/* Yeni Şifre Input */}
                <div className="input-label">
                  <label htmlFor="yeni-sifre">Yeni Şifre</label>
                  <i className="icon-login-sifre"></i>
                  <input
                    {...registerReset('yeniSifre')}
                    id="yeni-sifre"
                    type="password"
                    className="input-field"
                    placeholder="Yeni şifrenizi girin"
                    autoComplete="new-password"
                  />
                  {errorsReset.yeniSifre && (
                    <p className="mt-1 text-sm text-red-600">{errorsReset.yeniSifre.message}</p>
                  )}
                </div>

                {/* Yeni Şifre Tekrar Input */}
                <div className="input-label">
                  <label htmlFor="yeni-sifre-tekrar">Yeni Şifre (Tekrar)</label>
                  <i className="icon-login-sifre"></i>
                  <input
                    {...registerReset('yeniSifreTekrar')}
                    id="yeni-sifre-tekrar"
                    type="password"
                    className="input-field"
                    placeholder="Yeni şifrenizi tekrar girin"
                    autoComplete="new-password"
                  />
                  {errorsReset.yeniSifreTekrar && (
                    <p className="mt-1 text-sm text-red-600">{errorsReset.yeniSifreTekrar.message}</p>
                  )}
                </div>

                {/* Kaydet Butonu */}
                <button id="btn-sifre-kaydet" type="submit" disabled={loading}>
                  {loading ? 'KAYDEDİLİYOR...' : 'ŞİFREYİ KAYDET'}
                </button>

                {/* İPTAL Butonu */}
                <button id="btn-iptal" type="button" onClick={() => navigate('/login')}>
                  İPTAL
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

