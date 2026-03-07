/**
 * Purchase Page JavaScript
 * Satın alma akışını yönetir
 */

let currentStep = 1;
let selectedPlan = null;
let purchaseData = {
    plan: null,
    company: {},
    payment: {}
};

document.addEventListener('DOMContentLoaded', async function() {
    // Lucide icons initialize
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // URL'den plan parametresini al
    const urlParams = new URLSearchParams(window.location.search);
    const planParam = urlParams.get('plan');
    const billingPeriod = urlParams.get('billing') || 'monthly'; // 'monthly' veya 'yearly'
    
    // Global billing period değişkeni (planlar yüklenmeden önce ayarla)
    window.purchaseBillingPeriod = billingPeriod;
    
    // Toggle'ı URL'den gelen değere göre ayarla
    const yearlyBtn = document.getElementById('purchase-toggle-yearly');
    const monthlyBtn = document.getElementById('purchase-toggle-monthly');
    if (billingPeriod === 'yearly') {
        if (yearlyBtn) yearlyBtn.classList.add('active');
        if (monthlyBtn) monthlyBtn.classList.remove('active');
    } else {
        if (monthlyBtn) monthlyBtn.classList.add('active');
        if (yearlyBtn) yearlyBtn.classList.remove('active');
    }
    
    // Paketleri yükle
    await loadPlans(planParam);
    
    // Form event listeners
    initFormListeners();
    
    // İlk adımı göster
    showStep(1);
});

/**
 * Paketleri yükle ve göster
 */
async function loadPlans(preSelectedPlan = null) {
    const plansGrid = document.getElementById('landing-plans-grid') || document.querySelector('.landing-plan-options');
    if (!plansGrid) {
        console.error('❌ landing-plans-grid veya landing-plan-options elementi bulunamadı');
        return;
    }
    
    // Loading göster
    plansGrid.innerHTML = '<div class="landing-purchase-pricing-loading">Paketler yükleniyor...</div>';
    
    // API base URL'i belirle (try-catch dışında, hata mesajında kullanmak için)
    let apiBase;
    if (typeof window.getFloovonApiBase === 'function') {
        apiBase = window.getFloovonApiBase();
    } else if (window.API_BASE_URL) {
        apiBase = window.API_BASE_URL;
    } else {
        // file:// protokolü tespit edilirse localhost kullan
        const isFileProtocol = window.location.protocol === 'file:';
        const hostname = window.location.hostname || '';
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '' || isFileProtocol;
        if (isLocalhost) {
            const port = localStorage.getItem('backend_port') || '3001';
            apiBase = `http://localhost:${port}/api`;
        } else {
            apiBase = '/api';
        }
    }
    
    try {
        const fullUrl = `${apiBase}/public/plans`;
        
        // Public API endpoint'den paketleri çek
        let response;
        try {
            response = await fetch(fullUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
        } catch (fetchError) {
            console.error('❌ Fetch hatası:', fetchError);
            throw new Error(`Backend bağlantı hatası: ${fetchError.message}. Backend çalışıyor mu kontrol edin.`);
        }
        
        if (!response.ok) {
            let errorText;
            try {
                errorText = await response.text();
                console.error('❌ API Error Response:', errorText);
            } catch (e) {
                errorText = `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        let result;
        try {
            result = await response.json();
        } catch (parseError) {
            const text = await response.text();
            console.error('❌ JSON parse hatası:', parseError);
            console.error('❌ Response text:', text);
            throw new Error('API yanıtı geçersiz format');
        }
        
        if (!result.success) {
            throw new Error(result.error || result.message || 'Paketler yüklenemedi');
        }
        
        if (!result.data || !Array.isArray(result.data)) {
            console.error('❌ Geçersiz veri formatı:', result);
            throw new Error('Paket verisi geçersiz format');
        }
        
        if (result.data.length === 0) {
            console.warn('⚠️ Paket bulunamadı - veritabanında aktif paket yok');
            throw new Error('Paket bulunamadı. Lütfen yönetici ile iletişime geçin.');
        }
        
        let plans = result.data;
        
        // Sadece ilk 2 paketi göster
        if (plans.length > 2) {
            plans = plans.slice(0, 2);
        }
        
        // Plans'i global değişkene kaydet (toggle için)
        window.purchasePlans = plans;
        
        plansGrid.innerHTML = '';
        
        plans.forEach((plan, index) => {
            // Backend'den gelen alan adlarını normalize et (plan_name, plan_code, monthly_price, yearly_price)
            const planName = plan.plan_name || plan.plan_adi;
            const planCode = plan.plan_code || plan.plan_kodu;
            const monthlyPrice = plan.monthly_price || plan.aylik_ucret;
            const yearlyPrice = plan.yearly_price || plan.yillik_ucret;
            
            // Veri formatını kontrol et
            if (!planName || !planCode || !monthlyPrice) {
                console.warn('⚠️ Geçersiz paket verisi:', plan);
                return;
            }
            
            const price = (monthlyPrice / 100).toFixed(2);
            let features = [];
            
            try {
                // ozellikler string veya array olabilir
                if (typeof plan.ozellikler === 'string') {
                    features = JSON.parse(plan.ozellikler || '[]');
                } else if (Array.isArray(plan.ozellikler)) {
                    features = plan.ozellikler;
                }
            } catch (e) {
                console.warn('⚠️ Özellikler parse edilemedi:', e);
                features = [];
            }
            
            const isSelected = preSelectedPlan === planCode || (index === 1 && !preSelectedPlan); // İkinci paket varsayılan seçili
            const isRecommended = index === 1; // İkinci paket önerilen
            
            // Aylık ve yıllık fiyatları hesapla
            const monthlyPriceValue = parseFloat(price);
            // ✅ DÜZELTME: yearlyPrice kontrolü - eğer yearlyPrice varsa ve doğru hesaplanmışsa kullan
            // Ama önce aylık fiyattan hesaplanan değerle karşılaştır, yanlışsa aylık fiyattan hesapla
            let yearlyPriceValue;
            if (yearlyPrice && yearlyPrice > 0) {
                // yearlyPrice kuruş cinsinden, önce /100 yapıp TL'ye çevir, sonra /12 yaparak aylık eşdeğer fiyatı bul
                const calculatedFromYearly = (yearlyPrice / 100) / 12;
                // Aylık fiyattan hesaplanan değer (10 ay ödeme, 2 ay bedava)
                const calculatedFromMonthly = (monthlyPriceValue * 10) / 12;
                // Eğer veritabanındaki değer aylık fiyattan hesaplanan değerden %5'ten fazla farklıysa, aylık fiyattan hesapla
                const difference = Math.abs(calculatedFromYearly - calculatedFromMonthly);
                const threshold = calculatedFromMonthly * 0.05; // %5 tolerans
                if (difference > threshold) {
                    // Veritabanındaki değer yanlış, aylık fiyattan hesapla
                    yearlyPriceValue = calculatedFromMonthly;
                } else {
                    // Veritabanındaki değer doğru, kullan
                    yearlyPriceValue = calculatedFromYearly;
                }
            } else {
                // yearlyPrice yoksa, aylık fiyattan hesapla (10 ay ödeme, 2 ay bedava mantığı)
                yearlyPriceValue = (monthlyPriceValue * 10) / 12;
            }
            
            // Billing period'a göre fiyat hesapla
            const billingPeriod = window.purchaseBillingPeriod || 'monthly';
            const isYearly = billingPeriod === 'yearly' || billingPeriod === 'yillik';
            
            let displayPrice, periodText, periodSubText;
            if (isYearly) {
                // Yıllık: yıllık fiyatın 12'ye bölünmüş hali (aylık eşdeğer) göster
                displayPrice = Math.round(yearlyPriceValue).toLocaleString('tr-TR', { 
                    minimumFractionDigits: 0, 
                    maximumFractionDigits: 0 
                });
                periodText = 'YILLIK ÖDEME';
                periodSubText = `Aylık ₺${Math.round(monthlyPriceValue).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
            } else {
                // Aylık
                displayPrice = Math.round(monthlyPriceValue).toLocaleString('tr-TR', { 
                    minimumFractionDigits: 0, 
                    maximumFractionDigits: 0 
                });
                periodText = 'AYLIK ÖDEME';
                periodSubText = '';
            }
            
            const planOption = document.createElement('label');
            planOption.className = `landing-plan-option${isSelected ? ' selected' : ''}`;
            planOption.dataset.plan = planCode;
            planOption.dataset.planId = plan.id;
            planOption.dataset.planCode = planCode;
            planOption.dataset.monthlyPrice = monthlyPriceValue;
            planOption.dataset.yearlyPrice = yearlyPriceValue;
            
            const badgeHtml = isRecommended ? '<span class="landing-plan-option-badge">Önerilen</span>' : '';
            
            planOption.innerHTML = `
                <input type="radio" name="plan" value="${planCode}" ${isSelected ? 'checked' : ''}>
                <div class="landing-plan-option-header">
                    <span class="landing-plan-option-name">${planName}</span>
                    ${badgeHtml}
                </div>
                <div class="landing-plan-option-price" data-monthly="${monthlyPriceValue}" data-yearly="${yearlyPriceValue}">
                    ₺${displayPrice}<span>/ay</span>
                    ${isYearly ? '<span class="landing-plan-option-savings">Aylık pakete göre %20 avantajlı!</span>' : ''}
                </div>
            `;
            
            planOption.addEventListener('click', () => {
                // Tüm seçimleri temizle
                document.querySelectorAll('.landing-plan-option').forEach(opt => {
                    opt.classList.remove('selected');
                    opt.querySelector('input[type="radio"]').checked = false;
                });
                // Seçili olanı işaretle
                planOption.classList.add('selected');
                planOption.querySelector('input[type="radio"]').checked = true;
                selectPlan(plan);
            });
            
            if (isSelected) {
                selectPlan(plan);
            }
            
            plansGrid.appendChild(planOption);
        });
        
        // Lucide icons'ı yeniden initialize et
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
    } catch (error) {
        console.error('❌ Paketler yüklenirken hata:', error);
        console.error('❌ Hata detayları:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        // Kullanıcıya hata mesajı göster
        const errorHtml = 
            '<div style="text-align: center; padding: 3rem; color: var(--purchase-text-primary, #0f172a);">' +
                '<p style="font-size: 1rem; color: var(--purchase-text-secondary, #64748b);">Planlar yüklenirken bir hata oluştu, lütfen sayfayı yenileyin</p>' +
            '</div>';
        
        plansGrid.innerHTML = errorHtml;
    }
}

/**
 * Plan seçimi
 */
function selectPlan(plan) {
    selectedPlan = plan;
    purchaseData.plan = plan;
    
    // Tüm seçimleri temizle
    document.querySelectorAll('.landing-plan-option, .purchase-plan-card').forEach(card => {
        card.classList.remove('selected');
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = false;
    });
    
    // Plan kodunu normalize et (backend'den plan_code veya plan_kodu olarak gelebilir)
    const planCode = plan.plan_code || plan.plan_kodu;
    
    // Seçili kartı işaretle
    const selectedCard = document.querySelector(`[data-plan-code="${planCode}"], [data-plan="${planCode}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
        const radio = selectedCard.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
    }
    
    // Sidebar'ı güncelle
    updateSidebar(plan);
    
    // Devam butonunu aktif et
    const step1Next = document.getElementById('step1-next');
    if (step1Next) {
        step1Next.disabled = false;
    }
}

/**
 * Form event listeners
 */
function initFormListeners() {
    // İsim soyisim'den otomatik kullanıcı adı oluştur
    const fullNameInput = document.getElementById('fullName');
    const usernameInput = document.getElementById('username');
    
    if (fullNameInput && usernameInput) {
        let isManualEdit = false;
        
        // Kullanıcı manuel düzenleme yaparsa flag'i set et
        usernameInput.addEventListener('input', function() {
            isManualEdit = true;
        });
        
        fullNameInput.addEventListener('input', function() {
            const fullName = this.value.trim();
            
            // Eğer kullanıcı adı boşsa veya kullanıcı manuel düzenleme yapmadıysa otomatik oluştur
            if (fullName && (!isManualEdit || !usernameInput.value.trim())) {
                // Türkçe karakterleri değiştir ve küçük harfe çevir
                const username = fullName
                    .toLowerCase()
                    .replace(/ğ/g, 'g')
                    .replace(/ü/g, 'u')
                    .replace(/ş/g, 's')
                    .replace(/ı/g, 'i')
                    .replace(/ö/g, 'o')
                    .replace(/ç/g, 'c')
                    .replace(/[^a-z0-9]/g, '') // Sadece harf ve rakam
                    .substring(0, 50); // Maksimum 50 karakter
                
                if (username) {
                    usernameInput.value = username;
                    isManualEdit = false; // Otomatik oluşturuldu, flag'i sıfırla
                }
            }
        });
    }
    
    // Telefon formatlaması ve validasyonu: +90 (XXX) XXX XX XX
    // Sadece cep telefonu (+90(5) veya sabit telefon (90(3) formatlarını kabul et
    const phoneInput = document.getElementById('phone');
    const phoneError = document.getElementById('phone-error');
    
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, ''); // Sadece rakamlar
            
            // +90 ile başlamıyorsa ekle
            if (!value.startsWith('90')) {
                value = '90' + value;
            }
            
            // +90'yı kaldır, sadece rakamları işle
            if (value.startsWith('90')) {
                value = value.substring(2);
            }
            
            // Formatla: +90 (XXX) XXX XX XX
            let formatted = '+90';
            if (value.length > 0) {
                formatted += ' (' + value.substring(0, 3);
                if (value.length > 3) {
                    formatted += ') ' + value.substring(3, 6);
                }
                if (value.length > 6) {
                    formatted += ' ' + value.substring(6, 8);
                }
                if (value.length > 8) {
                    formatted += ' ' + value.substring(8, 10);
                }
            }
            
            e.target.value = formatted;
            
            // Input yazılırken hata mesajını gizle
            if (phoneError) {
                phoneError.style.display = 'none';
            }
            if (this.classList.contains('error')) {
                this.classList.remove('error');
            }
        });
        
        phoneInput.addEventListener('focus', function() {
            if (!this.value) {
                this.value = '+90 (';
            }
        });
        
        phoneInput.addEventListener('blur', function() {
            const phone = this.value.trim();
            const phoneDigits = phone.replace(/\D/g, '');
            
            // Telefon numarası validasyonu: Sadece uzunluk kontrolü
            if (phone && phoneDigits.length < 12) {
                if (phoneError) {
                    phoneError.textContent = 'Geçerli bir telefon numarası girin';
                    phoneError.style.display = 'block';
                }
                this.classList.add('error');
            } else {
                if (phoneError) {
                    phoneError.style.display = 'none';
                }
                this.classList.remove('error');
            }
        });
    }
    
    // Şirket bilgileri formu
    const companyForm = document.getElementById('company-form');
    if (companyForm) {
        companyForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (validateCompanyForm()) {
                nextStep();
            }
        });
    }
    
    // Tüm inputlara blur event listener ekle - hata kontrolü için
    const formInputs = document.querySelectorAll('#company-form input');
    formInputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateInput(this);
        });
        
        input.addEventListener('input', function() {
            // Kullanıcı yazmaya başladığında error class'ını kaldır
            if (this.classList.contains('error')) {
                this.classList.remove('error');
            }
        });
    });
    
    // E-posta kontrolü ve validasyonu
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('email-error');
    let emailCheckTimeout = null;
    
    if (emailInput) {
        // E-posta format kontrolü
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        emailInput.addEventListener('blur', function() {
            const email = this.value.trim();
            if (email) {
                if (!emailRegex.test(email)) {
                    if (emailError) {
                        emailError.textContent = 'Geçerli bir e-posta adresi girin';
                        emailError.style.display = 'block';
                    }
                    this.classList.add('error');
                } else {
                    if (emailError) {
                        emailError.style.display = 'none';
                    }
                    this.classList.remove('error');
                    // E-posta formatı doğruysa availability kontrolü yap
                    if (typeof checkEmailAvailability === 'function') {
                        checkEmailAvailability(email);
                    }
                }
            }
        });
        
        emailInput.addEventListener('input', function() {
            const email = this.value.trim();
            
            // Input yazılırken hata mesajını gizle ve error class'ını kaldır
            if (emailError) {
                emailError.style.display = 'none';
                emailError.textContent = '';
            }
            if (this.classList.contains('error')) {
                this.classList.remove('error');
            }
            
            // Debounce: Kullanıcı yazmayı bıraktıktan sonra format kontrolü yap
            clearTimeout(emailCheckTimeout);
            emailCheckTimeout = setTimeout(() => {
                if (email && emailRegex.test(email)) {
                    if (typeof checkEmailAvailability === 'function') {
                        checkEmailAvailability(email);
                    }
                }
            }, 500);
        });
    }
    
    // Şifre doğrulama
    const password = document.getElementById('password');
    const passwordConfirm = document.getElementById('passwordConfirm');
    const passwordError = document.getElementById('password-error');
    const passwordConfirmError = document.getElementById('password-confirm-error');
    
    if (password) {
        // Şifre uzunluk kontrolü
        password.addEventListener('input', () => {
            if (password.value.length > 0 && password.value.length < 8) {
                password.setCustomValidity('Şifre en az 8 karakter olmalıdır');
                if (passwordError) {
                    passwordError.textContent = 'Şifre en az 8 karakter olmalıdır';
                    passwordError.style.display = 'block';
                }
                password.classList.add('error');
            } else {
                password.setCustomValidity('');
                if (passwordError) {
                    passwordError.style.display = 'none';
                }
                password.classList.remove('error');
            }
            // Şifre değiştiğinde passwordConfirm'i de kontrol et
            if (passwordConfirm && passwordConfirm.value) {
                if (password.value !== passwordConfirm.value) {
                    passwordConfirm.classList.add('error');
                    if (passwordConfirmError) {
                        passwordConfirmError.textContent = 'Şifreler eşleşmiyor';
                        passwordConfirmError.style.display = 'block';
                    }
                } else {
                    passwordConfirm.classList.remove('error');
                    if (passwordConfirmError) {
                        passwordConfirmError.style.display = 'none';
                    }
                }
            }
        });
    }
    
    if (passwordConfirm) {
        // Şifre tekrar kontrolü
        passwordConfirm.addEventListener('input', () => {
            if (password && password.value !== passwordConfirm.value && passwordConfirm.value.trim()) {
                passwordConfirm.setCustomValidity('Şifreler eşleşmiyor');
                passwordConfirm.classList.add('error');
                if (passwordConfirmError) {
                    passwordConfirmError.textContent = 'Şifreler eşleşmiyor';
                    passwordConfirmError.style.display = 'block';
                }
            } else {
                passwordConfirm.setCustomValidity('');
                passwordConfirm.classList.remove('error');
                if (passwordConfirmError) {
                    passwordConfirmError.style.display = 'none';
                }
            }
        });
    }
    
    // Ödeme yöntemi her zaman kart olarak ayarla
    purchaseData.payment.method = 'card';
    
    // Ödeme yöntemi her zaman kart olarak ayarla
    purchaseData.payment.method = 'card';
    
    // Kredi kartı formunu göster
    setTimeout(() => {
        const cardFields = document.getElementById('card-fields');
        if (cardFields) {
            cardFields.classList.remove('hidden');
            cardFields.style.removeProperty('display');
            cardFields.style.removeProperty('visibility');
            cardFields.style.removeProperty('opacity');
            cardFields.style.removeProperty('height');
            cardFields.style.removeProperty('overflow');
            cardFields.removeAttribute('hidden');
        }
    }, 100);
    
    // Kart numarası formatla - Sadece rakam kabul et
    const cardNumber = document.getElementById('cardNumber');
    if (cardNumber) {
        cardNumber.addEventListener('input', (e) => {
            // Sadece rakamları al, diğer karakterleri kaldır
            let value = e.target.value.replace(/\D/g, '');
            // Maksimum 16 rakam
            if (value.length > 16) {
                value = value.substring(0, 16);
            }
            // 4'erli gruplar halinde formatla
            let formatted = value.match(/.{1,4}/g)?.join(' ') || value;
            e.target.value = formatted;
        });
        
        // Paste event'inde de sadece rakamları kabul et
        cardNumber.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const numbersOnly = pastedText.replace(/\D/g, '').substring(0, 16);
            const formatted = numbersOnly.match(/.{1,4}/g)?.join(' ') || numbersOnly;
            cardNumber.value = formatted;
        });
    }
    
    // Son kullanma tarihi formatla - İlk 2 hane ay (1-12), son 2 hane yıl
    const cardExpiry = document.getElementById('cardExpiry');
    if (cardExpiry) {
        cardExpiry.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, ''); // Sadece rakamlar
            
            // İlk 2 hane ay kontrolü (1-12)
            if (value.length >= 1) {
                const firstDigit = parseInt(value[0]);
                
                // İlk rakam 0-1 arası olmalı (01-12)
                if (firstDigit > 1) {
                    // İlk rakam 2-9 ise, geçersiz - değeri temizle
                    value = '';
                } else if (firstDigit === 1) {
                    // İlk rakam 1 ise, ikinci rakam 0-2 olabilir (10, 11, 12)
                    if (value.length >= 2) {
                        const month = parseInt(value.substring(0, 2));
                        if (month > 12) {
                            // 13, 14, etc. geçersiz - sadece ilk rakamı tut
                            value = value.substring(0, 1);
                        }
                    }
                } else if (firstDigit === 0) {
                    // İlk rakam 0 ise, ikinci rakam 1-9 olabilir (01-09)
                    if (value.length >= 2) {
                        const secondDigit = parseInt(value[1]);
                        if (secondDigit === 0) {
                            // 00 geçersiz - sadece ilk rakamı tut
                            value = value.substring(0, 1);
                        }
                    }
                }
            }
            
            // Formatla: MM/YY (maksimum 4 rakam)
            if (value.length > 4) {
                value = value.substring(0, 4);
            }
            if (value.length >= 2) {
                value = value.substring(0, 2) + '/' + value.substring(2, 4);
            }
            e.target.value = value;
        });
        
        // Paste event'inde de kontrol et
        cardExpiry.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            let value = pastedText.replace(/\D/g, '');
            
            // Ay kontrolü (1-12)
            if (value.length >= 2) {
                const month = parseInt(value.substring(0, 2));
                if (month > 12 || month < 1) {
                    // Geçersiz ay - sadece ilk rakamı tut
                    value = value.substring(0, 1);
                }
            }
            
            // Maksimum 4 rakam
            if (value.length > 4) {
                value = value.substring(0, 4);
            }
            
            // Formatla
            if (value.length >= 2) {
                value = value.substring(0, 2) + '/' + value.substring(2, 4);
            }
            cardExpiry.value = value;
        });
    }
    
    // CVV sadece rakam
    const cardCvv = document.getElementById('cardCvv');
    if (cardCvv) {
        cardCvv.addEventListener('input', (e) => {
            cardCvv.value = cardCvv.value.replace(/\D/g, '');
        });
    }
    
    // Vergi numarası sadece rakam
    const vergiNumarasiInput = document.getElementById('vergiNumarasi');
    if (vergiNumarasiInput) {
        vergiNumarasiInput.addEventListener('input', (e) => {
            vergiNumarasiInput.value = vergiNumarasiInput.value.replace(/\D/g, '');
        });
        
        // Paste event'i için de temizle
        vergiNumarasiInput.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            vergiNumarasiInput.value = pastedText.replace(/\D/g, '');
        });
    }
}

/**
 * Input validasyonu - blur event'inde kullanılır
 */
function validateInput(input) {
    // Sadece required ve boş olan inputları kontrol et
    if (input.hasAttribute('required') && !input.value.trim()) {
        input.classList.add('error');
        return false;
    } else if (input.type === 'email' && input.value.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const emailError = document.getElementById('email-error');
        if (!emailRegex.test(input.value.trim())) {
            input.classList.add('error');
            if (emailError) {
                emailError.textContent = 'Geçerli bir e-posta adresi girin';
                emailError.style.display = 'block';
            }
            return false;
        } else {
            input.classList.remove('error');
            if (emailError) {
                emailError.style.display = 'none';
            }
        }
    } else if (input.type === 'tel' && input.value.trim()) {
        const phoneDigits = input.value.replace(/\D/g, '');
        const phoneError = document.getElementById('phone-error');
        if (phoneDigits.length < 12) {
            input.classList.add('error');
            if (phoneError) {
                phoneError.textContent = 'Geçerli bir telefon numarası girin';
                phoneError.style.display = 'block';
            }
            return false;
        } else {
            input.classList.remove('error');
            if (phoneError) {
                phoneError.style.display = 'none';
            }
        }
    } else if (input.checkValidity()) {
        input.classList.remove('error');
    }
    return true;
}

/**
 * E-posta kontrolü (API ile)
 */
async function checkEmailAvailability(email) {
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('email-error');
    
    if (!emailInput || !emailError) return;
    
    // E-posta format kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        emailError.style.display = 'none';
        emailError.textContent = '';
        emailInput.setCustomValidity('');
        return;
    }
    
    // API base URL'i belirle
    // file:// protokolü tespit edilirse localhost kullan
    const isFileProtocol = window.location.protocol === 'file:';
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' || 
                       !window.location.hostname ||
                       isFileProtocol;
    const apiBase = window.API_BASE_URL || 
        (isLocalhost
            ? 'http://localhost:' + (localStorage.getItem('backend_port') || '3001') + '/api'
            : '/api');
    
    try {
        const response = await fetch(`${apiBase}/public/check-email?email=${encodeURIComponent(email)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.exists) {
            // E-posta zaten kullanılıyor
            emailError.style.display = 'block';
            emailError.textContent = 'Bu e-posta adresi ile zaten bir hesap mevcut';
            emailInput.setCustomValidity('Bu e-posta adresi ile zaten bir hesap mevcut');
            emailInput.classList.add('error');
        } else {
            // E-posta kullanılabilir
            emailError.style.display = 'none';
            emailError.textContent = '';
            emailInput.setCustomValidity('');
            emailInput.classList.remove('error');
        }
    } catch (error) {
        console.error('❌ E-posta kontrolü hatası:', error);
        // Hata durumunda sessizce devam et (kullanıcıyı engelleme)
        emailError.style.display = 'none';
        emailError.textContent = '';
    }
}

/**
 * Şirket formu validasyonu
 */
function validateCompanyForm() {
    const form = document.getElementById('company-form');
    if (!form) return false;
    
    // Tüm inputları kontrol et ve hata class'ı ekle
    const formInputs = form.querySelectorAll('input[required]');
    let hasError = false;
    const errorInputs = [];
    
    formInputs.forEach(input => {
        let isValid = true;
        
        // Boş kontrolü
        if (!input.value.trim()) {
            input.classList.add('error');
            isValid = false;
        }
        // E-posta kontrolü
        else if (input.type === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const emailError = document.getElementById('email-error');
            if (!emailRegex.test(input.value.trim())) {
                input.classList.add('error');
                if (emailError) {
                    emailError.textContent = 'Geçerli bir e-posta adresi girin';
                    emailError.style.display = 'block';
                }
                isValid = false;
            } else {
                input.classList.remove('error');
                if (emailError) {
                    emailError.style.display = 'none';
                }
            }
        }
        // Telefon kontrolü - Sadece uzunluk kontrolü
        else if (input.type === 'tel') {
            const phoneDigits = input.value.replace(/\D/g, '');
            const phoneError = document.getElementById('phone-error');
            
            if (phoneDigits.length < 12) {
                input.classList.add('error');
                if (phoneError) {
                    phoneError.textContent = 'Geçerli bir telefon numarası girin';
                    phoneError.style.display = 'block';
                }
                isValid = false;
            } else {
                input.classList.remove('error');
                if (phoneError) {
                    phoneError.style.display = 'none';
                }
            }
        }
        // Şifre kontrolü
        else if (input.type === 'password' && input.id === 'password') {
            if (input.value.length < 8) {
                input.classList.add('error');
                isValid = false;
            }
        }
        // Şifre tekrar kontrolü
        else if (input.type === 'password' && input.id === 'passwordConfirm') {
            const passwordInput = document.getElementById('password');
            const passwordConfirmError = document.getElementById('password-confirm-error');
            if (passwordInput && input.value !== passwordInput.value && input.value.trim()) {
                input.classList.add('error');
                if (passwordConfirmError) {
                    passwordConfirmError.textContent = 'Şifreler eşleşmiyor';
                    passwordConfirmError.style.display = 'block';
                }
                isValid = false;
            } else {
                input.classList.remove('error');
                if (passwordConfirmError) {
                    passwordConfirmError.style.display = 'none';
                }
            }
        }
        // Diğer validasyonlar
        else if (!input.checkValidity()) {
            input.classList.add('error');
            isValid = false;
        }
        
        if (!isValid) {
            hasError = true;
            errorInputs.push(input);
        } else {
            input.classList.remove('error');
        }
    });
    
    // Temel HTML5 validasyonu
    if (!form.checkValidity() || hasError) {
        // Tüm hatalı inputlara error mesajı göster
        errorInputs.forEach(input => {
            // Boş inputlar için
            if (!input.value.trim()) {
                if (input.type === 'email') {
                    const emailError = document.getElementById('email-error');
                    if (emailError) {
                        emailError.textContent = 'E-posta adresi gereklidir';
                        emailError.style.display = 'block';
                    }
                } else if (input.type === 'tel') {
                    const phoneError = document.getElementById('phone-error');
                    if (phoneError) {
                        phoneError.textContent = 'Telefon numarası gereklidir';
                        phoneError.style.display = 'block';
                    }
                }
            }
        });
        
        // İlk hatalı input'a focus et
        if (errorInputs.length > 0) {
            const firstError = errorInputs[0];
            firstError.focus();
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return false;
    }
    
    // E-posta kontrolü - input seviyesinde kontrol edildi ama tekrar kontrol et
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('email-error');
    if (emailInput && emailError && emailError.style.display === 'block') {
        // E-posta hatası varsa, kullanıcıyı uyar
        emailInput.focus();
        emailInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
    }
    
    // Şifre uzunluk kontrolü
    const passwordInput = document.getElementById('password');
    if (!passwordInput) {
        console.error('❌ password input bulunamadı');
        return false;
    }
    const password = passwordInput.value;
    if (password.length < 8) {
        if (typeof createToast === 'function') {
            createToast('error', 'Şifre en az 8 karakter olmalıdır');
        } else if (typeof window.showToast === 'function') {
            window.showToast('Şifre en az 8 karakter olmalıdır', 'error');
        }
        passwordInput.focus();
        return false;
    }
    
    // Şifre tekrar kontrolü
    const passwordConfirmInput = document.getElementById('passwordConfirm');
    if (!passwordConfirmInput) {
        console.error('❌ passwordConfirm input bulunamadı');
        return false;
    }
    const passwordConfirm = passwordConfirmInput.value;
    if (password !== passwordConfirm) {
        if (typeof createToast === 'function') {
            createToast('error', 'Şifreler eşleşmiyor');
        } else if (typeof window.showToast === 'function') {
            window.showToast('Şifreler eşleşmiyor', 'error');
        }
        passwordConfirmInput.focus();
        return false;
    }
    
    // E-posta format kontrolü
    const emailInputCheck = document.getElementById('email');
    if (!emailInputCheck) {
        console.error('❌ email input bulunamadı');
        return false;
    }
    const email = emailInputCheck.value;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        if (typeof createToast === 'function') {
            createToast('error', 'Geçerli bir e-posta adresi girin');
        } else if (typeof window.showToast === 'function') {
            window.showToast('Geçerli bir e-posta adresi girin', 'error');
        }
        emailInputCheck.focus();
        return false;
    }
    
    // İsim soyisim kontrolü
    const fullNameInput = document.getElementById('fullName');
    if (!fullNameInput) {
        console.error('❌ fullName input bulunamadı');
        return false;
    }
    const fullName = fullNameInput.value.trim();
    if (!fullName) {
        if (typeof createToast === 'function') {
            createToast('error', 'İsim soyisim gerekli');
        } else if (typeof window.showToast === 'function') {
            window.showToast('İsim soyisim gerekli', 'error');
        }
        fullNameInput.focus();
        return false;
    }
    
    // İl ve ilçe kontrolü
    const cityInput = document.getElementById('city');
    const stateInput = document.getElementById('state');
    if (!cityInput || !stateInput) {
        console.error('❌ city veya state input bulunamadı');
        return false;
    }
    const city = cityInput.value.trim();
    const state = stateInput.value.trim();
    if (!city || !state) {
        if (typeof createToast === 'function') {
            createToast('error', 'İl ve ilçe gerekli');
        } else if (typeof window.showToast === 'function') {
            window.showToast('İl ve ilçe gerekli', 'error');
        }
        if (!city) cityInput.focus();
        else stateInput.focus();
        return false;
    }
    
    // Vergi dairesi kontrolü
    const vergiDairesiInput = document.getElementById('vergiDairesi');
    if (!vergiDairesiInput) {
        console.error('❌ vergiDairesi input bulunamadı');
        return false;
    }
    const vergiDairesi = vergiDairesiInput.value.trim();
    if (!vergiDairesi) {
        if (typeof createToast === 'function') {
            createToast('error', 'Vergi dairesi gerekli');
        } else if (typeof window.showToast === 'function') {
            window.showToast('Vergi dairesi gerekli', 'error');
        }
        vergiDairesiInput.focus();
        return false;
    }
    
    // Vergi numarası kontrolü
    const vergiNumarasiInput = document.getElementById('vergiNumarasi');
    if (!vergiNumarasiInput) {
        console.error('❌ vergiNumarasi input bulunamadı');
        return false;
    }
    const vergiNumarasi = vergiNumarasiInput.value.trim();
    if (!vergiNumarasi) {
        if (typeof createToast === 'function') {
            createToast('error', 'Vergi numarası gerekli');
        } else if (typeof window.showToast === 'function') {
            window.showToast('Vergi numarası gerekli', 'error');
        }
        vergiNumarasiInput.focus();
        return false;
    }
    
    // Form verilerini kaydet
    const companyNameInput = document.getElementById('companyName');
    if (!companyNameInput) {
        console.error('❌ companyName input bulunamadı');
        return false;
    }
    
    const usernameInput = document.getElementById('username');
    if (!usernameInput) {
        console.error('❌ username input bulunamadı');
        return false;
    }
    
    purchaseData.company = {
        company_name: companyNameInput.value.trim(),
        full_name: fullName,
        username: usernameInput.value.trim(),
        email: email.trim(),
        phone: document.getElementById('phone').value.trim(),
        city: city,
        state: state,
        tax_office: vergiDairesi,
        tax_number: vergiNumarasi,
        password: password
    };
    
    return true;
}

/**
 * Ödeme formu validasyonu
 */
function validatePaymentForm() {
    const method = purchaseData.payment.method;
    
    if (!method) {
        purchaseData.payment.method = 'card'; // Varsayılan kart
    }
    
    if (purchaseData.payment.method === 'card') {
        const cardNumber = document.getElementById('cardNumber');
        const cardExpiry = document.getElementById('cardExpiry');
        const cardCvv = document.getElementById('cardCvv');
        const cardName = document.getElementById('cardName');
        
        if (!cardNumber || !cardNumber.value.trim()) {
            if (typeof createToast === 'function') {
                createToast('error', 'Lütfen kart numarasını girin');
            } else if (typeof window.showToast === 'function') {
                window.showToast('Lütfen kart numarasını girin', 'error');
            }
            if (cardNumber) cardNumber.focus();
            return false;
        }
        
        const cardNumberValue = cardNumber.value.replace(/\s/g, '');
        if (cardNumberValue.length < 13) {
            if (typeof createToast === 'function') {
                createToast('error', 'Lütfen geçerli bir kart numarası girin');
            } else if (typeof window.showToast === 'function') {
                window.showToast('Lütfen geçerli bir kart numarası girin', 'error');
            }
            cardNumber.focus();
            return false;
        }
        
        if (!cardExpiry || !cardExpiry.value.trim() || cardExpiry.value.length !== 5) {
            if (typeof createToast === 'function') {
                createToast('error', 'Lütfen geçerli bir son kullanma tarihi girin (MM/YY)');
            } else if (typeof window.showToast === 'function') {
                window.showToast('Lütfen geçerli bir son kullanma tarihi girin (MM/YY)', 'error');
            }
            if (cardExpiry) cardExpiry.focus();
            return false;
        }
        
        if (!cardCvv || !cardCvv.value.trim() || cardCvv.value.length < 3) {
            if (typeof createToast === 'function') {
                createToast('error', 'Lütfen geçerli bir CVV girin');
            } else if (typeof window.showToast === 'function') {
                window.showToast('Lütfen geçerli bir CVV girin', 'error');
            }
            if (cardCvv) cardCvv.focus();
            return false;
        }
        
        if (!cardName || !cardName.value.trim()) {
            if (typeof createToast === 'function') {
                createToast('error', 'Lütfen kart üzerindeki ismi girin');
            } else if (typeof window.showToast === 'function') {
                window.showToast('Lütfen kart üzerindeki ismi girin', 'error');
            }
            if (cardName) cardName.focus();
            return false;
        }
        
        purchaseData.payment.card = {
            number: cardNumberValue,
            expiry: cardExpiry.value,
            cvv: cardCvv.value,
            name: cardName.value
        };
    }
    
    return true;
}

/**
 * Sidebar'ı güncelle
 */
function updateSidebar(plan, price, tax, total) {
    if (!plan) {
        plan = selectedPlan;
    }
    if (!plan) return;
    
    // Billing period'u al (varsayılan: monthly)
    const billingPeriod = window.purchaseBillingPeriod || 'monthly';
    const isYearly = billingPeriod === 'yearly' || billingPeriod === 'yillik';

    if (!price || !tax || !total) {
        // Plan fiyatını belirle
        let basePrice;
        if (isYearly) {
            // Yıllık paket: müşteriden TOPLAM yıllık ücreti tahsil ediyoruz
            // (faturalandırma aylık olsa bile, bugün ödenecek tutar yıllık toplam olmalı)
            let yearlyPrice = plan.yearly_price;
            if (yearlyPrice === undefined || yearlyPrice === null) {
                yearlyPrice = plan.yillik_ucret;
            }

            // Eğer hala yoksa, aylık fiyattan yıllık toplamı türet (10 ay ödeme, 2 ay bedava mantığı)
            if (yearlyPrice === undefined || yearlyPrice === null) {
                const monthlyPrice = plan.monthly_price || plan.aylik_ucret;
                if (monthlyPrice) {
                    // monthlyPrice kuruş cinsinden → TL'ye çevir, 10 ay ile çarp, tekrar kuruşa dön
                    const yearlyInTl = (monthlyPrice / 100) * 10;
                    yearlyPrice = Math.round(yearlyInTl * 100); // tekrar kuruş
                }
            }

            // yearlyPrice kuruş → TL
            basePrice = yearlyPrice ? (yearlyPrice / 100) : 0;
        } else {
            // Aylık paket: monthly_price veya aylik_ucret (aylık fiyat)
            const monthlyPrice = plan.monthly_price || plan.aylik_ucret;
            basePrice = monthlyPrice ? (monthlyPrice / 100) : 0;
        }
        price = basePrice;
        tax = price * 0.20; // KDV %20
        total = price + tax;
    }
    
    // Türk Lirası formatında (binlik ayırıcı ve 2 ondalık basamak)
    const priceFormatted = parseFloat(price).toLocaleString('tr-TR', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
    const taxFormatted = parseFloat(tax).toLocaleString('tr-TR', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
    const totalFormatted = parseFloat(total).toLocaleString('tr-TR', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
    
    // Sidebar'ı güncelle
    const sidebarPlanName = document.getElementById('sidebar-plan-name');
    const sidebarBasePrice = document.getElementById('sidebar-base-price');
    const sidebarTax = document.getElementById('sidebar-tax');
    const sidebarTotal = document.getElementById('sidebar-total');
    const sidebarPlanPeriod = document.querySelector('.landing-sidebar-plan-period');
    
    // Plan adını normalize et (backend'den plan_name veya plan_adi olarak gelebilir)
    const planName = plan.plan_name || plan.plan_adi || 'Bilinmeyen Plan';
    if (sidebarPlanName) sidebarPlanName.textContent = planName;
    if (sidebarBasePrice) sidebarBasePrice.textContent = '₺' + priceFormatted;
    if (sidebarTax) sidebarTax.textContent = '₺' + taxFormatted;
    if (sidebarTotal) sidebarTotal.textContent = '₺' + totalFormatted;
    if (sidebarPlanPeriod) {
        sidebarPlanPeriod.textContent = isYearly ? 'Yıllık abonelik | Aylık faturalandırılır' : 'Aylık abonelik';
    }
}

/**
 * Özet sayfasını doldur
 */
function fillSummary() {
    if (!selectedPlan) return;

    // Billing period'u al (varsayılan: monthly)
    const billingPeriod = window.purchaseBillingPeriod || 'monthly';
    const isYearly = billingPeriod === 'yearly' || billingPeriod === 'yillik';

    // Seçili plana göre baz fiyatı (KDV hariç) TL cinsinden hesapla
    let basePrice;
    if (isYearly) {
        // Yıllık paket: müşteriden TOPLAM yıllık ücreti tahsil ediyoruz
        let yearlyPrice = selectedPlan.yearly_price;
        if (yearlyPrice === undefined || yearlyPrice === null) {
            yearlyPrice = selectedPlan.yillik_ucret;
        }

        // Eğer hala yoksa, aylık fiyattan yıllık toplamı türet (10 ay ödeme, 2 ay bedava mantığı)
        if (yearlyPrice === undefined || yearlyPrice === null) {
            const monthlyPrice = selectedPlan.monthly_price || selectedPlan.aylik_ucret;
            if (monthlyPrice) {
                const yearlyInTl = (monthlyPrice / 100) * 10;
                yearlyPrice = Math.round(yearlyInTl * 100); // kuruş
            }
        }

        basePrice = yearlyPrice ? (yearlyPrice / 100) : 0; // kuruş → TL
    } else {
        // Aylık paket: aylık fiyat
        const monthlyPrice = selectedPlan.monthly_price || selectedPlan.aylik_ucret;
        basePrice = monthlyPrice ? (monthlyPrice / 100) : 0;
    }

    const price = basePrice.toFixed(2);
    const tax = (basePrice * 0.20).toFixed(2);
    const total = (basePrice * 1.20).toFixed(2);
    
    // Türk Lirası formatında (binlik ayırıcı ve 2 ondalık basamak)
    const priceFormatted = parseFloat(price).toLocaleString('tr-TR', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
    const taxFormatted = parseFloat(tax).toLocaleString('tr-TR', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
    const totalFormatted = parseFloat(total).toLocaleString('tr-TR', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
    
    // Plan dönemi metnini güncelle (Aylık / Yıllık)
    const summaryPlanSublabel = document.querySelector('.landing-summary-sublabel');
    if (summaryPlanSublabel) {
        summaryPlanSublabel.textContent = isYearly
            ? 'Yıllık abonelik | Aylık faturalandırılır'
            : 'Aylık abonelik';
    }

    // Sidebar'ı güncelle
    updateSidebar(selectedPlan, price, tax, total);
    
    // Özet sayfasını güncelle
    const summaryPlan = document.getElementById('summary-plan');
    const summaryBasePrice = document.getElementById('summary-base-price');
    const summaryCompany = document.getElementById('summary-company');
    const summaryName = document.getElementById('summary-name');
    const summaryUsername = document.getElementById('summary-username');
    const summaryEmail = document.getElementById('summary-email');
    const summaryPayment = document.getElementById('summary-payment');
    const summarySubtotal = document.getElementById('summary-subtotal');
    const summaryTax = document.getElementById('summary-tax');
    const summaryTotal = document.getElementById('summary-total');
    
    if (summaryPlan) summaryPlan.textContent = selectedPlan.plan_adi;
    if (summaryBasePrice) summaryBasePrice.textContent = '₺' + priceFormatted;
    if (summaryCompany) summaryCompany.textContent = purchaseData.company.company_name || '-';
    if (summaryName) summaryName.textContent = purchaseData.company.full_name || '-';
    if (summaryUsername) summaryUsername.textContent = purchaseData.company.username || '-';
    if (summaryEmail) summaryEmail.textContent = purchaseData.company.email || '-';
    
    if (summaryPayment) summaryPayment.textContent = 'Kredi/Banka Kartı';
    
    if (summarySubtotal) summarySubtotal.textContent = '₺' + priceFormatted;
    if (summaryTax) summaryTax.textContent = '₺' + taxFormatted;
    if (summaryTotal) summaryTotal.textContent = '₺' + totalFormatted;
}

/**
 * Sonraki adıma geç
 */
function nextStep() {
    if (currentStep === 1) {
        if (!selectedPlan) {
            if (typeof createToast === 'function') {
                createToast('error', 'Lütfen bir paket seçin');
            } else if (typeof window.showToast === 'function') {
                window.showToast('Lütfen bir paket seçin', 'error');
            }
            return;
        }
    } else if (currentStep === 2) {
        const isValid = validateCompanyForm();
        if (!isValid) {
            console.error('❌ Form validasyonu başarısız');
            // Hatalı inputları göster
            const form = document.getElementById('company-form');
            if (form) {
                const errorInputs = form.querySelectorAll('input.error');
                if (errorInputs.length > 0) {
                    const firstError = errorInputs[0];
                    firstError.focus();
                    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
            return;
        }
        // Form verilerini kaydet
        const companyNameInput = document.getElementById('companyName');
        const fullNameInput = document.getElementById('fullName');
        const usernameInput = document.getElementById('username');
        const emailInput = document.getElementById('email');
        const phoneInput = document.getElementById('phone');
        const cityInput = document.getElementById('city');
        const stateInput = document.getElementById('state');
        const addressInput = document.getElementById('address');
        const vergiDairesiInput = document.getElementById('vergiDairesi');
        const vergiNumarasiInput = document.getElementById('vergiNumarasi');
        const passwordInput = document.getElementById('password');
        
        if (companyNameInput && fullNameInput && usernameInput && emailInput && phoneInput && cityInput && stateInput && addressInput && passwordInput) {
            purchaseData.company = {
                company_name: companyNameInput.value.trim(),
                full_name: fullNameInput.value.trim(),
                username: usernameInput.value.trim(),
                email: emailInput.value.trim(),
                phone: phoneInput.value.trim(),
                city: cityInput.value.trim(),
                state: stateInput.value.trim(),
                address: addressInput.value.trim(),
                tax_office: vergiDairesiInput ? vergiDairesiInput.value.trim() : '',
                tax_number: vergiNumarasiInput ? vergiNumarasiInput.value.trim() : '',
                password: passwordInput.value
            };
        }
    } else if (currentStep === 3) {
        if (!validatePaymentForm()) {
            return;
        }
    }
    
    if (currentStep === 3) {
        fillSummary();
    }
    
    if (currentStep < 4) {
        currentStep++;
        showStep(currentStep);
    }
}

/**
 * Önceki adıma dön
 */
function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
    }
}

/**
 * Adımı göster
 */
function showStep(step) {
    // Tüm form step'lerini gizle
    document.querySelectorAll('.landing-form-step, .purchase-step').forEach(s => {
        s.style.display = 'none';
        s.classList.remove('active');
    });
    
    // İlgili adımı göster
    const stepElement = document.getElementById('landing-form-step-' + step) || document.getElementById('form-step-' + step) || document.getElementById('step-' + step);
    if (stepElement) {
        stepElement.style.display = 'block';
        stepElement.classList.add('active');
    }
    
    // Step indicator'ları güncelle
    for (let i = 1; i <= 4; i++) {
        const stepItem = document.getElementById('landing-step-' + i);
        if (stepItem) {
            stepItem.classList.remove('active', 'completed');
            if (i < step) {
                stepItem.classList.add('completed');
            } else if (i === step) {
                stepItem.classList.add('active');
            }
        }
    }
    
    // Step-2 gösterildiğinde form listener'ları başlat
    if (step === 2) {
        setTimeout(() => {
            initFormListeners();
        }, 100);
    }
    
    // Step-3 gösterildiğinde ödeme formlarını kontrol et
    if (step === 3) {
        // Kredi kartı formunu göster
        setTimeout(() => {
            const cardFields = document.getElementById('card-fields');
            if (cardFields) {
                cardFields.classList.remove('hidden');
                cardFields.style.removeProperty('display');
                cardFields.style.removeProperty('visibility');
                cardFields.style.removeProperty('opacity');
                cardFields.style.removeProperty('height');
                cardFields.style.removeProperty('overflow');
                cardFields.removeAttribute('hidden');
            }
        }, 50);
    }
}

/**
 * Satın alma işlemini tamamla
 */
async function completePurchase() {
    const btn = document.getElementById('complete-purchase-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'İşleniyor...';
    }
    
    // Loading göster
    const loadingState = document.getElementById('loading-state');
    if (loadingState) {
        loadingState.style.display = 'block';
    }
    // Tüm form step'lerini gizle
    document.querySelectorAll('.landing-form-step').forEach(s => {
        s.style.display = 'none';
    });
    
    try {
        // API base URL'i belirle
        // file:// protokolü tespit edilirse localhost kullan
        const isFileProtocol = window.location.protocol === 'file:';
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' || 
                           !window.location.hostname ||
                           isFileProtocol;
        const apiBase = window.API_BASE_URL || 
            (isLocalhost
                ? 'http://localhost:' + (localStorage.getItem('backend_port') || '3001') + '/api'
                : '/api');
        
        // Backend endpoint'e satın alma isteği gönder
        const response = await fetch(apiBase + '/public/purchase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                plan_id: selectedPlan.id,
                plan_kodu: selectedPlan.plan_kodu,
                company_name: purchaseData.company.company_name,
                full_name: purchaseData.company.full_name,
                username: purchaseData.company.username,
                email: purchaseData.company.email,
                phone: purchaseData.company.phone,
                city: purchaseData.company.city,
                state: purchaseData.company.state,
                address: purchaseData.company.address,
                tax_office: purchaseData.company.tax_office || '',
                tax_number: purchaseData.company.tax_number || '',
                password: purchaseData.company.password,
                payment_method: purchaseData.payment.method,
                payment_data: purchaseData.payment.card || null,
                billing_period: window.purchaseBillingPeriod || 'monthly'
            })
        });
        
        let result;
        try {
            result = await response.json();
        } catch (parseError) {
            const text = await response.text();
            console.error('❌ JSON parse hatası:', parseError);
            console.error('❌ Response text:', text);
            throw new Error('Sunucu yanıtı geçersiz format');
        }
        
        if (!response.ok) {
            // HTTP hata durumu
            const errorMsg = result.error || result.message || `HTTP ${response.status}: ${response.statusText}`;
            const errorDetails = result.details || result.message || '';
            console.error('❌ API Error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorMsg,
                details: errorDetails,
                code: result.code,
                result: result
            });
            
            // E-posta zaten mevcut hatası için özel işlem
            if (errorMsg.includes('zaten bir hesap mevcut') || errorMsg.includes('already exists')) {
                const userWantsLogin = confirm(
                    'Bu e-posta adresi ile zaten bir hesap mevcut.\n\n' +
                    'Mevcut hesabınıza giriş yapmak ister misiniz?\n\n' +
                    'Tamam: Giriş sayfasına yönlendir\n' +
                    'İptal: Farklı bir e-posta adresi kullanın'
                );
                
                if (userWantsLogin) {
                    // Login sayfasına yönlendir
                    window.location.href = 'login.html';
                    return; // İşlemi durdur
                } else {
                    // Email alanına odaklan ve hata göster
                    const emailInput = document.getElementById('email');
                    const emailErrorEl = document.getElementById('email-error');
                    if (emailInput) {
                        emailInput.focus();
                        emailInput.classList.add('error');
                        // Email alanının altına hata mesajı göster
                        if (emailErrorEl) {
                            emailErrorEl.textContent = 'Bu e-posta adresi ile zaten bir hesap mevcut. Lütfen farklı bir e-posta adresi kullanın veya giriş yapın.';
                            emailErrorEl.style.display = 'block';
                        }
                    }
                    throw new Error('Lütfen farklı bir e-posta adresi kullanın');
                }
            }
            
            // Daha detaylı hata mesajı
            const fullErrorMsg = errorDetails ? `${errorMsg}\n\nDetay: ${errorDetails}` : errorMsg;
            throw new Error(fullErrorMsg);
        }
        
        if (result.success) {
            // Başarılı - Dashboard'a yönlendir
            const loadingState = document.getElementById('loading-state');
            if (loadingState) {
                loadingState.innerHTML = `
                    <div style="text-align: center; padding: 3rem 2rem;">
                        <div class="success-checkmark" style="width: 80px; height: 80px; margin: 0 auto 2rem; position: relative;">
                            <svg class="checkmark-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" style="width: 100%; height: 100%;">
                                <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none" stroke="#10b981" stroke-width="3" style="stroke-dasharray: 166; stroke-dashoffset: 166; animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;"/>
                                <path class="checkmark-check" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M14.1 27.2l7.1 7.2 16.7-16.8" style="stroke-dasharray: 48; stroke-dashoffset: 48; animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;"/>
                            </svg>
                        </div>
                        <h3 style="color: #1a1a1a; margin-bottom: 0.75rem; font-size: 1.5rem; font-weight: 600;">Satın Alma Başarılı!</h3>
                        <p style="color: #666; margin-bottom: 0; font-size: 0.95rem;">Hesabınız oluşturuldu. Yönlendiriliyorsunuz...</p>
                    </div>
                    <style>
                        @keyframes stroke {
                            100% {
                                stroke-dashoffset: 0;
                            }
                        }
                        .success-checkmark .checkmark-circle {
                            animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
                        }
                        .success-checkmark .checkmark-check {
                            animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
                        }
                    </style>
                `;
            }
            
            // Tenant code ve bilgileri al
            const tenantCode = result.data?.tenant_code || result.tenant_code;
            const username = purchaseData.company.username;
            
            // Tenant code ve username'i localStorage'a kaydet (güvenlik/privacy için URL'de görünmesin)
            if (tenantCode) {
                localStorage.setItem('tenant_code', tenantCode);
            }
            if (username) {
                localStorage.setItem('username', username);
            }
            
            // Dashboard'a yönlendir (URL parametreleri olmadan)
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
        } else {
            throw new Error(result.error || result.message || 'Satın alma işlemi başarısız');
        }
        
    } catch (error) {
        console.error('❌ Satın alma hatası:', error);
        console.error('❌ Hata detayları:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        // E-posta hatası için özel işlem yapıldıysa (login'e yönlendirme veya email alanına odaklanma), alert gösterme
        if (error.message === 'Lütfen farklı bir e-posta adresi kullanın') {
            // Email alanına odaklan ve hata göster (zaten yukarıda yapıldı)
            // Loading'i gizle, adımı göster
            const loadingState = document.getElementById('loading-state');
            if (loadingState) {
                loadingState.style.display = 'none';
            }
            showStep(currentStep);
            return; // İşlemi durdur
        }
        
        // Kullanıcıya hata mesajı göster
        const errorMessage = error.message || 'Satın alma işlemi sırasında bir hata oluştu';
        alert('Satın alma işlemi başarısız:\n\n' + errorMessage + '\n\nLütfen bilgilerinizi kontrol edip tekrar deneyin.');
        
        // Loading'i gizle, adımı göster
        const loadingState = document.getElementById('loading-state');
        if (loadingState) {
            loadingState.style.display = 'none';
        }
        showStep(currentStep);
        
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Satın Al';
        }
    }
}

/**
 * Purchase sayfasında aylık/yıllık toggle fonksiyonu
 */
function togglePurchasePricing(period) {
    // Toggle butonlarını güncelle
    document.querySelectorAll('#purchase-toggle-monthly, #purchase-toggle-yearly').forEach(btn => btn.classList.remove('active'));
    if (period === 'yearly') {
        document.getElementById('purchase-toggle-yearly')?.classList.add('active');
    } else {
        document.getElementById('purchase-toggle-monthly')?.classList.add('active');
    }
    
    // Global billing period değişkenini güncelle
    window.purchaseBillingPeriod = period;
    
    // Planları yeniden yükle (toggle değiştiğinde planların yeniden render edilmesi için)
    const selectedPlanCode = document.querySelector('.landing-plan-option.selected')?.dataset.plan;
    loadPlans(selectedPlanCode);
}
