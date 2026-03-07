// Login Form Handler
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const submitBtn = document.getElementById('submit-btn');
    const togglePassword = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('password');

    // Password toggle
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const eyeIcon = this.querySelector('.eye-icon');
            const eyeOffIcon = this.querySelector('.eye-off-icon');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                eyeIcon.style.display = 'none';
                eyeOffIcon.style.display = 'block';
            } else {
                passwordInput.type = 'password';
                eyeIcon.style.display = 'block';
                eyeOffIcon.style.display = 'none';
            }
        });
    }

    // Login form submit
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const tenantCode = document.getElementById('tenantCode').value.trim();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();

            console.log('🔍 Login form verileri:', {
                tenantCode: tenantCode ? tenantCode.substring(0, 3) + '***' : 'BOŞ',
                username: username ? username.substring(0, 3) + '***' : 'BOŞ',
                hasPassword: !!password,
                passwordLength: password ? password.length : 0
            });

            // Validation
            if (!tenantCode || !username || !password) {
                console.error('❌ Form validation başarısız:', {
                    tenantCode: tenantCode || 'BOŞ',
                    username: username || 'BOŞ',
                    password: password ? 'VAR' : 'BOŞ'
                });
                showError('Lütfen tüm alanları doldurun.', 'error');
                return;
            }

            // Disable submit button
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>Giriş yapılıyor...</span>';

            try {
                // API base URL'i belirle
                const isFileProtocol = window.location.protocol === 'file:';
                const isLocalhost = window.location.hostname === 'localhost' || 
                                   window.location.hostname === '127.0.0.1' || 
                                   !window.location.hostname;
                
                const apiBase = window.API_BASE_URL || 
                    (isFileProtocol || isLocalhost
                        ? `http://localhost:${localStorage.getItem('backend_port') || '3001'}/api`
                        : '/api');

                // Dashboard sayfasına yönlendirileceği için bitmiş abonelikler için de erişim izni ver
                const requestBody = {
                    tenant_code: tenantCode,
                    username: username,
                    password: password,
                    allow_expired: true,
                    login_type: 'dashboard',
                    redirect_to: 'dashboard.html'
                };
                
                console.log('📤 Login isteği gönderiliyor:', {
                    apiBase: apiBase,
                    endpoint: `${apiBase}/auth/login`,
                    body: {
                        tenant_code: tenantCode,
                        username: username ? username.substring(0, 3) + '***' : 'BOŞ',
                        password: password ? '***' : 'BOŞ'
                    }
                });

                const response = await fetch(`${apiBase}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    let errorData;
                    try {
                        errorData = JSON.parse(errorText);
                    } catch (e) {
                        errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
                    }
                    throw new Error(errorData.message || errorData.error || 'Giriş başarısız');
                }

                const result = await response.json();

                if (result.success && result.data) {
                    // Store authentication data
                    localStorage.setItem('token', result.data.token);
                    localStorage.setItem('user', JSON.stringify(result.data.user));
                    localStorage.setItem('tenant_code', tenantCode);
                    if (username) {
                        localStorage.setItem('username', username);
                    }

                    // Abonelik planı kontrolü: plan yoksa veya iptal edilmişse form altındaki uyarı alanında göster
                    try {
                        const subRes = await fetch(`${apiBase}/public/subscription?tenant_code=${encodeURIComponent(tenantCode)}`, {
                            method: 'GET',
                            credentials: 'include'
                        });
                        if (subRes.ok) {
                            const subData = await subRes.json();
                            const planId = subData.data && (subData.data.plan_id || subData.data.plan_id === 0) ? subData.data.plan_id : null;
                            const durum = (subData.data && subData.data.durum) ? String(subData.data.durum).toLowerCase() : '';
                            const hasNoPlan = planId == null || planId === 0 || durum === 'iptal' || durum === 'iptal_console';
                            if (hasNoPlan) {
                                showError('Aktif abonelik planınız bulunmuyor. Dashboard\'dan Plan & Abonelik bölümünden plan seçebilirsiniz.', 'warning');
                                await new Promise(r => setTimeout(r, 400)); // önce kutu render olsun
                                await new Promise(r => setTimeout(r, 5000)); // 5 sn okunsun, sonra yönlendir
                            }
                        }
                    } catch (_) { /* subscription check fail: continue */ }

                    // Redirect to dashboard (URL parametreleri olmadan - güvenlik/privacy için)
                    window.location.href = 'dashboard.html';
                } else {
                    showError(result.message || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.', 'error');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span>Giriş Yap</span><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
                }
            } catch (error) {
                console.error('Login error:', error);
                showError(error.message || 'Bağlantı hatası. Lütfen tekrar deneyin.', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>Giriş Yap</span><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
            }
        });
    }

    function showError(message, type) {
        if (!loginError) return;
        type = type || 'error';
        const inner = loginError.querySelector('.login-error-text');
        if (inner) {
            inner.textContent = message;
        } else {
            loginError.textContent = message;
        }
        loginError.className = 'login-error rounded-md p-4 ' + (type === 'warning' ? 'bg-amber-50' : 'bg-red-50');
        if (inner) inner.className = 'login-error-text text-sm ' + (type === 'warning' ? 'text-amber-800' : 'text-red-800');
        loginError.style.display = 'block';
        loginError.setAttribute('role', 'alert');
        setTimeout(function hideError() {
            if (loginError) loginError.style.display = 'none';
        }, type === 'warning' ? 8000 : 5000);
    }
});

