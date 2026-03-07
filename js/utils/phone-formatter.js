// Telefon numarası formatlama utility fonksiyonları

// Telefon numarasını temizle ve sadece rakamlar olarak kaydet (veritabanı için: 905066593545)
// STANDART FORMAT: 12 haneli, 90 ile başlayan (örn: 905066593545)
function cleanPhoneForDatabase(phone) {
    if (!phone) return null;
    const phoneStr = phone.toString().trim();
    
    if (phoneStr === '') return null;
    
    // Sadece rakamları al
    const digits = phoneStr.replace(/\D/g, '');
    
    if (digits.length === 0) return null;
    
    let normalized = digits;
    
    // 11 haneli ve 0 ile başlıyorsa 0'ı kaldır ve 90 ekle
    if (digits.length === 11 && digits.startsWith('0')) {
        normalized = '90' + digits.substring(1);
    }
    // 10 haneli ise 90 ekle (hangi rakamla başladığına bakmaksızın)
    else if (digits.length === 10) {
        normalized = '90' + digits;
    }
    // 12 haneli ve 90 ile başlıyorsa direkt döndür
    else if (digits.length === 12 && digits.startsWith('90')) {
        normalized = digits;
    }
    // Diğer durumlarda son 10 rakamı al ve 90 ekle
    else if (digits.length >= 10) {
        const last10 = digits.substring(digits.length - 10);
        normalized = '90' + last10;
    }
    else {
        // 10 haneden az ise geçersiz
        return null;
    }
    
    // Son kontrol: 12 haneli ve 90 ile başlamalı
    if (normalized.length === 12 && normalized.startsWith('90')) {
        return normalized;
    }
    
    return null;
}

// Telefon numarasını formatla (+90 (5XX) XXX XX XX) - GÖSTERİM İÇİN
// Veritabanından "905066593545" formatında gelir, "+90 (506) 659 35 45" formatında gösterir
function formatPhoneNumber(phone) {
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
    // ✅ DÜZELTME: Sadece 11 haneli ve 0 ile başlıyorsa kaldır, 3-9 haneli değerlerde 0'ı kaldırma
    if (digits.length === 11 && digits.startsWith('0')) {
        digits = digits.substring(1);
    }
    
    // 10 haneli ise direkt formatla (hangi rakamla başladığına bakmaksızın)
    if (digits.length === 10) {
        return `+90 (${digits.substring(0, 3)}) ${digits.substring(3, 6)} ${digits.substring(6, 8)} ${digits.substring(8, 10)}`;
    }
    
    // Diğer durumlarda son 10 rakamı al
    if (digits.length > 10) {
        digits = digits.substring(digits.length - 10);
    }
    
    // Eğer digits "90" ile başlıyorsa (yanlış format), sadece son 10 rakamı al
    // ✅ DÜZELTME: Sadece 10 haneden fazla ve 90 ile başlıyorsa kaldır
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
        // İlk 3 rakam (5XX) - maksimum 3 karakter
        formatted += digits.substring(0, Math.min(3, digits.length));
        if (digits.length >= 3) {
            formatted += ') ' + digits.substring(3, Math.min(6, digits.length)); // Sonraki 3 rakam (XXX)
            if (digits.length >= 6) {
                formatted += ' ' + digits.substring(6, Math.min(8, digits.length)); // Sonraki 2 rakam (XX)
                if (digits.length >= 8) {
                    // Son 2 rakam (XX) - sadece mevcut rakamları al, fazlasını alma
                    formatted += ' ' + digits.substring(8, Math.min(10, digits.length));
                }
            }
        }
    }
    
    return formatted;
}

// Telefon input'una otomatik format ekle - ORTAK YAPI (data-phone-input="standard")
function setupPhoneInput(inputElement) {
    if (!inputElement) return;
    if (inputElement.disabled) return;
    
    // ✅ ÖNEMLİ: Eğer zaten formatlanmışsa, tekrar bağlama yapma
    // Index sayfasında form aç/kapat sırasında setupPhoneInput birden fazla kez çağrılıyor
    // Bu, event listener'ların çakışmasına ve silme sorunlarına neden oluyor
    if (inputElement.hasAttribute('data-phone-formatted')) {
        return; // Zaten formatlanmış, tekrar bağlama yapma
    }
    
    // data-phone-input="standard" attribute'una sahip inputları öncelikli işle
    // Eğer yoksa ama telefon input'u ise (class="telefon-input" veya id içinde "telefon" geçiyorsa) da işle
    const hasStandardAttr = inputElement.getAttribute('data-phone-input') === 'standard';
    const isPhoneInput = inputElement.classList.contains('telefon-input') || 
                         (inputElement.id && inputElement.id.includes('telefon')) ||
                         (inputElement.id && inputElement.id.includes('phone')) ||
                         inputElement.type === 'tel';
    
    if (!hasStandardAttr && !isPhoneInput) {
        return;
    }
    
    // ✅ ÖNEMLİ: data-phone-formatted attribute'unu HEMEN set et
    // Bu, başka bir setupPhoneInput çağrısının aynı input'a tekrar bağlanmasını engeller
    inputElement.setAttribute('data-phone-formatted', 'true');
    
    // ✅ ÖNEMLİ: Eğer input'a zaten event listener'lar eklenmişse, önce kaldır
    // Index sayfasında form aç/kapat sırasında setupPhoneInput birden fazla kez çağrılıyor
    // Bu, event listener'ların çakışmasına ve silme sorunlarına neden oluyor
    // Çözüm: Event listener'ları named function olarak tanımla ve önce kaldır
    let phoneInputHandlers = inputElement._phoneInputHandlers;
    
    // Eğer daha önce handler'lar eklenmişse, önce kaldır
    if (phoneInputHandlers) {
        if (phoneInputHandlers.beforeinput) {
            inputElement.removeEventListener('beforeinput', phoneInputHandlers.beforeinput);
        }
        if (phoneInputHandlers.input) {
            inputElement.removeEventListener('input', phoneInputHandlers.input);
        }
        if (phoneInputHandlers.focus) {
            inputElement.removeEventListener('focus', phoneInputHandlers.focus);
        }
        if (phoneInputHandlers.select) {
            inputElement.removeEventListener('select', phoneInputHandlers.select);
        }
        if (phoneInputHandlers.mouseup) {
            inputElement.removeEventListener('mouseup', phoneInputHandlers.mouseup);
        }
        if (phoneInputHandlers.blur) {
            inputElement.removeEventListener('blur', phoneInputHandlers.blur);
        }
        if (phoneInputHandlers.keydown) {
            inputElement.removeEventListener('keydown', phoneInputHandlers.keydown);
        }
        if (phoneInputHandlers.paste) {
            inputElement.removeEventListener('paste', phoneInputHandlers.paste);
        }
    }
    
    // Yeni handler objesi oluştur
    phoneInputHandlers = {};
    
    // Placeholder'ı otomatik set et (HTML'deki placeholder'ı override et)
    inputElement.placeholder = '+90 (';
    
    // ✅ HTML5 validation pattern ve mesajı ekle (+90 (XXX) XXX XX XX formatı)
    inputElement.setAttribute('pattern', '\\+90\\s?\\(\\d{3}\\)\\s?\\d{3}\\s?\\d{2}\\s?\\d{2}');
    inputElement.setAttribute('title', 'Telefon numarası formatı: +90 (XXX) XXX XX XX');
    
    // ✅ KALDIRILDI: Invalid event listener - Artık sadece blur event'inde validation yapılıyor
    // Kullanıcı yazarken uyarı göstermemek için invalid event'i kaldırıldı
    
    let isUpdating = false;
    
    // ✅ ÖNEMLİ: previousValue, hadSelection ve isDeleting değişkenlerini önce tanımla
    let previousValue = inputElement.value;
    let hadSelection = false;
    let isDeleting = false;
    
    // Mevcut değeri formatla (sadece ilk kurulumda)
    if (inputElement.value && inputElement.value.trim() !== '' && inputElement.value.trim() !== '+90 (') {
        const digits = inputElement.value.replace(/\D/g, '');
        // Eğer digits "90" ile başlıyorsa (yanlış format), sadece son 10 rakamı al
        let cleanDigits = digits;
        if (digits.length === 12 && digits.startsWith('90')) {
            cleanDigits = digits.substring(2);
        } else if (digits.length === 11 && digits.startsWith('0')) {
            cleanDigits = digits.substring(1);
        } else if (digits.length === 10) {
            cleanDigits = digits;
        } else if (digits.length > 10) {
            cleanDigits = digits.substring(digits.length - 10);
        }
        // Son 10 rakamı al
        if (cleanDigits.length > 10) {
            cleanDigits = cleanDigits.substring(cleanDigits.length - 10);
        }
        if (cleanDigits.length > 0 && cleanDigits.length <= 10) {
            inputElement.value = formatPhoneNumber(cleanDigits);
            previousValue = inputElement.value;
        } else {
            inputElement.value = '+90 (';
            previousValue = '+90 (';
        }
    } else {
        // Değer boşsa veya sadece "+90 (" ise, direkt "+90 (" set et
        inputElement.value = '+90 (';
        previousValue = '+90 (';
    }
    let deletionType = null; // 'backspace' veya 'delete'
    
    // ✅ BEFOREINPUT EVENT - Seçili metin bilgisini sakla ve silme işlemini tespit et
    let beforeInputCursorPos = 0;
    let beforeInputValue = '';
    phoneInputHandlers.beforeinput = function(e) {
        // Seçili metin var mı kontrol et
        const selectionStart = e.target.selectionStart;
        const selectionEnd = e.target.selectionEnd;
        hadSelection = selectionEnd > selectionStart;
        previousValue = e.target.value;
        beforeInputValue = e.target.value; // Değeri sakla
        beforeInputCursorPos = selectionStart; // Cursor pozisyonunu sakla
        
        // Silme işlemini tespit et
        isDeleting = e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward';
        if (e.inputType === 'deleteContentBackward') {
            deletionType = 'backspace';
        } else if (e.inputType === 'deleteContentForward') {
            deletionType = 'delete';
        } else {
            deletionType = null;
        }
    };
    inputElement.addEventListener('beforeinput', phoneInputHandlers.beforeinput);
    
    // INPUT EVENT - Formatlama ve rakam kontrolü
    phoneInputHandlers.input = function(e) {
        if (isUpdating) return;
        
        isUpdating = true;
        let value = e.target.value;
        const cursorPos = e.target.selectionStart;
        
        // ✅ "+90 (" prefix'ini her zaman koru - Eğer value "+90 (" ile başlamıyorsa, ekle
        if (!value.startsWith('+90 (')) {
            value = '+90 (' + value.replace(/^\+90\s?\(?/, '').replace(/\D/g, '');
        }
        
        // ✅ Rakamları çıkar - Sadece "+90 (" sonrasındaki rakamları al
        let digits = '';
        if (value.startsWith('+90 (')) {
            digits = value.substring(5).replace(/\D/g, '');
        } else {
            digits = value.replace(/\D/g, '');
        }
        
        // Maksimum 10 rakam
        digits = digits.substring(0, 10);
        
        // Eğer tüm rakamlar silindiyse, sadece "+90 (" bırak
        if (digits.length === 0) {
            e.target.value = '+90 (';
            isUpdating = false;
            setTimeout(() => {
                e.target.setSelectionRange(5, 5);
            }, 0);
            return;
        }
        
        // ✅ Sadece normal yazma durumunda eski formatları (90, 0) temizle
        let cleanDigits = digits;
        if (!isDeleting && !hadSelection) {
            if (cleanDigits.startsWith('90') && cleanDigits.length > 2) {
                cleanDigits = cleanDigits.substring(2);
            }
            if (cleanDigits.startsWith('0') && cleanDigits.length > 1) {
                cleanDigits = cleanDigits.substring(1);
            }
            if (cleanDigits.length > 10) {
                cleanDigits = cleanDigits.substring(cleanDigits.length - 10);
            }
        }
        
        // Formatla
        const formatted = formatPhoneNumber(cleanDigits);
        
        // ✅ BASİT ÇÖZÜM: Cursor pozisyonunu hesapla
        const prefixLen = 5; // '+90 ('
        let newCursorPos = prefixLen;
        
        // Seçili metin varsa, cursor'u sona taşı
        if (hadSelection && digits.length > 0) {
            newCursorPos = formatted.length;
        } else if (digits.length > 0) {
            // Silme işlemi kontrolü
            const isDeletion = isDeleting || (previousValue && previousValue.length > value.length && !hadSelection);
            
            if (isDeletion && !hadSelection) {
                // ✅ SİLME İŞLEMİ: beforeinput event'inden gelen bilgileri kullan
                const oldCursorPos = beforeInputCursorPos || cursorPos;
                const oldValue = beforeInputValue || previousValue;
                const oldAfterPrefix = oldValue.startsWith('+90 (') ? oldValue.substring(prefixLen) : '';
                
                // Eski cursor pozisyonundan önce kaç rakam var?
                let digitCountBeforeCursor = 0;
                for (let i = 0; i < oldCursorPos - prefixLen && i < oldAfterPrefix.length; i++) {
                    if (/\d/.test(oldAfterPrefix[i])) {
                        digitCountBeforeCursor++;
                    }
                }
                
                // Backspace ile bir rakam silindi, cursor bir rakam geriye gitmeli
                const targetDigitCount = Math.max(0, digitCountBeforeCursor - 1);
                
                // Yeni formatlanmış değerde cursor pozisyonunu bul
                const newAfterPrefix = formatted.substring(prefixLen);
                let currentDigitCount = 0;
                newCursorPos = prefixLen; // Varsayılan
                
                // Formatlanmış string'de rakamları sayarak cursor pozisyonunu bul
                for (let i = 0; i < newAfterPrefix.length; i++) {
                    if (/\d/.test(newAfterPrefix[i])) {
                        currentDigitCount++;
                        if (currentDigitCount === targetDigitCount) {
                            // Hedef rakam sayısına ulaştık, cursor'u bu rakamın sonrasına yerleştir
                            newCursorPos = prefixLen + i + 1;
                            break;
                        } else if (currentDigitCount > targetDigitCount) {
                            // Rakam sayısı hedefi geçti, cursor'u bu rakamın önüne yerleştir
                            newCursorPos = prefixLen + i;
                            break;
                        }
                    }
                }
                
                // Eğer cursor pozisyonu bulunamadıysa, son rakamın sonrasına yerleştir
                if (newCursorPos < prefixLen) {
                    let lastDigitPos = prefixLen;
                    for (let i = 0; i < newAfterPrefix.length; i++) {
                        if (/\d/.test(newAfterPrefix[i])) {
                            lastDigitPos = prefixLen + i + 1;
                        }
                    }
                    newCursorPos = lastDigitPos > prefixLen ? lastDigitPos : formatted.length;
                }
            } else {
                // ✅ NORMAL YAZMA: Cursor pozisyonunu koru
                const oldAfterPrefix = value.substring(prefixLen);
                let digitCountBeforeCursor = 0;
                
                for (let i = 0; i < cursorPos - prefixLen && i < oldAfterPrefix.length; i++) {
                    if (/\d/.test(oldAfterPrefix[i])) {
                        digitCountBeforeCursor++;
                    }
                }
                
                const newAfterPrefix = formatted.substring(prefixLen);
                let currentDigitCount = 0;
                
                for (let i = 0; i < newAfterPrefix.length; i++) {
                    if (/\d/.test(newAfterPrefix[i])) {
                        currentDigitCount++;
                        if (currentDigitCount === digitCountBeforeCursor) {
                            newCursorPos = prefixLen + i + 1;
                            break;
                        } else if (currentDigitCount > digitCountBeforeCursor) {
                            newCursorPos = prefixLen + i;
                            break;
                        }
                    }
                }
                
                if (digits.length >= 10) {
                    newCursorPos = formatted.length;
                }
                if (newCursorPos < prefixLen) {
                    newCursorPos = formatted.length;
                }
            }
        }
        
        // Değeri güncelle
        e.target.value = formatted;
        
        // ✅ KALDIRILDI: Input event'inde validation mesajı gösterilmiyor
        // Sadece blur event'inde validation yapılacak (kullanıcı yazarken rahatsız etmemek için)
        // Input event'inde sadece custom validity'yi temizle (yazarken uyarı gösterme)
        e.target.setCustomValidity('');
        e.target.classList.remove('input-error');
        
        isUpdating = false;
        
        // Cursor pozisyonunu ayarla
        setTimeout(() => {
            e.target.setSelectionRange(newCursorPos, newCursorPos);
            // previousValue'yu güncelle
            previousValue = formatted;
            hadSelection = false;
            isDeleting = false;
            deletionType = null;
        }, 0);
    };
    inputElement.addEventListener('input', phoneInputHandlers.input);
    
    // FOCUS EVENT - Input'a tıklandığında formatlamayı kontrol et ve +90 ( maskesini göster
    phoneInputHandlers.focus = function(e) {
        const value = e.target.value;
        
        // ✅ DÜZELTME: Eğer değer boş veya sadece boşluksa, "+90 (" set et
        if (!value || value.trim() === '') {
            e.target.value = '+90 (';
            previousValue = '+90 (';
            setTimeout(() => {
                e.target.setSelectionRange(5, 5);
            }, 0);
            return;
        }
        
        // Cursor'u doğru pozisyona taşı (eğer değer "+90 (" ise)
        if (value === '+90 (') {
            setTimeout(() => {
                e.target.setSelectionRange(5, 5);
            }, 0);
        }
    };
    inputElement.addEventListener('focus', phoneInputHandlers.focus);
    
    // ✅ SELECT EVENT - "+90 (" prefix'ini seçilemez yap
    phoneInputHandlers.select = function(e) {
        const selectionStart = e.target.selectionStart;
        const selectionEnd = e.target.selectionEnd;
        const prefixLen = 5; // '+90 ('
        
        // Eğer seçim "+90 (" kısmını içeriyorsa, sadece "+90 (" sonrasını seç
        if (selectionStart < prefixLen || selectionEnd <= prefixLen) {
            setTimeout(() => {
                const newStart = Math.max(prefixLen, selectionStart);
                const newEnd = Math.max(prefixLen, selectionEnd);
                e.target.setSelectionRange(newStart, newEnd);
            }, 0);
        }
    };
    inputElement.addEventListener('select', phoneInputHandlers.select);
    
    // ✅ MOUSEUP EVENT - Mouse ile seçim yapıldığında "+90 (" kısmını koru
    phoneInputHandlers.mouseup = function(e) {
        const selectionStart = e.target.selectionStart;
        const selectionEnd = e.target.selectionEnd;
        const prefixLen = 5; // '+90 ('
        
        // Eğer seçim "+90 (" kısmını içeriyorsa, sadece "+90 (" sonrasını seç
        if (selectionStart < prefixLen || selectionEnd <= prefixLen) {
            setTimeout(() => {
                const newStart = Math.max(prefixLen, selectionStart);
                const newEnd = Math.max(prefixLen, selectionEnd);
                e.target.setSelectionRange(newStart, newEnd);
            }, 0);
        }
    };
    inputElement.addEventListener('mouseup', phoneInputHandlers.mouseup);
    
    // ✅ BLUR EVENT - Input'tan ayrıldığında validation kontrolü yap
    // Kullanıcı yazarken uyarı göstermemek için sadece blur event'inde validation yapılıyor
    phoneInputHandlers.blur = function(e) {
        // ✅ DÜZELTME: Form kapatılırken tooltip gösterme
        // Eğer form kapatılıyorsa (toast gösteriliyorsa), validation tooltip'i gösterme
        const isFormClosing = document.querySelector('.toast-interactive') !== null || 
                              document.querySelector('[data-form-closing="true"]') !== null;
        
        if (isFormClosing) {
            // Form kapatılıyor, validation'ı tamamen temizle - tooltip gösterme
            e.target.setCustomValidity('');
            e.target.classList.remove('input-error');
            // Custom tooltip'i de temizle (varsa)
            if (typeof hideInputError === 'function') {
                hideInputError(e.target);
            }
            return;
        }
        
        // Normal blur işlemi - validation yap ve tooltip göster
        const value = e.target.value;
        const digits = value.startsWith('+90 (') ? value.substring(5).replace(/\D/g, '') : value.replace(/\D/g, '');
        
        // Eğer değer varsa ama format hatalıysa, uyarı göster
        if (value && value.trim() !== '' && value !== '+90 (') {
            // Format kontrolü: +90 (XXX) XXX XX XX
            const isValidFormat = /^\+90\s?\(\d{3}\)\s?\d{3}\s?\d{2}\s?\d{2}$/.test(value);
            
            // ✅ SADECE HTML5 native validation kullan - validatePhoneInput fonksiyonunu kullan
            // Custom tooltip'i her zaman temizle (sadece native kullanıyoruz)
            if (typeof hideInputError === 'function') {
                hideInputError(e.target);
            }
            
            // validatePhoneInput fonksiyonunu kullan (o zaten tooltip'i yönetiyor)
            if (typeof validatePhoneInput === 'function') {
                validatePhoneInput(e.target, true); // showTooltip = true
            } else {
                // Fallback: Manuel validation
                if (digits.length > 0 && digits.length < 10) {
                    e.target.setCustomValidity('Telefon numarası eksik! +90 (XXX) XXX XX XX formatında yazınız.');
                    e.target.reportValidity();
                } else if (!isValidFormat && digits.length === 10) {
                    e.target.setCustomValidity('Telefon numarası formatı hatalı! +90 (XXX) XXX XX XX formatında yazınız.');
                    e.target.reportValidity();
                } else if (isValidFormat) {
                    e.target.setCustomValidity('');
                } else {
                    e.target.setCustomValidity('');
                }
            }
        } else if (e.target.required && (value === '' || value === '+90 (')) {
            // Required alan boşsa, sadece required mesajı göster (HTML5 native validation)
            e.target.setCustomValidity('');
            // Custom tooltip'i de temizle
            if (typeof hideInputError === 'function') {
                hideInputError(e.target);
            }
        } else {
            // Değer yoksa, hata yok
            e.target.setCustomValidity('');
            e.target.classList.remove('input-error');
            // Custom tooltip'i de temizle
            if (typeof hideInputError === 'function') {
                hideInputError(e.target);
            }
        }
    };
    inputElement.addEventListener('blur', phoneInputHandlers.blur);
    
    // KEYDOWN EVENT - Sadece rakam girişi ve silme kontrolü
    phoneInputHandlers.keydown = function(e) {
        const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab'];
        const isControlKey = e.ctrlKey || e.metaKey || e.altKey;
        
        // ✅ Ctrl+A (Select All) - "+90 (" kısmını hariç tut
        if ((e.key === 'a' || e.key === 'A') && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const prefixLen = 5; // '+90 ('
            const value = e.target.value;
            if (value.length > prefixLen) {
                e.target.setSelectionRange(prefixLen, value.length);
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
        
        // Rakam girişi kontrolü
        if (/^\d$/.test(e.key) && !isControlKey) {
            const val = e.target.value;
            let digits = '';
            if (val.startsWith('+90 (')) {
                digits = val.substring(5).replace(/\D/g, '');
            } else {
                digits = val.replace(/\D/g, '');
            }
            
            // Maksimum 10 rakam (10. rakamı da yazabilmek için > 10 kontrolü - 10 rakam varsa yeni rakam ekleme engellenmez)
            // ✅ DÜZELTME: >= 10 yerine > 10 kullanıldı, böylece 10. rakam yazılabilir
            if (digits.length > 10) {
                e.preventDefault();
                return false;
            }
        }
        
        // BACKSPACE - +90 ( formatını koru, sadece rakamları sil
        if (e.key === 'Backspace') {
            const cursorPos = e.target.selectionStart;
            const selectionEnd = e.target.selectionEnd;
            const val = e.target.value;
            const prefixLen = 5; // '+90 ('
            
            // Seçili metin varsa
            if (selectionEnd > cursorPos) {
                if (cursorPos < prefixLen || selectionEnd <= prefixLen) {
                    e.preventDefault();
                    setTimeout(() => {
                        const newStart = Math.max(prefixLen, cursorPos);
                        const newEnd = Math.max(prefixLen, selectionEnd);
                        e.target.setSelectionRange(newStart, newEnd);
                    }, 0);
                    return false;
                }
                // Seçili metin "+90 (" sonrasındaysa, normal silme işlemini yap (input event handler formatlayacak)
                return;
            }
            
            // Sadece +90 ( kaldıysa, silmeyi engelle
            if (val === '+90 (' && cursorPos <= prefixLen) {
                e.preventDefault();
                return false;
            }
            
            // Cursor +90 ( içindeyse, silmeyi engelle
            if (cursorPos < prefixLen) {
                e.preventDefault();
                return false;
            }
            
            // ✅ ÖNEMLİ: Cursor +90 ( sonrasındaysa, silmeye izin ver
            // input event handler formatlama yapacak ve cursor pozisyonunu düzeltecek
            // Burada preventDefault() yapmıyoruz, böylece normal silme işlemi gerçekleşir
        }
        
        // DELETE - +90 ( formatını koru, sadece rakamları sil
        if (e.key === 'Delete') {
            const cursorPos = e.target.selectionStart;
            const selectionEnd = e.target.selectionEnd;
            const val = e.target.value;
            const prefixLen = 5; // '+90 ('
            
            // ✅ Seçili metin varsa ve "+90 (" kısmını içeriyorsa, sadece "+90 (" sonrasını sil
            if (selectionEnd > cursorPos) {
                // Eğer seçim "+90 (" kısmını içeriyorsa, sadece "+90 (" sonrasını seç
                if (cursorPos < prefixLen || selectionEnd <= prefixLen) {
                    e.preventDefault();
                    setTimeout(() => {
                        const newStart = Math.max(prefixLen, cursorPos);
                        const newEnd = Math.max(prefixLen, selectionEnd);
                        e.target.setSelectionRange(newStart, newEnd);
                    }, 0);
                    return false;
                }
                return;
            }
            
            // ✅ DÜZELTME: Sadece "+90 (" kısmını koru - Geri kalanını input event handler halledecek
            // Eğer sadece +90 ( kaldıysa ve cursor +90 ( içindeyse, silmeyi engelle
            if (val === '+90 (' && cursorPos <= prefixLen) {
                e.preventDefault();
                return false;
            }
            
            // ✅ DÜZELTME: Cursor +90 ( içindeyse (prefixLen'dan önce), silmeyi engelle
            // Ama cursor +90 ( sonrasındaysa, silmeye izin ver (input event handler formatlayacak)
            // Sadece cursor pozisyonu prefixLen'dan küçükse engelle
            if (cursorPos < prefixLen) {
                // Cursor +90 ( içindeyse, silmeyi engelle
                e.preventDefault();
                return false;
            }
        }
    };
    inputElement.addEventListener('keydown', phoneInputHandlers.keydown);
    
    // PASTE EVENT - Her zaman +90 ( formatını koru
    phoneInputHandlers.paste = function(e) {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        const digits = pasted.replace(/\D/g, '').substring(0, 10);
        if (digits.length > 0) {
            e.target.value = formatPhoneNumber(digits);
            setTimeout(() => {
                e.target.setSelectionRange(e.target.value.length, e.target.value.length);
            }, 0);
        } else {
            // Rakam yoksa +90 ( formatını koru
            e.target.value = '+90 (';
            setTimeout(() => {
                e.target.setSelectionRange(5, 5);
            }, 0);
        }
    };
    inputElement.addEventListener('paste', phoneInputHandlers.paste);
    
    // ✅ ÖNEMLİ: Event handler'ları input element'ine kaydet (sonraki setupPhoneInput çağrılarında kaldırmak için)
    inputElement._phoneInputHandlers = phoneInputHandlers;
}

// Global erişim için
window.formatPhoneNumber = formatPhoneNumber;
window.setupPhoneInput = setupPhoneInput;
window.cleanPhoneForDatabase = cleanPhoneForDatabase;

// Tüm sayfalarda telefon inputlarını otomatik formatla - ORTAK YAPI
// Hem data-phone-input="standard" hem de telefon input'larını (class="telefon-input", type="tel", id içinde "telefon"/"phone") işle
// ✅ DÜZELTME: Console sayfalarında çalışma - Console sayfalarının kendi validation yapısı var
(function() {
    // ✅ Console sayfası kontrolü - Console sayfalarında phone-formatter'ı devre dışı bırak
    function isConsolePage() {
        // HTML class'ına göre kontrol et
        if (document.documentElement.classList.contains('console-login-page') ||
            document.documentElement.classList.contains('console-tenant-manage-page') ||
            document.documentElement.classList.contains('console-page')) {
            return true;
        }
        // URL'ye göre kontrol et
        if (window.location.pathname.includes('console') || 
            window.location.pathname.includes('console-login') ||
            window.location.pathname.includes('console-tenant-manage')) {
            return true;
        }
        return false;
    }
    
    function applyPhoneFormattingToAllInputs() {
        // ✅ Console sayfasında phone-formatter'ı devre dışı bırak
        if (isConsolePage()) {
            return;
        }
        
        // Önce data-phone-input="standard" attribute'una sahip telefon inputlarını bul
        const standardInputs = document.querySelectorAll('input[data-phone-input="standard"]');
        standardInputs.forEach(input => {
            if (!input.hasAttribute('data-phone-formatted') && !input.disabled) {
                if (typeof window.setupPhoneInput === 'function') {
                    window.setupPhoneInput(input);
                }
            }
        });
        
        // Sonra telefon input'larını bul (class="telefon-input", type="tel", id içinde "telefon"/"phone")
        const phoneInputs = document.querySelectorAll(
            'input.telefon-input:not([data-phone-input="standard"]), ' +
            'input[type="tel"]:not([data-phone-input="standard"]), ' +
            'input[id*="telefon"]:not([data-phone-input="standard"]), ' +
            'input[id*="phone"]:not([data-phone-input="standard"])'
        );
        
        phoneInputs.forEach(input => {
            // Eğer zaten formatlanmışsa veya disabled ise atla
            if (input.hasAttribute('data-phone-formatted') || input.hasAttribute('data-telefon-formatted') || input.disabled) {
                return;
            }
            
            // setupPhoneInput uygula (artık telefon input'larını da işliyor)
            if (typeof window.setupPhoneInput === 'function') {
                window.setupPhoneInput(input);
            }
        });
    }
    
    // Sayfa yüklendiğinde uygula
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyPhoneFormattingToAllInputs);
    } else {
        applyPhoneFormattingToAllInputs();
    }
    
    // MutationObserver ile dinamik eklenen input'ları da yakala
    const observer = new MutationObserver(function(mutations) {
        // ✅ Console sayfasında phone-formatter'ı devre dışı bırak
        if (isConsolePage()) {
            return;
        }
        
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) {
                    // Yeni eklenen node'da telefon input'larını ara
                    const phoneInputs = node.querySelectorAll ? node.querySelectorAll(
                        'input[data-phone-input="standard"], ' +
                        'input.telefon-input, ' +
                        'input[type="tel"], ' +
                        'input[id*="telefon"], ' +
                        'input[id*="phone"]'
                    ) : [];
                    phoneInputs.forEach(input => {
                        // ✅ ÖNEMLİ: Index sayfasındaki telefon inputlarını MutationObserver'dan hariç tut
                        // Index sayfasında setupIndexFormPhoneMask fonksiyonu telefon formatlamasını yönetiyor
                        if (input && (input.id === 'orgsahibitelefon' || input.id === 'musteriyetkilitelefon' || 
                            input.name === 'orgsahibitelefon' || input.name === 'musteriyetkilitelefon')) {
                            // Index sayfasındaki input'ları atla - setupIndexFormPhoneMask yönetiyor
                            return;
                        }
                        
                        // ✅ ÖNEMLİ: Ayarlar sayfasındaki sp-wp-tel inputunu MutationObserver'dan hariç tut
                        // Ayarlar sayfasında setupYeniKisiForm fonksiyonu telefon formatlamasını yönetiyor
                        if (input && input.id === 'sp-wp-tel') {
                            // Ayarlar sayfasındaki input'u atla - setupYeniKisiForm yönetiyor
                            return;
                        }
                        
                        // ✅ ÖNEMLİ: data-phone-formatted kontrolünü yap - Eğer zaten formatlanmışsa, tekrar setupPhoneInput çağırma
                        // Index sayfasında form aç/kapat sırasında MutationObserver aynı input'u tekrar yakalıyor
                        // Bu, event listener'ların çakışmasına ve silme sorunlarına neden oluyor
                        if (input && !input.hasAttribute('data-phone-formatted') && !input.hasAttribute('data-telefon-formatted') && !input.disabled) {
                            // ✅ ÖNEMLİ: data-phone-formatted attribute'unu HEMEN set et (race condition'ı önlemek için)
                            // setupPhoneInput içinde de kontrol var ama burada da set ediyoruz
                            input.setAttribute('data-phone-formatted', 'true');
                            if (typeof window.setupPhoneInput === 'function') {
                                window.setupPhoneInput(input);
                            }
                        }
                    });
                    // Eğer node'un kendisi telefon input'u ise
                    if (node.tagName === 'INPUT' && (
                        node.getAttribute('data-phone-input') === 'standard' ||
                        node.classList.contains('telefon-input') ||
                        node.type === 'tel' ||
                        (node.id && (node.id.includes('telefon') || node.id.includes('phone')))
                    )) {
                        // ✅ ÖNEMLİ: Index sayfasındaki telefon inputlarını MutationObserver'dan hariç tut
                        // Index sayfasında setupIndexFormPhoneMask fonksiyonu telefon formatlamasını yönetiyor
                        if (node.id === 'orgsahibitelefon' || node.id === 'musteriyetkilitelefon' || 
                            node.name === 'orgsahibitelefon' || node.name === 'musteriyetkilitelefon') {
                            // Index sayfasındaki input'ları atla - setupIndexFormPhoneMask yönetiyor
                            return;
                        }
                        
                        // ✅ ÖNEMLİ: Ayarlar sayfasındaki sp-wp-tel inputunu MutationObserver'dan hariç tut
                        // Ayarlar sayfasında setupYeniKisiForm fonksiyonu telefon formatlamasını yönetiyor
                        if (node.id === 'sp-wp-tel') {
                            // Ayarlar sayfasındaki input'u atla - setupYeniKisiForm yönetiyor
                            return;
                        }
                        
                        // ✅ ÖNEMLİ: data-phone-formatted kontrolünü yap - Eğer zaten formatlanmışsa, tekrar setupPhoneInput çağırma
                        if (!node.hasAttribute('data-phone-formatted') && !node.hasAttribute('data-telefon-formatted') && !node.disabled) {
                            // ✅ ÖNEMLİ: data-phone-formatted attribute'unu HEMEN set et (race condition'ı önlemek için)
                            node.setAttribute('data-phone-formatted', 'true');
                            if (typeof window.setupPhoneInput === 'function') {
                                window.setupPhoneInput(node);
                            }
                        }
                    }
                }
            });
        });
    });
    
    // document.body'nin yüklenmesini bekle
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        // document.body henüz yüklenmemişse, DOMContentLoaded'ı bekle
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                if (document.body) {
                    observer.observe(document.body, { childList: true, subtree: true });
                }
            });
        } else {
            // DOMContentLoaded zaten geçmişse, kısa bir süre bekle
            setTimeout(function() {
                if (document.body) {
                    observer.observe(document.body, { childList: true, subtree: true });
                }
            }, 100);
        }
    }
})();
