// Input Validation Utility Functions

// Show input error tooltip
function showInputError(inputElement, message) {
    if (!inputElement) return;
    
    // Remove existing tooltip if any
    hideInputError(inputElement);
    
    // Add error class to input
    inputElement.classList.add('input-error');
    
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'input-error-tooltip';
    tooltip.id = `error-tooltip-${inputElement.id || Date.now()}`;
    tooltip.innerHTML = `
        <span class="input-error-tooltip-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
        </span>
        <span class="input-error-tooltip-text">${message}</span>
    `;
    
    // Append to body first to calculate dimensions
    document.body.appendChild(tooltip);
    
    // Get input position after tooltip is in DOM
    const inputRect = inputElement.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const tooltipRect = tooltip.getBoundingClientRect();
    
    // Position tooltip below input (input'un altına)
    tooltip.style.top = `${inputRect.bottom + scrollTop + 8}px`;
    tooltip.style.left = `${inputRect.left + scrollLeft}px`;
    
    // Ensure tooltip doesn't go off screen
    const maxLeft = window.innerWidth - tooltipRect.width - 16;
    if (parseInt(tooltip.style.left) > maxLeft) {
        tooltip.style.left = `${maxLeft}px`;
    }
    
    // Show with animation
    setTimeout(() => {
        tooltip.classList.add('show');
    }, 10);
    
    // Store tooltip reference on input
    inputElement.dataset.errorTooltipId = tooltip.id;
}

// Hide input error tooltip
function hideInputError(inputElement) {
    if (!inputElement) return;
    
    // Remove error class
    inputElement.classList.remove('input-error');
    
    // Remove tooltip if exists
    const tooltipId = inputElement.dataset.errorTooltipId;
    if (tooltipId) {
        const tooltip = document.getElementById(tooltipId);
        if (tooltip) {
            tooltip.classList.remove('show');
            setTimeout(() => {
                if (tooltip.parentNode) {
                    tooltip.parentNode.removeChild(tooltip);
                }
            }, 200);
        }
        delete inputElement.dataset.errorTooltipId;
    }
}

// Validate email using HTML5 native validation
function validateEmailInput(inputElement, showTooltip = true) {
    if (!inputElement) return false;
    
    const email = inputElement.value.trim();
    
    if (!email) {
        // Boş ise native validation'ı temizle
        inputElement.setCustomValidity('');
        if (showTooltip) hideInputError(inputElement);
        return true; // Empty is valid (unless required)
    }
    
    // E-posta regex: @ işaretinden sonra en az bir nokta ve uzantı olmalı (örn: .com, .org)
    // Örnek geçersiz: ornek@mailadres (uzantı yok)
    // Örnek geçerli: ornek@mailadres.com
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);
    
    if (!isValid) {
        // HTML5 native validation kullan
        inputElement.setCustomValidity('Lütfen geçerli bir e-posta adresi girin (örn: ornek@mailadres.com)');
        // Custom tooltip'i kaldır (native kullanıyoruz)
        if (showTooltip) hideInputError(inputElement);
    } else {
        // Geçerli ise native validation'ı temizle
        inputElement.setCustomValidity('');
        if (showTooltip) hideInputError(inputElement);
    }
    
    return isValid;
}

// Validate phone using HTML5 native validation
function validatePhoneInput(inputElement, showTooltip = true) {
    if (!inputElement) {
        return false;
    }
    
    const phone = inputElement.value.trim();
    
    if (!phone || phone === '+90 (' || phone === '') {
        // Boş ise native validation'ı temizle
        inputElement.setCustomValidity('');
        if (showTooltip) hideInputError(inputElement);
        return true; // Empty is valid (unless required)
    }
    
    // Telefon numarasından sadece rakamları al
    const phoneDigits = phone.replace(/\D/g, '');
    
    // Türkiye telefon numarası kontrolü: +90 ile başlıyorsa 12 hane olmalı
    let isValidPhone = false;
    if (phone.startsWith('+90')) {
        // +90 (5XX) XXX XX XX formatı kontrolü
        // Tam format: +90 (542) 840 72 72 -> 5428407272 (10 rakam, +90 dahil değil)
        // setupPhoneInput fonksiyonu sadece 10 rakam alıyor (+90 ( sonrası)
        
        // Eğer 12 rakam varsa (905428407272 veya 903424234234) - tam numara
        if (phoneDigits.length === 12 && phoneDigits.startsWith('90')) {
            const areaCode = phoneDigits.substring(2, 5); // İlk 3 rakam (5XX, 3XX, 4XX, 2XX)
            // Türkiye telefon numaraları: Mobil (5XX), Sabit hat (2XX, 3XX, 4XX)
            isValidPhone = areaCode.startsWith('5') || areaCode.startsWith('2') || areaCode.startsWith('3') || areaCode.startsWith('4');
        } 
        // Eğer 10 rakam varsa (5428407272, 3424234234, 2423423423, 4423423423) - +90 ( sonrası rakamlar - TAM NUMARA
        else if (phoneDigits.length === 10 && (phoneDigits.startsWith('5') || phoneDigits.startsWith('2') || phoneDigits.startsWith('3') || phoneDigits.startsWith('4'))) {
            isValidPhone = true;
        } 
        // Eğer 11 rakam varsa ve 0 ile başlıyorsa (05428407272) - geçerli
        else if (phoneDigits.length === 11 && phoneDigits.startsWith('0')) {
            isValidPhone = true;
        } 
        // Eğer 11 rakam varsa ve 90 ile başlıyorsa (90542840727) - eksik ama kabul edilebilir
        else if (phoneDigits.length === 11 && phoneDigits.startsWith('90')) {
            isValidPhone = true;
        } 
        // Eğer 13+ rakam varsa (905428407272X) - fazla rakam var, son 10 rakamı kontrol et
        else if (phoneDigits.length >= 13 && phoneDigits.startsWith('90')) {
            const last10 = phoneDigits.substring(phoneDigits.length - 10);
            isValidPhone = last10.startsWith('5') || last10.startsWith('2') || last10.startsWith('3') || last10.startsWith('4');
        }
        // Eğer 10-12 rakam arası ve geçerli alan kodu ile başlıyorsa (5428407272, 3424234234, 2423423423, 4423423423) - geçerli
        else if (phoneDigits.length >= 10 && phoneDigits.length <= 12) {
            // Son 10 rakamı kontrol et
            const last10 = phoneDigits.substring(phoneDigits.length - 10);
            if (last10.startsWith('5') || last10.startsWith('2') || last10.startsWith('3') || last10.startsWith('4')) {
                isValidPhone = true;
            } else {
                // Eğer 90 ile başlıyorsa, 90'dan sonrasını kontrol et
                if (phoneDigits.startsWith('90') && phoneDigits.length >= 12) {
                    const areaCode = phoneDigits.substring(2, 5);
                    isValidPhone = areaCode.startsWith('5') || areaCode.startsWith('2') || areaCode.startsWith('3') || areaCode.startsWith('4');
                } else {
                    isValidPhone = false;
                }
            }
        }
        // Eğer format tamamlanmışsa (örn: +90 (542) 840 72 72) - tam 10 rakam olmalı
        // Eksik numara için geçerli sayma - sadece tam 10 veya 12 rakam geçerli
        else {
            isValidPhone = false;
        }
    } else {
        // Diğer formatlar geçersiz (sadece +90 formatı kabul edilir)
        isValidPhone = false;
    }
    
    if (!isValidPhone) {
        // HTML5 native validation kullan - daha açıklayıcı mesaj
        let errorMessage = 'Lütfen geçerli bir telefon numarası girin (+90 (XXX) XXX XX XX)';
        if (phoneDigits.length < 10) {
            const missingDigits = 10 - phoneDigits.length;
            errorMessage = `Telefon numarası eksik. ${missingDigits} rakam daha girmeniz gerekiyor (+90 (XXX) XXX XX XX)`;
        } else if (phoneDigits.length === 10 && !phoneDigits.startsWith('5') && !phoneDigits.startsWith('2') && !phoneDigits.startsWith('3') && !phoneDigits.startsWith('4')) {
            errorMessage = 'Telefon numarası geçersiz alan kodu ile başlıyor. Lütfen 2, 3, 4 veya 5 ile başlayan bir numara girin.';
        }
        inputElement.setCustomValidity(errorMessage);
        // ✅ Custom tooltip'i kaldır (native kullanıyoruz) - SADECE BİR TOOLTIP OLSUN
        if (typeof hideInputError === 'function') {
            hideInputError(inputElement);
        }
        // showTooltip true ise reportValidity çağır (sadece bir kez)
        if (showTooltip) {
            inputElement.reportValidity();
        }
    } else {
        // Geçerli ise native validation'ı temizle
        inputElement.setCustomValidity('');
        // ✅ Custom tooltip'i de temizle
        if (typeof hideInputError === 'function') {
            hideInputError(inputElement);
        }
    }
    
    return isValidPhone;
}

// ✅ Console sayfaları için telefon input maskesi - +90 ( formatını korur ve otomatik formatlar
function setupConsolePhoneInput(inputElement) {
    if (!inputElement) return;
    if (inputElement.disabled) return;
    
    // Zaten formatlanmışsa, önceki event listener'ları temizle
    if (inputElement.hasAttribute('data-console-phone-formatted')) {
        // Clone yaparak event listener'ları temizle
        const newInput = inputElement.cloneNode(true);
        inputElement.parentNode.replaceChild(newInput, inputElement);
        inputElement = newInput;
    }
    
    inputElement.setAttribute('data-console-phone-formatted', 'true');
    
    let isUpdating = false;
    let previousValue = inputElement.value;
    
    // FormatPhoneNumber fonksiyonu - +90 (XXX) XXX XX XX formatında formatlar
    function formatConsolePhoneNumber(phone) {
        if (!phone) return '+90 (';
        
        // Sadece rakamları al
        let digits = phone.toString().replace(/\D/g, '');
        
        if (digits.length === 0) return '+90 (';
        
        // 12 haneli ve 90 ile başlıyorsa (veritabanı formatı: 905066593545)
        if (digits.length === 12 && digits.startsWith('90')) {
            const phoneDigits = digits.substring(2); // 90'ı çıkar, 10 haneli kalır
            if (phoneDigits.length === 10) {
                return `+90 (${phoneDigits.substring(0, 3)}) ${phoneDigits.substring(3, 6)} ${phoneDigits.substring(6, 8)} ${phoneDigits.substring(8, 10)}`;
            }
        }
        
        // 11 haneli ve 0 ile başlıyorsa (örn: 05051563663), 0'ı kaldır
        if (digits.length === 11 && digits.startsWith('0')) {
            digits = digits.substring(1);
        }
        
        // 10 haneli ve 5 ile başlıyorsa direkt formatla
        if (digits.length === 10 && digits.startsWith('5')) {
            return `+90 (${digits.substring(0, 3)}) ${digits.substring(3, 6)} ${digits.substring(6, 8)} ${digits.substring(8, 10)}`;
        }
        
        // Diğer durumlarda son 10 rakamı al
        if (digits.length > 10) {
            digits = digits.substring(digits.length - 10);
        }
        
        // Eğer digits "90" ile başlıyorsa (yanlış format), sadece son 10 rakamı al
        if (digits.length > 10 && digits.startsWith('90') && digits.length > 2) {
            digits = digits.substring(2);
        }
        
        if (digits.length === 0) return '+90 (';
        
        // Format: +90 (5XX) XXX XX XX
        if (digits.length >= 10) {
            return `+90 (${digits.substring(0, 3)}) ${digits.substring(3, 6)} ${digits.substring(6, 8)} ${digits.substring(8, 10)}`;
        }
        
        // Eksik rakamlar varsa kısmi format
        let formatted = '+90 (';
        if (digits.length > 0) {
            formatted += digits.substring(0, 3); // İlk 3 rakam (5XX)
            if (digits.length >= 3) {
                formatted += ') ' + digits.substring(3, 6); // Sonraki 3 rakam (XXX)
                if (digits.length >= 6) {
                    formatted += ' ' + digits.substring(6, 8); // Sonraki 2 rakam (XX)
                    if (digits.length >= 8) {
                        formatted += ' ' + digits.substring(8, 10); // Son 2 rakam (XX)
                    }
                }
            }
        }
        
        return formatted;
    }
    
    // Mevcut değeri formatla
    if (inputElement.value && inputElement.value.trim() !== '' && inputElement.value.trim() !== '+90 (') {
        const digits = inputElement.value.replace(/\D/g, '');
        let cleanDigits = digits;
        if (digits.length === 12 && digits.startsWith('90')) {
            cleanDigits = digits.substring(2);
        } else if (digits.length === 11 && digits.startsWith('0')) {
            cleanDigits = digits.substring(1);
        } else if (digits.length > 10) {
            cleanDigits = digits.substring(digits.length - 10);
        }
        if (cleanDigits.length > 0 && cleanDigits.length <= 10) {
            inputElement.value = formatConsolePhoneNumber(cleanDigits);
            previousValue = inputElement.value;
        } else {
            inputElement.value = '+90 (';
            previousValue = '+90 (';
        }
    } else {
        inputElement.value = '+90 (';
        previousValue = '+90 (';
    }
    
    // KEYDOWN EVENT - +90 ( formatını koru ve maksimum 10 rakam kontrolü
    inputElement.addEventListener('keydown', function(e) {
        const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab'];
        const isControlKey = e.ctrlKey || e.metaKey || e.altKey;
        const prefixLen = 5; // '+90 ('
        const cursorPos = e.target.selectionStart;
        const val = e.target.value;
        
        // Ctrl+A (Select All) - "+90 (" kısmını hariç tut
        if ((e.key === 'a' || e.key === 'A') && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (val.length > prefixLen) {
                e.target.setSelectionRange(prefixLen, val.length);
            } else {
                e.target.setSelectionRange(prefixLen, prefixLen);
            }
            return false;
        }
        
        // Harf ve özel karakter engelle
        if (!allowedKeys.includes(e.key) && !isControlKey && !/^\d$/.test(e.key)) {
            e.preventDefault();
            return false;
        }
        
        // Rakam girişi kontrolü - Maksimum 10 rakam (+90 ( sonrası)
        if (/^\d$/.test(e.key) && !isControlKey) {
            const digits = val.substring(prefixLen).replace(/\D/g, '');
            if (digits.length >= 10) {
                e.preventDefault();
                return false;
            }
        }
        
        // BACKSPACE - +90 ( formatını koru
        if (e.key === 'Backspace') {
            if (val === '+90 (' && cursorPos <= prefixLen) {
                e.preventDefault();
                return false;
            }
            if (cursorPos < prefixLen) {
                e.preventDefault();
                return false;
            }
        }
        
        // DELETE - +90 ( formatını koru
        if (e.key === 'Delete') {
            if (val === '+90 (' && cursorPos <= prefixLen) {
                e.preventDefault();
                return false;
            }
            if (cursorPos < prefixLen) {
                e.preventDefault();
                return false;
            }
        }
    });
    
    // INPUT EVENT - Formatlama
    inputElement.addEventListener('input', function(e) {
        if (isUpdating) return;
        
        isUpdating = true;
        let value = e.target.value;
        
        // "+90 (" prefix'ini her zaman koru
        if (!value.startsWith('+90 (')) {
            value = '+90 (' + value.replace(/^\+90\s?\(?/, '').replace(/\D/g, '');
        }
        
        // Rakamları çıkar (maksimum 10) - Sadece "+90 (" sonrasındaki rakamları al
        let digits = '';
        if (value.startsWith('+90 (')) {
            digits = value.substring(5).replace(/\D/g, '').substring(0, 10);
        } else {
            digits = value.replace(/\D/g, '').substring(0, 10);
        }
        
        // Eğer tüm rakamlar silindiyse, sadece "+90 (" bırak
        if (digits.length === 0) {
            e.target.value = '+90 (';
            previousValue = '+90 (';
            isUpdating = false;
            setTimeout(() => {
                e.target.setSelectionRange(5, 5);
            }, 0);
            return;
        }
        
        // Formatla
        const formatted = formatConsolePhoneNumber(digits);
        e.target.value = formatted;
        previousValue = formatted;
        
        // Cursor pozisyonunu ayarla
        const prefixLen = 5;
        const cursorPos = e.target.selectionStart;
        let newCursorPos = prefixLen;
        
        if (digits.length > 0) {
            // Format uzunluğunu hesapla
            const formattedLength = formatted.length;
            // Cursor pozisyonunu korumaya çalış
            if (cursorPos >= prefixLen) {
                const digitsBeforeCursor = value.substring(prefixLen, Math.min(cursorPos, value.length)).replace(/\D/g, '').length;
                let pos = prefixLen;
                let digitCount = 0;
                for (let i = prefixLen; i < formatted.length && digitCount < digitsBeforeCursor; i++) {
                    if (/\d/.test(formatted[i])) {
                        digitCount++;
                    }
                    pos = i + 1;
                }
                newCursorPos = Math.min(pos, formattedLength);
            }
        }
        
        isUpdating = false;
        setTimeout(() => {
            e.target.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    });
    
    // BLUR EVENT - Validation
    inputElement.addEventListener('blur', function(e) {
        const value = e.target.value;
        const digits = value.substring(5).replace(/\D/g, '');
        
        if (value && value !== '+90 (' && digits.length > 0) {
            validatePhoneInput(e.target, true);
        }
    });
}

// Global erişim için
window.setupConsolePhoneInput = setupConsolePhoneInput;

// Validate username and show/hide error (boşluk ve özel karakter kontrolü)
function validateUsernameInput(inputElement, showTooltip = true) {
    if (!inputElement) return false;
    
    const username = inputElement.value.trim();
    
    if (!username) {
        if (showTooltip) hideInputError(inputElement);
        return true; // Empty is valid (unless required)
    }
    
    // Kullanıcı adı sadece harf, rakam, alt çizgi ve tire içerebilir, boşluk ve özel karakter olamaz
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    const hasSpace = /\s/.test(username);
    const hasSpecialChars = /[^a-zA-Z0-9_-]/.test(username);
    
    let isValid = usernameRegex.test(username);
    let errorMessage = '';
    
    if (hasSpace) {
        isValid = false;
        errorMessage = 'Kullanıcı adında boşluk olamaz';
    } else if (hasSpecialChars) {
        isValid = false;
        errorMessage = 'Kullanıcı adında özel karakter olamaz (sadece harf, rakam, _ ve - kullanılabilir)';
    } else if (!isValid) {
        errorMessage = 'Kullanıcı adı geçersiz (sadece harf, rakam, _ ve - kullanılabilir)';
    }
    
    if (!isValid && showTooltip) {
        showInputError(inputElement, errorMessage);
    } else if (showTooltip) {
        hideInputError(inputElement);
    }
    
    return isValid;
}

// Clear all tooltips (for form close)
function clearAllInputErrors() {
    // Find all tooltips and remove them
    const tooltips = document.querySelectorAll('.input-error-tooltip');
    tooltips.forEach(tooltip => {
        tooltip.classList.remove('show');
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        }, 200);
    });
    
    // Remove error classes from all inputs
    const errorInputs = document.querySelectorAll('.input-error');
    errorInputs.forEach(input => {
        input.classList.remove('input-error');
        delete input.dataset.errorTooltipId;
    });
}

