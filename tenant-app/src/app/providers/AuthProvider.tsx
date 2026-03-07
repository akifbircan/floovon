import React, { useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated, getUser, clearAuth, setUser as saveUser, type User } from '../../lib/auth';
import { apiRequest } from '../../lib/api';
import { getApiBaseUrl } from '../../lib/runtime';
import { getUploadUrl } from '../../shared/utils/urlUtils';
import { AuthContext } from './authContext';

// Re-export so existing imports from AuthProvider keep working
export { useAuth } from './authContext';

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContextProvider = AuthContext.Provider;

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Backend'den kullanıcı bilgilerini çek - /api/auth/me endpoint'ini kullan (eski yapıyla uyumlu)
  const fetchUserProfile = async (userId?: number): Promise<User | null> => {
    try {
      // Önce userId'yi al
      let targetUserId = userId;
      if (!targetUserId) {
        const storedUser = getUser();
        if (storedUser?.id) {
          targetUserId = storedUser.id;
        } else {
          console.warn('User ID bulunamadı, profil bilgileri yüklenemedi');
          return storedUser;
        }
      }

      // /api/auth/me?id=${userId} endpoint'ini kullan (eski yapıyla uyumlu)
      const endpoint = userId ? `/auth/me?id=${targetUserId}` : '/auth/me';
      const response = await apiRequest<{ success: boolean; data: any }>(endpoint, {
        method: 'GET',
      });
      
      // Response: apiRequest artık { success, data } yerine doğrudan data (kullanıcı objesi) döndürüyor
      // Eski format: { success: true, data: { name, surname, ... } } -> profileData = response.data
      let userData: User | null = null;
      const profileData = response && typeof response === 'object' && 'data' in response && response.data
        ? response.data
        : response && typeof response === 'object' && ('id' in response || 'name' in response)
          ? response
          : null;
      if (profileData) {
        const storedUser = getUser();
        
        // Backend'den gelen alanları map et (users tablosu: name, surname, username, role, profile_image)
        // Eski kodda kullanılan alanlar: isim, soyisim, kullaniciadi, yetki, profil_resmi
        userData = {
          id: profileData.id || targetUserId || storedUser?.id || 0,
          email: profileData.email || storedUser?.email,
          // name ve surname (DB'den geliyor)
          name: profileData.name || profileData.isim || storedUser?.name,
          ad: profileData.isim || profileData.name || storedUser?.ad, // Türkçe ad (isim)
          // surname (DB'den geliyor)
          telefon: profileData.phone || profileData.telefon || storedUser?.telefon,
          // role (DB'den geliyor)
          role: profileData.yetki || profileData.role || storedUser?.role || 'Sistem Yöneticisi',
          tenant_id: profileData.tenant_id || storedUser?.tenant_id || 0,
          // profile_image (DB'den geliyor) -> profil_resmi (eski kodda kullanılan)
          // Profil resmi URL'ini oluştur: /uploads/tenants/{tenant_id}/profiles/{filename}
          profil_resmi: (() => {
            const imagePath = profileData.profil_resmi || profileData.profile_image || storedUser?.profil_resmi || '';
            const tenantId = profileData.tenant_id || storedUser?.tenant_id;
            
            if (!imagePath || imagePath.trim() === '' || imagePath === 'null' || imagePath === 'undefined') {
              return '';
            }
            
            // Eğer zaten full URL ise (http ile başlıyorsa), olduğu gibi kullan
            if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
              return imagePath;
            }
            
            // getUploadUrl kullan - otomatik olarak doğru backend base URL'i ekler
            return getUploadUrl(imagePath);
            
            // Eğer path zaten /uploads ile başlıyorsa, direkt backend base'e ekle
            if (imagePath.startsWith('/uploads')) {
              const timestamp = Date.now();
              return `${backendBase}${imagePath}${imagePath.includes('?') ? '&' : '?'}t=${timestamp}`;
            }
            
            // Eğer tenant_id varsa ve path sadece dosya adı gibi görünüyorsa, tenant-based path oluştur
            if (tenantId && imagePath) {
              // Path'ten sadece dosya adını al (eğer tam path ise)
              // Örnek: "profiles/filename.jpg" -> "filename.jpg" veya "uploads/tenants/1/profiles/filename.jpg" -> "filename.jpg"
              let filename = imagePath;
              if (imagePath.includes('/')) {
                // Eğer path içinde "profiles/" varsa, ondan sonrasını al
                const profilesIndex = imagePath.indexOf('profiles/');
                if (profilesIndex !== -1) {
                  filename = imagePath.substring(profilesIndex + 'profiles/'.length);
                } else {
                  // Sadece son kısmı al
                  filename = imagePath.split('/').pop() || imagePath;
                }
              }
              
              // Cache busting için timestamp ekle
              const timestamp = Date.now();
              return `${backendBase}/uploads/tenants/${tenantId}/profiles/${filename}?t=${timestamp}`;
            }
            
            // Fallback: Direkt backend base'e ekle
            const timestamp = Date.now();
            return `${backendBase}${imagePath.startsWith('/') ? imagePath : '/' + imagePath}?t=${timestamp}`;
          })(),
          // Eski yapıyla uyumluluk için - backend'den gelen alanları map et
          isim: profileData.isim || profileData.name, // name -> isim
          soyisim: profileData.soyisim || profileData.surname, // surname -> soyisim
          kullaniciadi: profileData.kullaniciadi || profileData.username, // username -> kullaniciadi
          yetki: profileData.yetki || profileData.role, // role -> yetki
        };
      } else if (response && typeof response === 'object' && 'id' in response) {
        // Direkt User objesi formatında gelmişse
        const directUser = response as any;
        userData = {
          id: directUser.id || targetUserId || 0,
          email: directUser.email,
          name: directUser.name || directUser.isim,
          ad: directUser.isim || directUser.name || directUser.ad,
          telefon: directUser.phone || directUser.telefon,
          role: directUser.yetki || directUser.role || 'Sistem Yöneticisi',
          tenant_id: directUser.tenant_id || getUser()?.tenant_id || 0,
          profil_resmi: directUser.profil_resmi || directUser.profile_image || '',
          // Eski yapıyla uyumluluk
          isim: directUser.isim || directUser.name,
          soyisim: directUser.soyisim || directUser.surname,
          kullaniciadi: directUser.kullaniciadi || directUser.username,
          yetki: directUser.yetki || directUser.role,
        };
      }
      
      return userData;
    } catch (error) {
      console.error('Kullanıcı profili yüklenemedi:', error);
      // Hata durumunda localStorage'dan al
      return getUser();
    }
  };

  // Initialize: Token varsa önce backend ile doğrula; doğrulama yoksa login göster
  useEffect(() => {
    const checkAuth = async () => {
      if (!isAuthenticated()) {
        setIsLoading(false);
        return;
      }
      const storedUser = getUser();
      if (!storedUser?.id) {
        clearAuth();
        setUser(null);
        setIsLoading(false);
        return;
      }
      try {
        const freshUser = await fetchUserProfile(storedUser.id);
        if (freshUser) {
          setUser(freshUser);
          saveUser(freshUser);
        } else {
          clearAuth();
          setUser(null);
        }
      } catch {
        // 401 vb.: api interceptor login'e yönlendirir; yine de state temizle
        clearAuth();
        setUser(null);
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  // Kullanıcı bilgilerini yenile
  const refreshUser = async () => {
    if (isAuthenticated()) {
      const currentUser = getUser();
      if (currentUser?.id) {
        try {
          const freshUser = await fetchUserProfile(currentUser.id);
          if (freshUser) {
            setUser(freshUser);
            saveUser(freshUser);
          }
        } catch (error) {
          console.error('Kullanıcı bilgileri yenilenemedi:', error);
        }
      }
    }
  };

  const login = async (newUser: User, token: string) => {
    setUser(newUser);
    localStorage.setItem('floovon_token', token);
    localStorage.setItem('floovon_user', JSON.stringify(newUser));
    if (newUser.tenant_id) {
      localStorage.setItem('floovon_tenant_id', newUser.tenant_id.toString());
    }
    
    // Login sonrası backend'den güncel bilgileri çek - users tablosundan
    if (newUser.id) {
      try {
        const freshUser = await fetchUserProfile(newUser.id);
        if (freshUser) {
          setUser(freshUser);
          saveUser(freshUser);
        }
      } catch (error) {
        console.error('Kullanıcı bilgileri yüklenemedi:', error);
      }
    }
  };

  const logout = () => {
    clearAuth();
    setUser(null);
    navigate('/login');
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user && isAuthenticated(),
    isLoading,
    login,
    logout,
    refreshUser,
  };

  return <AuthContextProvider value={value}>{children}</AuthContextProvider>;
};

