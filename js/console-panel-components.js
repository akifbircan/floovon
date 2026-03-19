// Admin Panel Component Helpers - Vanilla JS Versions
// Bu dosya admin panel component'lerini vanilla JS'e çevirir

// Utility function for className merging (cn function equivalent)
function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}

// Sayfadan geri dönüldüğünde (bfcache vb.) kalmış olabilecek scroll kilidini temizler.
function syncConsoleBodyScrollLock() {
  const hasActiveModal = !!document.querySelector('.modal-overlay.active');
  if (document?.documentElement?.classList) {
    document.documentElement.classList.toggle('console-modal-open', hasActiveModal);
    document.documentElement.classList.toggle('modal-open', hasActiveModal);
  }
  if (document?.body?.classList) {
    document.body.classList.toggle('console-modal-open', hasActiveModal);
    document.body.classList.toggle('modal-open', hasActiveModal);
  }
  if (hasActiveModal) return;
  if (document?.documentElement?.style) {
    document.documentElement.style.overflow = '';
    document.documentElement.style.overflowX = '';
    document.documentElement.style.overflowY = '';
    document.documentElement.style.touchAction = '';
  }
  if (document?.body?.style) {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.height = '';
    document.body.style.overflow = '';
    document.body.style.overflowX = '';
    document.body.style.overflowY = '';
    document.body.style.touchAction = '';
    document.body.style.webkitOverflowScrolling = '';
  }

  // Console sayfasinda modal kapandiysa mobil scroll'u aninda geri zorla.
  if (window.adminPanel && typeof window.adminPanel.enforceMobileScrollState === 'function') {
    window.adminPanel.enforceMobileScrollState();
  }
}

// Button Component
function createButton(options = {}) {
  const {
    variant = 'default',
    size = 'default',
    className = '',
    children = '',
    onClick = null,
    disabled = false,
    type = 'button'
  } = options;

  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    ghost: 'hover:bg-slate-100 hover:text-slate-700',
    link: 'text-blue-600 underline-offset-4 hover:underline'
  };

  const sizes = {
    default: 'h-9 px-4 py-2',
    sm: 'h-8 rounded-md gap-1.5 px-3',
    lg: 'h-10 rounded-md px-6',
    'xl': 'h-11 px-6 rounded-lg',
    icon: 'size-9',
    'icon-sm': 'size-8',
    'icon-lg': 'size-10'
  };

  const button = document.createElement('button');
  button.type = type;
  button.className = cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50',
    variants[variant] || variants.default,
    sizes[size] || sizes.default,
    className
  );
  button.disabled = disabled;
  if (onClick) button.addEventListener('click', onClick);
  if (typeof children === 'string') {
    button.innerHTML = children;
  } else if (children instanceof Node) {
    button.appendChild(children);
  }
  return button;
}

// Card Components
function createCard(options = {}) {
  const { className = '', children = '' } = options;
  const card = document.createElement('div');
  card.className = cn(
    'bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm',
    className
  );
  if (typeof children === 'string') {
    card.innerHTML = children;
  } else if (children instanceof Node) {
    card.appendChild(children);
  }
  return card;
}

function createCardHeader(options = {}) {
  const { className = '', children = '' } = options;
  const header = document.createElement('div');
  header.className = cn(
    'grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6',
    className
  );
  if (typeof children === 'string') {
    header.innerHTML = children;
  } else if (children instanceof Node) {
    header.appendChild(children);
  }
  return header;
}

function createCardTitle(options = {}) {
  const { className = '', children = '' } = options;
  const title = document.createElement('div');
  title.className = cn('leading-none font-semibold', className);
  if (typeof children === 'string') {
    title.textContent = children;
  } else if (children instanceof Node) {
    title.appendChild(children);
  }
  return title;
}

function createCardDescription(options = {}) {
  const { className = '', children = '' } = options;
  const desc = document.createElement('div');
  desc.className = cn('text-muted-foreground text-sm', className);
  if (typeof children === 'string') {
    desc.textContent = children;
  } else if (children instanceof Node) {
    desc.appendChild(children);
  }
  return desc;
}

function createCardContent(options = {}) {
  const { className = '', children = '' } = options;
  const content = document.createElement('div');
  content.className = cn('px-6', className);
  if (typeof children === 'string') {
    content.innerHTML = children;
  } else if (children instanceof Node) {
    content.appendChild(children);
  }
  return content;
}

// Badge Component
function createBadge(options = {}) {
  const { variant = 'default', className = '', children = '' } = options;
  const variants = {
    default: 'border-transparent bg-primary text-primary-foreground',
    secondary: 'border-transparent bg-secondary text-secondary-foreground',
    destructive: 'border-transparent bg-destructive text-white',
    outline: 'text-foreground'
  };
  const badge = document.createElement('span');
  badge.className = cn(
    'inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0',
    variants[variant] || variants.default,
    className
  );
  if (typeof children === 'string') {
    badge.innerHTML = children;
  } else if (children instanceof Node) {
    badge.appendChild(children);
  }
  return badge;
}

// Input Component
function createInput(options = {}) {
  const { type = 'text', className = '', placeholder = '', value = '', onChange = null } = options;
  const input = document.createElement('input');
  input.type = type;
  input.className = className;
  input.placeholder = placeholder;
  input.value = value;
  if (onChange) input.addEventListener('input', onChange);
  return input;
}

// Label Component
function createLabel(options = {}) {
  const { className = '', children = '', htmlFor = '' } = options;
  const label = document.createElement('label');
  label.className = className;
  if (htmlFor) label.htmlFor = htmlFor;
  if (typeof children === 'string') {
    label.innerHTML = children;
  } else if (children instanceof Node) {
    label.appendChild(children);
  }
  return label;
}

// Avatar Component
function createAvatar(options = {}) {
  const { className = '', src = '', fallback = '' } = options;
  const avatar = document.createElement('div');
  avatar.className = cn(
    'relative flex size-8 shrink-0 overflow-hidden rounded-full',
    className
  );
  
  if (src) {
    const img = document.createElement('img');
    img.src = src;
    img.className = 'aspect-square size-full';
    img.onerror = () => {
      // Fallback göster
      const fallbackEl = document.createElement('div');
      fallbackEl.className = 'bg-muted flex size-full items-center justify-center rounded-full';
      fallbackEl.textContent = fallback || '?';
      avatar.innerHTML = '';
      avatar.appendChild(fallbackEl);
    };
    avatar.appendChild(img);
  } else {
    const fallbackEl = document.createElement('div');
    fallbackEl.className = 'bg-muted flex size-full items-center justify-center rounded-full';
    fallbackEl.textContent = fallback || '?';
    avatar.appendChild(fallbackEl);
  }
  
  return avatar;
}

// Sheet Component (Modal/Sidebar) - Manage sayfasındaki modal yapısına göre dönüştürüldü
function createSheet(options = {}) {
  const {
    id = '',
    open = false,
    side = 'right',
    className = '',
    children = '',
    onClose = null
  } = options;

  const modalId = id || `modal-${Date.now()}`;
  const overlayId = id ? `${id}-overlay` : `modal-overlay-${Date.now()}`;

  // Modal Overlay - Manage sayfasındaki gibi
  const overlay = document.createElement('div');
  overlay.id = overlayId;
  overlay.className = 'modal-overlay';
  if (open) {
    overlay.classList.add('active');
  }
  
  if (onClose) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) onClose();
    });
  }

  // Modal - Manage sayfasındaki gibi
  const modal = document.createElement('div');
  modal.className = 'modal';
  if (className) {
    modal.classList.add(className);
  }

  if (typeof children === 'string') {
    modal.innerHTML = children;
  } else if (children instanceof Node) {
    modal.appendChild(children);
  }

  overlay.appendChild(modal);

  // Update function - Manage sayfasındaki gibi active class ile
  overlay.update = function(isOpen) {
    if (isOpen) {
      overlay.classList.add('active');
      // Modal açılırken html ve body overflow'u hemen engelle (yatay scroll çıkmasın)
      document.documentElement.classList.add('modal-open');
      document.documentElement.style.overflowX = 'hidden';
      document.body.classList.add('modal-open');
      document.body.style.overflow = 'hidden';
      document.body.style.overflowX = 'hidden';
      document.body.style.overflowY = 'hidden';
      syncConsoleBodyScrollLock();
    } else {
      overlay.classList.remove('active');
      // Modal kapandığında html ve body overflow'u geri yükle
      // Eğer başka aktif modal yoksa
      syncConsoleBodyScrollLock();
    }
  };

  return overlay;
}

function createSheetHeader(options = {}) {
  const { className = '', children = '', icon = null, title = '', description = '', closeButton = true, onClose = null } = options;
  const header = document.createElement('div');
  header.className = cn('modal-header', className);
  
  // Modal Header Content - Manage sayfasındaki gibi
  const headerContent = document.createElement('div');
  headerContent.className = 'modal-header-content';
  
  // Modal Header Icon
  if (icon) {
    const headerIcon = document.createElement('div');
    headerIcon.className = 'modal-header-icon';
    if (typeof icon === 'string') {
      headerIcon.innerHTML = icon;
    } else if (icon instanceof Node) {
      headerIcon.appendChild(icon);
    }
    headerContent.appendChild(headerIcon);
  }
  
  // Modal Header Text
  if (title || description) {
    const headerText = document.createElement('div');
    headerText.className = 'modal-header-text';
    
    if (title) {
      const titleEl = document.createElement('h2');
      if (typeof title === 'string') {
        titleEl.textContent = title;
      } else if (title instanceof Node) {
        titleEl.appendChild(title);
      } else {
        titleEl.innerHTML = title;
      }
      headerText.appendChild(titleEl);
    }
    
    if (description) {
      const descEl = document.createElement('p');
      descEl.className = 'modal-description';
      if (typeof description === 'string') {
        descEl.textContent = description;
      } else if (description instanceof Node) {
        descEl.appendChild(description);
      } else {
        descEl.innerHTML = description;
      }
      headerText.appendChild(descEl);
    }
    
    headerContent.appendChild(headerText);
  }
  
  header.appendChild(headerContent);
  
  // Close Button - Manage sayfasındaki gibi
  if (closeButton) {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close');
    if (onClose) {
      closeBtn.addEventListener('click', onClose);
    }
    header.appendChild(closeBtn);
  }
  
  // Eğer children varsa, headerContent'e ekle
  if (typeof children === 'string') {
    headerContent.innerHTML += children;
  } else if (children instanceof Node) {
    headerContent.appendChild(children);
  }
  
  return header;
}

function createSheetTitle(options = {}) {
  const { className = '', children = '' } = options;
  const title = document.createElement('h2');
  title.className = className;
  if (typeof children === 'string') {
    title.textContent = children;
  } else if (children instanceof Node) {
    title.appendChild(children);
  }
  return title;
}

function createSheetDescription(options = {}) {
  const { className = '', children = '' } = options;
  const desc = document.createElement('p');
  desc.className = className;
  if (typeof children === 'string') {
    desc.textContent = children;
  } else if (children instanceof Node) {
    desc.appendChild(children);
  }
  return desc;
}

function createSheetContent(options = {}) {
  const { className = '', children = '' } = options;
  const content = document.createElement('div');
  content.className = cn('modal-body', className);
  if (typeof children === 'string') {
    content.innerHTML = children;
  } else if (children instanceof Node) {
    content.appendChild(children);
  }
  return content;
}

function createSheetFooter(options = {}) {
  const { className = '', children = '' } = options;
  const footer = document.createElement('div');
  footer.className = cn('modal-footer', className);
  if (typeof children === 'string') {
    footer.innerHTML = children;
  } else if (children instanceof Node) {
    footer.appendChild(children);
  }
  return footer;
}

// Export functions
window.AdminComponents = {
  cn,
  createButton,
  createCard,
  createCardHeader,
  createCardTitle,
  createCardDescription,
  createCardContent,
  createBadge,
  createInput,
  createLabel,
  createAvatar,
  createSheet,
  createSheetHeader,
  createSheetTitle,
  createSheetDescription,
  createSheetContent,
  createSheetFooter
};

// Ortak Admin User Helper Fonksiyonları
const AdminUserHelpers = {
    // Admin user verisini localStorage'dan al
    getAdminUser() {
        const adminUserStr = localStorage.getItem('admin_user');
        let adminUser = {};
        try {
            adminUser = adminUserStr ? JSON.parse(adminUserStr) : {};
        } catch(e) {
            console.error('Admin user parse hatası:', e);
        }
        return adminUser;
    },
    
    // Admin user verisini backend'den çek ve localStorage'ı güncelle
    async fetchAdminUserFromBackend() {
        try {
            const adminUserId = localStorage.getItem('admin_user_id');
            const adminToken = localStorage.getItem('admin_token');
            
            if (!adminUserId || !adminToken) {
                return this.getAdminUser(); // Fallback to localStorage
            }
            
            const apiBase = window.API_BASE_URL || 
                (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                    ? `http://localhost:${localStorage.getItem('backend_port') || '3001'}/api`
                    : ((typeof window.getFloovonApiBase === 'function') 
                        ? window.getFloovonApiBase() 
                        : (window.API_BASE_URL || '/api')));
            
            const response = await fetch(`${apiBase}/admin/user`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    // localStorage'ı güncelle
                    localStorage.setItem('admin_user', JSON.stringify(result.data));
                    return result.data;
                }
            }
            
            // Hata durumunda localStorage'dan döndür
            return this.getAdminUser();
        } catch (error) {
            console.error('Admin user backend fetch hatası:', error);
            return this.getAdminUser(); // Fallback to localStorage
        }
    },
    
    // Profil resmi URL'ini düzelt
    getProfileImageUrl(profilResmi) {
        if (!profilResmi || profilResmi.trim() === '') {
            return null;
        }
        
        let imageUrl = profilResmi;
        if (typeof window.getFloovonUploadUrl === 'function') {
            imageUrl = window.getFloovonUploadUrl(imageUrl);
        } else if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
            const backendBase = window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || '');
            imageUrl = backendBase + (imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl);
        }
        return imageUrl;
    },
    
    // Avatar elementi oluştur (ortak mantık)
    createProfileAvatar(adminUser) {
        const avatar = document.createElement('div');
        avatar.className = 'modal-profile-avatar';
        
        const avatarImg = document.createElement('img');
        avatarImg.className = 'hidden'; // hidden class ile başla
        
        const avatarFallback = document.createElement('div');
        avatarFallback.className = 'w-full h-full flex items-center justify-center';
        
        const name = adminUser.name || adminUser.email || adminUser.kullaniciadi || 'A';
        avatarFallback.textContent = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        
        avatar.appendChild(avatarImg);
        avatar.appendChild(avatarFallback);
        
        // Profil resmi yükle
        const imageUrl = this.getProfileImageUrl(adminUser.profil_resmi);
        if (imageUrl) {
            // Resim zaten yüklenmiş olabilir (cache), bu durumu kontrol et
            const checkImageLoaded = () => {
                if (avatarImg.complete && avatarImg.naturalHeight !== 0) {
                    // Resim zaten yüklenmiş
                    avatarImg.classList.remove('hidden');
                    avatarFallback.style.display = 'none';
                }
            };
            
            avatarImg.onload = () => {
                // hidden class'ını kaldır, inline style kullanma
                avatarImg.classList.remove('hidden');
                avatarFallback.style.display = 'none';
            };
            avatarImg.onerror = () => {
                // Hata durumunda hidden class'ını ekle
                avatarImg.classList.add('hidden');
                avatarFallback.style.display = 'flex';
            };
            
            // Resmi yükle
            avatarImg.src = imageUrl + '?t=' + Date.now();
            
            // Resim zaten yüklenmiş olabilir (cache), hemen kontrol et
            setTimeout(checkImageLoaded, 0);
        }
        
        // Avatar'a tıklayınca resim yükleme özelliği ekle (sadece admin panel için)
        if (window.location.pathname.includes('/console') || window.location.pathname.includes('/admin')) {
            avatar.style.cursor = 'pointer';
            avatar.title = 'Profil resmini değiştirmek için tıklayın';
            avatar.addEventListener('click', async () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.style.display = 'none';
                document.body.appendChild(input);
                
                input.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (!file) {
                        document.body.removeChild(input);
                        return;
                    }
                    
                    // Dosya boyutu kontrolü (max 5MB)
                    if (file.size > 5 * 1024 * 1024) {
                        if (typeof createToast === 'function') {
                            createToast('error', 'Dosya boyutu 5MB\'dan büyük olamaz.');
                        } else {
                            alert('Dosya boyutu 5MB\'dan büyük olamaz.');
                        }
                        document.body.removeChild(input);
                        return;
                    }
                    
                    // Profil resmini hemen yükleme - sadece preview göster ve pendingProfileFile olarak sakla
                    // Backend'e yükleme sadece "Kaydet" butonuna basıldığında yapılacak
                    
                    // Preview için FileReader kullan
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        // Preview göster
                        avatarImg.src = e.target.result;
                        avatarImg.classList.remove('hidden');
                        avatarFallback.style.display = 'none';
                        
                        // Pending file olarak sakla (Kaydet butonuna basıldığında yüklenecek)
                        avatar.pendingProfileFile = file;
                        avatar.setAttribute('data-pending-profile-file', 'true');
                        
                        // Profil resmi değişikliğini işaretle (form değişiklik kontrolü için)
                        // Avatar elementine bir observer ekle veya direkt kontrol et
                        const checkAvatarChange = () => {
                            if (avatar.pendingProfileFile) {
                                // Değişiklik callback'ini çağır (eğer varsa)
                                if (window.updateProfileOriginalValues) {
                                    window.updateProfileOriginalValues({
                                        profil_resmi: file.name // Geçici olarak dosya adını sakla
                                    });
                                }
                            }
                        };
                        checkAvatarChange();
                    };
                    reader.readAsDataURL(file);
                    
                    document.body.removeChild(input);
                });
                
                input.click();
            });
        }
        
        return avatar;
    }
};

// Export AdminComponents to window
if (typeof window !== 'undefined') {
  // bfcache/back-forward sonrası modal açık değilse scroll kilidini temizle
  window.addEventListener('pageshow', () => {
    syncConsoleBodyScrollLock();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncConsoleBodyScrollLock();
    }
  });

  window.AdminComponents = {
    createSheet,
    createSheetHeader,
    createSheetTitle,
    createSheetDescription,
    createSheetContent,
    createSheetFooter,
    createInput,
    createLabel,
    createButton
  };
  
  // Ortak helper fonksiyonlarını da export et
  window.AdminUserHelpers = AdminUserHelpers;
}
