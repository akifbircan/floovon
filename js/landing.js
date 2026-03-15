/**
 * Landing Page JavaScript
 * Paketleri yükler ve FAQ accordion işlevselliği sağlar
 */

document.addEventListener('DOMContentLoaded', async function() {
    // Lucide icons initialize
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // Paketleri yükle
    await loadPricingPlans();
    
    // FAQ accordion
    initFAQ();
    
    // Smooth scroll
    initSmoothScroll();

    // Tema toggle
    initLandingTheme();
});

/**
 * Landing tema yönetimi (light / dark)
 * - body[data-default-theme] ile varsayılan tema
 * - body[data-show-theme-toggle="false"] ile header'daki butonu gizleyebilme
 * - localStorage ile kullanıcı seçimini hatırlama (buton görünürse)
 */
function applyLandingTheme(theme) {
    const body = document.body;
    if (!body) return;

    const header = document.querySelector('.landing-header');
    const logo = document.querySelector('.landing-logo img');
    const footerLogo = document.querySelector('.landing-footer-logo img');
    const toggle = document.querySelector('.landing-theme-toggle');
    const thumb = toggle ? toggle.querySelector('.landing-theme-toggle-thumb') : null;

    const normalizedTheme = theme === 'light' ? 'light' : 'dark';

    body.classList.remove('theme-light', 'theme-dark');
    body.classList.add(normalizedTheme === 'light' ? 'theme-light' : 'theme-dark');

    if (header) {
        if (normalizedTheme === 'light') {
            header.classList.add('light-header');
        } else {
            header.classList.remove('light-header');
        }
    }

    if (logo) {
        logo.src = normalizedTheme === 'light'
            ? '../assets/landing/logo-floovon-dark.svg'
            : '../assets/landing/logo-floovon-light.svg';
    }

    if (footerLogo) {
        footerLogo.src = normalizedTheme === 'light'
            ? '../assets/landing/logo-floovon-dark.svg'
            : '../assets/landing/logo-floovon-light.svg';
    }

    if (toggle && thumb) {
        toggle.setAttribute('data-theme', normalizedTheme);
        if (normalizedTheme === 'light') {
            thumb.style.transform = 'translateX(22px)';
        } else {
            thumb.style.transform = 'translateX(0)';
        }
    }
}

function getInitialLandingTheme(showToggle) {
    const body = document.body;
    if (!body) return 'dark';

    const defaultThemeAttr = (body.dataset.defaultTheme || '').toLowerCase();
    const defaultTheme = (defaultThemeAttr === 'light' || defaultThemeAttr === 'dark')
        ? defaultThemeAttr
        : 'dark';

    if (showToggle) {
        try {
            const saved = localStorage.getItem('floovon_landing_theme');
            if (saved === 'light' || saved === 'dark') {
                return saved;
            }
        } catch (e) {
            // localStorage erişilemezse sessizce devam et
        }
    } else {
        // Tema butonu gizliyse, eski kaydı temizleyip her zaman default'u kullan
        try {
            localStorage.removeItem('floovon_landing_theme');
        } catch (e) {
            // yoksay
        }
    }

    return defaultTheme;
}

function initLandingTheme() {
    const body = document.body;
    if (!body) return;

    const showToggleAttr = body.dataset.showThemeToggle;
    const showToggle = (showToggleAttr === undefined || showToggleAttr === null)
        ? true
        : showToggleAttr.toLowerCase() !== 'false';

    const toggle = document.querySelector('.landing-theme-toggle');

    const initialTheme = getInitialLandingTheme(showToggle);
    applyLandingTheme(initialTheme);

    // Tema butonu hiç yoksa veya bilerek gizlenmişse sadece temayı uygula
    if (!toggle) return;
    if (!showToggle) {
        toggle.style.display = 'none';
        return;
    }

    toggle.addEventListener('click', function () {
        const currentTheme = document.body.classList.contains('theme-light') ? 'light' : 'dark';
        const nextTheme = currentTheme === 'light' ? 'dark' : 'light';

        applyLandingTheme(nextTheme);

        try {
            localStorage.setItem('floovon_landing_theme', nextTheme);
        } catch (e) {
            // localStorage erişimi yoksa yoksay
        }
    });
}

/**
 * Paketleri API'den yükle ve göster
 */
async function loadPricingPlans() {
    const pricingGrid = document.getElementById('landing-pricing-grid') || document.querySelector('.landing-pricing-grid');
    if (!pricingGrid) return;
    
    try {
        // API base URL'i belirle
        // file:// protokolü tespit edilirse localhost kullan
        const isFileProtocol = window.location.protocol === 'file:';
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' || 
                           !window.location.hostname;
        
        const apiBase = window.API_BASE_URL || 
            (isFileProtocol || isLocalhost
                ? `http://localhost:${localStorage.getItem('backend_port') || '3001'}/api`
                : '/api');
        
        // Public API endpoint'den paketleri çek
        const response = await fetch(`${apiBase}/public/plans`);
        const result = await response.json();
        
        if (!result.success || !result.data) {
            throw new Error('Paketler yüklenemedi');
        }
        
        const plans = result.data;
        
        // Fallback: Eğer API'den veri gelmezse mock data kullan
        /* const plans = [
            {
                id: 1,
                plan_adi: 'Basic',
                plan_kodu: 'basic',
                aylik_ucret: 99900, // kuruş cinsinden
                max_kullanici: 10,
                max_depolama_gb: 100,
                ozellikler: JSON.stringify([
                    '10 kullanıcıya kadar',
                    '100 GB depolama alanı',
                    'Temel sipariş ve müşteri yönetimi'
                ])
            },
            {
                id: 2,
                plan_adi: 'Pro Kurumsal',
                plan_kodu: 'pro_kurumsal',
                aylik_ucret: 249900,
                max_kullanici: 50,
                max_depolama_gb: 1000,
                ozellikler: JSON.stringify([
                    '50 kullanıcıya kadar',
                    '1000 GB depolama alanı',
                    'Gelişmiş raporlama ve API erişimi'
                ])
            },
            {
                id: 3,
                plan_adi: 'Enterprise',
                plan_kodu: 'enterprise',
                aylik_ucret: 499900,
                max_kullanici: 200,
                max_depolama_gb: 5000,
                ozellikler: JSON.stringify([
                    '200 kullanıcıya kadar',
                    '5000 GB depolama alanı',
                    '7/24 öncelikli destek ve özel entegrasyonlar'
                ])
            }
        ]; */
        
        pricingGrid.innerHTML = '';
        
        plans.forEach((plan, index) => {
            // Türk Lirası formatında fiyat (binlik ayırıcı: nokta, küsürat yok)
            const monthlyPriceValue = plan.aylik_ucret / 100;
            // Yıllık fiyat: veritabanındaki yillik_ucret toplam yıllık fiyat (kuruş cinsinden), /100 yapıp 12'ye bölerek aylık fiyatı bul
            // Örnek: 15.000.000 kuruş / 100 = 15.000 TL, 15.000 / 12 = 1.250 TL
            // Örnek: 27.000.000 kuruş / 100 = 27.000 TL, 27.000 / 12 = 2.250 TL
            let yearlyPriceValue;
            // yillik_ucret kuruş cinsinden, önce /100 yapıp TL'ye çevir, sonra /12 yaparak aylık fiyatı bul
            if (plan.yillik_ucret && plan.yillik_ucret > 0) {
                yearlyPriceValue = (plan.yillik_ucret / 100) / 12;
            } else {
                // Fallback: aylık fiyat * 10 (10 ay ödeme, 2 ay bedava mantığı) / 12
                yearlyPriceValue = (monthlyPriceValue * 10) / 12;
            }
            // Binlik ayırıcı olarak nokta kullan, küsürat yok
            const monthlyPrice = Math.round(monthlyPriceValue).toLocaleString('tr-TR', { 
                minimumFractionDigits: 0, 
                maximumFractionDigits: 0,
                useGrouping: true
            });
            const yearlyPrice = Math.round(yearlyPriceValue).toLocaleString('tr-TR', { 
                minimumFractionDigits: 0, 
                maximumFractionDigits: 0,
                useGrouping: true
            });
            // ozellikler bazen akıllı tırnak (" ") ile geliyor; JSON için düz tırnak (") gerekli
            let features = [];
            try {
                const raw = (plan.ozellikler || '[]').toString();
                const normalized = raw.replace(/[\u201C\u201D\u201E\u201F]/g, '"').replace(/[\u2018\u2019\u201A\u201B]/g, "'");
                features = JSON.parse(normalized);
            } catch (e) {
                console.warn('Plan özellikleri parse edilemedi, boş liste kullanılıyor:', e.message);
                features = [];
            }
            if (!Array.isArray(features)) features = [];
            const isFeatured = index === 1; // Pro Kurumsal featured
            
            const planCard = document.createElement('div');
            planCard.className = `landing-pricing-card${isFeatured ? ' featured' : ''}`;
            const popularBadge = isFeatured ? '<div class="landing-pricing-popular">En Popüler</div>' : '';
            planCard.innerHTML = `
                ${popularBadge}
                <h3 class="landing-plan-name">${plan.plan_adi}</h3>
                <p class="landing-plan-desc">${plan.plan_adi} paketi</p>
                <div class="landing-plan-price">
                    <span class="landing-price-currency">₺</span>
                    <span class="landing-price-amount" data-monthly="${monthlyPriceValue}" data-yearly="${yearlyPriceValue}">${monthlyPrice}</span>
                    <span class="landing-price-period">/ay</span>
                    <span class="landing-plan-original-price" style="display: none;" data-monthly="${monthlyPriceValue}">₺${monthlyPrice}</span>
                    <span class="landing-plan-discount" style="display: none;">%20 İndirim</span>
                </div>
                <ul class="landing-plan-features">
                    <li class="landing-plan-feature">
                        <div class="landing-feature-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <polyline points="20,6 9,17 4,12" />
                            </svg></div>
                        <span>${plan.max_kullanici} kullanıcıya kadar</span>
                    </li>
                    <li class="landing-plan-feature">
                        <div class="landing-feature-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <polyline points="20,6 9,17 4,12" />
                            </svg></div>
                        <span>${plan.max_depolama_gb} GB depolama</span>
                    </li>
                    ${features.map(feature => {
                        const isWhatsAppFeature = feature.toLowerCase().includes('whatsapp');
                        const isAracTakipFeature = feature.toLowerCase().includes('araç takip') || feature.toLowerCase().includes('arac takip');
                        const isKampanyaFeature = feature.toLowerCase().includes('kampanya');
                        const isCicekSepetiFeature = feature.toLowerCase().includes('çiçek sepeti') || feature.toLowerCase().includes('cicek sepeti') || feature.toLowerCase().includes('ciceksepeti');
                        const isProPlan = index === 1; // Profesyonel paket
                        const isFeaturedFeature = (isWhatsAppFeature || isAracTakipFeature || isKampanyaFeature || isCicekSepetiFeature) && isProPlan;
                        return `
                        <li class="landing-plan-feature">
                            <div class="landing-feature-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <polyline points="20,6 9,17 4,12" />
                                </svg></div>
                            <span>${feature}</span>
                            ${isFeaturedFeature ? '<span class="landing-feature-badge">ÖNE ÇIKAN ÖZELLİK</span>' : ''}
                        </li>
                    `;
                    }).join('')}
                </ul>
                <a href="./purchase.html?plan=${plan.plan_kodu}&billing=monthly" class="landing-btn-plan ${isFeatured ? 'landing-btn-plan-primary' : 'landing-btn-plan-secondary'}" data-billing="monthly" data-plan-code="${plan.plan_kodu}">
                    ${isFeatured ? 'Başla' : 'Paketi Seç'}
                </a>
            `;
            
            pricingGrid.appendChild(planCard);
        });
        
        // Lucide icons'ı yeniden initialize et
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        // Pricing kartları oluşturulduktan sonra animasyonu tetikle
        if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
            // Kısa bir gecikme ile animasyonu başlat (DOM güncellemesi için)
            setTimeout(() => {
                gsap.utils.toArray('.landing-pricing-card').forEach((c, i) => {
                    gsap.to(c, { 
                        opacity: 1, 
                        y: 0, 
                        duration: 0.8, 
                        ease: 'power3.out', 
                        scrollTrigger: { 
                            trigger: c, 
                            start: 'top 85%',
                            toggleActions: 'play none none reverse',
                            once: true
                        }, 
                        delay: i * 0.15 
                    });
                });
            }, 100);
        } else {
            // GSAP yoksa direkt göster
            document.querySelectorAll('.landing-pricing-card').forEach(card => {
                if (card) {
                    card.style.opacity = '1';
                    card.style.transform = 'none';
                }
            });
        }
        
    } catch (error) {
        console.error('Paketler yüklenirken hata:', error);
        pricingGrid.innerHTML = '<div class="landing-pricing-loading">Paketler yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.</div>';
    }
}

/**
 * FAQ accordion işlevselliği
 */
function initFAQ() {
    const faqItems = document.querySelectorAll('.landing-faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.landing-faq-question');
        if (!question) return;
        
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Tüm item'ları kapat
            faqItems.forEach(otherItem => {
                otherItem.classList.remove('active');
            });
            
            // Tıklanan item'ı aç/kapat
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });
}

/**
 * Smooth scroll için anchor link'leri
 * Not: Bu fonksiyon landing.html'deki inline script ile çakışmaması için 
 * sadece GSAP yoksa çalışır
 */
function initSmoothScroll() {
    // Eğer GSAP ve ScrollToPlugin yüklüyse, inline script zaten smooth scroll'u hallediyor
    if (typeof gsap !== 'undefined' && gsap.plugins && gsap.plugins.scrollTo) {
        return; // GSAP ScrollToPlugin varsa, inline script zaten çalışıyor
    }
    
    // Fallback: Native smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        // Eğer zaten bir event listener varsa, ekleme
        if (anchor.dataset.smoothScrollInitialized) return;
        anchor.dataset.smoothScrollInitialized = 'true';
        
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#' || !href) return;
            
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}
