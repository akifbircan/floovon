import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { getApiBaseUrl } from '../../../lib/runtime';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { EmptyState } from '../../../shared/components/EmptyState';
import { usePageAnimations } from '../../../shared/hooks/usePageAnimations';
import { usePlan } from '../../../app/providers/PlanProvider';
import { getProfileImageUrl } from '../../../shared/utils/userUtils';
import { formatPhoneNumber, cleanPhoneForDatabase } from '../../../shared/utils/formatUtils';
import { usePhoneInput } from '../../../shared/hooks/usePhoneInput';
import { showToast, showToastInteractive } from '../../../shared/utils/toastUtils';
import { createPortal } from 'react-dom';
import { User, Pencil, Shield, Users, Crown, UserCheck, Truck, Trash2, X, Check } from 'lucide-react';

interface UserListItem {
  id: number;
  ad?: string;
  soyad?: string;
  name?: string;
  surname?: string;
  email: string;
  kullanici_adi?: string;
  username?: string;
  telefon?: string;
  phone?: string;
  yetkilendirme?: string;
  role?: string;
  profil_resmi?: string;
  profile_image?: string;
  durum?: 'aktif' | 'pasif';
  is_active?: number;
  is_admin?: number | string;
  son_etkinlik?: string;
}

/**
 * Profil Ayarları sayfası
 * Tab sistemi: Profil Bilgileri, Profil Yönetimi, Yetkilendirme
 */
/** İsim + soyisimden kullanıcı adı üretir (küçük harf, Türkçe karakterler ASCII, noktasız birleşik) */
function kullaniciAdiUret(ad: string, soyad: string): string {
  const trMap: Record<string, string> = { ı: 'i', ğ: 'g', ü: 'u', ş: 's', ö: 'o', ç: 'c', İ: 'i', I: 'i', Ğ: 'g', Ü: 'u', Ş: 's', Ö: 'o', Ç: 'c' };
  const toAscii = (s: string) => s.split('').map((c) => trMap[c] ?? c).join('').toLowerCase().replace(/[^a-z0-9]/g, '');
  const a = toAscii((ad || '').trim());
  const b = toAscii((soyad || '').trim());
  if (!a && !b) return '';
  return a + b;
}

export const ProfilePage: React.FC = () => {
  usePageAnimations('profile');
  const { user: currentUser, refreshUser } = useAuth();
  const { maxUsers, refetch: refetchPlan } = usePlan();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'profil' | 'yonetim' | 'yetkilendirme'>('profil');

  const refetchPlanWhenOnYonetim = React.useRef(false);
  React.useEffect(() => {
    if (activeTab === 'yonetim' && !refetchPlanWhenOnYonetim.current) {
      refetchPlanWhenOnYonetim.current = true;
      refetchPlan();
    }
    if (activeTab !== 'yonetim') refetchPlanWhenOnYonetim.current = false;
  }, [activeTab, refetchPlan]);

  /** Sekme değişince tıklanan tab butonunu görünür yap (kısmen görünür sekme tıklanınca tam görünsün) */
  React.useEffect(() => {
    const tabEl = document.querySelector(`.profil-tab-nav button[data-tab="${activeTab}"]`);
    if (tabEl && tabEl instanceof HTMLElement) {
      tabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  const [formData, setFormData] = useState({
    ad: '',
    soyad: '',
    email: '',
    kullanici_adi: '',
    telefon: '',
    yetkilendirme: 'Sistem Yöneticisi',
    sifre: '',
    sifre_tekrar: '',
  });
  const [profilResmiFile, setProfilResmiFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    ad: '',
    soyad: '',
    email: '',
    kullanici_adi: '',
    yetkilendirme: 'Sistem Yöneticisi',
    sifre: '',
  });
  const editUserPhoneInput = usePhoneInput('');
  const [editUserProfilResmiFile, setEditUserProfilResmiFile] = useState<File | null>(null);
  const [editUserPreviewUrl, setEditUserPreviewUrl] = useState<string>('');
  const [editUserImgError, setEditUserImgError] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [addUserDrawerOpen, setAddUserDrawerOpen] = useState(false);
  const [addUserForm, setAddUserForm] = useState({
    ad: '',
    soyad: '',
    email: '',
    kullanici_adi: '',
    yetkilendirme: 'Sistem Yöneticisi',
    sifre: '',
    sifre_tekrar: '',
  });
  const addUserPhoneInput = usePhoneInput('');
  const [addUserProfilResmiFile, setAddUserProfilResmiFile] = useState<File | null>(null);
  const [addUserPreviewUrl, setAddUserPreviewUrl] = useState<string>('');
  const [isSavingAdd, setIsSavingAdd] = useState(false);
  const addUserFormRef = useRef<HTMLFormElement>(null);
  const editUserFormRef = useRef<HTMLFormElement>(null);

  /** Yetki tablosu: sayfa x rol izin matrisi. index (Siparişler) her zaman erişilebilir, tabloda yok. */
  const [pagePermissions, setPagePermissions] = useState<Record<string, Record<string, boolean>>>(() => {
    const pages = ['musteriler', 'musteriler-cari', 'partner-firmalar', 'partner-firmalar-cari', 'partnerler-potansiyel', 'kampanya-yonetimi', 'raporlar', 'arsiv-siparisler', 'ayarlar'];
    const roles = ['sistem-yoneticisi', 'siparis-operatörü', 'teslimat-sorumlusu'];
    const defaults: Record<string, Record<string, boolean>> = {};
    pages.forEach((pageId) => {
      defaults[pageId] = {};
      roles.forEach((roleId) => {
        if (roleId === 'sistem-yoneticisi') defaults[pageId][roleId] = true;
        else defaults[pageId][roleId] = false;
      });
    });
    return defaults;
  });

  const YETKI_SAYFALAR = [
    { id: 'musteriler', name: 'Müşteriler' },
    { id: 'musteriler-cari', name: 'Müşteri Cari Hesap' },
    { id: 'partner-firmalar', name: 'Partner Firmalar' },
    { id: 'partner-firmalar-cari', name: 'Partner Firma Cari Hesap' },
    { id: 'partnerler-potansiyel', name: 'Potansiyel Partnerler' },
    { id: 'kampanya-yonetimi', name: 'Kampanya Yönetimi' },
    { id: 'raporlar', name: 'Raporlar' },
    { id: 'arsiv-siparisler', name: 'Arşiv Siparişler' },
    { id: 'ayarlar', name: 'Ayarlar' },
    { id: 'profil-ayarlari', name: 'Profil Ayarları' },
  ];
  const YETKI_ROLLER = [
    { id: 'sistem-yoneticisi', name: 'Sistem Yöneticisi' },
    { id: 'siparis-operatörü', name: 'Sipariş Operatörü' },
    { id: 'teslimat-sorumlusu', name: 'Sipariş Sorumlusu' },
  ];

  const togglePagePermission = async (pageId: string, roleId: string) => {
    if (roleId === 'sistem-yoneticisi') return;
    const pageName = YETKI_SAYFALAR.find((p) => p.id === pageId)?.name ?? pageId;
    const roleName = YETKI_ROLLER.find((r) => r.id === roleId)?.name ?? roleId;
    const newVal = !pagePermissions[pageId]?.[roleId];
    setPagePermissions((prev) => ({
      ...prev,
      [pageId]: { ...prev[pageId], [roleId]: newVal },
    }));
    showToast(newVal ? 'success' : 'info', `${roleName}: ${pageName} erişimi ${newVal ? 'verildi' : 'kaldırıldı'}`);
    try {
      await apiRequest('/user/page-permissions/update', {
        method: 'POST',
        data: { role_id: roleId, page_id: pageId, has_access: newVal },
      });
      window.dispatchEvent(new Event('pagePermissionsUpdated'));
    } catch (err) {
      setPagePermissions((prev) => ({
        ...prev,
        [pageId]: { ...prev[pageId], [roleId]: !newVal },
      }));
      showToast('error', 'İzin kaydedilemedi. Lütfen tekrar deneyin.');
    }
  };

  // Yetkilendirme: Backend'den tüm rollerin izinlerini yükle (sadece sistem yöneticisi)
  useEffect(() => {
    const role = (currentUser as any)?.yetkilendirme || (currentUser as any)?.role || '';
    const isSysAdmin = /sistem\s*y[oö]neticisi|sistem-yoneticisi|admin/i.test(String(role));
    if (!isSysAdmin || !currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest<Record<string, Record<string, boolean>>>('/user/page-permissions', {
          method: 'GET',
          params: { all_roles: '1' },
        });
        if (cancelled || !data) return;
        setPagePermissions((prev) => {
          const next = { ...prev };
          for (const [roleId, perms] of Object.entries(data)) {
            for (const [pageId, hasAccess] of Object.entries(perms)) {
              if (!next[pageId]) next[pageId] = {};
              next[pageId][roleId] = !!hasAccess;
            }
          }
          return next;
        });
      } catch {
        // Sessizce varsayılanlarla devam et
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  // Form verisini currentUser'dan doldur
  useEffect(() => {
    if (currentUser) {
      const u = currentUser as any;
      setFormData((prev) => ({
        ...prev,
        ad: u.ad || u.name || u.isim || '',
        soyad: u.soyad || u.surname || u.soyisim || '',
        email: u.email || '',
        kullanici_adi: u.kullaniciadi || u.kullanici_adi || u.username || '',
        telefon: u.telefon || u.phone || '',
        yetkilendirme: (() => {
          const r = u.yetkilendirme || u.role || 'Sistem Yöneticisi';
          return r === 'Teslimat Sorumlusu' ? 'Sipariş Sorumlusu' : r;
        })(),
      }));
    }
  }, [currentUser]);

  useEffect(() => {
    if (editingUser) {
      const u = editingUser;
      setEditUserForm({
        ad: u.ad ?? u.name ?? '',
        soyad: u.soyad ?? u.surname ?? '',
        email: u.email ?? '',
        kullanici_adi: u.kullanici_adi ?? u.username ?? '',
        yetkilendirme: (() => {
          const r = u.yetkilendirme ?? u.role ?? 'Sistem Yöneticisi';
          return r === 'Teslimat Sorumlusu' ? 'Sipariş Sorumlusu' : r;
        })(),
        sifre: '',
      });
      editUserPhoneInput.setDisplayValue(u.telefon ?? u.phone ?? '');
      setEditUserProfilResmiFile(null);
      setEditUserImgError(false);
    }
  }, [editingUser]);

  useEffect(() => {
    if (editUserProfilResmiFile) {
      const url = URL.createObjectURL(editUserProfilResmiFile);
      setEditUserPreviewUrl(url);
      setEditUserImgError(false);
      return () => URL.revokeObjectURL(url);
    }
    setEditUserPreviewUrl('');
  }, [editUserProfilResmiFile]);

  useEffect(() => {
    if (addUserDrawerOpen) {
      setAddUserForm({
        ad: '',
        soyad: '',
        email: '',
        kullanici_adi: '',
        yetkilendirme: 'Sistem Yöneticisi',
        sifre: '',
        sifre_tekrar: '',
      });
      addUserPhoneInput.setDisplayValue('');
      setAddUserProfilResmiFile(null);
    }
  }, [addUserDrawerOpen]);

  useEffect(() => {
    if (addUserProfilResmiFile) {
      const url = URL.createObjectURL(addUserProfilResmiFile);
      setAddUserPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setAddUserPreviewUrl('');
  }, [addUserProfilResmiFile]);

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const maxFromApi = tenantLimits?.max_users ?? maxUsers;
    const limit = typeof maxFromApi === 'number' && !isNaN(maxFromApi) ? maxFromApi : Number(maxFromApi);
    if (!isNaN(limit) && limit > 0 && users && users.length >= limit) {
      showToast('warning', `Planınız en fazla ${limit} kullanıcı eklemenize izin veriyor. Yeni kullanıcı eklemek için abonelik planınızı yükseltebilirsiniz.`);
      return;
    }
    const finalUsername = (addUserForm.kullanici_adi.trim() || kullaniciAdiUret(addUserForm.ad, addUserForm.soyad)).toLowerCase();
    if (users && finalUsername && users.some((u) => (u.kullanici_adi ?? u.username ?? '').toLowerCase() === finalUsername)) {
      showToast('error', 'Bu kullanıcı adı zaten kullanılıyor. Lütfen farklı bir kullanıcı adı girin.');
      return;
    }
    if (addUserForm.sifre.length < 6) {
      showToast('warning', 'Şifre en az 6 karakter olmalıdır');
      return;
    }
    if (addUserForm.sifre !== addUserForm.sifre_tekrar) {
      showToast('warning', 'Şifreler eşleşmiyor');
      return;
    }
    setIsSavingAdd(true);
    try {
      const result = await apiRequest<{ id: number }>('/users', {
        method: 'POST',
        data: {
          isim: addUserForm.ad.trim(),
          soyisim: addUserForm.soyad.trim(),
          email: addUserForm.email.trim(),
          kullaniciadi: addUserForm.kullanici_adi.trim() || kullaniciAdiUret(addUserForm.ad, addUserForm.soyad) || addUserForm.email.trim(),
          telefon: addUserPhoneInput.cleanValue || undefined,
          yetki: addUserForm.yetkilendirme,
          sifre: addUserForm.sifre,
        },
      });
      const newId = result?.id;
      if (addUserProfilResmiFile && newId) {
        const formDataUpload = new FormData();
        formDataUpload.append('userId', String(newId));
        formDataUpload.append('profile', addUserProfilResmiFile);
        const apiBase = getApiBaseUrl();
        const token = localStorage.getItem('floovon_token') || localStorage.getItem('token');
        const res = await fetch(`${apiBase}/auth/upload-profile`, {
          method: 'POST',
          body: formDataUpload,
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          showToast('warning', 'Kullanıcı eklendi ancak profil resmi yüklenemedi');
        } else {
          let profilResmiPath = json?.data?.url || json?.data?.filepath;
          if (profilResmiPath && (profilResmiPath.includes('localhost') || profilResmiPath.includes('127.0.0.1'))) {
            const match = profilResmiPath.match(/\/uploads\/[^?]+/);
            profilResmiPath = match ? match[0] : profilResmiPath;
          }
          if (profilResmiPath) {
            await apiRequest('/auth/profile', {
              method: 'PUT',
              data: { id: newId, profil_resmi: profilResmiPath },
            });
          }
        }
      }
      showToast('success', 'Kullanıcı başarıyla eklendi');
      setAddUserDrawerOpen(false);
      setAddUserProfilResmiFile(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Kullanıcı eklenemedi');
    } finally {
      setIsSavingAdd(false);
    }
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const finalUsername = editUserForm.kullanici_adi.trim().toLowerCase();
    if (finalUsername && users?.some((u) => u.id !== editingUser.id && (u.kullanici_adi ?? u.username ?? '').toLowerCase() === finalUsername)) {
      showToast('error', 'Bu kullanıcı adı zaten kullanılıyor. Lütfen farklı bir kullanıcı adı girin.');
      return;
    }
    if (editUserForm.sifre && editUserForm.sifre.length > 0 && editUserForm.sifre.length < 6) {
      showToast('warning', 'Şifre en az 6 karakter olmalıdır');
      return;
    }
    setIsSavingEdit(true);
    try {
      let profilResmiPath = editingUser.profil_resmi ?? editingUser.profile_image ?? '';
      if (profilResmiPath && (profilResmiPath.startsWith('http') || profilResmiPath.includes('uploads/'))) {
        const match = profilResmiPath.match(/\/uploads\/[^?]+/);
        profilResmiPath = match ? match[0] : profilResmiPath;
      }
      if (editUserProfilResmiFile) {
        const formDataUpload = new FormData();
        formDataUpload.append('userId', String(editingUser.id));
        formDataUpload.append('profile', editUserProfilResmiFile);
        const apiBase = getApiBaseUrl();
        const token = localStorage.getItem('floovon_token') || localStorage.getItem('token');
        const res = await fetch(`${apiBase}/auth/upload-profile`, {
          method: 'POST',
          body: formDataUpload,
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          showToast('error', json?.message || 'Profil resmi yüklenemedi');
          setIsSavingEdit(false);
          return;
        }
        profilResmiPath = json?.data?.url || json?.data?.filepath || profilResmiPath;
      }
      await apiRequest('/auth/profile', {
        method: 'PUT',
        data: {
          id: editingUser.id,
          isim: editUserForm.ad.trim(),
          soyisim: editUserForm.soyad.trim(),
          email: editUserForm.email.trim(),
          kullaniciadi: editUserForm.kullanici_adi.trim(),
          telefon: editUserPhoneInput.cleanValue || undefined,
          yetki: editUserForm.yetkilendirme,
          profil_resmi: profilResmiPath || undefined,
          sifre: editUserForm.sifre.trim() || undefined,
        },
      });
      showToast('success', 'Kullanıcı güncellendi');
      const wasCurrentUser = editingUser.id === currentUser?.id;
      setEditingUser(null);
      setEditUserProfilResmiFile(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (wasCurrentUser) {
        await refreshUser();
      }
    } catch (err: unknown) {
      showToast('error', (err as Error)?.message || 'Kullanıcı güncellenemedi');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const { data: tenantLimits } = useQuery({
    queryKey: ['tenant-limits'],
    queryFn: async () => {
      const result = await apiRequest<{ max_users: number | null }>('/tenant/limits', { method: 'GET' });
      return result;
    },
    enabled: activeTab === 'yonetim',
    staleTime: 60 * 1000,
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      try {
        const result = await apiRequest<UserListItem[]>('/users', { method: 'GET' });
        return Array.isArray(result) ? result : [];
      } catch (err) {
        if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 404) {
          return [];
        }
        console.error('Kullanıcılar yükleme hatası:', err);
        return [];
      }
    },
    enabled: activeTab === 'yonetim',
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  /** Yeni kullanıcı formunda girilen kullanıcı adı (veya otomatik üretilen) zaten listede var mı? */
  const addUserKullaniciAdiMevcut = React.useMemo(() => {
    const finalUsername = (addUserForm.kullanici_adi.trim() || kullaniciAdiUret(addUserForm.ad, addUserForm.soyad)).toLowerCase();
    if (!finalUsername || !users?.length) return false;
    return users.some((u) => (u.kullanici_adi ?? u.username ?? '').toLowerCase() === finalUsername);
  }, [addUserForm.kullanici_adi, addUserForm.ad, addUserForm.soyad, users]);

  /** Düzenleme formunda girilen kullanıcı adı başka bir kullanıcıda zaten var mı? (kendi adı hariç) */
  const editUserKullaniciAdiMevcut = React.useMemo(() => {
    const finalUsername = editUserForm.kullanici_adi.trim().toLowerCase();
    if (!finalUsername || !users?.length || !editingUser) return false;
    return users.some((u) => u.id !== editingUser.id && (u.kullanici_adi ?? u.username ?? '').toLowerCase() === finalUsername);
  }, [editUserForm.kullanici_adi, users, editingUser]);

  /** Yeni kullanıcı formunda kaydedilmemiş değişiklik var mı? */
  const isAddFormDirty = React.useMemo(() => {
    return (
      addUserForm.ad.trim() !== '' ||
      addUserForm.soyad.trim() !== '' ||
      addUserForm.email.trim() !== '' ||
      addUserForm.kullanici_adi.trim() !== '' ||
      addUserForm.sifre !== '' ||
      addUserForm.sifre_tekrar !== '' ||
      addUserProfilResmiFile !== null
    );
  }, [addUserForm.ad, addUserForm.soyad, addUserForm.email, addUserForm.kullanici_adi, addUserForm.sifre, addUserForm.sifre_tekrar, addUserProfilResmiFile]);

  /** Düzenleme formunda kaydedilmemiş değişiklik var mı? */
  const isEditFormDirty = React.useMemo(() => {
    if (!editingUser) return false;
    const u = editingUser;
    const tel = (u.telefon ?? u.phone ?? '').toString().trim();
    const curTel = editUserPhoneInput.cleanValue?.trim() ?? '';
    return (
      editUserForm.ad !== (u.ad ?? u.name ?? '') ||
      editUserForm.soyad !== (u.soyad ?? u.surname ?? '') ||
      editUserForm.email !== (u.email ?? '') ||
      editUserForm.kullanici_adi !== (u.kullanici_adi ?? u.username ?? '') ||
      editUserForm.yetkilendirme !== (u.yetkilendirme ?? u.role ?? 'Sistem Yöneticisi') ||
      curTel !== tel ||
      editUserForm.sifre !== '' ||
      editUserProfilResmiFile !== null
    );
  }, [editingUser, editUserForm.ad, editUserForm.soyad, editUserForm.email, editUserForm.kullanici_adi, editUserForm.yetkilendirme, editUserForm.sifre, editUserPhoneInput.cleanValue, editUserProfilResmiFile]);

  const closeKullaniciDrawer = () => {
    setEditingUser(null);
    setEditUserProfilResmiFile(null);
    setAddUserDrawerOpen(false);
    setAddUserProfilResmiFile(null);
  };

  const tryCloseKullaniciDrawer = () => {
    if (addUserDrawerOpen && isAddFormDirty) {
      showToastInteractive({
        title: 'Değişiklikleri Kaydet',
        message: 'Kaydedilmeyen değişiklikler var! Değişiklikleri kaydetmek istiyor musunuz?',
        confirmText: 'Evet, Kaydet',
        cancelText: 'İptal',
        onConfirm: () => {
          (window as unknown as { closeInteractiveToastIfOpen?: () => void }).closeInteractiveToastIfOpen?.();
          if (addUserFormRef.current?.checkValidity()) {
            addUserFormRef.current?.requestSubmit();
          } else {
            addUserFormRef.current?.reportValidity();
          }
        },
        onCancel: () => {
          (window as unknown as { closeInteractiveToastIfOpen?: () => void }).closeInteractiveToastIfOpen?.();
          closeKullaniciDrawer();
        },
      });
      return;
    }
    if (editingUser && isEditFormDirty) {
      showToastInteractive({
        title: 'Değişiklikleri Kaydet',
        message: 'Kaydedilmeyen değişiklikler var! Değişiklikleri kaydetmek istiyor musunuz?',
        confirmText: 'Evet, Kaydet',
        cancelText: 'İptal',
        onConfirm: () => {
          (window as unknown as { closeInteractiveToastIfOpen?: () => void }).closeInteractiveToastIfOpen?.();
          if (editUserFormRef.current?.checkValidity()) {
            editUserFormRef.current?.requestSubmit();
          } else {
            editUserFormRef.current?.reportValidity();
          }
        },
        onCancel: () => {
          (window as unknown as { closeInteractiveToastIfOpen?: () => void }).closeInteractiveToastIfOpen?.();
          closeKullaniciDrawer();
        },
      });
      return;
    }
    closeKullaniciDrawer();
  };

  const performProfileSave = async () => {
    if (!currentUser?.id) return;
    setIsSaving(true);
    try {
      let profilResmiPath = (currentUser as any)?.profil_resmi || (currentUser as any)?.profile_image || '';
      if (profilResmiPath && (profilResmiPath.startsWith('http') || profilResmiPath.includes('uploads/'))) {
        const match = profilResmiPath.match(/\/uploads\/[^?]+/);
        profilResmiPath = match ? match[0] : profilResmiPath;
      }
      if (profilResmiFile) {
        const formDataUpload = new FormData();
        formDataUpload.append('userId', String(currentUser.id));
        formDataUpload.append('profile', profilResmiFile);
        const apiBase = getApiBaseUrl();
        const token = localStorage.getItem('floovon_token') || localStorage.getItem('token');
        const res = await fetch(`${apiBase}/auth/upload-profile`, {
          method: 'POST',
          body: formDataUpload,
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          showToast('error', json?.message || 'Profil resmi yüklenemedi');
          setIsSaving(false);
          return;
        }
        profilResmiPath = json?.data?.url || json?.data?.filepath || profilResmiPath;
      }
      await apiRequest('/auth/profile', {
        method: 'PUT',
        data: {
          id: currentUser.id,
          isim: formData.ad.trim(),
          soyisim: formData.soyad.trim(),
          email: formData.email.trim(),
          kullaniciadi: formData.kullanici_adi.trim(),
          telefon: cleanPhoneForDatabase(formData.telefon) || undefined,
          yetki: formData.yetkilendirme,
          profil_resmi: profilResmiPath || undefined,
          sifre: formData.sifre.trim() || undefined,
        },
      });
      showToast('success', 'Profil başarıyla güncellendi');
      setProfilResmiFile(null);
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (error) {
      showToast('error', (error as Error)?.message || 'Profil güncellenirken bir hata oluştu');
      console.error('Profile update error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) {
      showToast('error', 'Kullanıcı bilgisi bulunamadı');
      return;
    }
    if (formData.sifre && formData.sifre !== formData.sifre_tekrar) {
      showToast('warning', 'Şifreler eşleşmiyor');
      return;
    }
    const currentRole = (currentUser as any)?.yetki ?? (currentUser as any)?.role ?? 'Sistem Yöneticisi';
    const newRole = formData.yetkilendirme;
    if (currentRole !== newRole) {
      showToastInteractive({
        message: 'Kullanıcı rolünü değiştirirseniz bazı sayfalara ve yetkilere erişiminiz kısıtlanabilir. Emin misiniz?',
        confirmText: 'Evet, Değiştir',
        cancelText: 'İptal',
        isWarning: true,
        onConfirm: () => { performProfileSave(); },
      });
      return;
    }
    await performProfileSave();
  };

  const [previewUrl, setPreviewUrl] = useState<string>('');
  useEffect(() => {
    if (profilResmiFile) {
      const url = URL.createObjectURL(profilResmiFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl('');
  }, [profilResmiFile]);

  const profilResmiPreview = previewUrl || getProfileImageUrl(currentUser ?? undefined);

  return (
    <div className="profil-page page-wrapper">
      <div className="profil-page-inner">
        <div className="profil-baslik-alan">
          <h1 className="profil-baslik">Profil Ayarları</h1>
          <p className="profil-baslik-alt">Kişisel bilgilerinizi ve hesap ayarlarınızı yönetin</p>
        </div>

        <div className="profil-tab-nav">
          <button
            type="button"
            data-tab="profil"
            onClick={(e) => { e.stopPropagation(); setActiveTab('profil'); }}
            aria-selected={activeTab === 'profil'}
            className={`profil-tab-btn ${activeTab === 'profil' ? 'active' : ''}`}
          >
            <User size={18} />
            Profil Bilgileri
          </button>
          <button
            type="button"
            data-tab="yonetim"
            onClick={(e) => { e.stopPropagation(); setActiveTab('yonetim'); }}
            aria-selected={activeTab === 'yonetim'}
            className={`profil-tab-btn ${activeTab === 'yonetim' ? 'active' : ''}`}
          >
            <Users size={18} />
            Profil Yönetimi
          </button>
          <button
            type="button"
            data-tab="yetkilendirme"
            onClick={(e) => { e.stopPropagation(); setActiveTab('yetkilendirme'); }}
            aria-selected={activeTab === 'yetkilendirme'}
            className={`profil-tab-btn ${activeTab === 'yetkilendirme' ? 'active' : ''}`}
          >
            <Shield size={18} />
            Yetkilendirme
          </button>
        </div>

        {activeTab === 'profil' && (
          <div className="profil-card">
            <div className="profil-card-header">
              <div>
                <h2 className="profil-card-title">Profil Bilgileri</h2>
                <p className="profil-card-subtitle">Kişisel bilgilerinizi ve hesap ayarlarınızı güncelleyin</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="profil-form">
              <div className="profil-resim-alan">
                <div className="profil-resim-wrapper">
                  <div className="profil-resim-preview">
                    <img
                      src={profilResmiPreview}
                      alt="Profil"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `${getApiBaseUrl().replace('/api', '')}/assets/profil-default.jpg`;
                      }}
                    />
                  </div>
                  <div className="profil-resim-actions">
                    <div className="profil-resim-actions-buttons">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setProfilResmiFile(file);
                        }}
                        className="profil-resim-input-hidden"
                        id="profil-resmi-upload"
                      />
                      <label htmlFor="profil-resmi-upload" className="profil-btn profil-btn-primary">
                        Resim Yükle
                      </label>
                      {profilResmiFile && (
                        <button
                          type="button"
                          onClick={() => setProfilResmiFile(null)}
                          className="profil-btn profil-btn-ghost"
                        >
                          Kaldır
                        </button>
                      )}
                    </div>
                    <span className="profil-resim-hint">256x256px boyutunda profil resmi yükleyin.</span>
                  </div>
                </div>
              </div>

              <div className="profil-form-grid profil-form-grid-cols3">
                <div className="profil-form-col profil-form-col-1">
                  <div className="profil-form-group profil-field">
                    <label htmlFor="profil-ad">İsim</label>
                    <input
                      id="profil-ad"
                      type="text"
                      value={formData.ad}
                      onChange={(e) => setFormData({ ...formData, ad: e.target.value })}
                      autoComplete="given-name"
                      required
                    />
                  </div>
                  <div className="profil-form-group profil-field">
                    <label htmlFor="profil-soyad">Soyisim</label>
                    <input
                      id="profil-soyad"
                      type="text"
                      value={formData.soyad}
                      onChange={(e) => setFormData({ ...formData, soyad: e.target.value })}
                      autoComplete="family-name"
                      required
                    />
                  </div>
                  <div className="profil-form-group profil-field">
                    <label htmlFor="profil-kullaniciadi">Kullanıcı Adı</label>
                    <input
                      id="profil-kullaniciadi"
                      type="text"
                      value={formData.kullanici_adi}
                      onChange={(e) => setFormData({ ...formData, kullanici_adi: e.target.value })}
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>
                <div className="profil-form-col profil-form-col-2">
                  <div className="profil-form-group profil-field">
                    <label htmlFor="profil-email">E-posta Adresi</label>
                    <input
                      id="profil-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      autoComplete="email"
                      required
                    />
                  </div>
                  <div className="profil-form-group profil-field">
                    <label htmlFor="profil-telefon">İletişim Telefonu</label>
                    <input
                      id="profil-telefon"
                      type="tel"
                      value={formData.telefon}
                      onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
                      placeholder="+90 (5XX) XXX XX XX"
                      autoComplete="tel"
                    />
                  </div>
                </div>
                <div className="profil-form-col profil-form-col-3">
                  <div className="profil-form-col-secure">
                    <div className="profil-form-group profil-field">
                      <label htmlFor="profil-yetki">Yetkilendirme</label>
                      <select
                        id="profil-yetki"
                        value={formData.yetkilendirme}
                        onChange={(e) => setFormData({ ...formData, yetkilendirme: e.target.value })}
                      >
                        <option value="Sistem Yöneticisi">Sistem Yöneticisi</option>
                        <option value="Sipariş Operatörü">Sipariş Operatörü</option>
                        <option value="Sipariş Sorumlusu">Sipariş Sorumlusu</option>
                      </select>
                    </div>
                    <div className="profil-form-group profil-field">
                      <label htmlFor="profil-sifre">Şifre</label>
                      <input
                        id="profil-sifre"
                        type="password"
                        value={formData.sifre}
                        onChange={(e) => setFormData({ ...formData, sifre: e.target.value })}
                        placeholder="Yeni şifre (boş bırakılırsa değiştirilmez)"
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="profil-form-group profil-field">
                      <label htmlFor="profil-sifre-tekrar">Şifre Tekrar</label>
                      <input
                        id="profil-sifre-tekrar"
                        type="password"
                        value={formData.sifre_tekrar}
                        onChange={(e) => setFormData({ ...formData, sifre_tekrar: e.target.value })}
                        placeholder="Şifre tekrar"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="profil-form-actions">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="profil-btn profil-btn-primary"
                >
                  {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'yonetim' && (
          <div className="profil-card">
            <div className="profil-card-header">
              <div>
                <h2 className="profil-card-title">
                  Profil Yönetimi
                  {!usersLoading && users != null && (
                    <span className="profil-yonetim-user-count">{users.length} Kullanıcı</span>
                  )}
                </h2>
                <p className="profil-card-subtitle">Organizasyonunuzdaki kullanıcı hesaplarını yönetin</p>
              </div>
              <button
                type="button"
                className="profil-btn profil-btn-primary"
                onClick={() => {
                  const maxFromApi = tenantLimits?.max_users ?? maxUsers;
                  const limit = typeof maxFromApi === 'number' && !isNaN(maxFromApi) ? maxFromApi : Number(maxFromApi);
                  const atLimit = !isNaN(limit) && limit > 0 && Array.isArray(users) && users.length >= limit;
                  if (atLimit) {
                    showToast('warning', `Planınız en fazla ${limit} kullanıcı eklemenize izin veriyor. Yeni kullanıcı eklemek için abonelik planınızı yükseltebilirsiniz.`);
                    return;
                  }
                  setEditingUser(null);
                  setAddUserDrawerOpen(true);
                }}
              >
                <Users size={16} />
                Yeni Kullanıcı Ekle
              </button>
            </div>
            {usersLoading ? (
              <div className="profil-loading">
                <LoadingSpinner size="md" />
              </div>
            ) : !users || users.length === 0 ? (
              <div className="profil-empty-wrapper">
                <EmptyState variant="soft" title="Kullanıcı bulunamadı" description="Henüz bu tenant'a ait kullanıcı kaydı yok." />
              </div>
            ) : (
              <div className="profil-table-wrapper">
                <div className="profil-table-scroll table-scrollbar">
                  <table className="profil-table customers-table">
                    <thead>
                      <tr>
                        <th>Kullanıcı</th>
                        <th>E-posta & Telefon</th>
                        <th>Yetki</th>
                        <th>Durum</th>
                        <th>Son Etkinlik</th>
                        <th className="text-center">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => {
                        const ad = user.ad ?? user.name ?? '';
                        const soyad = user.soyad ?? user.surname ?? '';
                        const profilResmi = user.profil_resmi ?? user.profile_image;
                        const telefon = user.telefon ?? user.phone;
                        const yetki = user.yetkilendirme ?? user.role;
                        const yetkiDisplay = yetki === 'Teslimat Sorumlusu' ? 'Sipariş Sorumlusu' : (yetki || 'Sistem Yöneticisi');
                        const durum = user.durum ?? (user.is_active === 1 ? 'aktif' : 'pasif');
                        return (
                          <tr key={user.id} className="profil-table-row">
                            <td data-label="Kullanıcı">
                              <div className="profil-user-cell">
                                {profilResmi ? (
                                  <img
                                    src={getProfileImageUrl(user)}
                                    alt={`${ad} ${soyad}`.trim() || 'Kullanıcı'}
                                    className="profil-user-avatar"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = `${getApiBaseUrl().replace('/api', '')}/assets/profil-default.jpg`;
                                    }}
                                  />
                                ) : (
                                  <div className="profil-user-avatar-placeholder">
                                    {((ad || ' ').charAt(0) || (user.kullanici_adi ?? user.username ?? ' ').charAt(0)).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div className="profil-user-name">{ad} {soyad}</div>
                                  <div className="profil-user-username">{user.kullanici_adi ?? user.username ?? '-'}</div>
                                </div>
                              </div>
                            </td>
                            <td data-label="E-posta & Telefon">
                              <div className="profil-user-email">{user.email}</div>
                              {telefon && <div className="profil-user-phone">{formatPhoneNumber(telefon)}</div>}
                            </td>
                            <td data-label="Yetki">
                              <span className="profil-badge profil-badge-role">{yetkiDisplay}</span>
                            </td>
                            <td data-label="Durum">
                              <button
                                type="button"
                                className={`durum-badge ${durum === 'aktif' ? 'durum-badge-aktif' : 'durum-badge-pasif'} ${(user.is_admin === 1 || user.is_admin === '1') ? 'durum-badge-admin' : ''}`}
                                title={(user.is_admin === 1 || user.is_admin === '1') ? 'Bu kullanıcı varsayılan/ana kullanıcı olduğu için durumu değiştirilemez' : 'Durumu değiştirmek için tıklayın'}
                                onClick={async () => {
                                  if (user.is_admin === 1 || user.is_admin === '1') {
                                    showToast('warning', 'Bu kullanıcı varsayılan/ana kullanıcı olduğu için durumu değiştirilemez.');
                                    return;
                                  }
                                  try {
                                    const yeniDurum = durum === 'aktif' ? 'pasif' : 'aktif';
                                    await apiRequest(`/users/${user.id}`, {
                                      method: 'PUT',
                                      data: { durum: yeniDurum },
                                    });
                                    queryClient.invalidateQueries({ queryKey: ['users'] });
                                    showToast('success', yeniDurum === 'aktif' ? 'Kullanıcı aktif yapıldı.' : 'Kullanıcı pasif yapıldı.');
                                  } catch (err) {
                                    showToast('error', (err as Error)?.message || 'Durum güncellenemedi');
                                  }
                                }}
                              >
                                {durum === 'aktif' ? 'Aktif' : 'Pasif'}
                              </button>
                            </td>
                            <td data-label="Son Etkinlik" className="profil-son-etkinlik">
                              {user.son_etkinlik?.trim() && user.son_etkinlik.trim() !== '-' ? (
                                user.son_etkinlik
                              ) : (
                                <span className="profil-son-etkinlik-placeholder">(Henüz etkinlik yok)</span>
                              )}
                            </td>
                            <td data-label="İşlemler" className="text-center">
                              <div className="islem-ikonlar">
                                <button
                                  type="button"
                                  className="islem-ikon duzenle-ikon"
                                  title="Düzenle"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAddUserDrawerOpen(false);
                                    setEditingUser(user);
                                  }}
                                >
                                  <Pencil size={14} />
                                </button>
                                {user.id === currentUser?.id ? (
                                  <button
                                    type="button"
                                    className="islem-ikon sil-ikon"
                                    disabled
                                    title="Oturum açan kullanıcı kendi hesabını silemez"
                                    aria-label="Oturum açan kullanıcı kendi hesabını silemez"
                                  >
                                    <Trash2 size={14} aria-hidden />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="islem-ikon sil-ikon"
                                    data-tooltip="Kullanıcıyı Sil"
                                    title="Kullanıcıyı Sil"
                                    aria-label="Kullanıcıyı Sil"
                                    onClick={() => {
                                      const adSoyad = `${ad} ${soyad}`.trim() || user.kullanici_adi || user.email || `Kullanıcı #${user.id}`;
                                      showToastInteractive({
                                        title: 'Kullanıcı Sil',
                                        message: `${adSoyad} kullanıcısını silmek istediğinize emin misiniz?`,
                                        confirmText: 'Evet, Sil',
                                        cancelText: 'İptal',
                                        onConfirm: async () => {
                                          try {
                                            await apiRequest(`/users/${user.id}`, { method: 'DELETE' });
                                            showToast('success', 'Kullanıcı silindi');
                                            queryClient.invalidateQueries({ queryKey: ['users'] });
                                          } catch (err: unknown) {
                                            showToast('error', (err as Error)?.message || 'Kullanıcı silinemedi');
                                          }
                                        },
                                      });
                                    }}
                                  >
                                    <Trash2 size={14} aria-hidden />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'yetkilendirme' && (
          <div className="profil-card">
            <div className="profil-card-header">
              <div>
                <h2 className="profil-card-title">Yetkilendirme Sistemi</h2>
                <p className="profil-card-subtitle">Kullanıcı rollerini ve sayfa erişim izinlerini yönetin</p>
              </div>
            </div>
            <div className="profil-yetkilendirme-content">
              <div className="profil-yetki-grid">
                <div className="profil-yetki-kart">
                  <div className="profil-yetki-kart-header">
                    <div className="profil-yetki-kart-icon profil-yetki-icon-sistem">
                      <Crown size={24} />
                    </div>
                    <div className="profil-yetki-kart-info">
                      <h4 className="profil-yetki-kart-baslik">Sistem Yöneticisi</h4>
                      <p className="profil-yetki-kart-aciklama">Tüm sistem yetkileri</p>
                    </div>
                  </div>
                  <div className="profil-yetki-kart-footer">
                    <span className="profil-yetki-badge-tum">Tüm İzinler</span>
                  </div>
                </div>
                <div className="profil-yetki-kart">
                  <div className="profil-yetki-kart-header">
                    <div className="profil-yetki-kart-icon profil-yetki-icon-siparis">
                      <UserCheck size={24} />
                    </div>
                    <div className="profil-yetki-kart-info">
                      <h4 className="profil-yetki-kart-baslik">Sipariş Operatörü</h4>
                      <p className="profil-yetki-kart-aciklama">Sipariş yönetim yetkileri</p>
                    </div>
                  </div>
                  <div className="profil-yetki-kart-footer">
                    <span className="profil-yetki-badge-sinirli">Sınırlı İzinler</span>
                  </div>
                </div>
                <div className="profil-yetki-kart">
                  <div className="profil-yetki-kart-header">
                    <div className="profil-yetki-kart-icon profil-yetki-icon-teslimat">
                      <Truck size={24} />
                    </div>
                    <div className="profil-yetki-kart-info">
                      <h4 className="profil-yetki-kart-baslik">Sipariş Sorumlusu</h4>
                      <p className="profil-yetki-kart-aciklama">Teslimat yönetim yetkileri</p>
                    </div>
                  </div>
                  <div className="profil-yetki-kart-footer">
                    <span className="profil-yetki-badge-sinirli">Sınırlı İzinler</span>
                  </div>
                </div>
              </div>
              <div className="profil-yetkilendirme-sayfa-izinleri">
                <p className="profil-yetkilendirme-hint">Rollerin hangi sayfalara erişebileceğini rolün karşısındaki ikona tıklayarak izin verin ya da engelleyin.</p>
                <p className="profil-yetkilendirme-hint profil-yetkilendirme-hint--info">Siparişler sayfası tüm roller için her zaman erişilebilirdir.</p>
                <div className="permissions-table-container">
                  <table className="permissions-table">
                    <thead>
                      <tr>
                        <th>Sayfa / Modül</th>
                        {YETKI_ROLLER.map((r) => (
                          <th key={r.id} className="text-center">{r.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {YETKI_SAYFALAR.map((page) => (
                        <tr key={page.id} className="permission-row">
                          <td className="page-name-cell" data-label="Sayfa / Modül">{page.name}</td>
                          {YETKI_ROLLER.map((role) => {
                            const hasAccess = role.id === 'sistem-yoneticisi' ? true : (pagePermissions[page.id]?.[role.id] ?? false);
                            const isSysAdmin = role.id === 'sistem-yoneticisi';
                            const handleClick = (e: React.MouseEvent) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!isSysAdmin) {
                                togglePagePermission(page.id, role.id);
                              }
                            };
                            const handleKeyDown = (e: React.KeyboardEvent) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                if (!isSysAdmin) {
                                  togglePagePermission(page.id, role.id);
                                }
                              }
                            };
                            return (
                              <td
                                key={role.id}
                                className="permission-cell permission-cell--centered permission-cell--clickable"
                                data-label={role.name}
                                data-role={role.id}
                                data-page-id={page.id}
                                title={hasAccess ? 'Sayfa erişimini kaldır' : 'Sayfa erişimini ver'}
                                role="button"
                                tabIndex={0}
                                onClick={handleClick}
                                onKeyDown={handleKeyDown}
                              >
                                <span className="permission-icon-wrapper">
                                  {hasAccess ? (
                                    <Check size={20} className="text-success" strokeWidth={2.5} />
                                  ) : (
                                    <X size={20} className="text-danger" strokeWidth={2.5} />
                                  )}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {(editingUser || addUserDrawerOpen) && createPortal(
          <div
            className="profil-drawer-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby={addUserDrawerOpen ? 'kullanici-ekle-title' : 'kullanici-duzenle-title'}
          >
            <div className="profil-drawer">
              <div className="profil-drawer-header">
                <h2 id={addUserDrawerOpen ? 'kullanici-ekle-title' : 'kullanici-duzenle-title'} className="profil-drawer-title">
                  {addUserDrawerOpen ? 'Yeni Kullanıcı Ekle' : 'Kullanıcıyı Düzenle'}
                </h2>
                <button
                  type="button"
                  className="profil-drawer-close"
                  onClick={tryCloseKullaniciDrawer}
                  aria-label="Kapat"
                >
                  <X size={22} aria-hidden />
                </button>
              </div>
              {addUserDrawerOpen ? (
              <form ref={addUserFormRef} onSubmit={handleAddUserSubmit} className="profil-drawer-body">
                <div className="profil-field profil-drawer-resim-alan">
                  <div className="profil-resim-wrapper">
                    <div className="profil-resim-preview profil-resim-preview-sm">
                      {addUserPreviewUrl ? (
                        <img src={addUserPreviewUrl} alt="Profil" />
                      ) : (
                        <div className="profil-resim-preview-placeholder">
                          {(addUserForm.ad || ' ').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="profil-resim-actions">
                      <div className="profil-resim-actions-buttons">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setAddUserProfilResmiFile(file);
                          }}
                          className="profil-resim-input-hidden"
                          id="profil-resmi-upload-add"
                        />
                        <label htmlFor="profil-resmi-upload-add" className="profil-btn profil-btn-primary">
                          Resim Yükle
                        </label>
                        {addUserProfilResmiFile && (
                          <button
                            type="button"
                            onClick={() => setAddUserProfilResmiFile(null)}
                            className="profil-btn profil-btn-ghost"
                          >
                            Kaldır
                          </button>
                        )}
                      </div>
                      <span className="profil-resim-hint">256x256px boyutunda profil resmi yükleyin.</span>
                    </div>
                  </div>
                </div>
                <div className="profil-field-row profil-field-row--2">
                  <div className="profil-field">
                    <label>İsim</label>
                    <input
                      type="text"
                      value={addUserForm.ad}
                      onChange={(e) => {
                        const ad = e.target.value;
                        setAddUserForm((f) => ({ ...f, ad, kullanici_adi: kullaniciAdiUret(ad, f.soyad) }));
                      }}
                      required
                    />
                  </div>
                  <div className="profil-field">
                    <label>Soyisim</label>
                    <input
                      type="text"
                      value={addUserForm.soyad}
                      onChange={(e) => {
                        const soyad = e.target.value;
                        setAddUserForm((f) => ({ ...f, soyad, kullanici_adi: kullaniciAdiUret(f.ad, soyad) }));
                      }}
                      required
                    />
                  </div>
                </div>
                <div className="profil-field">
                  <label>E-posta</label>
                  <input
                    type="email"
                    value={addUserForm.email}
                    onChange={(e) => setAddUserForm((f) => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="profil-field">
                  <label>Kullanıcı Adı</label>
                  <input
                    type="text"
                    value={addUserForm.kullanici_adi}
                    onChange={(e) => setAddUserForm((f) => ({ ...f, kullanici_adi: e.target.value }))}
                    placeholder="Kullanıcı adı otomatik oluşturulur, dilerseniz değiştirebilirsiniz"
                    aria-invalid={addUserKullaniciAdiMevcut}
                    aria-describedby={addUserKullaniciAdiMevcut ? 'add-user-kullaniciadi-uyari' : undefined}
                    title={addUserKullaniciAdiMevcut ? 'Bu kullanıcı adı zaten kullanılıyor. Lütfen farklı bir kullanıcı adı girin.' : undefined}
                    data-tooltip={addUserKullaniciAdiMevcut ? 'Bu kullanıcı adı zaten kullanılıyor. Lütfen farklı bir kullanıcı adı girin.' : undefined}
                    className={addUserKullaniciAdiMevcut ? 'input-hata' : ''}
                  />
                  {addUserKullaniciAdiMevcut && (
                    <span id="add-user-kullaniciadi-uyari" className="profil-field-uyari" role="alert">
                      Bu kullanıcı adı zaten kullanılıyor, lütfen başka bir kullanıcı adı belirleyin.
                    </span>
                  )}
                </div>
                <div className="profil-field">
                  <label>Telefon</label>
                  <input
                    ref={addUserPhoneInput.inputRef}
                    type="tel"
                    value={addUserPhoneInput.displayValue}
                    onChange={addUserPhoneInput.handleChange}
                    onKeyDown={addUserPhoneInput.handleKeyDown}
                    onFocus={addUserPhoneInput.handleFocus}
                    onPaste={addUserPhoneInput.handlePaste}
                    placeholder="+90 (5XX) XXX XX XX"
                    autoComplete="tel"
                  />
                </div>
                <div className="profil-field">
                  <label>Yetki</label>
                  <select
                    value={addUserForm.yetkilendirme}
                    onChange={(e) => setAddUserForm((f) => ({ ...f, yetkilendirme: e.target.value }))}
                  >
                    <option value="Sistem Yöneticisi">Sistem Yöneticisi</option>
                    <option value="Sipariş Operatörü">Sipariş Operatörü</option>
                    <option value="Sipariş Sorumlusu">Sipariş Sorumlusu</option>
                  </select>
                </div>
                <div className="profil-field-row profil-field-row--2">
                  <div className="profil-field">
                    <label>Şifre</label>
                    <input
                      type="password"
                      value={addUserForm.sifre}
                      onChange={(e) => setAddUserForm((f) => ({ ...f, sifre: e.target.value }))}
                      placeholder="En az 6 karakter"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="profil-field">
                    <label>Şifre (Tekrar)</label>
                    <input
                      type="password"
                      value={addUserForm.sifre_tekrar}
                      onChange={(e) => setAddUserForm((f) => ({ ...f, sifre_tekrar: e.target.value }))}
                      placeholder="Şifre tekrar"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <div className="profil-drawer-actions">
                  <button
                    type="button"
                    className="profil-btn profil-btn-secondary"
                    onClick={tryCloseKullaniciDrawer}
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="profil-btn profil-btn-primary"
                    disabled={isSavingAdd}
                  >
                    {isSavingAdd ? 'Ekleniyor...' : 'Ekle'}
                  </button>
                </div>
              </form>
              ) : (
              <form ref={editUserFormRef} onSubmit={handleEditUserSubmit} className="profil-drawer-body">
                <div className="profil-field profil-drawer-resim-alan">
                  <div className="profil-resim-wrapper">
                    <div className="profil-resim-preview profil-resim-preview-sm">
                      {editUserPreviewUrl ? (
                        <img src={editUserPreviewUrl} alt="Profil" />
                      ) : editingUser && (editingUser.profil_resmi ?? editingUser.profile_image) && !editUserImgError ? (
                        <img
                          src={getProfileImageUrl(editingUser)}
                          alt="Profil"
                          onError={() => setEditUserImgError(true)}
                        />
                      ) : (
                        <div className="profil-resim-preview-placeholder">
                          {(editUserForm.ad || ' ').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="profil-resim-actions">
                      <div className="profil-resim-actions-buttons">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setEditUserProfilResmiFile(file);
                          }}
                          className="profil-resim-input-hidden"
                          id="profil-resmi-upload-edit"
                        />
                        <label htmlFor="profil-resmi-upload-edit" className="profil-btn profil-btn-primary">
                          Resim Yükle
                        </label>
                        {editUserProfilResmiFile && (
                          <button
                            type="button"
                            onClick={() => setEditUserProfilResmiFile(null)}
                            className="profil-btn profil-btn-ghost"
                          >
                            Kaldır
                          </button>
                        )}
                      </div>
                      <span className="profil-resim-hint">256x256px boyutunda profil resmi yükleyin.</span>
                    </div>
                  </div>
                </div>
                <div className="profil-field-row profil-field-row--2">
                  <div className="profil-field">
                    <label>İsim</label>
                    <input
                      type="text"
                      value={editUserForm.ad}
                      onChange={(e) => setEditUserForm((f) => ({ ...f, ad: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="profil-field">
                    <label>Soyisim</label>
                    <input
                      type="text"
                      value={editUserForm.soyad}
                      onChange={(e) => setEditUserForm((f) => ({ ...f, soyad: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="profil-field">
                  <label>E-posta</label>
                  <input
                    type="email"
                    value={editUserForm.email}
                    onChange={(e) => setEditUserForm((f) => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="profil-field">
                  <label>Kullanıcı Adı</label>
                  <input
                    type="text"
                    value={editUserForm.kullanici_adi}
                    onChange={(e) => setEditUserForm((f) => ({ ...f, kullanici_adi: e.target.value }))}
                    placeholder="Kullanıcı adı otomatik oluşturulur, dilerseniz değiştirebilirsiniz"
                    required
                    aria-invalid={editUserKullaniciAdiMevcut}
                    aria-describedby={editUserKullaniciAdiMevcut ? 'edit-user-kullaniciadi-uyari' : undefined}
                    title={editUserKullaniciAdiMevcut ? 'Bu kullanıcı adı zaten kullanılıyor, lütfen başka bir kullanıcı adı belirleyin.' : undefined}
                    data-tooltip={editUserKullaniciAdiMevcut ? 'Bu kullanıcı adı zaten kullanılıyor, lütfen başka bir kullanıcı adı belirleyin.' : undefined}
                    className={editUserKullaniciAdiMevcut ? 'input-hata' : ''}
                  />
                  {editUserKullaniciAdiMevcut && (
                    <span id="edit-user-kullaniciadi-uyari" className="profil-field-uyari" role="alert">
                      Bu kullanıcı adı zaten kullanılıyor, lütfen başka bir kullanıcı adı belirleyin.
                    </span>
                  )}
                </div>
                <div className="profil-field">
                  <label>Telefon</label>
                  <input
                    ref={editUserPhoneInput.inputRef}
                    type="tel"
                    value={editUserPhoneInput.displayValue}
                    onChange={editUserPhoneInput.handleChange}
                    onKeyDown={editUserPhoneInput.handleKeyDown}
                    onFocus={editUserPhoneInput.handleFocus}
                    onPaste={editUserPhoneInput.handlePaste}
                    placeholder="+90 (5XX) XXX XX XX"
                    autoComplete="tel"
                  />
                </div>
                <div className="profil-field">
                  <label>Yetki</label>
                  <select
                    value={editUserForm.yetkilendirme}
                    onChange={(e) => setEditUserForm((f) => ({ ...f, yetkilendirme: e.target.value }))}
                  >
                    <option value="Sistem Yöneticisi">Sistem Yöneticisi</option>
                    <option value="Sipariş Operatörü">Sipariş Operatörü</option>
                    <option value="Sipariş Sorumlusu">Sipariş Sorumlusu</option>
                  </select>
                </div>
                <div className="profil-field">
                  <label>Yeni Şifre (boş bırakılırsa değiştirilmez)</label>
                  <input
                    type="password"
                    value={editUserForm.sifre}
                    onChange={(e) => setEditUserForm((f) => ({ ...f, sifre: e.target.value }))}
                    placeholder="En az 6 karakter"
                    autoComplete="new-password"
                  />
                </div>
                <div className="profil-drawer-actions">
                  <button
                    type="button"
                    className="profil-btn profil-btn-secondary"
                    onClick={tryCloseKullaniciDrawer}
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="profil-btn profil-btn-primary"
                    disabled={isSavingEdit}
                  >
                    {isSavingEdit ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </div>
              </form>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};
