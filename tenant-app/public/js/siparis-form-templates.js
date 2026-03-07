/**
 * Sipariş Form Şablonları
 * Tüm sipariş ekleme formları için merkezi şablon yönetimi
 */

const SiparisFormTemplates = {
    /**
     * Organizasyon Form Şablonu (Düğün, Nişan, Sünnet)
     */
    organizasyon: {
        template: `
            <div class="header-alan">
                <div class="baslik">Yeni Sipariş Ekle</div>
                <div class="header-sag">
                    <button class="btn-duzenle">
                        <i class="icon-sk-karti-duzenle"></i>
                        Kartı Düzenle
                    </button>
                    <button class="btn-close-form">
                        <i class="icon-btn-kapat"></i>
                    </button>
                </div>
            </div>
            <div class="container container-organizasyon show">
                <div class="organizasyon-kutu">
                    <div class="kart-gorseli" id="gorselYukle" data-lightbox-grup="organizasyon-davetiye">
                        <img data-dynamic-gorsel alt="Davetiye görseli">
                        <div class="gorsel-placeholder">
                            Bu organizasyona davetiye görseli eklenmemiş
                        </div>
                    </div>
                    
                    <div class="organizasyon-bilgileri">
                        <div class="org-turu-band">
                            <div class="left">
                                <div class="org-tur">Düğün</div>
                                <div class="kart-etiket"></div>
                            </div>
                            <div class="right">
                                <a href="./siparis-kart-detay.html">
                                    <div class="toplam-siparis" data-dynamic="true">
                                        <i class="icon-toplam-siparis"></i><span class="siparis-sayisi">0</span>/<span class="max-siparis">20</span>
                                    </div>
                                </a>
                                <div class="btn-partner-siparis-ekle partner-siparisler info-only no-pointer-events" data-dynamic="true">
                                    <i class="icon-partner-siparis"></i>
                                    <div class="partner-siparis-sayisi">0</div>
                                </div>
                            </div>
                        </div>
                        <div class="org-adres-bilgileri" data-dynamic="true">
                            <div class="konum" data-field="name">Organizasyon Adı</div>
                            <div class="acik-adres" data-field="address">Organizasyon Adresi</div>
                            <div class="il-ilce"></div>
                        </div>
                        <div class="sahip-ve-zaman">
                            <div class="organizasyon-sahibi" data-dynamic="true">
                                <div class="baslik">
                                    <i class="icon-organizasyon-sahibi"></i>
                                    Organizasyon Sahibi
                                </div>
                                <div class="teslim-kisisi" data-field="contact_person">Sahip Adı</div>
                                <div class="teslim-kisisi-telefon">
                                    <i class="icon-telefon"></i>
                                    <span id="teslim-kisisi-telefon" data-field="phone"><a href="tel:">Telefon</a></span>
                                </div>
                            </div>
                            <div class="vr"></div>
                            <div class="teslim-zaman" data-dynamic="true">
                                <div class="baslik">
                                    <i class="icon-teslim-tarihi-ve-saati"></i>
                                    Teslim Zamanı
                                </div>
                                <div class="tarih" data-field="delivery_date">Teslim Tarihi</div>
                                <div class="saat" data-field="delivery_time">
                                    Saat <span class="time-value">Teslim Saati</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="siparis-form-alan">
                    <div class="sol-alan">
                        <div class="partner-siparisi-isaretle">
                            <label class="cbox-alan">
                                <input type="checkbox" name="is_partner_order" class="cbox-partner-order" value="1">
                                <span class="cbox-label-text">Partner siparişi olarak ekleyin</span>
                            </label>
                            <div class="aciklama">Bu siparişi partnerden gelen veya partnere vereceğiniz sipariş olarak işaretleyin</div>
                            <div class="partner-siparis-detaylari hidden">
                                <div class="partner-tipi checkbox-alan">
                                    <div class="checkbox-wrap">
                                        <input type="radio" name="partner_type" id="partner-verilen" value="verilen">
                                        <label for="partner-verilen">Partnere Verilen</label>
                                    </div>
                                    <div class="checkbox-wrap">
                                        <input type="radio" name="partner_type" id="partner-gelen" value="gelen">
                                        <label for="partner-gelen">Partnerden Gelen</label>
                                    </div>
                                </div>
                                <div class="wrapper-acilirliste partner" id="partner-firma-liste" data-type="partnerfirma" class="hidden">
                                    <div class="acilirliste">
                                        <span>Partner firma seçin</span>
                                        <i class="uil uil-angle-down"></i>
                                    </div>
                                    <div class="content">
                                        <div class="search">
                                            <i class="uil uil-search"></i>
                                            <input spellcheck="false" type="text" placeholder="Arayın">
                                        </div>
                                        <ul class="options-partner">
                                            <!-- Dinamik olarak yüklenecek -->
                                        </ul>
                                    </div>
                                    <input type="hidden" name="partnerfirma" class="hidden-veri">
                                </div>
                            </div>
                        </div>
                        <div class="kisi-bilgi-alanlar">
                            <div class="siparis-veren-musteri">
                                <div class="alan-baslik">
                                    <div class="baslik">
                                        <i class="icon-sk-siparis-veren icon-size-16"></i>
                                        Sipariş Veren Müşteri
                                    </div>
                                    <span>Sipariş veren müşteri bilgileri</span>
                                </div>
                                <div class="input-alan">
                                    <div class="input">
                                        <div class="wrapper-acilirliste musteri" id="musterilistesi1">
                                            <div class="acilirliste">
                                                <span>Müşteri seçiniz</span>
                                                <i class="uil uil-angle-down"></i>
                                            </div>
                                            <div class="content">
                                                <div class="search">
                                                    <i class="uil uil-search"></i>
                                                    <input spellcheck="false" type="text" placeholder="Müşteri arayın">
                                                </div>
                                                <ul class="options-musteriler">
                                                    <!-- Müşteri listesi dinamik olarak yüklenecek -->
                                                </ul>
                                            </div>
                                            <input type="hidden" name="musteri" class="hidden-veri" required>
                                        </div>
                                    </div>
                                    <input id="musteriunvan" type="text"
                                        placeholder="(veya kendiniz ekleyin) Müşteri/Firma Adı" required>
                                    <div class="input-grup">
                                        <input id="musteriadsoyad" type="text" placeholder="İsim Soyisim" required>
                                        <input id="musteritelefon" class="telefon-input" type="tel" data-phone-input="standard"
                                            required>
                                    </div>
                                    <textarea name="urun_yazisi" placeholder="Ürün yazısı (veya Sipariş ürün üzeri not)"
                                        rows="3" class="textarea-height-64" required></textarea>
                                    <textarea rows="4" cols="50" id="siparisnotalan" name="comment" placeholder="Ekstra not veya açıklama"
                                        class="textarea-height-64"></textarea>
                                </div>
                                
                                <div class="urun-yazi-dosyalar-wrapper">
                                    <!-- Müşteri Ürün Yazı Dosyaları Dropdown -->
                                    <div class="musteri-urun-dosya-dropdown hidden" id="musteriUrunDosyaDropdownSiparis">
                                        <div class="acilirliste">
                                            <span>Bu müşteriye ait ürün yazı dosyaları <span class="dropdown-dosya-sayisi">0</span></span>
                                            <i class="fa-solid fa-chevron-down dropdown-arrow"></i>
                                        </div>
                                        <div class="dropdown-body">
                                            <!-- JavaScript ile doldurulacak -->
                                        </div>
                                        <div class="secili-dosya-bilgi" class="hidden">
                                            <i class="fa-solid fa-check-circle"></i>
                                            <span class="secili-dosya-isim"></span>
                                            <button type="button" class="secili-dosya-kaldir-btn" title="Seçimi kaldır">
                                                <i class="fa-solid fa-times"></i>
                                                <span>Kaldır</span>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div class="dosya-yukle-alan" id="urun-yazisi-yukle">
                                    <i class="icon-sk-urun-yazisi"></i>
                                    <span class="file-label">Ürün yazısı dosyası yükleyin</span>
                                    <button type="button" class="remove-button hidden">Kaldır</button>
                                    <input type="file" class="file-input hidden" accept="image/*" />
                                </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="sag-alan">
                        <div class="urun-hizmet">
                            <div class="alan-baslik">
                                <div class="baslik">
                                    <i class="icon-sk-urun-bilgisi icon-size-16"></i>
                                    Ürün/Hizmet
                                </div>
                                <span>Sipariş alınan ürün veya hizmet bilgisi</span>
                            </div>
                            <div class="input-alan">
                                <div class="wrapper-acilirliste urunler" data-type="urunhizmet">
                                    <div class="acilirliste">
                                        <span>Ürün veya hizmet seçin</span>
                                        <i class="uil uil-angle-down"></i>
                                    </div>
                                    <div class="content">
                                        <div class="search">
                                            <i class="uil uil-search"></i>
                                            <input spellcheck="false" type="text"
                                                placeholder="Ürün veya hizmet arayın">
                                        </div>
                                        <ul class="options-urunler">
                                            <!-- Ürün listesi dinamik olarak yüklenecek -->
                                        </ul>
                                    </div>
                                    <input class="hidden-veri" name="urunhizmet" required type="hidden">
                                </div>
                                <div class="urun-fiyati-ve-aciklama">
                                    <input id="siparisurunaciklama" type="text" placeholder="(Varsa) Açıklama">
                                    <input type="text" name="urunfiyat" id="urunfiyat" class="tl-input" placeholder="0,00 TL">
                                </div>
                            </div>
                        </div>
                        <hr>
                        <div class="siparis-ucreti">
                            <div class="alan-baslik">
                                <div class="baslik">
                                    <i class="icon-sk-ucret icon-size-16"></i>
                                    Sipariş Ücreti
                                </div>
                                <span>Siparişe ait ürün ücret/hesap bilgileri</span>
                            </div>
                            <div class="radiobutton-alan">
                                <div class="ucret-secim">
                                    <div class="odeme-tipleri" data-required-radio="ucret-tip">
                                        <div class="cari-hesap">
                                            <input type="radio" name="ucret-tip" id="ut-cari" required>
                                            <label for="ut-cari">CARİ HESAP</label>
                                        </div>
                                        <div class="odeme-tipleri-rb-container">
                                            <div class="odeme-tip-column">
                                                <div class="odeme-tip-radio-box">
                                                    <input type="radio" name="ucret-tip" id="ut-nakit">
                                                    <label for="ut-nakit">NAKİT</label>
                                                </div>
                                                <div class="odeme-tip-radio-box">
                                                    <input type="radio" name="ucret-tip" id="ut-havaleeft">
                                                    <label for="ut-havaleeft">HAVALE/EFT</label>
                                                </div>
                                                <div class="odeme-tip-radio-box">
                                                    <input type="radio" name="ucret-tip" id="ut-kredikarti">
                                                    <label for="ut-kredikarti">POS</label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <hr>
                        <div class="ekstra-ucretlendirmeler">
                            <div class="alan-baslik">
                                <div class="baslik">
                                    <i class="icon-sk-ucret icon-size-16"></i>
                                    Ekstra Ücretlendirmeler
                                </div>
                                <span>Siparişe ait ekstra ücretlendirmeler</span>
                            </div>
                            <div class="input-grup">
                                <input id="ekstraucretaciklama" name="ekstra-ucret-aciklama" type="text" placeholder="Açıklama yazınız">
                                <input type="text" id="ekstraucrettutar" name="ekstra-ucret-tutari" class="tl-input" placeholder="0,00 TL">
                            </div>
                        </div>
                    </div>
                </div>
                <div class="alt-alan">
                    <div class="duzenleyen">
                        ${window.userSession ? window.userSession.createDuzenleyenHTML() : `
                            <img class="duzenleyen-profil-resmi" src="" onerror="this.onerror=null; this.src=''; this.style.display='none';">
                            <div class="duzenleme-tarih">Son Dzn: <span>Yeni sipariş</span></div>
                        `}
                    </div>
                    <div class="butonlar">
                        <button class="secondary-button btn-vazgec">VAZGEÇ</button>
                        <button type="submit" class="primary-button btn-kaydet" data-toast="kaydet">KAYDET</button>
                    </div>
                </div>
            </div>
        `,
        
        fields: [
            'organizasyon-turu',
            'organizasyon-sahibi', 
            'telefon',
            'teslim-tarihi',
            'teslim-saati',
            'adres',
            'mahalle',
            'partner-siparis',
            'partner-siparis-sayisi',
            'siparis-notlari',
            'organizasyon-id'
        ],
        
        validations: {
            required: ['organizasyon-turu', 'organizasyon-sahibi', 'telefon', 'teslim-tarihi', 'teslim-saati', 'adres'],
            phone: ['telefon'],
            date: ['teslim-tarihi'],
            time: ['teslim-saati']
        },
        
        conditionalFields: {
            'partner-siparis': 'partner-siparis-alan'
        }
    },
    
    /**
     * Araç Süsleme Form Şablonu
     */
    aracSusleme: {
        template: `
            <div class="header-alan">
                <div class="baslik">Yeni Sipariş Ekle</div>
                <div class="header-sag">
                    <button class="btn-duzenle">
                        <i class="icon-sk-karti-duzenle"></i>
                        Kartı Düzenle
                    </button>
                    <button class="btn-close-form">
                        <i class="icon-btn-kapat"></i>
                    </button>
                </div>
            </div>
            <div class="container container-aracsusleme show">
                <div class="organizasyon-kutu">
                    <div class="kart-gorseli kart-gorseli-relative" id="gorselYukle">
                        <img src="assets/kart-gorsel-gelin-arabasi-genel-statik.jpg" alt="Davetiye görseli">
                    </div>
                    <div class="organizasyon-bilgileri">
                        <div class="org-turu-band">
                            <div class="left">
                                <div class="org-tur">Araç Süsleme</div>
                            </div>
                            <div class="right">
                                <a href="./siparis-kart-detay.html">
                                    <div class="toplam-siparis" data-dynamic="true">
                                        <i class="icon-toplam-siparis"></i><span class="siparis-sayisi">0</span>/<span class="max-siparis">20</span>
                                    </div>
                                </a>
                                <div class="btn-partner-siparis-ekle partner-siparisler info-only no-pointer-events" data-dynamic="true">
                                    <i class="icon-partner-siparis"></i>
                                    <div class="partner-siparis-sayisi">0</div>
                                </div>
                            </div>
                        </div>
                        <div class="org-adres-bilgileri">
                            <div id="pasif" class="konum" data-dynamic-isletme-adi></div>
                            <div id="pasif" class="acik-adres">İzzetbey Mahallesi Adem Yavuz Cd. No: 1 ÇUMRA</div>
                            <div class="il-ilce"></div>
                        </div>
                        <div class="sahip-ve-zaman">
                            <div class="kart-aciklama">
                                Araç randevuları için sipariş kartları üzerindeki
                                <span>randevu saatini dikkate alınız</span>
                            </div>
                            <div class="vr"></div>
                            <div class="teslim-zaman">
                                <div class="baslik">
                                    <i class="icon-teslim-tarihi-ve-saati"></i>
                                    Randevu Tarihi
                                </div>
                                <div class="tarih">10 Eylül 2025 Salı</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="siparis-form-alan">
                    <div class="sol-alan">
                        <div class="partner-siparisi-isaretle">
                            <label class="cbox-alan">
                                <input type="checkbox" name="is_partner_order" class="cbox-partner-order" value="1">
                                <span class="cbox-label-text">Partner siparişi olarak ekleyin</span>
                            </label>
                            <div class="aciklama">Bu siparişi partnerden gelen veya partnere vereceğiniz sipariş olarak işaretleyin</div>
                            <div class="partner-siparis-detaylari hidden">
                                <div class="partner-tipi checkbox-alan">
                                    <div class="checkbox-wrap">
                                        <input type="radio" name="partner_type" id="partner-verilen" value="verilen">
                                        <label for="partner-verilen">Partnere Verilen</label>
                                    </div>
                                    <div class="checkbox-wrap">
                                        <input type="radio" name="partner_type" id="partner-gelen" value="gelen">
                                        <label for="partner-gelen">Partnerden Gelen</label>
                                    </div>
                                </div>
                                <div class="wrapper-acilirliste partner" id="partner-firma-liste" data-type="partnerfirma" class="hidden">
                                    <div class="acilirliste">
                                        <span>Partner firma seçin</span>
                                        <i class="uil uil-angle-down"></i>
                                    </div>
                                    <div class="content">
                                        <div class="search">
                                            <i class="uil uil-search"></i>
                                            <input spellcheck="false" type="text" placeholder="Arayın">
                                        </div>
                                        <ul class="options-partner">
                                            <!-- Dinamik olarak yüklenecek -->
                                        </ul>
                                    </div>
                                    <input type="hidden" name="partnerfirma" class="hidden-veri">
                                </div>
                            </div>
                        </div>
                        <div class="kisi-bilgi-alanlar">
                            <div class="siparis-veren-musteri">
                                <div class="alan-baslik">
                                    <div class="baslik">
                                        <i class="icon-sk-siparis-veren icon-size-16"></i>
                                        Sipariş Veren Müşteri
                                    </div>
                                    <span>Sipariş veren müşteri bilgileri</span>
                                </div>
                                <div class="input-alan">
                                    <div class="input">
                                        <div class="wrapper-acilirliste musteri" id="musterilistesi2">
                                            <div class="acilirliste">
                                                <span>Müşteri seçiniz</span>
                                                <i class="uil uil-angle-down"></i>
                                            </div>
                                            <div class="content">
                                                <div class="search">
                                                    <i class="uil uil-search"></i>
                                                    <input spellcheck="false" type="text" placeholder="Müşteri arayın">
                                                </div>
                                                <ul class="options-musteriler">
                                                    <!-- Müşteri listesi dinamik olarak yüklenecek -->
                                                </ul>
                                            </div>
                                            <input type="hidden" name="musteri" class="hidden-veri" required>
                                        </div>
                                    </div>
                                    <input id="musteriunvan" type="text" placeholder="(veya kendiniz ekleyin) Müşteri/Firma Adı" required>
                                    <div class="input-grup">
                                        <input id="musteriadsoyad" type="text" placeholder="İsim Soyisim" required>
                                        <input id="musteritelefon" class="telefon-input" type="tel" data-phone-input="standard"
                                            required>
                                    </div>
                                    <textarea rows="4" cols="50" id="siparisnotalan" name="comment" placeholder="Ekstra not veya açıklama"
                                        class="textarea-height-64"></textarea>
                                </div>
                                
                                <!-- Araç Süsleme formunda müşteri ürün yazı dosyaları ve dosya yükleme alanı gizli -->
                                <div class="urun-yazi-dosyalar-wrapper" class="hidden">
                                    <!-- Müşteri Ürün Yazı Dosyaları Dropdown -->
                                    <div class="musteri-urun-dosya-dropdown hidden" id="musteriUrunDosyaDropdownSiparis">
                                        <div class="acilirliste">
                                            <span>Bu müşteriye ait ürün yazı dosyaları <span class="dropdown-dosya-sayisi">0</span></span>
                                            <i class="fa-solid fa-chevron-down dropdown-arrow"></i>
                                        </div>
                                        <div class="dropdown-body">
                                            <!-- JavaScript ile doldurulacak -->
                                        </div>
                                        <div class="secili-dosya-bilgi" class="hidden">
                                            <i class="fa-solid fa-check-circle"></i>
                                            <span class="secili-dosya-isim"></span>
                                            <button type="button" class="secili-dosya-kaldir-btn" title="Seçimi kaldır">
                                                <i class="fa-solid fa-times"></i>
                                                <span>Kaldır</span>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div class="dosya-yukle-alan hidden" id="urun-yazisi-yukle">
                                        <i class="icon-sk-urun-yazisi"></i>
                                        <span class="file-label">Ürün yazısı dosyası yükleyin</span>
                                        <button type="button" class="remove-button" class="hidden">Kaldır</button>
                                        <input type="file" class="file-input" accept="image/*" class="hidden" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="arac-bilgileri">
                            <div class="alan-baslik">
                                <div class="baslik">
                                    <!-- <i class="icon-sk-arac" class="icon-size-16"></i> -->
                                    <i class="fa-solid fa-car"></i>
                                    Araç Bilgileri
                                </div>
                                <span>Süslenecek araç bilgileri</span>
                            </div>
                            <div class="input-alan">
                                <input id="arac-marka-model" class="arac-marka-model" name="arac-marka-model" type="text" placeholder="Araç Marka/Model (örn: Renault Megane)"
                                    required>

                                <div class="input-grup">
                                    <input id="arac-plaka" class="arac-plaka" name="arac-plaka" type="text" placeholder="Araç Plakası" required>

                                    <input id="arac-renk" class="arac-renk" name="arac-renk" type="text" placeholder="Araç Rengi" required>
                                </div>
                                <textarea name="urun_yazisi" placeholder="Araç üzerine yazılacak yazı(lar)"
                                    rows="3" class="textarea-height-64"></textarea>
                            </div>
                            <div class="randevu-teslim-saati">
                                <div class="baslik">RANDEVU SAATİ</div>
                                <div class="saat-ve-aciklama">
                                    <div class="saat-input-wrapper siparis-saat">
                                        <input type="time" id="arac-randevu-saat" name="arac-randevu-saat" required>
                                        <button type="button" class="icon-button">
                                            <i class="icon-saat"></i>
                                        </button>
                                    </div>
                                    <div class="aciklama">
                                        Araç randevuları için sipariş kartları üzerindeki <span>randevu saatini dikkate alınız</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="sag-alan">
                        <div class="urun-hizmet">
                            <div class="alan-baslik">
                                <div class="baslik">
                                    <i class="icon-sk-urun-bilgisi icon-size-16"></i>
                                    Ürün/Hizmet
                                </div>
                                <span>Sipariş alınan ürün veya hizmet bilgisi</span>
                            </div>
                            <div class="input-alan">
                                <div class="wrapper-acilirliste urunler" data-type="urunhizmet">
                                    <div class="acilirliste">
                                        <span>Ürün veya hizmet seçin</span>
                                        <i class="uil uil-angle-down"></i>
                                    </div>
                                    <div class="content">
                                        <div class="search">
                                            <i class="uil uil-search"></i>
                                            <input spellcheck="false" type="text"
                                                placeholder="Ürün veya hizmet arayın">
                                        </div>
                                        <ul class="options-urunler">
                                            <!-- Ürün listesi dinamik olarak yüklenecek -->
                                        </ul>
                                    </div>
                                    <input class="hidden-veri" name="urunhizmet" required type="hidden">
                                </div>
                                <div class="urun-fiyati-ve-aciklama">
                                    <input id="siparisurunaciklama" type="text" placeholder="(Varsa) Açıklama">
                                    <input class="tl-input" name="urunfiyat" id="urunfiyat" type="text" placeholder="0,00 TL">
                                </div>
                            </div>
                        </div>
                        <hr>
                        <div class="siparis-ucreti">
                            <div class="alan-baslik">
                                <div class="baslik">
                                    <i class="icon-sk-ucret icon-size-16"></i>
                                    Sipariş Ücreti
                                </div>
                                <span>Siparişe ait ürün ücret/hesap bilgileri</span>
                            </div>
                            <div class="radiobutton-alan">
                                <div class="ucret-secim">
                                    <div class="odeme-tipleri" data-required-radio="ucret-tip">
                                        <div class="cari-hesap">
                                            <input type="radio" name="ucret-tip" id="ut-cari" required>
                                            <label for="ut-cari">CARİ HESAP</label>
                                        </div>
                                        <div class="odeme-tipleri-rb-container">
                                            <div class="odeme-tip-column">
                                                <div class="odeme-tip-radio-box">
                                                    <input type="radio" name="ucret-tip" id="ut-nakit">
                                                    <label for="ut-nakit">NAKİT</label>
                                                </div>
                                                <div class="odeme-tip-radio-box">
                                                    <input type="radio" name="ucret-tip" id="ut-havaleeft">
                                                    <label for="ut-havaleeft">HAVALE/EFT</label>
                                                </div>
                                                <div class="odeme-tip-radio-box">
                                                    <input type="radio" name="ucret-tip" id="ut-kredikarti">
                                                    <label for="ut-kredikarti">POS</label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <hr>
                        <div class="ekstra-ucretlendirmeler">
                            <div class="alan-baslik">
                                <div class="baslik">
                                    <i class="icon-sk-ucret icon-size-16"></i>
                                    Ekstra Ücretlendirmeler
                                </div>
                                <span>Siparişe ait ekstra ücretlendirmeler</span>
                            </div>
                            <div class="input-grup">
                                <input id="ekstraucretaciklama" name="ekstra-ucret-aciklama" type="text" placeholder="Açıklama yazınız">
                                <input type="text" id="ekstraucrettutar" name="ekstra-ucret-tutari" class="tl-input" placeholder="0,00 TL">
                            </div>
                        </div>
                    </div>
                </div>
                <div class="alt-alan">
                    <div class="duzenleyen">
                        ${window.userSession ? window.userSession.createDuzenleyenHTML() : `
                            <img class="duzenleyen-profil-resmi" src="" onerror="this.onerror=null; this.src=''; this.style.display='none';">
                            <div class="duzenleme-tarih">Son Dzn: <span>Yeni sipariş</span></div>
                        `}
                    </div>
                    <div class="butonlar">
                        <button class="secondary-button btn-vazgec">VAZGEÇ</button>
                        <button type="submit" class="primary-button btn-kaydet" data-toast="kaydet">KAYDET</button>
                    </div>
                </div>
            </div>
        `,
        
        fields: [
            'musteri-adi',
            'telefon',
            'siparis-turu',
            'randevu-tarihi',
            'teslim-saati',
            'adres',
            'arac-marka-model',
            'arac-renk',
            'arac-plaka',
            'siparis-detaylari',
            'fiyat',
            'organizasyon-id'
        ],
        
        validations: {
            required: ['musteri-adi', 'telefon', 'siparis-turu', 'randevu-tarihi', 'teslim-saati', 'adres', 'arac-marka-model', 'arac-renk', 'arac-plaka', 'siparis-detaylari'],
            phone: ['telefon'],
            date: ['randevu-tarihi'],
            time: ['teslim-saati'],
            currency: ['fiyat']
        }
    },
    
    /**
     * Özel Sipariş Form Şablonu
     */
    ozelSiparis: {
        template: `
            <div class="header-alan">
                <div class="baslik">Yeni Sipariş Ekle</div>
                <div class="header-sag">
                    <button class="btn-duzenle">
                        <i class="icon-sk-karti-duzenle"></i>
                        Kartı Düzenle
                    </button>
                    <button class="btn-close-form">
                        <i class="icon-btn-kapat"></i>
                    </button>
                </div>
            </div>
            <div class="container container-ozelsiparis show">
                <div class="organizasyon-kutu">
                    <div class="kart-gorseli kart-gorseli-relative" id="gorselYukle">
                        <img src="assets/kart-gorsel-genel-statik.jpg" alt="Davetiye görseli">
                    </div>
                    <div class="organizasyon-bilgileri">
                        <div class="org-turu-band">
                            <div class="left">
                                <div class="org-tur">Özel Sipariş</div>
                                <div class="kart-etiket"></div>
                            </div>
                            <div class="right">
                                <a href="./siparis-kart-detay.html">
                                    <div class="toplam-siparis" data-dynamic="true">
                                        <i class="icon-toplam-siparis"></i><span class="siparis-sayisi">0</span>/<span class="max-siparis">20</span>
                                    </div>
                                </a>
                                <div class="btn-partner-siparis-ekle partner-siparisler info-only no-pointer-events" data-dynamic="true">
                                    <i class="icon-partner-siparis"></i>
                                    <div class="partner-siparis-sayisi">0</div>
                                </div>
                            </div>
                        </div>
                        <div class="org-adres-bilgileri">
                            <div class="konum"></div>
                            <div class="acik-adres"></div>
                            <div class="il-ilce"></div>
                        </div>
                        <div class="sahip-ve-zaman">
                            <div class="kart-aciklama">
                                Özel siparişler için sipariş kartları üzerindeki
                                <span>teslim saatini dikkate alınız</span>
                            </div>
                            <div class="vr"></div>
                            <div class="teslim-zaman">
                                <div class="baslik">
                                    <i class="icon-teslim-tarihi-ve-saati"></i>
                                    Teslim Zamanı
                                </div>
                                <div class="tarih">09 Eylül 2025 Pazartesi</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="siparis-form-alan">
                    <div class="sol-alan">
                        <div class="partner-siparisi-isaretle">
                            <label class="cbox-alan">
                                <input type="checkbox" name="is_partner_order" class="cbox-partner-order" value="1">
                                <span class="cbox-label-text">Partner siparişi olarak ekleyin</span>
                            </label>
                            <div class="aciklama">Bu siparişi partnerden gelen veya partnere vereceğiniz sipariş olarak işaretleyin</div>
                            <div class="partner-siparis-detaylari hidden">
                                <div class="partner-tipi checkbox-alan">
                                    <div class="checkbox-wrap">
                                        <input type="radio" name="partner_type" id="partner-verilen" value="verilen">
                                        <label for="partner-verilen">Partnere Verilen</label>
                                    </div>
                                    <div class="checkbox-wrap">
                                        <input type="radio" name="partner_type" id="partner-gelen" value="gelen">
                                        <label for="partner-gelen">Partnerden Gelen</label>
                                    </div>
                                </div>
                                <div class="wrapper-acilirliste partner" id="partner-firma-liste" data-type="partnerfirma" class="hidden">
                                    <div class="acilirliste">
                                        <span>Partner firma seçin</span>
                                        <i class="uil uil-angle-down"></i>
                                    </div>
                                    <div class="content">
                                        <div class="search">
                                            <i class="uil uil-search"></i>
                                            <input spellcheck="false" type="text" placeholder="Arayın">
                                        </div>
                                        <ul class="options-partner">
                                            <!-- Dinamik olarak yüklenecek -->
                                        </ul>
                                    </div>
                                    <input type="hidden" name="partnerfirma" class="hidden-veri">
                                </div>
                            </div>
                        </div>
                        <div class="kisi-bilgi-alanlar">
                            <div class="siparis-veren-musteri">
                                <div class="alan-baslik">
                                    <div class="baslik">
                                        <i class="icon-sk-siparis-veren icon-size-16"></i>
                                        Sipariş Veren Müşteri
                                    </div>
                                    <span>Sipariş veren müşteri bilgileri</span>
                                </div>
                                <div class="input-alan">
                                    <div class="input">
                                        <div class="wrapper-acilirliste musteri" id="musterilistesi3">
                                            <div class="acilirliste">
                                                <span>Müşteri seçiniz</span>
                                                <i class="uil uil-angle-down"></i>
                                            </div>
                                            <div class="content">
                                                <div class="search">
                                                    <i class="uil uil-search"></i>
                                                    <input spellcheck="false" type="text"
                                                        placeholder="Müşteri arayın">
                                                </div>
                                                <ul class="options-musteriler">
                                                    <!-- Müşteri listesi dinamik olarak yüklenecek -->
                                                </ul>
                                            </div>
                                            <input type="hidden" name="musteri" class="hidden-veri" required>
                                        </div>
                                    </div>
                                    <input id="musteriunvan" type="text" placeholder="(veya kendiniz ekleyin) Müşteri/Firma Adı"
                                        required>
                                    <div class="input-grup">
                                        <input id="musteriadsoyad" type="text" placeholder="İsim Soyisim" required>
                                        <input id="musteritelefon" class="telefon-input" type="tel"
                                            data-phone-input="standard" required>
                                    </div>
                                    <textarea name="urun_yazisi"
                                        placeholder="Ürün yazısı (veya Sipariş ürün üzeri not)" rows="3"
                                        class="textarea-height-64"></textarea>
                                    <textarea rows="4" cols="50" id="siparisnotalan" name="comment"
                                        placeholder="Ekstra not veya açıklama" class="textarea-height-64"></textarea>
                                </div>
                                
                                <div class="urun-yazi-dosyalar-wrapper">
                                    <!-- Müşteri Ürün Yazı Dosyaları Dropdown -->
                                    <div class="musteri-urun-dosya-dropdown" id="musteriUrunDosyaDropdownOzelSiparis" class="hidden">
                                        <div class="acilirliste">
                                            <span>Bu müşteriye ait ürün yazı dosyaları <span class="dropdown-dosya-sayisi">0</span></span>
                                            <i class="fa-solid fa-chevron-down dropdown-arrow"></i>
                                        </div>
                                        <div class="dropdown-body">
                                            <!-- JavaScript ile doldurulacak -->
                                        </div>
                                        <div class="secili-dosya-bilgi" class="hidden">
                                            <i class="fa-solid fa-check-circle"></i>
                                            <span class="secili-dosya-isim"></span>
                                            <button type="button" class="secili-dosya-kaldir-btn" title="Seçimi kaldır">
                                                <i class="fa-solid fa-times"></i>
                                                <span>Kaldır</span>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div class="dosya-yukle-alan" id="urun-yazisi-yukle">
                                        <i class="icon-sk-urun-yazisi"></i>
                                        <span class="file-label">Ürün yazısı dosyası yükleyin</span>
                                        <button type="button" class="remove-button"
                                            class="hidden">Kaldır</button>
                                        <input type="file" class="file-input" accept="image/*" class="hidden" />
                                    </div>
                                </div>
                            </div>
                            <div class="teslim-kisisi">
                                <div class="alan-baslik">
                                    <div class="baslik">
                                        <i class="icon-sk-teslim-kisisi" class="icon-size-16"></i>
                                        Teslim Edilecek Kişi
                                    </div>
                                    <span>Siparişin teslim edileceği kişi bilgileri</span>
                                </div>
                                <div class="input-alan">
                                    <div class="input-grup">
                                        <input id="teslimedilecekadsoyad" name="teslim_kisisi" type="text" placeholder="İsim Soyisim"
                                            required>
                                        <input id="teslimedilecektelefon" name="teslim_kisisi_telefon" class="telefon-input" type="text" data-phone-input="standard"
                                            data-phone-input="standard" required>
                                    </div>
                          
                                       <div class="input-icerik-alan">
                                        <div class="input-icerik-grup" id="il-ilce">
                                            <div class="wrapper-acilirliste genel" data-type="il">
                                                <div class="acilirliste">
                                                    <span>İl Seçiniz</span>
                                                    <i class="uil uil-angle-down"></i>
                                                </div>
                                                <div class="content">
                                                    <div class="search">
                                                        <i class="uil uil-search"></i>
                                                        <input spellcheck="false" type="text" placeholder="Arayın">
                                                    </div>
                                                    <ul class="options-genel">
                                                        <!-- Dinamik olarak doldurulacak -->
                                                    </ul>
                                                </div>
                                                <!-- BACKEND FORM VERİSİ -->
                                                <input type="hidden" name="teslim_il" class="hidden-veri" required>
                                            </div>
                                            <div class="wrapper-acilirliste genel" data-type="ilce">
                                                <div class="acilirliste">
                                                    <span>İlçe Seçiniz</span>
                                                    <i class="uil uil-angle-down"></i>
                                                </div>
                                                <div class="content">
                                                    <div class="search">
                                                        <i class="uil uil-search"></i>
                                                        <input spellcheck="false" type="text" placeholder="Arayın">
                                                    </div>
                                                    <ul class="options-genel">
                                                        <!-- Dinamik olarak doldurulacak -->
                                                    </ul>
                                                </div>
                                                <!-- BACKEND FORM VERİSİ -->
                                                <input type="hidden" name="teslim_ilce" class="hidden-veri" required>
                                            </div>
                                        </div>
                                        <div class="wrapper-acilirliste genel" data-type="mahallesemt">
                                            <div class="acilirliste">
                                                <span>Mahalle/Semt</span>
                                                <i class="uil uil-angle-down"></i>
                                            </div>
                                            <div class="content">
                                                <div class="search">
                                                    <i class="uil uil-search"></i>
                                                    <input spellcheck="false" type="text" placeholder="Arayın">
                                                </div>
                                                <ul class="options-genel">
                                                    <!-- Dinamik olarak doldurulacak -->
                                                </ul>
                                            </div>
                                            <!-- BACKEND FORM VERİSİ -->
                                            <input type="hidden" name="teslim_mahalle" class="hidden-veri" required>
                                        </div>
                                        <textarea id="acikadres" name="teslim_acik_adres" placeholder="Açık adresi yazınız"
                                            rows="3" required></textarea>
                                    </div>
                                    
                                </div>
                                <div class="randevu-teslim-saati">
                                    <div class="baslik">TESLİM SAATİ</div>
                                    <div class="saat-ve-aciklama">
                                        <div class="saat-input-wrapper siparis-saat">
                                            <input type="time" name="teslim_saat" required>
                                            <button type="button" class="icon-button">
                                                <i class="icon-saat"></i>
                                            </button>
                                        </div>
                                        <div class="aciklama">
                                            Özel siparişler için sipariş kartları üzerindeki
                                            <span>teslim saatini dikkate alınız</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="sag-alan">
                        <div class="urun-hizmet">
                            <div class="alan-baslik">
                                <div class="baslik">
                                    <i class="icon-sk-urun-bilgisi icon-size-16"></i>
                                    Ürün/Hizmet
                                </div>
                                <span>Sipariş alınan ürün veya hizmet bilgisi</span>
                            </div>
                            <div class="input-alan">
                                <div class="wrapper-acilirliste urunler" data-type="urunhizmet">
                                    <div class="acilirliste">
                                        <span>Ürün veya hizmet seçin</span>
                                        <i class="uil uil-angle-down"></i>
                                    </div>
                                    <div class="content">
                                        <div class="search">
                                            <i class="uil uil-search"></i>
                                            <input spellcheck="false" type="text"
                                                placeholder="Ürün veya hizmet arayın">
                                        </div>
                                        <ul class="options-urunler">
                                            <!-- Ürün listesi dinamik olarak yüklenecek -->
                                        </ul>
                                    </div>
                                    <input class="hidden-veri" name="urunhizmet" required type="hidden">
                                </div>
                                <div class="urun-fiyati-ve-aciklama">
                                    <input id="siparisurunaciklama" type="text" placeholder="(Varsa) Açıklama">
                                    <input class="tl-input" name="urunfiyat" id="urunfiyat" type="text" placeholder="0,00 TL">
                                </div>
                            </div>
                        </div>
                        <hr>
                        <div class="siparis-ucreti">
                            <div class="alan-baslik">
                                <div class="baslik">
                                    <i class="icon-sk-ucret icon-size-16"></i>
                                    Sipariş Ücreti
                                </div>
                                <span>Siparişe ait ürün ücret/hesap bilgileri</span>
                            </div>
                            <div class="radiobutton-alan">
                                <div class="ucret-secim">
                                    <div class="odeme-tipleri" data-required-radio="ucret-tip">
                                        <div class="cari-hesap">
                                            <input type="radio" name="ucret-tip" id="ut-cari" required>
                                            <label for="ut-cari">CARİ HESAP</label>
                                        </div>
                                        <div class="odeme-tipleri-rb-container">
                                            <div class="odeme-tip-column">
                                                <div class="odeme-tip-radio-box">
                                                    <input type="radio" name="ucret-tip" id="ut-nakit">
                                                    <label for="ut-nakit">NAKİT</label>
                                                </div>
                                                <div class="odeme-tip-radio-box">
                                                    <input type="radio" name="ucret-tip" id="ut-havaleeft">
                                                    <label for="ut-havaleeft">HAVALE/EFT</label>
                                                </div>
                                                <div class="odeme-tip-radio-box">
                                                    <input type="radio" name="ucret-tip" id="ut-kredikarti">
                                                    <label for="ut-kredikarti">POS</label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <hr>
                        <div class="ekstra-ucretlendirmeler">
                            <div class="alan-baslik">
                                <div class="baslik">
                                    <i class="icon-sk-ucret icon-size-16"></i>
                                    Ekstra Ücretlendirmeler
                                </div>
                                <span>Siparişe ait ekstra ücretlendirmeler</span>
                            </div>
                            <div class="input-grup">
                                <input id="ekstraucretaciklama" name="ekstra-ucret-aciklama" type="text" placeholder="Açıklama yazınız">
                                <input type="text" id="ekstraucrettutar" name="ekstra-ucret-tutari" class="tl-input" placeholder="0,00 TL">
                            </div>
                        </div>
                    </div>
                </div>
                <div class="alt-alan">
                    <div class="duzenleyen">
                        ${window.userSession ? window.userSession.createDuzenleyenHTML() : `
                            <img class="duzenleyen-profil-resmi" src="" onerror="this.onerror=null; this.src=''; this.style.display='none';">
                            <div class="duzenleme-tarih">Son Dzn: <span>Yeni sipariş</span></div>
                        `}
                    </div>
                    <div class="butonlar">
                        <button class="secondary-button btn-vazgec">VAZGEÇ</button>
                        <button type="submit" class="primary-button btn-kaydet" data-toast="kaydet">KAYDET</button>
                    </div>
                </div>
            </div>
        `,
        
        fields: [
            'musteri-adi',
            'telefon',
            'siparis-turu',
            'teslim-tarihi',
            'teslim-saati',
            'teslim-adresi',
            'siparis-detaylari',
            'fiyat',
            'organizasyon-id',
            'organizasyon-turu'
        ],
        
        validations: {
            required: ['musteri-adi', 'telefon', 'siparis-turu', 'teslim-tarihi', 'teslim-saati', 'teslim-adresi', 'siparis-detaylari'],
            phone: ['telefon'],
            date: ['teslim-tarihi'],
            time: ['teslim-saati'],
            currency: ['fiyat']
        }
    },
    
    /**
     * Özel Gün Form Şablonu
     */
    ozelGun: {
        template: `
            <div class="header-alan">
                <div class="baslik">Yeni Sipariş Ekle</div>
                <div class="header-sag">
                    <button class="btn-duzenle">
                        <i class="icon-sk-karti-duzenle"></i>
                        Kartı Düzenle
                    </button>
                    <button class="btn-close-form">
                        <i class="icon-btn-kapat"></i>
                    </button>
                </div>
            </div>
            <div class="container container-ozelgun show">
                <div class="organizasyon-kutu">
                    <div class="kart-gorseli kart-gorseli-relative" id="gorselYukle">
                        <img src="assets/kart-gorsel-genel-statik.jpg" alt="Davetiye görseli">
                    </div>
                    <div class="organizasyon-bilgileri">
                        <div class="org-turu-band">
                            <div class="left">
                                <div class="org-tur">Özel Gün</div>
                                <div class="kart-etiket"></div>
                            </div>
                            <div class="right">
                                <a href="./siparis-kart-detay.html">
                                    <div class="toplam-siparis" data-dynamic="true">
                                        <i class="icon-toplam-siparis"></i><span class="siparis-sayisi">0</span>/<span class="max-siparis">20</span>
                                    </div>
                                </a>
                                <div class="btn-partner-siparis-ekle partner-siparisler info-only no-pointer-events" data-dynamic="true">
                                    <i class="icon-partner-siparis"></i>
                                    <div class="partner-siparis-sayisi">0</div>
                                </div>
                            </div>
                        </div>
                        <div class="org-adres-bilgileri">
                            <div class="konum"></div>
                            <div class="acik-adres"></div>
                            <div class="il-ilce"></div>
                        </div>
                        <div class="sahip-ve-zaman">
                            <div class="kart-aciklama">
                                Özel gün siparişleri için sipariş kartları üzerindeki
                                <span>teslim saatini dikkate alınız</span>
                            </div>
                            <div class="vr"></div>
                            <div class="teslim-zaman">
                                <div class="baslik">
                                    <i class="icon-teslim-tarihi-ve-saati"></i>
                                    Teslim Zamanı
                                </div>
                                <div class="tarih">09 Eylül 2025 Pazartesi</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="siparis-form-alan">
                    <div class="sol-alan">
                        <div class="partner-siparisi-isaretle">
                            <label class="cbox-alan">
                                <input type="checkbox" name="is_partner_order" class="cbox-partner-order" value="1">
                                <span class="cbox-label-text">Partner siparişi olarak ekleyin</span>
                            </label>
                            <div class="aciklama">Bu siparişi partnerden gelen veya partnere vereceğiniz sipariş olarak işaretleyin</div>
                            <div class="partner-siparis-detaylari hidden">
                                <div class="partner-tipi checkbox-alan">
                                    <div class="checkbox-wrap">
                                        <input type="radio" name="partner_type" id="partner-verilen" value="verilen">
                                        <label for="partner-verilen">Partnere Verilen</label>
                                    </div>
                                    <div class="checkbox-wrap">
                                        <input type="radio" name="partner_type" id="partner-gelen" value="gelen">
                                        <label for="partner-gelen">Partnerden Gelen</label>
                                    </div>
                                </div>
                                <div class="wrapper-acilirliste partner" id="partner-firma-liste" data-type="partnerfirma" class="hidden">
                                    <div class="acilirliste">
                                        <span>Partner firma seçin</span>
                                        <i class="uil uil-angle-down"></i>
                                    </div>
                                    <div class="content">
                                        <div class="search">
                                            <i class="uil uil-search"></i>
                                            <input spellcheck="false" type="text" placeholder="Arayın">
                                        </div>
                                        <ul class="options-partner">
                                            <!-- Dinamik olarak yüklenecek -->
                                        </ul>
                                    </div>
                                    <input type="hidden" name="partnerfirma" class="hidden-veri">
                                </div>
                            </div>
                        </div>
                        <div class="kisi-bilgi-alanlar">
                            <div class="siparis-veren-musteri">
                                <div class="alan-baslik">
                                    <div class="baslik">
                                        <i class="icon-sk-siparis-veren icon-size-16"></i>
                                        Sipariş Veren Müşteri
                                    </div>
                                    <span>Sipariş veren müşteri bilgileri</span>
                                </div>
                                <div class="input-alan">
                                    <div class="input">
                                        <div class="wrapper-acilirliste musteri" id="musterilistesi4">
                                            <div class="acilirliste">
                                                <span>Müşteri seçiniz</span>
                                                <i class="uil uil-angle-down"></i>
                                            </div>
                                            <div class="content">
                                                <div class="search">
                                                    <i class="uil uil-search"></i>
                                                    <input spellcheck="false" type="text"
                                                        placeholder="Müşteri arayın">
                                                </div>
                                                <ul class="options-musteriler">
                                                    <!-- Müşteri listesi dinamik olarak yüklenecek -->
                                                </ul>
                                            </div>
                                            <input type="hidden" name="musteri" class="hidden-veri" required>
                                        </div>
                                    </div>
                                    <input id="musteriunvan" type="text" placeholder="(veya kendiniz ekleyin) Müşteri/Firma Adı"
                                        required>
                                    <div class="input-grup">
                                        <input id="musteriadsoyad" type="text" placeholder="İsim Soyisim" required>
                                        <input id="musteritelefon" class="telefon-input" type="tel"
                                            data-phone-input="standard" required>
                                    </div>
                                    <textarea name="urun_yazisi"
                                        placeholder="Ürün yazısı (veya Sipariş ürün üzeri not)" rows="3"
                                        class="textarea-height-64"></textarea>
                                    <textarea rows="4" cols="50" id="siparisnotalan" name="comment"
                                        placeholder="Ekstra not veya açıklama" class="textarea-height-64"></textarea>
                                </div>
                                
                                <div class="urun-yazi-dosyalar-wrapper">
                                    <!-- Müşteri Ürün Yazı Dosyaları Dropdown -->
                                    <div class="musteri-urun-dosya-dropdown" id="musteriUrunDosyaDropdownOzelGun" class="hidden">
                                        <div class="acilirliste">
                                            <span>Bu müşteriye ait ürün yazı dosyaları <span class="dropdown-dosya-sayisi">0</span></span>
                                            <i class="fa-solid fa-chevron-down dropdown-arrow"></i>
                                        </div>
                                        <div class="dropdown-body">
                                            <!-- JavaScript ile doldurulacak -->
                                        </div>
                                        <div class="secili-dosya-bilgi" class="hidden">
                                            <i class="fa-solid fa-check-circle"></i>
                                            <span class="secili-dosya-isim"></span>
                                            <button type="button" class="secili-dosya-kaldir-btn" title="Seçimi kaldır">
                                                <i class="fa-solid fa-times"></i>
                                                <span>Kaldır</span>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div class="dosya-yukle-alan" id="urun-yazisi-yukle">
                                        <i class="icon-sk-urun-yazisi"></i>
                                        <span class="file-label">Ürün yazısı dosyası yükleyin</span>
                                        <button type="button" class="remove-button"
                                            class="hidden">Kaldır</button>
                                        <input type="file" class="file-input" accept="image/*" class="hidden" />
                                    </div>
                                </div>
                            </div>
                            <div class="teslim-kisisi">
                                <div class="alan-baslik">
                                    <div class="baslik">
                                        <i class="icon-sk-teslim-kisisi" class="icon-size-16"></i>
                                        Teslim Edilecek Kişi
                                    </div>
                                    <span>Siparişin teslim edileceği kişi bilgileri</span>
                                </div>
                                <div class="input-alan">
                                    <div class="input-grup">
                                        <input id="teslimedilecekadsoyad" name="teslim_kisisi" type="text" placeholder="İsim Soyisim"
                                            required>
                                        <input id="teslimedilecektelefon" name="teslim_kisisi_telefon" class="telefon-input" type="text" data-phone-input="standard"
                                            data-phone-input="standard" required>
                                    </div>
                      <div class="input-icerik-alan">
                                        <div class="input-icerik-grup" id="il-ilce">
                                            <div class="wrapper-acilirliste genel" data-type="il">
                                                <div class="acilirliste">
                                                    <span>İl Seçiniz</span>
                                                    <i class="uil uil-angle-down"></i>
                                                </div>
                                                <div class="content">
                                                    <div class="search">
                                                        <i class="uil uil-search"></i>
                                                        <input spellcheck="false" type="text" placeholder="Arayın">
                                                    </div>
                                                    <ul class="options-genel">
                                                        <!-- Dinamik olarak doldurulacak -->
                                                    </ul>
                                                </div>
                                                <!-- BACKEND FORM VERİSİ -->
                                                <input type="hidden" name="teslim_il" class="hidden-veri" required>
                                            </div>
                                            <div class="wrapper-acilirliste genel" data-type="ilce">
                                                <div class="acilirliste">
                                                    <span>İlçe Seçiniz</span>
                                                    <i class="uil uil-angle-down"></i>
                                                </div>
                                                <div class="content">
                                                    <div class="search">
                                                        <i class="uil uil-search"></i>
                                                        <input spellcheck="false" type="text" placeholder="Arayın">
                                                    </div>
                                                    <ul class="options-genel">
                                                        <!-- Dinamik olarak doldurulacak -->
                                                    </ul>
                                                </div>
                                                <!-- BACKEND FORM VERİSİ -->
                                                <input type="hidden" name="teslim_ilce" class="hidden-veri" required>
                                            </div>
                                        </div>
                                        <div class="wrapper-acilirliste genel" data-type="mahallesemt">
                                            <div class="acilirliste">
                                                <span>Mahalle/Semt</span>
                                                <i class="uil uil-angle-down"></i>
                                            </div>
                                            <div class="content">
                                                <div class="search">
                                                    <i class="uil uil-search"></i>
                                                    <input spellcheck="false" type="text" placeholder="Arayın">
                                                </div>
                                                <ul class="options-genel">
                                                    <!-- Dinamik olarak doldurulacak -->
                                                </ul>
                                            </div>
                                            <!-- BACKEND FORM VERİSİ -->
                                            <input type="hidden" name="teslim_mahalle" class="hidden-veri" required>
                                        </div>
                                        <textarea id="acikadres" name="teslim_acik_adres" placeholder="Açık adresi yazınız"
                                            rows="3" required></textarea>
                                    </div>
                                    
                                </div>
                                <div class="randevu-teslim-saati">
                                    <div class="baslik">TESLİM SAATİ</div>
                                    <div class="saat-ve-aciklama">
                                        <div class="saat-input-wrapper siparis-saat">
                                            <input type="time" name="teslim_saat" required>
                                            <button type="button" class="icon-button">
                                                <i class="icon-saat"></i>
                                            </button>
                                        </div>
                                        <div class="aciklama">
                                            Özel gün siparişleri için sipariş kartları üzerindeki
                                            <span>teslim saatini dikkate alınız</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="sag-alan">
                        <div class="urun-hizmet">
                            <div class="alan-baslik">
                                <div class="baslik">
                                    <i class="icon-sk-urun-bilgisi icon-size-16"></i>
                                    Ürün/Hizmet
                                </div>
                                <span>Sipariş alınan ürün veya hizmet bilgisi</span>
                            </div>
                            <div class="input-alan">
                                <div class="wrapper-acilirliste urunler" data-type="urunhizmet">
                                    <div class="acilirliste">
                                        <span>Ürün veya hizmet seçin</span>
                                        <i class="uil uil-angle-down"></i>
                                    </div>
                                    <div class="content">
                                        <div class="search">
                                            <i class="uil uil-search"></i>
                                            <input spellcheck="false" type="text"
                                                placeholder="Ürün veya hizmet arayın">
                                        </div>
                                        <ul class="options-urunler">
                                            <!-- Ürün listesi dinamik olarak yüklenecek -->
                                        </ul>
                                    </div>
                                    <input class="hidden-veri" name="urunhizmet" type="hidden" required>
                                </div>
                                <div class="urun-fiyati-ve-aciklama">
                                    <input id="siparisurunaciklama" type="text" placeholder="(Varsa) Açıklama">
                                    <input class="tl-input" name="urunfiyat" id="urunfiyat" type="text" placeholder="0,00 TL">
                                </div>
                            </div>
                        </div>
                        <hr>
                        <div class="siparis-ucreti">
                            <div class="alan-baslik">
                                <div class="baslik">
                                    <i class="icon-sk-ucret icon-size-16"></i>
                                    Sipariş Ücreti
                                </div>
                                <span>Siparişe ait ürün ücret/hesap bilgileri</span>
                            </div>
                            <div class="radiobutton-alan">
                                <div class="ucret-secim">
                                    <div class="odeme-tipleri" data-required-radio="ucret-tip">
                                        <div class="cari-hesap">
                                            <input type="radio" name="ucret-tip" id="ut-cari" required>
                                            <label for="ut-cari">CARİ HESAP</label>
                                        </div>
                                        <div class="odeme-tipleri-rb-container">
                                            <div class="odeme-tip-column">
                                                <div class="odeme-tip-radio-box">
                                                    <input type="radio" name="ucret-tip" id="ut-nakit">
                                                    <label for="ut-nakit">NAKİT</label>
                                                </div>
                                                <div class="odeme-tip-radio-box">
                                                    <input type="radio" name="ucret-tip" id="ut-havaleeft">
                                                    <label for="ut-havaleeft">HAVALE/EFT</label>
                                                </div>
                                                <div class="odeme-tip-radio-box">
                                                    <input type="radio" name="ucret-tip" id="ut-kredikarti">
                                                    <label for="ut-kredikarti">POS</label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <hr>
                        <div class="ekstra-ucretlendirmeler">
                            <div class="alan-baslik">
                                <div class="baslik">
                                    <i class="icon-sk-ucret icon-size-16"></i>
                                    Ekstra Ücretlendirmeler
                                </div>
                                <span>Siparişe ait ekstra ücretlendirmeler</span>
                            </div>
                            <div class="input-grup">
                                <input id="ekstraucretaciklama" name="ekstra-ucret-aciklama" type="text" placeholder="Açıklama yazınız">
                                <input type="text" id="ekstraucrettutar" name="ekstra-ucret-tutari" class="tl-input" placeholder="0,00 TL">
                            </div>
                        </div>
                    </div>
                </div>
                <div class="alt-alan">
                    <div class="duzenleyen">
                        ${window.userSession ? window.userSession.createDuzenleyenHTML() : `
                            <img class="duzenleyen-profil-resmi" src="" onerror="this.onerror=null; this.src=''; this.style.display='none';">
                            <div class="duzenleme-tarih">Son Dzn: <span>Yeni sipariş</span></div>
                        `}
                    </div>
                    <div class="butonlar">
                        <button class="secondary-button btn-vazgec">VAZGEÇ</button>
                        <button type="submit" class="primary-button btn-kaydet" data-toast="kaydet">KAYDET</button>
                    </div>
                </div>
            </div>
        `,
        
        fields: [
            'musteri-adi',
            'telefon',
            'siparis-turu',
            'teslim-tarihi',
            'teslim-saati',
            'teslim-adresi',
            'siparis-detaylari',
            'fiyat',
            'organizasyon-id',
            'organizasyon-turu'
        ],
        
        validations: {
            required: ['musteri-adi', 'telefon', 'siparis-turu', 'teslim-tarihi', 'teslim-saati', 'teslim-adresi', 'siparis-detaylari'],
            phone: ['telefon'],
            date: ['teslim-tarihi'],
            time: ['teslim-saati'],
            currency: ['fiyat']
        }
    }
};

/**
 * Form şablonunu al
 * @param {string} formType - Form türü (organizasyon, aracSusleme, ozelSiparis, ozelGun)
 * @returns {Object} Form şablonu objesi
 */
function getSiparisFormTemplate(formType) {
    
    // Türkçe karakterleri normalize et
    const templateKey = formType.toLowerCase()
        .replace(/\s+/g, '')           // Boşlukları kaldır
        .replace(/ş/g, 's')            // ş -> s
        .replace(/ğ/g, 'g')            // ğ -> g
        .replace(/ü/g, 'u')            // ü -> u
        .replace(/ı/g, 'i')            // ı -> i
        .replace(/ö/g, 'o')            // ö -> o
        .replace(/ç/g, 'c');           // ç -> c
    
    switch(templateKey) {
        case 'organizasyon':
        case 'dugun':
        case 'nisan':
        case 'sunnet':
            return SiparisFormTemplates.organizasyon;
        case 'aracsusleme':
            return SiparisFormTemplates.aracSusleme;
        case 'ozelsiparis':
            return SiparisFormTemplates.ozelSiparis;
        case 'ozelgun':
            return SiparisFormTemplates.ozelGun;
        default:
            console.warn('⚠️ Bilinmeyen form türü:', formType, '->', templateKey);
            return SiparisFormTemplates.organizasyon;
    }
}

/**
 * Form şablonunu render et
 * @param {string} formType - Form türü
 * @param {HTMLElement} container - Container elementi
 * @returns {HTMLElement} Oluşturulan form elementi
 */
function renderSiparisForm(formType, container) {
    
    const template = getSiparisFormTemplate(formType);
    
    if (!template) {
        console.error('❌ Template bulunamadı:', formType);
        return null;
    }
    
    // Container'ı temizle
    container.innerHTML = '';
    
    // Şablonu ekle
    container.innerHTML = template.template;
    
    // ✅ Yeni form açıldığında musteriunvan initialValue'larını temizle
    // Böylece kullanıcı yazarken otomatik dropdown seçimi yapılmayacak
    const musteriUnvanInputs = document.querySelectorAll('#musteriunvan');
    musteriUnvanInputs.forEach(input => {
        if (input.dataset.initialValue) {
            delete input.dataset.initialValue;
        }
    });
    
    // Yeni form'daki genel dropdown'ları (il-ilçe-mahalle) başlat
    setTimeout(() => {
        if (typeof setupGenelAcilirListe === 'function') {
            setupGenelAcilirListe();
        }
    }, 50);
    
    // ✅ ÖNEMLİ: Form oluşturulduktan sonra telefon formatlamasını başlat
    setTimeout(() => {
        if (typeof setupIndexFormPhoneMask === 'function') {
            setupIndexFormPhoneMask();
        } else if (typeof window.setupPhoneInput === 'function') {
            // Fallback: Direkt telefon inputlarını formatla
            const telefonInputs = container.querySelectorAll('.telefon-input, #musteritelefon, #teslimedilecektelefon, input[type="tel"][data-phone-input="standard"]');
            telefonInputs.forEach(input => {
                if (input && !input.hasAttribute('data-phone-formatted') && !input.disabled) {
                    if (!input.hasAttribute('data-phone-input')) {
                        input.setAttribute('data-phone-input', 'standard');
                    }
                    if (!input.value || input.value.trim() === '' || !input.value.startsWith('+90 (')) {
                        input.value = '+90 (';
                    }
                    window.setupPhoneInput(input);
                }
            });
        }
    }, 200);
    
    // Araç Süsleme formu için işletme adını yükle
    const normalizedFormType = formType?.toLowerCase().replace(/\s+/g, '').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c');
    
    if (normalizedFormType === 'aracsusleme' || formType === 'aracsusleme-kart') {
        // DOM'un hazır olmasını bekle
        setTimeout(() => {
            const isletmeAdiElement = container.querySelector('[data-dynamic-isletme-adi]');
            
            if (isletmeAdiElement) {
                // Backend'den ayarlar_genel_isletme_ayarlari tablosundan isletme_adi alanını çek
                const apiBase = (typeof window.getFloovonApiBase === 'function') ? window.getFloovonApiBase() : (window.API_BASE_URL || 'http://localhost:3001/api');
                fetch(`${apiBase}/ayarlar/isletme`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success && data.data && data.data.isletme_adi) {
                            isletmeAdiElement.textContent = data.data.isletme_adi;
                        }
                    })
                    .catch(error => {
                        console.error('❌ İşletme adı yüklenirken hata:', error);
                    });
            }
        }, 200);
    }
    
    // Özel Gün ve Özel Sipariş formlarında kart-etiket alanını kontrol et ve veri yoksa gizle
    if (normalizedFormType === 'ozelgun' || normalizedFormType === 'ozelsiparis' || formType === 'ozelgun-kart' || formType === 'ozelsiparis-kart') {
        setTimeout(() => {
            const kartEtiket = container.querySelector('.kart-etiket');
            if (kartEtiket) {
                const etiketMetni = (kartEtiket.textContent || '').trim();
                // Eğer etiket metni boşsa veya sadece boşluk karakterlerinden oluşuyorsa gizle
                if (!etiketMetni || etiketMetni === '') {
                    kartEtiket.style.display = 'none';
                } else {
                    kartEtiket.style.display = '';
                }
            }
        }, 200);
    }
    
    // Müşteri dropdown güncelleme trigger'ı - birkaç kez dene
    setTimeout(() => {
        if (window.triggerCustomerDropdownUpdate) {
            window.triggerCustomerDropdownUpdate();
        }
    }, 100);
    
    setTimeout(() => {
        if (window.triggerCustomerDropdownUpdate) {
            window.triggerCustomerDropdownUpdate();
        }
    }, 500);
    
    setTimeout(() => {
        if (window.triggerCustomerDropdownUpdate) {
            window.triggerCustomerDropdownUpdate();
        }
    }, 1000);
    
    // 🆕 DOĞRUDAN: Form render edildikten sonra date/time input'ları doldur
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const hh = String(today.getHours()).padStart(2, '0');
    const min = String(today.getMinutes()).padStart(2, '0');
    
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const currentTime = `${hh}:${min}`;
    
    // setTimeout ile DOM'un tamamen hazır olmasını bekle (100ms gibi eski yedekteki gibi)
    setTimeout(() => {
        // Tüm date input'ları bul ve doldur
        const allDateInputs = container.querySelectorAll('input[type="date"]');
        
        allDateInputs.forEach((input, index) => {
            input.value = todayStr;
            console.log(`✅ renderSiparisForm - Date Input ${index + 1} dolduruldu:`, input.id || input.name, '→', input.value);
        });
        
        // NOT: Time input'lara şu anki saat yazdırılmıyor - kullanıcı manuel girecek
        // const allTimeInputs = container.querySelectorAll('input[type="time"]');
        // console.log('🔍 renderSiparisForm - Bulunan time input sayısı:', allTimeInputs.length);
        // 
        // allTimeInputs.forEach((input, index) => {
        //     input.value = currentTime;
        //     console.log(`✅ renderSiparisForm - Time Input ${index + 1} dolduruldu:`, input.id || input.name, '→', input.value);
        // });
    }, 100);
    
    // File input'ları temizle (template render sonrası) - ŞİMDİLİK KAPALI
    // setTimeout(() => {
    //     if (typeof window !== 'undefined' && window.clearFileInputsInForm) {
    //         window.clearFileInputsInForm(container);
    //     }
    // }, 200);
    
    return container;
}

// Global erişim için window'a ekle
if (typeof window !== 'undefined') {
    window.SiparisFormTemplates = SiparisFormTemplates;
    window.getSiparisFormTemplate = getSiparisFormTemplate;
    window.renderSiparisForm = renderSiparisForm;
}
