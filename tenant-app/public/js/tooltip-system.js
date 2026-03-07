/**
 * Unified Tooltip System
 * ✅ React uygulaması için tooltip sistemi
 * 
 * data-tooltip attribute'u olan elementlerde hover/touch ile tooltip gösterir.
 * data-tooltip-pos="top|bottom|left|right" ile yön belirlenebilir (varsayılan: top).
 */

function initUnifiedTooltipSystem() {
    let tooltipEl = null, currentTarget = null;

    const POS = { TOP: "top", BOTTOM: "bottom", LEFT: "left", RIGHT: "right" };

    function findTooltipTarget(el) {
        let cur = el;
        while (cur && cur !== document.body) {
            if (cur.getAttribute && cur.hasAttribute('data-tooltip')) return cur;
            cur = cur.parentElement;
        }
        return null;
    }

    function clearTooltip() {
        if (tooltipEl?.parentNode) tooltipEl.remove();
        tooltipEl = null; currentTarget = null;
    }

    function getPreferredPosForTarget(target) {
        // İsteğe bağlı zorunlu yön: data-tooltip-pos="top|bottom|left|right"
        const forced = target.getAttribute('data-tooltip-pos');
        if (forced && [POS.TOP, POS.BOTTOM, POS.LEFT, POS.RIGHT].includes(forced)) {
            return forced;
        }
        // Varsayılan: üst
        return POS.TOP;
    }

    function applyPlacement(target, tip) {
        const rect = target.getBoundingClientRect();
        const tRect = tip.getBoundingClientRect();
        let pos = getPreferredPosForTarget(target);
        let left = 0, top = 0;

        // Konum hesapla
        const place = (p) => {
            pos = p;
            tip.classList.remove('tooltip--top', 'tooltip--bottom', 'tooltip--left', 'tooltip--right');
            tip.classList.add(`tooltip--${p}`);
            switch (p) {
                case POS.TOP:
                    left = rect.left + rect.width / 2 - tRect.width / 2;
                    top = rect.top - tRect.height - 8;
                    tip.style.transform = 'none';
                    break;
                case POS.BOTTOM:
                    left = rect.left + rect.width / 2 - tRect.width / 2;
                    top = rect.bottom + 8;
                    tip.style.transform = 'none';
                    break;
                case POS.LEFT:
                    left = rect.left - tRect.width - 12;
                    top = rect.top + rect.height / 2 - tRect.height / 2;
                    tip.style.transform = 'none';
                    break;
                case POS.RIGHT:
                    left = rect.right + 12;
                    top = rect.top + rect.height / 2 - tRect.height / 2;
                    tip.style.transform = 'none';
                    break;
            }
            // Ekran kenar koruması
            const pad = 10;
            left = Math.min(Math.max(left, pad), window.innerWidth - tRect.width - pad);
            top = Math.min(Math.max(top, pad), window.innerHeight - tRect.height - pad);
        };

        // Önce tercih edilen
        place(pos);

        // Flip mantığı: sığmıyorsa karşı yöne çevir
        const offTop = top < 10;
        const offBottom = top + tRect.height > window.innerHeight - 10;
        const offLeft = left < 10;
        const offRight = left + tRect.width > window.innerWidth - 10;

        if (pos === POS.TOP && offTop) place(POS.BOTTOM);
        else if (pos === POS.BOTTOM && offBottom) place(POS.TOP);
        else if (pos === POS.LEFT && offLeft) place(POS.RIGHT);
        else if (pos === POS.RIGHT && offRight) place(POS.LEFT);

        tip.style.left = `${left}px`;
        tip.style.top = `${top}px`;
    }

    function showTooltip(target, text) {
        if (currentTarget === target && tooltipEl) return;
        clearTooltip(); currentTarget = target;

        tooltipEl = document.createElement('div');
        tooltipEl.className = 'tooltip';
        
        // Çok satırlı içerik desteği: \n karakterlerini <br> tag'ine çevir
        // Güvenlik için sadece \n karakterlerini işle, HTML tag'lerini escape et
        const safeText = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        tooltipEl.innerHTML = safeText.replace(/\n/g, '<br>');
        
        tooltipEl.style.visibility = 'hidden';
        document.body.appendChild(tooltipEl);

        // İlk ölçüm için
        const _ = tooltipEl.getBoundingClientRect();
        applyPlacement(target, tooltipEl);
        tooltipEl.style.visibility = 'visible';
    }

    // Mouse hover için (web görünümü)
    document.addEventListener('mouseover', (e) => {
        const tgt = findTooltipTarget(e.target);
        if (!tgt) return;
        const txt = tgt.getAttribute('data-tooltip');
        if (!txt || txt === '-') return;
        showTooltip(tgt, txt);
    }, true);

    document.addEventListener('mouseout', (e) => {
        const tgt = findTooltipTarget(e.target);
        if (!tgt) return;
        const rel = findTooltipTarget(e.relatedTarget);
        if (rel === tgt) return;
        clearTooltip();
    }, true);

    // Touch için (mobil görünüm)
    let touchTimeout = null;
    let touchStartTime = null;
    let touchTarget = null;
    
    document.addEventListener('touchstart', (e) => {
        const tgt = findTooltipTarget(e.target);
        if (!tgt) {
            clearTooltip();
            touchTarget = null;
            return;
        }
        const txt = tgt.getAttribute('data-tooltip');
        if (!txt || txt === '-') {
            clearTooltip();
            touchTarget = null;
            return;
        }
        
        touchTarget = tgt;
        touchStartTime = Date.now();
        
        // Kısa bir gecikme ile tooltip göster (yanlışlıkla dokunmaları önlemek için)
        touchTimeout = setTimeout(() => {
            if (touchTarget === tgt) {
                showTooltip(tgt, txt);
            }
        }, 200);
    }, true);

    document.addEventListener('touchend', (e) => {
        const touchDuration = touchStartTime ? Date.now() - touchStartTime : 0;
        
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        
        // Eğer kısa bir dokunma ise (tap), tooltip'i göster ve bir süre tut
        if (touchTarget && touchDuration < 300) {
            const txt = touchTarget.getAttribute('data-tooltip');
            if (txt && txt !== '-') {
                showTooltip(touchTarget, txt);
                // 3 saniye sonra kapat
                setTimeout(() => {
                    clearTooltip();
                }, 3000);
            }
        } else {
            // Uzun dokunma veya kaydırma ise tooltip'i kapat
            clearTooltip();
        }
        
        touchTarget = null;
        touchStartTime = null;
    }, true);

    document.addEventListener('touchmove', () => {
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        // Kaydırma yapıldığında tooltip'i kapat
        clearTooltip();
        touchTarget = null;
        touchStartTime = null;
    }, true);

    document.addEventListener('scroll', clearTooltip, true);
    window.addEventListener('resize', clearTooltip);

    // React'ten veya link tıklanınca sayfa değişirken tooltip kapatılsın (floovon-clear-tooltip)
    document.addEventListener('floovon-clear-tooltip', clearTooltip);
}

// Window export
window.initUnifiedTooltipSystem = initUnifiedTooltipSystem;

// Sayfa yüklendiğinde tooltip sistemini başlat
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initUnifiedTooltipSystem();
    });
} else {
    initUnifiedTooltipSystem();
}



