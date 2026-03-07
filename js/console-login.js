document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Elements to animate
    const logo = document.querySelector('.console-login-animate-logo');
    const headline = document.querySelector('.console-login-animate-headline');
    const features = document.querySelector('.console-login-animate-features');
    const footer = document.querySelector('.console-login-animate-footer');
    const loginCard = document.querySelector('.console-login-animate-card');

    // Add entry animation classes after a small delay
    setTimeout(() => {
        if (logo) logo.classList.add('console-login-is-visible');
        if (headline) headline.classList.add('console-login-is-visible');
        if (features) features.classList.add('console-login-is-visible');
        if (footer) footer.classList.add('console-login-is-visible');
        if (loginCard) loginCard.classList.add('console-login-is-visible');
    }, 100);

    // "Beni Hatırla" – kaydedilmiş kullanıcı adı/şifreyi yükle (tarayıcı autocomplete sonrası uygula)
    (function restoreRemembered() {
        var usernameInput = document.getElementById('console-login-username');
        var passwordInput = document.getElementById('console-login-password');
        var rememberCheckbox = document.getElementById('console-login-remember');
        var rememberedUsername = localStorage.getItem('admin_remembered_username');
        var rememberedPassword = localStorage.getItem('admin_remembered_password');
        var hasStored = (rememberedUsername && rememberedUsername.length > 0) || (rememberedPassword && rememberedPassword.length > 0);
        if (!hasStored || (!usernameInput && !passwordInput)) return;
        if (usernameInput && rememberedUsername) usernameInput.value = rememberedUsername;
        if (passwordInput && rememberedPassword) passwordInput.value = rememberedPassword;
        if (rememberCheckbox) rememberCheckbox.checked = true;
    })();
    // Tarayıcı autocomplete bazen değerleri sonradan yazıyor; 100ms sonra tekrar uygula
    setTimeout(function() {
        var usernameInput = document.getElementById('console-login-username');
        var passwordInput = document.getElementById('console-login-password');
        var rememberCheckbox = document.getElementById('console-login-remember');
        var rememberedUsername = localStorage.getItem('admin_remembered_username');
        var rememberedPassword = localStorage.getItem('admin_remembered_password');
        if ((rememberedUsername && usernameInput && usernameInput.value !== rememberedUsername) ||
            (rememberedPassword && passwordInput && passwordInput.value !== rememberedPassword)) {
            if (usernameInput && rememberedUsername) usernameInput.value = rememberedUsername;
            if (passwordInput && rememberedPassword) passwordInput.value = rememberedPassword;
            if (rememberCheckbox) rememberCheckbox.checked = true;
        }
    }, 100);

    // Form Submission Logic
    const loginForm = document.querySelector('form');
    if (loginForm) {
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            const btnContent = submitBtn.innerHTML;

            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const usernameInput = document.getElementById('console-login-username');
                const passwordInput = document.getElementById('console-login-password');
                const rememberCheckbox = document.getElementById('console-login-remember');
                const username = (usernameInput && usernameInput.value) ? usernameInput.value.trim() : '';
                const password = (passwordInput && passwordInput.value) ? passwordInput.value : '';
                const remember = rememberCheckbox ? rememberCheckbox.checked : false;
                
                if (!username || !password) {
                    if (typeof createToast === 'function') {
                        createToast('error', 'Lütfen kullanıcı adı ve şifre girin.');
                    } else {
                        alert('Lütfen kullanıcı adı ve şifre girin.');
                    }
                    return;
                }
                
                // Show loading state
                submitBtn.disabled = true;
                submitBtn.innerHTML = `
                    <div class="console-flex-center-gap">
                        <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        GİRİŞ YAPILIYOR
                    </div>
                `;

                try {
                    // Backend API'ye istek gönder
                    // API base URL'i kullan (hem localhost hem sunucu için çalışır)
                    let backendBase = window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || null);
                    
                    // Eğer backend base yoksa, API base'den türet
                    if (!backendBase) {
                        const apiBase = (typeof window.getFloovonApiBase === 'function') 
                            ? window.getFloovonApiBase() 
                            : (window.API_BASE_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
                                ? 'http://localhost:3001/api'
                                : '/api'));
                        // API base'den backend base'i çıkar (/api'yi kaldır)
                        backendBase = apiBase.replace('/api', '');
                    }
                    
                    // file:// protokolünde backendBase boş string olabilir, localhost'a yönlendir
                    if (window.location.protocol === 'file:' && (!backendBase || backendBase === '')) {
                        const port = localStorage.getItem('backend_port') || '3001';
                        backendBase = `http://localhost:${port}`;
                    }
                    
                    const loginUrl = `${backendBase}/api/admin/login`;
                    
                    console.log('🔍 Login attempt:', { username, backendBase, loginUrl });
                    
                    const response = await fetch(loginUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include', // Cookie'ler için gerekli
                        body: JSON.stringify({
                            kullaniciadi: username,
                            password: password
                        })
                    });
                    
                    console.log('📡 Response status:', response.status, response.statusText);
                    
                    // Response text'i önce oku, sonra parse et
                    const responseText = await response.text();
                    console.log('📄 Response text:', responseText);
                    
                    let result;
                    try {
                        result = JSON.parse(responseText);
                    } catch (parseError) {
                        console.error('❌ JSON parse error:', parseError, 'Response text:', responseText);
                        throw new Error('Sunucudan geçersiz yanıt alındı');
                    }
                    
                    // Debug log
                    console.log('✅ Login response:', { success: result.success, error: result.error, status: response.status, result });
                    
                    if (result.success) {
                        // Başarılı giriş
                        // Admin user bilgisini localStorage'a kaydet
                        if (result.data && result.data.user) {
                            localStorage.setItem('admin_user', JSON.stringify(result.data.user));
                            localStorage.setItem('admin_token', result.data.token);
                            localStorage.setItem('admin_user_id', result.data.user.id.toString());
                        }
                        
                        // "Beni Hatırla" işaretliyse kullanıcı adı ve şifreyi kaydet; değilse temizle
                        if (remember) {
                            localStorage.setItem('admin_remember_me', 'true');
                            localStorage.setItem('admin_remembered_username', username);
                            localStorage.setItem('admin_remembered_password', password);
                        } else {
                            localStorage.removeItem('admin_remember_me');
                            localStorage.removeItem('admin_remembered_username');
                            localStorage.removeItem('admin_remembered_password');
                        }
                        
                        // Başarılı girişten sonra /console'a yönlendir
                        // Cookie'lerin set edilmesi için kısa bir bekleme
                        console.log('✅ Login başarılı, yönlendiriliyor...');
                        setTimeout(() => {
                            // file:// protokolünde relative path çalışmaz, console-panel/console.html kullan
                            if (window.location.protocol === 'file:') {
                                window.location.replace('./console.html');
                            } else {
                                // window.location.replace kullan (geri butonu ile login sayfasına dönülmesin)
                                window.location.replace('/console');
                            }
                        }, 300);
                    } else {
                        // Hata durumu
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = btnContent;
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                        if (typeof createToast === 'function') {
                            createToast('error', result.error || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
                        } else {
                            alert(result.error || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
                        }
                    }
                } catch (error) {
                    console.error('❌ Login hatası:', error);
                    
                    // Backend bağlantı hatası kontrolü
                    let errorMessage = 'Giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.';
                    if (error.message && error.message.includes('Failed to fetch')) {
                        errorMessage = 'Backend sunucusuna bağlanılamıyor. Lütfen backend sunucusunun çalıştığından emin olun.';
                    } else if (error.message && error.message.includes('ERR_CONNECTION_REFUSED')) {
                        errorMessage = 'Backend sunucusu çalışmıyor. Lütfen backend sunucusunu başlatın.';
                    }
                    
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = btnContent;
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                    if (typeof createToast === 'function') {
                        createToast('error', errorMessage);
                    } else {
                        alert(errorMessage);
                    }
                }
            });
        }
    }
});
