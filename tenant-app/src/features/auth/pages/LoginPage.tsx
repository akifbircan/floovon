import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../../app/providers/AuthProvider';
import { loginRequest } from '../../../lib/api';
import type { User } from '../../../lib/auth';
import { applySavedThemeToDocument } from '../../../shared/hooks/useTheme';

const loginSchema = z.object({
  tenant_code: z.string().min(1, 'Tenant kodu gereklidir'),
  username: z.string().min(1, 'Kullanıcı adı gereklidir'),
  password: z.string().min(1, 'Şifre gereklidir'),
  remember_tenant: z
    .union([z.boolean(), z.string(), z.literal('on')])
    .optional()
    .transform((v) => v === true || v === 'true' || v === 'on'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    getValues,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: (() => {
      if (typeof window === 'undefined') {
        return { tenant_code: '', username: '', password: '', remember_tenant: false };
      }
      const urlTenant = new URLSearchParams(window.location.search).get('tenant');
      const isRemembered = localStorage.getItem('remember_me') === 'true';
      const rememberedTenant = localStorage.getItem('remembered_tenant_code') || '';
      return {
        tenant_code: urlTenant || (isRemembered ? rememberedTenant : ''),
        username: isRemembered ? (localStorage.getItem('remembered_username') || '') : '',
        password: isRemembered ? (localStorage.getItem('remembered_password') || '') : '',
        remember_tenant: isRemembered,
      };
    })(),
  });

  // Login sayfası: ilk yüklemede temayı uygula + diğer sekmede (index) tema değişince de güncelle
  useEffect(() => {
    applySavedThemeToDocument();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'tenant_panel_theme') applySavedThemeToDocument();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // URL veya localStorage'tan hatırlanan değerleri forma uygula (sadece "Beni hatırla" işaretliyse tenant + kullanıcı adı + şifre)
  useEffect(() => {
    const urlTenantCode = searchParams.get('tenant');
    const rememberedTenantCode = localStorage.getItem('remembered_tenant_code') || '';
    const rememberedUsername = localStorage.getItem('remembered_username') || '';
    const rememberedPassword = localStorage.getItem('remembered_password') || '';
    const isRemembered = localStorage.getItem('remember_me') === 'true';

    const tenantCode = urlTenantCode || (isRemembered ? rememberedTenantCode : '');
    const currentRemember = getValues('remember_tenant');

    reset({
      tenant_code: tenantCode,
      username: isRemembered ? rememberedUsername : '',
      password: isRemembered ? rememberedPassword : '',
      remember_tenant: currentRemember ?? isRemembered,
    });
  }, [searchParams]);

  const onSubmit = async (data: LoginFormData) => {
    setError('');
    setLoading(true);

    try {
      const result = await loginRequest({
        tenant_code: data.tenant_code.trim(),
        kullaniciadi: data.username.trim(),
        sifre: data.password,
      });

      if (!result.ok) {
        setError(result.message);
        setLoading(false);
        return;
      }

      const { token, user, tenant_id } = result.data;

      // Beni hatırla: ÖNCE kaydet (login() state güncelleyince yönlendirme olabilir, sonraki satırlar çalışmayabilir)
      const rememberVal = data.remember_tenant;
      const shouldRemember = rememberVal === true ||
        String(rememberVal) === 'on' ||
        String(rememberVal) === 'true' ||
        Boolean(rememberVal);

      // Beni hatırla işaretliyse: tenant kodu + kullanıcı adı + şifre kaydet; değilse hepsini temizle
      if (shouldRemember && data.tenant_code?.trim()) {
        localStorage.setItem('remembered_tenant_code', data.tenant_code.trim());
        localStorage.setItem('remembered_username', (data.username || '').trim());
        localStorage.setItem('remembered_password', data.password || '');
        localStorage.setItem('remember_me', 'true');
      } else {
        localStorage.removeItem('remembered_tenant_code');
        localStorage.removeItem('remembered_username');
        localStorage.removeItem('remembered_password');
        localStorage.removeItem('remember_me');
      }

      // User objesine tenant_id ekle
      const userWithTenant: User = {
        ...(user as User),
        tenant_id: tenant_id ?? (user as User).tenant_id ?? 1,
      };

      // Auth state'i güncelle (login sonrası yönlendirme olabilir)
      await login(userWithTenant, token);

      // Dashboard'a yönlendir
      navigate('/');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Giriş yapılırken bir hata oluştu');
      } else {
        setError('Giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-login min-h-screen">
      {/* Sol Alan - Görsel - Webde görünür (lg:block), mobilde gizli (login-custom.css) */}
      <div className="sol-alan lg:block">
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

      {/* Sağ Alan - Form - Eski HTML yapısına göre */}
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
              <div className="text-yukleniyor">Giriş yapılıyor.<br />Lütfen bekleyin.</div>
            </div>
          )}

          <form id="loginForm" onSubmit={handleSubmit(onSubmit)}>
            <div className="input-alan">
              {/* Logo */}
              <img className="logo" src="/assets/logo-floovon-light.svg" alt="Floovon" />
              
              {/* Başlık */}
              <div className="baslik">Hoş geldiniz!</div>

              {/* Hata Mesajı */}
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-800">{error}</div>
                </div>
              )}

              {/* Tenant Kodu Input */}
              <div className="input-label tenant-input-wrapper">
                <label htmlFor="tenant_code">Tenant Kodu</label>
                <i className="icon-kart-menu-kunye-yazdir"></i>
                <input
                  {...register('tenant_code')}
                  id="tenant_code"
                  type="text"
                  className="input-field"
                  placeholder="Tenant Kodu"
                  autoComplete="off"
                  required
                  inputMode="numeric"
                  pattern="[0-9]+"
                />
              </div>

              {/* Kullanıcı Adı Input */}
              <div className="input-label">
                <label htmlFor="username">Kullanıcı Adı</label>
                <i className="icon-login-kullaniciadi"></i>
                <input
                  {...register('username')}
                  id="username"
                  type="text"
                  className="input-field"
                  placeholder="Kullanıcı Adınız"
                  autoComplete="username"
                />
              </div>

              {/* Şifre Input */}
              <div className="input-label">
                <label htmlFor="password">Şifre</label>
                <i className="icon-login-sifre"></i>
                <input
                  {...register('password')}
                  id="password"
                  type="password"
                  className="input-field"
                  placeholder="Şifreniz"
                  autoComplete="current-password"
                />
                {/* Şifremi Unuttum Linki */}
                <div className="sifremi-unuttum web-link">
                  <a href="/login-sifremi-unuttum">Şifremi unuttum?</a>
                </div>
              </div>

              {/* Beni Hatırla Checkbox */}
              <div className="beni-hatirla-wrapper">
                <input
                  {...register('remember_tenant')}
                  id="remember_tenant"
                  type="checkbox"
                  value="true"
                />
                <label htmlFor="remember_tenant">Beni Hatırla</label>
              </div>

              {/* Giriş Butonu */}
              <button id="btn-giris-yap" type="submit" disabled={loading}>
                {loading ? 'GİRİŞ YAPILIYOR...' : 'GİRİŞ YAP'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

