// toast-notification-script.js

// #region Toast Bilgi ve Uyarıları
document.addEventListener("DOMContentLoaded", function () {
  // Bildirim kutusu oluşturulmamışsa DOM'a ekle
  if (!document.querySelector(".notifications")) {
    const notifications = document.createElement("ul");
    notifications.className = "notifications";
    // ✅ display: block olarak başlat (none yapınca toast görünmüyor!)
    notifications.style.setProperty('display', 'block', 'important');
    notifications.style.setProperty('position', 'fixed', 'important');
    notifications.style.setProperty('top', '20px', 'important');
    notifications.style.setProperty('right', '20px', 'important');
    notifications.style.setProperty('z-index', '999999', 'important');
    notifications.style.setProperty('list-style', 'none', 'important');
    notifications.style.setProperty('padding', '0', 'important');
    notifications.style.setProperty('margin', '0', 'important');
    document.body.appendChild(notifications);
  }
  
  // Demo butonlar için (örnek kullanım)
  document.querySelectorAll(".buttons .btn").forEach(btn => {
    btn.addEventListener("click", () => createToast(btn.id));
  });
});

// Değişken çakışmasını önlemek için kontrol
if (typeof window.activeToasts === 'undefined') {
    window.activeToasts = new Set(); // Aktif toast mesajlarını takip et
}
if (typeof window.toastCooldowns === 'undefined') {
    window.toastCooldowns = new Map(); // Her toast tipi için cooldown
}

// #endregion Toast Bilgi ve Uyarıları

// #region Toplam Müşteri Sayısını Güncelleme ve Boş Liste Kontrolü
function updateToplamMusteriSayisi() {
  const musteriListesi = document.querySelectorAll("tr.musteri-grup");
  const toplamMusteriAlani = document.querySelector(".toplam-musteri-sayisi");
  const musteriYokWrapper = document.querySelector(".musteri-veri-yok");
  const musteriTablosu = document.querySelector("#musteriler-tablo-export");
  // const kampanyaTablosu = document.querySelector("#kampanyalar-tablo-export");
  
  const musteriSayisi = musteriListesi.length;
  
  // Toplam sayıyı güncelle
  if (toplamMusteriAlani) {
    toplamMusteriAlani.textContent = `${musteriSayisi}`;
  }
  
  // Müşteri yoksa uyarı göster, varsa gizle
  if (musteriYokWrapper) {
    if (musteriSayisi === 0) {
      musteriYokWrapper.style.display = "flex";
      if (musteriTablosu) musteriTablosu.style.display = "none";
    } else {
      musteriYokWrapper.style.display = "none";
      if (musteriTablosu) musteriTablosu.style.display = "table";
    }
  }

  // // Kampanua yoksa uyarı göster, varsa gizle
  // if (kampanyaYokWrapper) {
  //   if (musteriSayisi === 0) {
  //     kampanyaYokWrapper.style.display = "flex";
  //     if (kampanyaTablosu) kampanyaTablosu.style.display = "none";
  //   } else {
  //     kampanyaYokWrapper.style.display = "none";
  //     if (kampanyaTablosu) kampanyaTablosu.style.display = "table";
  //   }
  // }
}

// #region Toplam Partner Sayısını Güncelleme ve Boş Liste Kontrolü
function updateToplamPartnerSayisi() {
  const partnerListesi = document.querySelectorAll("tr.partner-grup");
  const toplamPartnerAlani = document.querySelector(".toplam-partner-firma-sayisi");
  const partnerYokWrapper = document.querySelector(".partner-veri-yok");
  const partnerTablosu = document.querySelector("#partnerfirmalar-tablo-export");
  
  const partnerSayisi = partnerListesi.length;
  
  // Toplam sayıyı güncelle (eğer böyle bir alan varsa)
  if (toplamPartnerAlani) {
    toplamPartnerAlani.textContent = `${partnerSayisi}`;
  }
  
  // Partner yoksa uyarı göster, varsa gizle
  if (partnerYokWrapper) {
    if (partnerSayisi === 0) {
      partnerYokWrapper.style.display = "flex";
      if (partnerTablosu) partnerTablosu.style.display = "none";
    } else {
      partnerYokWrapper.style.display = "none";
      if (partnerTablosu) partnerTablosu.style.display = "table";
    }
  }
}

// Sayfa yüklendiğinde de kontrol et
document.addEventListener("DOMContentLoaded", function() {
  // Diğer kodlardan sonra çalışması için setTimeout kullan
  setTimeout(() => {
    updateToplamMusteriSayisi();
    updateToplamPartnerSayisi();
  }, 100);
});
// #endregion

// #region Akıllı Silme Sistemi - Tüm data-butonsil Butonlarında Toast ile Onaylı
document.addEventListener("click", function (e) {
  const btn = e.target.closest("[data-butonsil]");
  if (!btn) return;
  
  // Profil ayarları sayfasındaki silme butonlarını atla (kendi event listener'ı var)
  if (btn.classList.contains('deleteBtn') && btn.closest('.profil-kisi-tablo')) {
    console.log('⚠️ Profil ayarları silme butonu, global listener atlanıyor');
    return;
  }
  
  e.preventDefault();
  
  // Buton devre dışı mı kontrol et
  if (btn.disabled || btn.classList.contains('processing')) return;
  
  const tip = btn.dataset.butonsil;

  switch (tip) {
    case "kullanici-sil": {
      const userId = btn.getAttribute('data-user-id');
      const userName = btn.getAttribute('data-user-name') || 'Bu kullanıcı';
      
      if (!userId) {
        console.error('❌ Kullanıcı ID bulunamadı');
        return;
      }
      
      createToastInteractive({
        message: `${userName} kullanıcısını silmek istediğinizden emin misiniz?`,
        confirmText: 'Evet, Sil',
        cancelText: 'İptal',
        confirmButtonClass: 'toast-btn-danger',
        onConfirm: async () => {
          await performDeleteUser(userId);
        }
      });
      break;
    }
    case "sil":
    case "tahsilat-sil": {
      const tahsilatRow = btn.closest('tr');
      const tahsilatId = tahsilatRow?.dataset?.tahsilatId;
      const musteriId =
        (typeof window.getMusteriIdFromUrl === 'function' && window.getMusteriIdFromUrl()) ||
        new URLSearchParams(window.location.search).get('musteri_id') ||
        new URLSearchParams(window.location.search).get('musteri');
      if (!tahsilatId || !musteriId) {
        return;
      }

      const apiBase = typeof window.getFloovonApiBase === 'function'
        ? window.getFloovonApiBase()
        : ((typeof window.getFloovonApiBase === 'function') ? window.getFloovonApiBase() : (window.API_BASE_URL || 'http://localhost:3001/api'));

      createToastInteractive({
        message: 'Bu tahsilatı silmek istediğinize emin misiniz?',
        confirmText: 'Evet',
        cancelText: 'Hayır',
        onConfirm: async () => {
          try {
            const response = await fetch(`${apiBase}/musteriler/${musteriId}/tahsilatlar/${tahsilatId}`, {
              method: 'DELETE'
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || 'Tahsilat silinemedi');
            }

          if (typeof createToast === 'function') {
              createToast('success', 'Tahsilat kaydı silindi.');
            }

            if (typeof window.loadMusteriTahsilatlar === 'function') {
              await window.loadMusteriTahsilatlar(musteriId);
            }
            if (typeof window.loadMusteriCariOzet === 'function') {
              await window.loadMusteriCariOzet(musteriId);
            }
          } catch (error) {
            console.error('Tahsilat silme hatası:', error);
            if (typeof createToast === 'function') {
              createToast('error', error.message || 'Tahsilat silinirken hata oluştu');
            }
          }
        }
      });
      break;
    }
      const silinecekAlan =
        btn.closest(".etiketbox") ||
        btn.closest(".orgturbox") ||
        btn.closest(".siparis-kart") ||
        btn.closest(".dosya-alan") ||
        btn.closest("tr") ||
        btn.closest(".silinecek-alan") ||
        btn.closest(".musteri-bilgiler-alani") ||
        btn.closest("tr.musteri-grup") ||
        btn.closest("tr.partner-grup");
    
      if (!silinecekAlan) return;

      // PARENT TABLE'I HEMEN BUL VE SAKLA
      let parentTableId = null;
      if (silinecekAlan.matches("tr")) {
        const parentTable = silinecekAlan.closest('.tablo');
        parentTableId = parentTable?.id;
        console.log('Silmeden önce table ID:', parentTableId);
      }
    
      // Seçili müşteri mi kontrol et
      const seciliSatir = document.querySelector(".musteri-kapsayici.secili");
      const seciliSatirId = seciliSatir?.closest("tr.musteri-grup")?.dataset?.musterino;
      const silinecekSatirId = silinecekAlan?.dataset?.musterino;
      
      // Müşteri satırı mı kontrol et
      const isMusteriSatiri = silinecekAlan.classList.contains("musteri-grup");
      // Partner satırı mı kontrol et
      const isPartnerSatiri = silinecekAlan.classList.contains("partner-grup");
    
      createToastInteractive({
        message: "Bu kaydı silmek istediğinize emin misiniz?",
        confirmText: "Evet",
        cancelText: "Hayır",
        onConfirm: async () => {
          // Müşteri dosyası ise backend'den sil
          const isMusteriDosyasi = silinecekAlan.classList.contains("dosya-alan");
          if (isMusteriDosyasi) {
            // Önce data-file-name attribute'unu kontrol et (orijinal dosya adı - backend'de saklanan)
            let dosyaAdi = silinecekAlan.getAttribute('data-file-name');
            
            // Eğer data-file-name yoksa, sil-ikon'dan al
            if (!dosyaAdi) {
              const silIkon = silinecekAlan.querySelector('.sil-ikon');
              dosyaAdi = silIkon?.getAttribute('data-file-name');
            }
            
            // Hala yoksa, data-file-name-display'den al (düzeltilmiş hali)
            if (!dosyaAdi) {
              dosyaAdi = silinecekAlan.getAttribute('data-file-name-display');
            }
            
            // Hala yoksa, .dosya-adi'den al ama uzantıyı ekle
            if (!dosyaAdi) {
              const dosyaAdiText = silinecekAlan.querySelector('.dosya-adi')?.textContent?.trim();
              const dosyaTurText = silinecekAlan.querySelector('.dosya-tur')?.textContent?.trim();
              // Dosya türünden uzantıyı çıkar (örn: "PDF • Dosyayı İndir" -> "PDF")
              const uzantisi = dosyaTurText?.split('•')[0]?.trim().toLowerCase();
              if (dosyaAdiText && uzantisi) {
                dosyaAdi = `${dosyaAdiText}.${uzantisi}`;
              } else {
                dosyaAdi = dosyaAdiText;
              }
            }
            
            console.log('🔍 Dosya adı bulundu (toast):', dosyaAdi);
            
            const customerId = silinecekAlan.closest('.musteri-yuklenen-dosyalar')?.dataset.musteriId;
            
            console.log('🔧 Toast sisteminde dosya silme:', { customerId, dosyaAdi, hasDeleteFunction: !!window.deleteCustomerFile });
            
            if (customerId && dosyaAdi && window.deleteCustomerFile) {
              // Backend'den dosyayı sil
              try {
                await window.deleteCustomerFile(customerId, dosyaAdi);
                // Başarılı olursa UI'dan da sil ve dosya listesini yenile
                silinecekAlan.classList.add("fade-out");
                setTimeout(async () => {
                    silinecekAlan.remove();
                    // Müşteri dosya listesini yenile
                    if (typeof loadMusteriListesi === 'function') {
                      await loadMusteriListesi();
                    }
                    // Mevcut müşterinin dosya alanını güncelle
                    if (typeof musteriListesi !== 'undefined' && Array.isArray(musteriListesi)) {
                      const updatedCustomer = musteriListesi.find(c => c.id == customerId);
                      if (updatedCustomer && typeof showMusteriDosyalari === 'function') {
                        showMusteriDosyalari(updatedCustomer.urun_yazi_dosyasi || '', customerId);
                      }
                    }
                }, 300);
              } catch (error) {
                console.error('❌ Backend dosya silme hatası:', error);
                // Hata durumunda sadece UI'dan sil
                silinecekAlan.classList.add("fade-out");
                setTimeout(() => {
                    silinecekAlan.remove();
                }, 300);
              }
            } else {
              console.log('🔧 Fallback: UI\'dan silme - Eksik bilgi:', { customerId, dosyaAdi, hasDeleteFunction: !!window.deleteCustomerFile });
              // Fallback: UI'dan sil
              silinecekAlan.classList.add("fade-out");
              setTimeout(() => {
                silinecekAlan.remove();
              }, 300);
            }
          }
          // Müşteri satırı ise backend'e silme isteği gönder
          else if (isMusteriSatiri) {
            const customerId = silinecekAlan.dataset.musteriId;
            const customerName = silinecekAlan.dataset.firmaunvan;
            
            if (customerId && window.deleteCustomer) {
              // Backend'e silme isteği gönder
              window.deleteCustomer(customerId, customerName);
            } else {
              // Fallback: UI'dan sil
              silinecekAlan.classList.add("fade-out");
              setTimeout(() => {
                silinecekAlan.remove();
                if (typeof updateToplamMusteriSayisi === 'function') {
                  updateToplamMusteriSayisi();
                }
              }, 300);
            }
          } else {
            // Diğer elementler için normal silme işlemi
            silinecekAlan.classList.add("fade-out");
            setTimeout(() => {
              silinecekAlan.remove();
              
              // Eğer silinen müşteri detaylarda gösteriliyorsa, alanları sıfırla
              if (seciliSatirId && silinecekSatirId && seciliSatirId === silinecekSatirId) {
                document.querySelector(".musteri-bilgiler-alani").style.display = "none";
                document.querySelector(".musteri-yuklenen-dosyalar").style.display = "none";
                document.querySelector(".detay-not-alan").style.display = "block";
              }
              
              // Eğer partner satırı silindiyse toplam sayıyı güncelle
              if (isPartnerSatiri) {
                updateToplamPartnerSayisi();
              }

              // SAKLANAN TABLE ID'YI KULLAN
              if (parentTableId) {
                console.log('Saklanmış table ID ile çağırılıyor:', parentTableId);
                if (typeof window.updateTableEmptyState === 'function') {
                  window.updateTableEmptyState(parentTableId);
                }
              }
            }, 500);
          }
        },
        onCancel: () => {
          console.log("Silme işlemi iptal edildi.");
        }
      });
      break;

    case "profil-resmi-sil":
      const wrapper = btn.closest(".profil-bilgileri-kapsayici");
      const img = wrapper?.querySelector("#profile-img") || wrapper?.querySelector("img");
      const input = wrapper?.querySelector(".profile-input");
      createToastInteractive({
        message: "Profil resmini kaldırmak istiyor musunuz?",
        confirmText: "Evet",
        cancelText: "Hayır",
        onConfirm: async () => {
          console.log('✅ Evet butonuna tıklandı, profil resmi kaldırılıyor...');
          
          // Profil resmini kaldır (profil-ayarlari.js'deki fonksiyonu kullan)
          if (typeof window.removeProfileImageDirectly === 'function') {
            await window.removeProfileImageDirectly();
          } else {
            // Fallback: Eski yöntem
            if (img) {
              img.style.display = 'none';
            }
            if (input) input.value = '';
            
            if (typeof createToast === 'function') {
              createToast("success", "Profil resmi kaldırıldı");
            }
          }
        },
        onCancel: () => {
          console.log("Profil resmi silme iptal edildi.");
        }
      });
      break;
      
    case "isletme-logo-sil":
      const logoWrapper = btn.closest(".profil-bilgileri-kapsayici") || btn.closest(".resim-alan");
      const logoImg = logoWrapper?.querySelector("#company-logo-img");
      const logoInput = logoWrapper?.querySelector("#company-logo");
      createToastInteractive({
        message: "Logoyu kaldırmak istiyor musunuz?",
        confirmText: "Evet",
        cancelText: "Hayır",
        onConfirm: () => {
          if (logoImg) logoImg.src = 'assets/isletme-logo-placeholder.png';
          if (logoInput) logoInput.value = '';
          createToast("islemtamam");
        },
        onCancel: () => {
          console.log("Logo silme iptal edildi.");
        }
      });
      break;
  }
});
// #endregion

// Mesaj tanımları - HEMEN TANIMLA (DOMContentLoaded bekleme yok, sayfa yüklenirken hazır olsun)
window.toastDetails = window.toastDetails || {
  timer: 6000,
  kaydet: { icon: 'fa-circle-check', text: 'Başarıyla kaydedildi!' },
  yenikart: { icon: 'fa-circle-check', text: 'Yeni Kart Oluşturuldu!' },
  islemtamam: { icon: 'fa-circle-check', text: 'İşlem Başarılı!' },
  success: { icon: 'fa-circle-check', text: 'İşlem Başarılı!' },
  arsivlendi: { icon: 'fa-circle-check', text: 'Arşivleme işlemi tamamlandı!' },
  arsivgeriyukle: { icon: 'fa-circle-check', text: 'Sipariş kartı geri yüklendi!' },
  error: { icon: 'fa-circle-xmark', text: 'Bir hata oluştu!' },
  warning: { icon: 'fa-triangle-exclamation', text: 'Bu sayfa hazırlanıyor!' },
  info: { icon: 'fa-circle-info', text: 'İşlem Tamamlandı.' },

  // Fatura Tost Bildirimleri
  faturaOlusturuldu: { icon: 'fa-file-invoice', text: 'Fatura başarıyla oluşturuldu!' },
  faturaPdfIndir: { icon: 'fa-file-pdf', text: 'Fatura PDF olarak indiriliyor...' },
  faturaEmailGonder: { icon: 'fa-envelope', text: 'Fatura e-posta ile gönderiliyor...' },
  faturaWhatsappGonder: { icon: 'fa-brands fa-whatsapp', text: 'Fatura WhatsApp ile gönderiliyor...' },
  
  teslimEdildi: { icon: 'fa-circle-check', text: 'Sipariş teslim edildi ve arşivlendi!' },
  kartArsivlendi: { icon: 'fa-archive', text: 'Kart başarıyla arşivlendi!' },
  tumSiparislerTeslim: { icon: 'fa-check-double', text: 'Tüm siparişler teslim edildi olarak işaretlendi!' },

  customSifreGonderildi: {
    icon: 'fa-paper-plane',
    text: 'Şifre sıfırlama bağlantısı gönderildi!'
  }
    };

// Gelişmiş toast oluşturucu - HER ZAMAN ÇALIŞSIN
function createToast(id, customMessage = null) {
  
  // window.toastDetails kontrolü - eğer yoksa varsayılan değerler kullan
  if (!window.toastDetails) {
    // Eğer henüz tanımlanmamışsa, hemen tanımla
    window.toastDetails = {
      timer: 6000,
      success: { icon: 'fa-circle-check', text: 'İşlem Başarılı!' },
      error: { icon: 'fa-circle-xmark', text: 'Bir hata oluştu!' },
      warning: { icon: 'fa-triangle-exclamation', text: 'Uyarı!' },
      info: { icon: 'fa-circle-info', text: 'Bilgi' }
    };
    console.warn('⚠️ window.toastDetails henüz tanımlanmamış, varsayılan değerler kullanılıyor');
  }
  
  // Eğer id yoksa info kullan
  const toastConfig = window.toastDetails[id] || window.toastDetails['info'] || { icon: 'fa-circle-info', text: 'Bilgi' };
  const { icon, text } = toastConfig;
  const finalMessage = customMessage || text;
  
  // Cooldown kontrolü - DEVRE DIŞI (kullanıcı birden fazla güncelleme yapabilir)
  // const cooldownKey = `${id}_${finalMessage}`;
  // const now = Date.now();
  // if (window.toastCooldowns && window.toastCooldowns.has(cooldownKey)) {
  //   const lastTime = window.toastCooldowns.get(cooldownKey);
  //   if (now - lastTime < 1000) {
  //     return;
  //   }
  // }
  
  // Aktif mesaj kontrolü - DEVRE DIŞI (her zaman göster)
  // if (window.activeToasts && window.activeToasts.has(finalMessage)) {
  //   console.log('Aynı toast zaten aktif:', finalMessage);
  //   return;
  // }
  
  // Console sayfalarında #console-toast-notifications kullan; yoksa .notifications veya yeni oluştur
  let notifications = document.getElementById("console-toast-notifications") || document.querySelector("body > ul.notifications") || document.querySelector(".notifications");
  if (!notifications) {
    notifications = document.createElement("ul");
    notifications.className = "notifications";
    notifications.id = "console-toast-notifications";
    document.body.appendChild(notifications);
  }
  if (notifications.parentElement !== document.body) {
    document.body.appendChild(notifications);
  }
  
  if (!notifications) {
    console.error('❌ .notifications elementi oluşturulamadı!');
    console.log(`🔔 Toast (${id}): ${finalMessage}`);
    return;
  }
  

  // NOTIFICATIONS'ı kesinlikle görünür yap - CSS'deki display:none'u ezmek için !important kullan
  notifications.style.setProperty('display', 'block', 'important');
  notifications.style.setProperty('visibility', 'visible', 'important');
  notifications.style.setProperty('opacity', '1', 'important');
  
  // Z-index ve position – console overlay/modal üstünde görünsün
  notifications.style.setProperty('position', 'fixed', 'important');
  notifications.style.setProperty('top', '20px', 'important');
  notifications.style.setProperty('right', '20px', 'important');
  notifications.style.setProperty('z-index', '2147483647', 'important');

  // Lucide Icons SVG mapping
  const iconSVGMap = {
    'fa-circle-check': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    'fa-circle-xmark': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
    'fa-triangle-exclamation': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>',
    'fa-circle-info': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>',
    'fa-file-invoice': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="M16 13H8"></path><path d="M16 17H8"></path><path d="M10 9H8"></path></svg>',
    'fa-file-pdf': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="M16 13H8"></path><path d="M16 17H8"></path><path d="M10 9H8"></path></svg>',
    'fa-envelope': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>',
    'fa-brands fa-whatsapp': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"></path><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"></path></svg>',
    'fa-archive': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"></rect><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path><path d="M10 12h4"></path></svg>',
    'fa-check-double': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 7 17l-5-5"></path><path d="m22 10-7.5 7.5L13 16"></path></svg>',
    'fa-paper-plane': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path></svg>'
  };
  
  // Icon'u SVG'ye çevir
  const iconSVG = iconSVGMap[icon] || iconSVGMap['fa-circle-info'];
  
  const toast = document.createElement("li");
  toast.className = `toast ${id}`;
  toast.innerHTML = `
    <div class="column">
      <div class="toast-icon">${iconSVG}</div>
      <span>${finalMessage}</span>
    </div>
    <div class="toast-close" onclick="removeToast(this.parentElement)">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </div>
  `;
  
  // Toast'u takip et (aktif toast takibi devre dışı - her zaman göster)
  // window.activeToasts.add(finalMessage);
  // window.toastCooldowns.set(cooldownKey, now);
  
  // Boyamayı garantiye almak için bir sonraki frame'de ekle
  if (typeof window.requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      notifications.appendChild(toast);
      toast.timeoutId = setTimeout(() => {
        removeToast(toast);
      }, window.toastDetails.timer);
    });
  } else {
    notifications.appendChild(toast);
    toast.timeoutId = setTimeout(() => {
      removeToast(toast);
    }, window.toastDetails.timer);
  }
  
  // Toast temizlendiğinde aktif listeden çıkar
  toast.addEventListener('remove', () => {
    window.activeToasts.delete(finalMessage);
  });
}

// Etkileşimli toast (Evet / Hayır)
function createToastInteractive({ title, message, confirmText = "Evet", cancelText = "Hayır", onConfirm, onCancel, isWarning = false, confirmButtonClass = '' }) {
  
  // Zaten aktif bir interactive toast varsa önce kaldır
  const existingToast = document.querySelector('.toast.interactive');
  const existingOverlay = document.querySelector('.toast-overlay');
  if (existingToast) {
    // Eski toast'ın event listener'larını temizle
    const oldConfirmBtn = existingToast.querySelector('.toast-btn-confirm');
    const oldCancelBtn = existingToast.querySelector('.toast-btn-cancel');
    if (oldConfirmBtn) {
      oldConfirmBtn.replaceWith(oldConfirmBtn.cloneNode(true));
    }
    if (oldCancelBtn) {
      oldCancelBtn.replaceWith(oldCancelBtn.cloneNode(true));
    }
    if (existingOverlay) existingOverlay.remove();
    existingToast.remove();
  }
  
  let notifications = document.querySelector(".notifications");
  if (!notifications) {
    // .notifications elementi yoksa oluştur
    notifications = document.createElement("ul");
    notifications.className = "notifications";
    notifications.style.display = "none";
    document.body.appendChild(notifications);
  }
  if (notifications.style.display === "none") {
    notifications.style.display = "block";
  }
  
  // ✅ Toast gösterilmeden önce tüm input'ları blur yap ve validation tooltip'lerini TAMAMEN engelle
  // Bu, HTML5 native validation tooltip'lerinin toast'un üstünde görünmesini engeller
  const allInputs = document.querySelectorAll('input, textarea, select');
  const allForms = document.querySelectorAll('form');
  
  // Tüm form'ları geçici olarak novalidate yap (tooltip gösterilmesin)
  allForms.forEach(form => {
    if (!form.hasAttribute('novalidate')) {
      form.setAttribute('novalidate', '');
      form.setAttribute('data-was-novalidate', 'false');
    } else {
      form.setAttribute('data-was-novalidate', 'true');
    }
  });
  
  allInputs.forEach(input => {
    // Önce blur yap (focus'taysa) - ÇOK ÖNEMLİ!
    if (document.activeElement === input) {
      input.blur();
      // Blur'dan sonra kısa bir gecikme ile tekrar blur yap (tooltip gösterilmesin)
      setTimeout(() => {
        if (document.activeElement === input) {
          input.blur();
        }
      }, 0);
    }
    
    // Validation'ı tamamen temizle
    if (input.setCustomValidity) {
      input.setCustomValidity('');
    }
    
    // Input'u geçici olarak required'dan çıkar (tooltip gösterilmesin)
    const wasRequired = input.hasAttribute('required');
    if (wasRequired) {
      input.removeAttribute('required');
      input.setAttribute('data-was-required', 'true');
    }
    
    // Pattern attribute'unu geçici olarak kaldır (tooltip gösterilmesin)
    const hadPattern = input.hasAttribute('pattern');
    if (hadPattern) {
      const patternValue = input.getAttribute('pattern');
      input.removeAttribute('pattern');
      input.setAttribute('data-was-pattern', patternValue);
    }
    
    // Custom tooltip'leri de temizle
    if (typeof hideInputError === 'function') {
      hideInputError(input);
    }
    
    // HTML5 validation'ı bypass et - input'u geçici olarak valid yap
    input.classList.remove('input-error');
  });
  
  // Kısa bir gecikme ile tekrar kontrol et (tooltip gösterilmeden önce)
  setTimeout(() => {
    allInputs.forEach(input => {
      if (document.activeElement === input) {
        input.blur();
      }
      if (input.setCustomValidity) {
        input.setCustomValidity('');
      }
    });
  }, 10);
  
  const overlay = document.createElement("div");
  overlay.className = "toast-overlay";
  const toast = document.createElement("li");
  toast.className = "toast interactive";
  
  // Warning icon SVG (turuncu üçgen)
  const warningIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>`;
  
  // Title varsa header ekle
  const headerHTML = title ? `
    <div class="toast-interactive-header">
      <div class="toast-interactive-title">
        ${isWarning ? `<div class="toast-interactive-icon">${warningIcon}</div>` : ''}
        <span>${title}</span>
      </div>
    </div>
  ` : '';
  
  // Confirm button class'ı ekle
  const confirmBtnClass = confirmButtonClass ? ` ${confirmButtonClass}` : '';
  
  var cancelIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  var confirmIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  toast.innerHTML = `
    ${headerHTML}
    <div class="toast-interactive-body">
      <p class="toast-message">${message}</p>
    </div>
    <div class="toast-actions">
      <button class="toast-btn toast-btn-cancel"><span class="toast-btn-icon">${cancelIcon}</span><span class="toast-btn-text">${cancelText}</span></button>
      <button class="toast-btn toast-btn-confirm${confirmBtnClass}"><span class="toast-btn-icon">${confirmIcon}</span><span class="toast-btn-text">${confirmText}</span></button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(toast);
  
  const close = () => removeInteractiveToast(toast, overlay);
  
  toast.querySelector(".toast-btn-confirm").addEventListener("click", async () => {
    // Toast'ı HEMEN kapat (onConfirm çağrılmadan önce)
    // Böylece kullanıcı "Evet" dediğinde toast hemen kaybolur
    toast.style.display = 'none';
    overlay.style.display = 'none';
    toast.classList.add('removing');
    overlay.classList.add('hide');
    
    // DOM'dan kaldır (kısa bir gecikme ile animasyon için)
    setTimeout(() => {
      // ✅ Toast kapatıldığında input'ları geri yükle
      removeInteractiveToast(toast, overlay);
      if (toast.parentNode) toast.remove();
      if (overlay.parentNode) overlay.remove();
    }, 100);
    
    // onConfirm callback'ini çağır (toast kapandıktan sonra)
    if (typeof onConfirm === "function") {
      try {
        const result = onConfirm();
        // Eğer Promise döndürüyorsa await et
        if (result && typeof result.then === 'function') {
          await result;
        }
      } catch (error) {
        console.error('❌ onConfirm callback hatası:', error);
      }
    }
  });
  
  toast.querySelector(".toast-btn-cancel").addEventListener("click", () => {
    if (typeof onCancel === "function") onCancel();
    // ✅ Toast kapatıldığında input'ları geri yükle
    removeInteractiveToast(toast, overlay);
    close();
  });
  
  overlay.addEventListener("click", () => {
    if (typeof onCancel === "function") onCancel();
    close();
  });
}

// Toast kaldırıcı - Geliştirilmiş
function removeToast(toast) {
  if (toast.classList.contains('removing')) return; // Zaten kaldırılıyor
  
  toast.classList.add("hide", "removing");
  if (toast.timeoutId) clearTimeout(toast.timeoutId);
  
  // Aktif toast listesinden çıkar
  const messageSpan = toast.querySelector('span');
  if (messageSpan) {
    window.activeToasts.delete(messageSpan.textContent);
  }
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
    const notifications = document.querySelector(".notifications");
    if (notifications && notifications.children.length === 0) {
      notifications.style.display = "none";
    }
  }, 500);
}

// Etkileşimli toast kaldırıcı
function removeInteractiveToast(toast, overlay) {
  // ✅ Toast kapatıldığında input'ların required ve pattern attribute'larını geri yükle
  const allInputs = document.querySelectorAll('input, textarea, select');
  const allForms = document.querySelectorAll('form');
  
  // Form'ların novalidate attribute'unu geri yükle
  allForms.forEach(form => {
    const wasNovalidate = form.getAttribute('data-was-novalidate');
    if (wasNovalidate === 'false') {
      form.removeAttribute('novalidate');
      form.removeAttribute('data-was-novalidate');
    } else if (wasNovalidate === 'true') {
      form.removeAttribute('data-was-novalidate');
    }
  });
  
  allInputs.forEach(input => {
    // Required attribute'unu geri ekle
    if (input.getAttribute('data-was-required') === 'true') {
      input.setAttribute('required', '');
      input.removeAttribute('data-was-required');
    }
    
    // Pattern attribute'unu geri ekle
    const wasPattern = input.getAttribute('data-was-pattern');
    if (wasPattern) {
      input.setAttribute('pattern', wasPattern);
      input.removeAttribute('data-was-pattern');
    }
  });
  if (toast.classList.contains('removing')) return;
  
  toast.classList.add("hide", "removing");
  overlay.classList.add("hide");
  
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
    if (overlay.parentNode) overlay.remove();
  }, 500);
}

// Butonu geçici olarak devre dışı bırakma fonksiyonu
function disableButtonTemporarily(button, duration = 1000) {
  if (!button) return;
  
  button.disabled = true;
  button.classList.add('processing');
  
  setTimeout(() => {
    button.disabled = false;
    button.classList.remove('processing');
  }, duration);
}

// Tüm aktif toast'ları temizleme fonksiyonu (isteğe bağlı)
function clearAllToasts() {
  const toasts = document.querySelectorAll('.toast:not(.interactive)');
  toasts.forEach(toast => removeToast(toast));
  window.activeToasts.clear();
}

// Fonksiyonları global erişime aç
window.createToast = createToast;
window.createToastInteractive = createToastInteractive;
window.removeToast = removeToast;
window.disableButtonTemporarily = disableButtonTemporarily;
window.clearAllToasts = clearAllToasts;

// #endregion