// reklam-area.js - Başlangıç Paketi Reklam Alanı Kontrolü
// script.js'ten taşındı (2026-02-06)

/**
 * Reklam alanı ve araç takip alanlarını JS'den dinamik oluştur
 * HTML'de görünmeyecek, inspect'te display değiştirilemeyecek
 */
function createReklamArea() {
    const container = document.getElementById('primaryFeatureContainer');
    if (!container) {
        console.error('❌ primaryFeatureContainer bulunamadı!');
        return null;
    }
    
    // ✅ DÜZELTME: Container zaten içerik varsa (reklam veya multiVehicle), yeniden oluşturma
    const existingReklam = container.querySelector('#baslangicPaketReklam');
    if (existingReklam) {
        return existingReklam; // Zaten var, yeniden oluşturma
    }
    
    const existingMultiVehicle = container.querySelector('#multiVehicle');
    if (existingMultiVehicle) {
        return null; // MultiVehicle var, reklam oluşturma
    }
    
    // Eski elementleri temizle (sadece içerik yoksa)
    container.innerHTML = '';
    
    const reklamArea = document.createElement('div');
    reklamArea.className = 'baslangic-paket-reklam';
    reklamArea.id = 'baslangicPaketReklam';
    reklamArea.setAttribute('data-force-show', 'true');
    reklamArea.style.setProperty('display', 'flex', 'important');
    reklamArea.style.setProperty('visibility', 'visible', 'important');
    reklamArea.style.setProperty('opacity', '1', 'important');
    
    reklamArea.innerHTML = `
        <div class="reklam-content">
            <h3 class="reklam-title">Daha Fazla Özellik Edinin</h3>
            <div class="reklam-features">
                <div class="reklam-feature-item">
                    <div class="reklam-feature-icon">
                        <i class="fa-brands fa-whatsapp"></i>
                    </div>
                    <div class="reklam-feature-content">
                        <div class="reklam-feature-title">WhatsApp Entegrasyonu</div>
                        <div class="reklam-feature-desc">Sipariş bildirimleri gönderin</div>
                    </div>
                </div>
                <div class="reklam-feature-item">
                    <div class="reklam-feature-icon">
                        <i class="fa-solid fa-truck"></i>
                    </div>
                    <div class="reklam-feature-content">
                        <div class="reklam-feature-title">Araç Takip</div>
                        <div class="reklam-feature-desc">Teslimattaki araçlarınızı takip edin</div>
                    </div>
                </div>
                <div class="reklam-feature-item">
                    <div class="reklam-feature-icon">
                        <i class="fa-solid fa-bullhorn"></i>
                    </div>
                    <div class="reklam-feature-content">
                        <div class="reklam-feature-title">Kampanya Yönetimi</div>
                        <div class="reklam-feature-desc">Kampanyalar oluşturun</div>
                    </div>
                </div>
            </div>
            <button class="reklam-button" id="paketYukseltBtn">
                Paketi Yükselt
            </button>
        </div>
    `;
    
    container.appendChild(reklamArea);
    
    // Container'ın parent elementlerini kontrol et
    let parent = container.parentElement;
    while (parent && parent !== document.body) {
        if (parent.classList.contains('sag-panel') && window.innerWidth <= 600) {
            parent.style.setProperty('display', 'none', 'important');
            break;
        }
        const parentDisplay = window.getComputedStyle(parent).display;
        if (parentDisplay === 'none' && !parent.classList.contains('sag-panel')) {
            console.warn('⚠️ Container parent elementi gizli, gösteriliyor...');
            parent.style.setProperty('display', 'block', 'important');
        }
        parent = parent.parentElement;
    }
    
    // Paketi Yükselt butonu
    const paketYukseltBtn = document.getElementById('paketYukseltBtn');
    if (paketYukseltBtn) {
        paketYukseltBtn.onclick = () => {
            window.location.href = './landing/dashboard.html';
        };
    }
    
    return reklamArea;
}

function createMultiVehicleArea() {
    const container = document.getElementById('primaryFeatureContainer');
    if (!container) {
        console.error('❌ primaryFeatureContainer bulunamadı!');
        return null;
    }
    
    // ✅ DÜZELTME: Container zaten içerik varsa (multiVehicle), yeniden oluşturma
    const existingMultiVehicle = container.querySelector('#multiVehicle');
    if (existingMultiVehicle) {
        return existingMultiVehicle; // Zaten var, yeniden oluşturma
    }
    
    // Eski elementleri temizle (sadece multiVehicle yoksa)
    container.innerHTML = '';
    
    const multiVehicle = document.createElement('div');
    multiVehicle.className = 'multi-arac-wrapper';
    multiVehicle.id = 'multiVehicle';
    multiVehicle.style.setProperty('display', 'flex', 'important');
    multiVehicle.style.setProperty('flex-direction', 'column', 'important');
    multiVehicle.style.setProperty('visibility', 'visible', 'important');
    multiVehicle.style.setProperty('opacity', '1', 'important');
    
    multiVehicle.innerHTML = `
        <div class="multi-header">
            <div class="multi-title-wrapper">
                <div class="multi-title-icon">
                    <i class="fa-solid fa-truck"></i>
                </div>
                <div class="multi-title-content">
                    <h3 class="multi-title">Araç Takibi</h3>
                    <div class="multi-title-count" id="multiTitleCount">0 Araç</div>
                </div>
            </div>
            <div class="active-vehicles-info">
                <div class="active-dot"></div>
                <span class="active-text" id="activeVehiclesCount">0 Aktif</span>
            </div>
        </div>
        <div class="vehicle-list">
            <!-- Araçlar buraya dinamik yüklenecek -->
        </div>
    `;
    
    container.appendChild(multiVehicle);
    
    // Container'ın parent elementlerini kontrol et
    let parent = container.parentElement;
    while (parent && parent !== document.body) {
        if (parent.classList.contains('sag-panel') && window.innerWidth <= 600) {
            parent.style.setProperty('display', 'none', 'important');
            break;
        }
        const parentDisplay = window.getComputedStyle(parent).display;
        if (parentDisplay === 'none' && !parent.classList.contains('sag-panel')) {
            console.warn('⚠️ Container parent elementi gizli, gösteriliyor...');
            parent.style.setProperty('display', 'block', 'important');
        }
        parent = parent.parentElement;
    }
    
    return multiVehicle;
}

/**
 * Plan kontrolü - plan_id === 1 ise başlangıç paketi
 * @returns {Promise<{isBaslangicPlan: boolean, planId: number|null}>}
 */
async function checkBaslangicPlan() {
    try {
        const isFileProtocol = window.location.protocol === 'file:';
        const hostname = window.location.hostname || '';
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '' || isFileProtocol;
        const apiBase = (typeof window.getFloovonApiBase === 'function' ? window.getFloovonApiBase() : null) || window.API_BASE_URL || (window.location.origin ? window.location.origin + '/api' : '/api');
        
        let tenantCode = localStorage.getItem('tenant_code') || 
                        localStorage.getItem('remembered_tenant_code') ||
                        new URLSearchParams(window.location.search).get('tenant');
        
        let tenantId = null;
        if (!tenantCode) {
            const userStr = localStorage.getItem('floovon_user') || localStorage.getItem('user');
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    tenantId = user.tenant_id || localStorage.getItem('floovon_tenant_id');
                } catch (e) {
                    console.warn('⚠️ User parse hatası:', e);
                }
            }
        }
        
        if (!tenantCode && !tenantId) {
            return { isBaslangicPlan: false, planId: null };
        }
        
        const subscriptionUrl = tenantCode 
            ? `${apiBase}/public/subscription?tenant_code=${tenantCode}`
            : `${apiBase}/public/subscription?tenant_id=${tenantId}`;
        
        const response = await fetch(subscriptionUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        
        if (!response.ok) {
            return { isBaslangicPlan: false, planId: null };
        }
        
        const result = await response.json();
        
        if (!result.success || !result.data) {
            return { isBaslangicPlan: false, planId: null };
        }
        
        const planId = parseInt(result.data.plan_id);
        const isBaslangicPlan = planId === 1;
        
        return { isBaslangicPlan, planId };
    } catch (error) {
        console.error('❌ Plan kontrolü hatası:', error);
        return { isBaslangicPlan: false, planId: null };
    }
}

/**
 * Başlangıç paketi kontrolü - plan_id === 1 ise reklam göster
 */
async function checkBaslangicPlanAndShowAd() {
    const container = document.getElementById('primaryFeatureContainer');
    if (!container) {
        return;
    }
    
    // ✅ DÜZELTME: Container zaten içerik varsa, yeniden oluşturma
    const existingReklam = container.querySelector('#baslangicPaketReklam');
    const existingMultiVehicle = container.querySelector('#multiVehicle');
    if (existingReklam || existingMultiVehicle) {
        return; // Zaten içerik var, yeniden oluşturma
    }
    
    if (window.innerWidth > 600) {
        container.style.setProperty('display', 'block', 'important');
        container.style.setProperty('visibility', 'visible', 'important');
    } else {
        const sagPanel = container.closest('.sag-panel');
        if (sagPanel) {
            sagPanel.style.setProperty('display', 'none', 'important');
        }
    }
    
    try {
        const { isBaslangicPlan, planId } = await checkBaslangicPlan();
        
        if (isBaslangicPlan) {
            const reklamArea = createReklamArea();
            
            if (!reklamArea) {
                console.error('❌ Reklam alanı oluşturulamadı!');
                return;
            }
            
            // GÜVENLİK: Reklam alanının gizlenmesini engelle
            if (typeof MutationObserver !== 'undefined') {
                const securityObserver = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                            const target = mutation.target;
                            if (target === reklamArea) {
                                const computedDisplay = window.getComputedStyle(target).display;
                                if (computedDisplay === 'none') {
                                    target.style.setProperty('display', 'flex', 'important');
                                    target.style.setProperty('visibility', 'visible', 'important');
                                }
                            }
                        }
                    });
                });
                
                securityObserver.observe(reklamArea, {
                    attributes: true,
                    attributeFilter: ['style']
                });
            }
        } else {
            createMultiVehicleArea();
        }
    } catch (error) {
        console.error('❌ Plan kontrolü hatası:', error);
        createMultiVehicleArea();
    }
}

// Global erişim için
window.checkBaslangicPlanAndShowAd = checkBaslangicPlanAndShowAd;
window.createReklamArea = createReklamArea;
window.createMultiVehicleArea = createMultiVehicleArea;
window.checkBaslangicPlan = checkBaslangicPlan;

// Sayfa yüklendiğinde bir kez çalıştır
// ERR_BLOCKED_BY_CLIENT hatası için try-catch ekle (reklam engelleyici tarafından engellenebilir)
try {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                try {
                    checkBaslangicPlanAndShowAd();
                } catch (error) {
                    console.warn('⚠️ Plan kontrolü çalıştırılamadı (reklam engelleyici olabilir):', error);
                }
            }, 1000);
        });
    } else {
        setTimeout(() => {
            try {
                checkBaslangicPlanAndShowAd();
            } catch (error) {
                console.warn('⚠️ Plan kontrolü çalıştırılamadı (reklam engelleyici olabilir):', error);
            }
        }, 1000);
    }
} catch (error) {
    console.warn('⚠️ reklam-area.js yüklenirken hata oluştu (reklam engelleyici olabilir):', error);
}

