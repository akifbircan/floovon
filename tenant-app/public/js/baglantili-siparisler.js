/**
 * Bağlantılı Siparişleri Hesaplayan Fonksiyon
 * Aynı hafta + farklı organizasyonlar
 * script.js'ten taşındı (2026-02-08)
 */
(function() {
'use strict';

//#region Bağlantılı Siparişleri Hesaplayan Fonksiyon (Aynı hafta + farklı organizasyonlar)

async function baglantiliSiparisleriHesapla() {
    const kartlar = document.querySelectorAll('.siparis-kart');
    if (kartlar.length === 0) {
        return;
    }

    // Her müşteri için backend'den veri çek
    const musteriSiparisMap = new Map();
    
    // Tüm siparişleri backend'den çek
    try {
        // Token ekleyen fetch kullan (floovonFetch veya override edilmiş fetch)
        const fetchFn = window.floovonFetch || window.floovonFetchStandard;
        let response;
        if (fetchFn) {
            // floovonFetch kullan - URL zaten endpoint olmalı (/api/siparis-kartlar veya siparis-kartlar)
            // floovonFetch içinde base URL zaten ekleniyor
            response = await fetchFn('/api/siparis-kartlar');
        } else {
            // Fallback: Manuel fetch
            const apiBase = (typeof window.getFloovonApiBase === 'function') 
                ? await window.getFloovonApiBase() 
                : (window.API_BASE_URL || (window.location.origin ? window.location.origin + '/api' : '/api'));
            const token = localStorage.getItem('floovon_token') || localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            response = await fetch(`${apiBase}/siparis-kartlar`, { headers });
        }
        // floovonFetch response'u otomatik parse ediyor, normal fetch ise json() çağrılmalı
        const result = (response && typeof response.json === 'function') ? await response.json() : response;
        
        if (!result.success || !result.data) {
            console.error('❌ Sipariş verileri alınamadı:', result);
            return;
        }
        
        // ✅ REVIZE-4: Seçili haftanın tarih aralığını al
        let selectedWeekDays = [];
        try {
            const weekInput = document.getElementById('weekPicker') || document.querySelector("input[type='week']");
            if (weekInput && weekInput.value) {
                const selectedWeek = weekInput.value;
                // getWeekDays veya getSelectedWeekDays fonksiyonunu kullan
                if (typeof window.getSelectedWeekDays === 'function') {
                    selectedWeekDays = window.getSelectedWeekDays();
                } else if (typeof getSelectedWeekDays === 'function') {
                    selectedWeekDays = getSelectedWeekDays();
                } else if (typeof window.getWeekDays === 'function') {
                    selectedWeekDays = window.getWeekDays(selectedWeek);
                } else if (typeof getWeekDays === 'function') {
                    selectedWeekDays = getWeekDays(selectedWeek);
                } else if (typeof moment !== 'undefined') {
                    // Fallback: moment.js ile hesapla
                    const startOfWeek = moment(selectedWeek, 'YYYY-[W]WW').startOf('isoWeek');
                    for (let i = 0; i < 7; i++) {
                        const day = startOfWeek.clone().add(i, 'days');
                        selectedWeekDays.push(day.format('DD MMMM YYYY dddd'));
                    }
                }
            }
        } catch (weekError) {
            console.warn('⚠️ Seçili hafta alınamadı, tüm haftalardaki siparişler sayılacak:', weekError);
        }
        
        // Her müşteri için KAÇ FARKLI ORGANİZASYON KARTINDA sipariş olduğunu hesapla
        const musteriOrganizasyonMap = new Map(); // { "Ahmet Yılmaz": Set([1, 2, 3]) }
        
        // ✅ REVIZE-4: Seçili haftadaki siparişleri bul (DOM'dan) - müşteri unvanı ve organizasyon kart ID'si eşleştirmesi
        const selectedWeekSiparisler = new Map(); // { "musteriUnvan|organizasyonKartId": true }
        if (selectedWeekDays.length > 0) {
            const domKartlar = document.querySelectorAll('.siparis-kart, .ana-kart, .item');
            domKartlar.forEach(kart => {
                const tarihElement = kart.querySelector('.teslim-zaman .tarih, .tarih');
                if (tarihElement) {
                    const kartTarih = tarihElement.textContent.trim();
                    if (selectedWeekDays.includes(kartTarih)) {
                        // Bu kart seçili haftada, müşteri unvanı ve organizasyon kart ID'sini bul
                        const siparisVeren = kart.querySelector('.siparis-veren')?.textContent.trim();
                        const organizasyonKartId = kart.getAttribute('data-organizasyon-id') || 
                                                    kart.closest('.item, .ana-kart')?.getAttribute('data-organizasyon-id');
                        if (siparisVeren && organizasyonKartId) {
                            // Müşteri unvanı ve organizasyon kart ID'sini birleştirerek key oluştur
                            const key = `${siparisVeren}|${organizasyonKartId}`;
                            selectedWeekSiparisler.set(key, true);
                        }
                    }
                }
            });
        }
        
        result.data.forEach(siparis => {
            const musteriUnvan = siparis.musteri_unvan;
            const organizasyonKartId = siparis.organizasyon_kart_id;
            
            if (!musteriUnvan) {
                return;
            }
            
            if (!organizasyonKartId) {
                return;
            }
            
            // ✅ REVIZE-4: Sadece seçili haftadaki siparişleri say (müşteri unvanı + organizasyon kart ID eşleştirmesi)
            if (selectedWeekSiparisler.size > 0) {
                const key = `${musteriUnvan}|${organizasyonKartId}`;
                // Eğer bu sipariş seçili haftada değilse, sayma
                if (!selectedWeekSiparisler.has(key)) {
                    return;
                }
            }
            
            if (!musteriOrganizasyonMap.has(musteriUnvan)) {
                musteriOrganizasyonMap.set(musteriUnvan, new Set());
            }
            musteriOrganizasyonMap.get(musteriUnvan).add(organizasyonKartId);
        });
        
        // Her müşteri için FARKLI organizasyon sayısını hesapla
        musteriOrganizasyonMap.forEach((organizasyonSet, musteriUnvan) => {
            musteriSiparisMap.set(musteriUnvan, organizasyonSet.size);
        });
        
        // DOM'daki her kart için bağlantılı sipariş sayısını güncelle
        let guncellenenKartSayisi = 0;
        kartlar.forEach(kart => {
            const siparisVeren = kart.querySelector('.siparis-veren')?.textContent.trim();
            if (!siparisVeren) {
                return;
            }
            
            const alan = kart.querySelector('.baglantili-siparisler, .baglantili-siparisler-yok');
            if (!alan) {
                return;
            }
            
            const icon = alan.querySelector('i');
            
            // Var olan sayı metni temizle
            temizleSayiyi(icon);
            
            // Backend'den gelen toplam sipariş sayısını al
            const toplamSiparisSayisi = musteriSiparisMap.get(siparisVeren) || 0;
            
            
            if (toplamSiparisSayisi > 1) {
                // Sınıfı güncelle (AKTİF - 2+ farklı organizasyonda sipariş var)
                alan.className = 'baglantili-siparisler';
                // Rakamı ikonun yanına ekle
                icon?.insertAdjacentText('afterend', toplamSiparisSayisi.toString());
                // Tooltip içeriğini güncelle
                alan.setAttribute('data-tooltip', `Bu müşterinin ${toplamSiparisSayisi} farklı organizasyon kartında siparişi var`);
                guncellenenKartSayisi++;
            } else {
                // Sınıfı güncelle (PASİF - 0 veya 1 organizasyonda sipariş var)
                alan.className = 'baglantili-siparisler-yok';
                // 0 yaz (bağlantılı sipariş yok demektir)
                icon?.insertAdjacentText('afterend', '0');
                // Tooltip içeriğini güncelle
                alan.setAttribute('data-tooltip', toplamSiparisSayisi === 0 ? 'İlişkili sipariş yok' : 'Bu müşterinin sadece bu organizasyonda siparişi var (bağlantılı sipariş yok)');
            }
        });
        
    } catch (error) {
        console.error('❌ Bağlantılı siparişler hesaplama hatası:', error);
    }
}

function temizleSayiyi(iconElement) {
    if (!iconElement) return;
    let next = iconElement.nextSibling;
    while (next && next.nodeType === Node.TEXT_NODE) {
        const sil = next;
        next = next.nextSibling;
        sil.remove();
    }
}

//#endregion

// Window exports
window.baglantiliSiparisleriHesapla = baglantiliSiparisleriHesapla;
window.temizleSayiyi = temizleSayiyi;

})();


