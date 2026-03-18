/**
 * WhatsApp "Sohbetten sipariş" ve "Sipariş onay analizi" OpenAI promptları.
 * Düzenlemek için yalnızca bu dosyayı kullanın.
 */

'use strict';

/** Sohbetten sipariş analizi: modele giden sohbet metni üst sınırı */
const MAX_SIPARIS_ANALIZ_CHARS = 12000;

/** Sipariş onay analizi: sohbet metni üst sınırı */
const MAX_SIPARIS_ONAY_CHARS = 12000;

/**
 * Ürün listesi varsa siparis_urun kuralı (system prompt içine gömülür).
 * @param {string} urunListesiMetin
 */
function buildUrunKuraliForAnaliz(urunListesiMetin) {
    const t = String(urunListesiMetin || '').trim();
    if (t) {
        return `\n- siparis_urun: Önce aşağıdaki listeden en yakın ürünü yaz. Hiçbiri uymuyorsa müşterinin kullandığı ürün ifadesini olduğu gibi yaz; müşteri ürün söylediyse alanı boş bırakma. Örnek: "buket" → listede "Çiçek Buketi" varsa onu kullan. Liste: ${t}`;
    }
    return '\n- siparis_urun: Sipariş edilen ürünün adı/kısa açıklaması (örn. "Kırmızı gül buketi").';
}

/**
 * POST /api/whatsapp/sohbetten-siparis-analiz — system mesajı
 * @param {string} urunListesiMetin Aktif ürünler virgülle birleşik veya boş
 */
function buildSohbettenSiparisAnalizSystemPrompt(urunListesiMetin) {
    const urunKurali = buildUrunKuraliForAnaliz(urunListesiMetin);
    return `Sen bir çiçekçi sipariş analiz asistanısın. Verilen WhatsApp sohbet metninden SADECE müşterinin yazdığı en güncel siparişi analiz et ve aşağıdaki JSON alanlarına yerleştir.

ÇIKTI KURALI:
- SADECE geçerli bir JSON objesi döndür.
- JSON dışında tek kelime yazma.
- Tüm anahtarlar her zaman bulunmalı.
- Sohbette müşteri bir şey net söylediyse (ürün, isim, adres parçası, saat vb.) ilgili alanı doldur; tamamen yoksa "" bırak.
- Tahmin / uydurma yapma: soyad uydurma, olmayan tarih uydurma, eski siparişten veri çalma.
- FORM DOLULUĞU: Müşteri bir alanı net yazdıysa mutlaka doldur. Tek şüpheli satır yüzünden diğer alanları boş bırakma; her alan bağımsız değerlendirilir.

JSON ANAHTARLARI:
musteri_isim_soyisim, siparis_veren_telefon, teslim_kisisi, teslim_kisisi_telefon, teslim_il, teslim_ilce, teslim_mahalle, teslim_acik_adres, teslim_tarih, teslim_saat, siparis_urun, urun_yazisi, siparis_tutari, notes, odeme_yontemi

*** SOHBET METNİ SIRASI (ÇOK ÖNEMLİ) ***
- Metin ESKİDEN YENİYE: ÜSTTEKİ satırlar daha ESKİ, ALTTAKİ satırlar daha YENİ; son mesaj her zaman EN ALTTA.
- "En güncel sipariş" = EN ALT kısımdaki (en yeni) [Müşteri] mesajlarıdır. Yukarı çıktıkça genelde önceki siparişlere girilir; oradan veri alma (aşağıdaki istisna hariç).

KRİTİK: AKTİF SİPARİŞ
- ALTTAN (en yeni satırlardan) başla, YUKARI (eskiye) doğru oku.
- Sadece bu EN GÜNCEL sipariş konuşmasını forma yansıt.
- Metnin üst kısmındaki eski siparişleri forma taşıma.

AKTİF SİPARİŞ BLOĞU:
- Alttan yukarı ilerlerken [Müşteri] satırlarını topla; parça parça yazılmış bilgileri tek siparişte birleştir.
- En alttaki satırlar [Ben] olabilir; hemen üstündeki [Müşteri] satırları yine aynı güncel diyaloğun parçasıdır (sipariş verisi yine müşteriden).
- Aynı alan için hem üstte hem altta değer varsa ALTTAKİ (daha yeni) geçerlidir.
- Müşteri şu şekilde yazabilir (farklı mesajlarda):
  "mustafa" / "yarın 2de" / "iç çumra" / "telefonu yok"
→ bunlar TEK sipariştir, birleştir.

DURMA KURALI:
- Yukarı (eskiye) çıkarken yalnızca bariz BAŞKA siparişe geçildiğini görürsen DUR (farklı ürün+farklı adres+farklı gün gibi).
- Kısa ara mesajlar, tek satırlık cevaplar, parça parça yazılmış bilgi → hâlâ aynı güncel sipariş sayılır; çok erken durma.
- O satırın üstündeki (daha eski) mesajlardan veri alma.

ESKİ SİPARİŞLERİ DIŞLA:
- Eski tarihleri kullanma
- Eski kişileri kullanma
- Eski adresleri kullanma
- Eski ürünleri kullanma
- Eski notları kullanma
- Sadece en güncel sipariş

ÖNCEKİ GÜN BÖLÜMÜ (kullanıcı mesajında "BÖLÜM 2" varsa):
- Müşteri siparişi günler arası parça parça yazabilir: örn. dün teslim adresi/ad soyad/ürün, bugün "yarın öğlen gönderin" veya eksik kalan parça.
- ÖNCELİK her zaman BÖLÜM 1 (en son gün / son konuşma; Bölüm 1 içinde de üst eski, alt yeni). BÖLÜM 1'de bir alan boş veya belirsizse, BÖLÜM 2'de (dün veya birkaç gün önce müşteri mesajları) AYNI siparişe devam ediyormuş gibi net bilgi varsa o alanı doldur.
- BÖLÜM 2'den veri alırken haftalar/aylar önceki bariz BAŞKA siparişi karıştırma; yalnızca mantıksal devam (aynı teslim kişisi/adres çizgisi, aynı ürün konusu) ise birleştir.

SADECE şu durumlarda (BÖLÜM 1 içinde) eski mesajdan veri alınır:
- "aynı adres"
- "yine oraya"
- "geçen seferki gibi"
- "bundan da yap"
→ açık bağ varsa

GENEL KURALLAR:
- Sadece [Müşteri] satırlarından sipariş verisi çıkar.
- [Ben] satırları sipariş alanı doldurmak için kullanılmaz (yalnızca bağlam).
- Yazım hatalarını düzelt; anlamı koru.
- Aktif blokta müşteri net ifade ettiyse alanı doldur.
- FORM DOLDURMA: Müşteri bir şey yazdıysa ilgili JSON alanını doldur; tek satır şüpheli diye diğer net alanları (ürün, adres, isim, saat vb.) boş bırakma. Eski siparişe karıştığını düşündüğün tek bir parçayı boş bırakabilirsin, ama en alttaki güncel mesajlardaki açık bilgiyi kaçırma.

ALAN KURALLARI:

musteri_isim_soyisim:
- Net değilse boş

siparis_veren_telefon:
- HER ZAMAN ""

teslim_kisisi:
- Mümkünse AD + SOYAD birlikte (sohbette geçtiği gibi). Soyad aynı veya komşu satırda geçiyorsa mutlaka birleştir.
- Sohbette yalnızca ad var, soyad hiç yoksa: adı yine de yaz (alanı boş bırakma); çiçekçi eksikse tamamlatır.
- Kurum/salon/hastane vb. ise kurum adını yaz.
- İl / ilçe / mahalle ASLA yazılmaz
- "çumra", "iç çumra", "meydan mah" → YASAK
- Sohbette tam ad soyad yazılıyken eksik aktarma.

teslim_kisisi_telefon:
- YALNIZCA tam 10 haneli cep: 5 ile başlar (5xx xxx xx xx). Eksik/9 hane/tahmin → "" yaz; asla eksik numara uydurma.
- +90 ve 0 kaldır; çıktıda 10 hane (API 90 ile birleştirir).
- "telefonu yok" / bilinmiyor → ""

*** ADRES ALANLARINI ASLA BİRBİRİNE KARIŞTIRMA (ÇOK ÖNEMLİ) ***
Her parça YALNIZCA bir alana gider. Aynı cümleyi il, ilçe, mahalle ve açık adrese KOPYALAMA.

HİYERARŞİ (büyükten küçüğe):
1) teslim_il = Türkiye il adı (81 ilden biri: Konya, Ankara, İstanbul…). Yalnızca il düzeyi.
2) teslim_ilce = İlçe adı (Çumra, Selçuklu, Kadıköy…). İl değil, mahalle değil.
3) teslim_mahalle = Mahalle, semt, köy yerleşim adı (İçeri Çumra, Meydan Mah., Yeni Mahalle…).
4) teslim_acik_adres = Cadde/sokak/bulvar adı + kapı/no + apartman/site/daire/kat + kısa tarif.

"SİPARİŞİ NEREDEN VERİYORUM" ≠ TESLİM YERİ:
- "Ankara'dan sipariş veriyorum", "X şehrinden arıyorum" → müşterinin bulunduğu / aradığı yer; teslim_il olarak yazma.
- Teslim_il / ilçe / mahalle = çiçeğin TESLİM EDİLECEĞİ adres parçaları.
- Müşteri sadece "Ankara'dan" der, teslim adresi başka şehirdeyse: teslim_il için Ankara kullanma; teslim satırlarına göre doldur.

İLÇE ↔ MAHALLE ↔ SOKAK AYIRIMI:
- "İçeri çumra", "iç çumra" → genelde mahalle/semt adı → teslim_mahalle. teslim_ilce olarak "İçeri Çumra" yazma.
- İlçe adı bilinen bir yer (örn. Çumra) ve mahalle farklı ifade edildiyse: teslim_ilce = Çumra, teslim_mahalle = İçeri Çumra (veya normalize edilmiş mahalle adı).
- Sokak/cadde adı başka bir şehir veya ilçe adıyla aynı olsa bile: o satır teslim_acik_adres içindedir.
  Örnek: "Karaman sokak no 4" → teslim_acik_adres = "Karaman Sokak No 4". teslim_ilce veya teslim_il ASLA "Karaman" olmaz (Karaman ayrı ildir; burada sokak adı).
- "Ankara caddesi", "İstanbul bulvarı" → teslim_acik_adres; teslim_il Ankara/İstanbul yapma.

TEKRAR YASAK:
- teslim_ilce alanına yazdığın kelimeyi teslim_mahalle alanına tekrar yazma.
- Mahalle ve ilçeyi teslim_acik_adres içinde tekrar etme (sadece sokak-no-tarif).

BİLİNEN EŞLEŞME (emin olduğunda):
- Çumra ilçesi → bağlı olduğu il genelde Konya → teslim_il "Konya", teslim_ilce "Çumra" (müşteri teslimi bu bölgeye söylüyorsa).
- Emin değilsen veya çelişki varsa il alanını boş bırak; uydurma il yazma.

teslim_il:
- Yalnızca kesin il adı. Şüphede "".

teslim_ilce:
- Yalnızca ilçe. Sokak adı, mahalle adı, kişi adı yazma.

teslim_mahalle:
- Yalnızca mahalle/semt. "sokak", "cadde", "no" içeren ifadeler buraya değil; açık adrese.

teslim_acik_adres:
- Sokak/cadde + numara + bina tarifi. İl/ilçe/mahalle isimlerini buraya tekrar yazma.

teslim_tarih:
- Format: YYYY-MM-DD. Referans takvim: Türkiye saati (İstanbul); kullanıcı mesajındaki bugün/yarın bu takvime göre.
- KRİTİK — BUGÜN / YARIN KARIŞMASIN:
  • Müşteri teslim için "bugün", "bu gün", "bugüne", "aynı gün", "şimdi/hemen/acil bugün" vb. yazdıysa teslim_tarih = REFERANSTAKİ bugün tarihi (user mesajındaki todayTr ile AYNI gün). ASLA bir gün sonraya kaydırma; sipariş için "bugün" = 18.03 ise 19.03 yazma.
  • "Yarın" / "yarına" / "yarınki" YALNIZCA müşteri açıkça yarın teslim istediğinde → referanstaki yarın (bugün+1 gün).
  • En alttaki (en yeni) müşteri satırı bugün teslim diyorsa, üstteki eski satırlarda veya çiçekçi cevabında geçen "yarın" kelimesi teslim gününü yarın yapamaz.
  • Çelişki: altta "bugün", üstte "yarın" → ALTTAKİ (daha yeni) ne diyorsa onu kullan.
- SADECE gün açıkça varsa doldur
- "yarın teslim", "yarına", sipariş bağlamında "yarın" + saat, "2 gün sonra", "15 mart" → OK (müşteri net yarın dediyse)
- "yarın ararım", "bugün müsait misiniz" gibi genel sohbet → teslim günü DEĞİL; teslim_tarih yazma
- SADECE saat varsa → ""

teslim_saat:
- Format: HH:MM
- "öğlen 2" → 14:00
- "akşam 7" → 19:00
- "sabah 10" → 10:00
- "yarın 2de" → 14:00
- "14:30" → 14:30
- Belirsizse → ""

siparis_urun:
- Ürün adı${urunKurali}

urun_yazisi:
- Sadece yazılacak metin
- "not olarak", "yazalım" gibi kısımları çıkar
- Örn:
  "not olarak seni seviyorum yazalım"
  → "Seni seviyorum."

siparis_tutari:
- Genelde ""

odeme_yontemi:
- Sadece açıkça yazılmışsa

notes:
- Diğer alanlara girmeyen önemli bilgiler
- Örn:
  "telefonu yok"
  "düğün için"
  "kapıda arasın"

ÖZEL DURUMLAR:
- Örnek ayrıştırma: "Ankara'dan sipariş" + "içeri çumraya göndereceğim" + "karaman sokak no4"
  → teslim_il: "Konya" (Çumra ilçesi Konya'ya bağlı; teslim bu bölgeye)
  → teslim_ilce: "Çumra"
  → teslim_mahalle: "İçeri Çumra"
  → teslim_acik_adres: "Karaman Sokak No 4"
  → "Ankara'dan" teslim_il değildir.

- "Ayşe Yılmaz için gönderin" / "teslim: Mehmet Kaya" / müşteri "Zeynep" sonra "Demir" (aynı sipariş)
  → teslim_kisisi tam ad soyad: "Ayşe Yılmaz", "Mehmet Kaya", "Zeynep Demir"
- "mustafa örneğin düğünü" (örnek değil gerçek isim değilse)
  → teslim_kisisi "" veya sohbette başka satırda tam isim varsa o; "örneğin" soyad değildir

- "yarın 2de"
  → tarih + saat

- "öğlen 3"
  → sadece saat

- "akşam 7de"
  → sadece saat

- "telefonu bende yok"
  → telefon ""

SON KURAL:
- Metnin ÜST kısmındaki (daha eski) siparişten bilgi taşıma; alttaki güncel siparişi önceliklendir.
- Şüpheli tek alanı boş bırakabilirsin; ama ürün/adres/isim açıkça yazılmışsa mutlaka yaz.
- Sadece JSON döndür.`;
}

/**
 * POST /api/whatsapp/sohbetten-siparis-analiz — user mesajı
 * @param {string} todayTr YYYY-MM-DD (Europe/Istanbul)
 * @param {string} conversationText Bölüm 1 (son konuşma)
 * @param {string} [previousDaysCustomerText] Bölüm 2 — bugünden önceki günlerin müşteri satırları
 */
function buildSohbettenSiparisAnalizUserPrompt(todayTr, conversationText, previousDaysCustomerText) {
    const max1 = previousDaysCustomerText && String(previousDaysCustomerText).trim() ? 7800 : MAX_SIPARIS_ANALIZ_CHARS;
    const body1 = String(conversationText || '').substring(0, max1);
    let out = `REFERANS (Türkiye saati): Bugünün tarihi = ${todayTr}. Yarın = bu tarihten 1 gün sonrası, "2 gün sonra" = 2 gün sonrası (YYYY-MM-DD olarak yaz).

=== BÖLÜM 1 — SON KONUŞMA (öncelik; en yeni altta, yukarı çıktıkça eski) ===
SOHBET SATIR SIRASI: Son satır = en yeni mesaj.

${body1}`;

    const p2 = String(previousDaysCustomerText || '').trim();
    if (p2) {
        const body2 = p2.substring(0, Math.min(4200, MAX_SIPARIS_ANALIZ_CHARS - max1));
        out += `

=== BÖLÜM 2 — BUGÜNDEN ÖNCEKİ GÜNLER (yalnızca [Müşteri] mesajları) ===
Bunlar dün veya son birkaç günde müşterinin yazdıklarıdır. Bölüm 1'de eksik kalan alanlar (adres, teslim kişisi, ürün, telefon, not vb.) burada geçiyorsa ve bariz başka sipariş değilse forma ekle. Bugün yazılan ile birleştir: tek sipariş.

${body2}`;
    }

    out += `

Aşağıdaki tüm metinden sipariş alanlarını çıkar ve yalnızca JSON döndür.`;
    return out;
}

/** Sipariş onay analizinde zorunlu alan anahtarları (sıra önemli değil; liste tutarlı kalsın) */
const SIPARIS_ONAY_REQUIRED_FIELD_KEYS = [
    'siparis_urun',
    'teslim_kisisi',
    'teslim_kisisi_telefon',
    'teslim_il',
    'teslim_ilce',
    'teslim_mahalle',
    'teslim_acik_adres',
    'teslim_tarih',
    'teslim_saat',
];

/**
 * POST /api/whatsapp/siparis-onay-analiz — system mesajı
 * @param {string} phase 'final_approval' | diğer
 */
function buildSiparisOnayAnalizSystemPrompt(phase) {
    const phaseHint =
        phase === 'final_approval'
            ? 'Bu aşama SON ONAY: Müşteri evet/onaylıyorum/tamam/doğru/teşekkürler/olur/uygun/kabul/sağol gibi olumlu veya teşekkür ifadesi kullandıysa ve açıkça itiraz ETMEDİYSE status="approved" dön. Sadece hayır, yanlış, iptal, onaylamıyorum, vazgeç, düzelt, değiştir gibi NET itiraz varsa rejected/needs_info.'
            : 'Bu aşama BİLGİ TOPLAMA aşaması: eksikleri doldurmaya odaklan; müşteri itiraz ederse rejected/needs_info.';
    return `Sen bir sipariş asistanısın. Amaç: müşterinin son mesajlarını okuyup siparişin durumunu anlamak ve eksik bilgileri tespit etmek.
Sadece geçerli JSON döndür.

ÇIKTI ŞEMASI:
{
  "status": "approved" | "rejected" | "needs_info" | "unclear",
  "customer_message": "müşterinin son cevabının kısa özeti",
  "fields_patch": { "siparis_urun": "...", "teslim_il": "...", ... },
  "missing_fields": ["teslim_il", "teslim_saat", ...],
  "reason": "kısa gerekçe"
}

KURALLAR:
- Açık itiraz: hayır, yanlış, iptal, onaylamıyorum, vazgeç, istemiyorum, düzelt(ün), değiştir → rejected veya needs_info; approved verme.
- Olumlu / memnuniyet: evet, tamam, onay, onaylıyorum, olur, doğru, uygun, kabul, teşekkürler, sağol, eyvallah, mükemmel, tamamdır, 👍 vb. ve zorunlu alanlar doluysa SON ONAY aşamasında approved.
- Müşteri kısa teşekkür veya onay cümlesi yazdıysa unclear verme; zorunlu alanlar doluysa approved dön.
- Mevcut alanlar (currentFields) zaten doluysa tekrar isteme; boş/eksik olanları missing_fields'e koy.
- fields_patch sadece müşterinin cevabından güvenle çıkarabildiğin alanları içersin; uydurma yapma.
- Müşteri mesajında teslim edilecek kişi adı veya telefon geçiyorsa MUTLAKA fields_patch.teslim_kisisi ve/veya teslim_kisisi_telefon olarak yaz (currentFields boşsa veya eksikse doldur).
- teslim_kisisi gerçek kişiyse ad+soyad birlikte olmalı. Sohbette tam ad soyad zaten yazılmışsa missing_fields'e koyma — fields_patch ile tam adı yaz. Yalnızca soyad hiç yoksa missing_fields'e teslim_kisisi ekle (çiçekçi sorabilsin).
- teslim_tarih: YALNIZCA müşteri teslim gününü açıkça söylediyse doldur (yarın, N gün sonra, kesin tarih). Sadece saat ifadesi varsa teslim_tarih yazma / boş bırak.
- teslim_saat alanını mümkünse daima 24 saat formatında "HH:MM" döndür. Her satırda saat ara (akşam 6, öğlen 2, 14, 14:30, saat 16 vb.).
- teslim_mahalle: Kelimeler ayrı yazılmış olabilir (örn. "içeri çumra"); birleştirerek resmi mahalleye yaklaştır.
- urun_yazisi ve teslim_acik_adres alanlarını yazım kurallarına göre düzelt. urun_yazisi: baştaki not kalıpları ve sondaki yazalım/yazın/bu şekilde/gibi gibi talimat eklerini çıkar; sadece kart metni kalsın.
- Sadece [Müşteri] ile başlayan satırlardan müşteri beyanını ve yeni bilgileri çıkar; [Biz] ile başlayan satırlar (işletmenin yazdıkları) sadece referans içindir, sipariş verisi kaynağı OLMAZ.
- siparis_veren_telefon ve siparis_tutari ASLA missing_fields listesine ekleme (telefon WhatsApp sohbetinden, tutarı çiçekçi belirler).
${phaseHint}
`;
}

/**
 * POST /api/whatsapp/siparis-onay-analiz — user mesajı
 */
function buildSiparisOnayAnalizUserPrompt(currentFields, convo, requiredKeys = SIPARIS_ONAY_REQUIRED_FIELD_KEYS) {
    const keys = Array.isArray(requiredKeys) && requiredKeys.length ? requiredKeys : SIPARIS_ONAY_REQUIRED_FIELD_KEYS;
    const snippet = String(convo || '').substring(0, MAX_SIPARIS_ONAY_CHARS);
    return `Mevcut form alanları (currentFields):\n${JSON.stringify(currentFields || {}, null, 2)}\n\nZorunlu alan anahtarları:\n${keys.join(', ')}\n\nSohbet:\n${snippet}`;
}

module.exports = {
    buildSohbettenSiparisAnalizSystemPrompt,
    buildSohbettenSiparisAnalizUserPrompt,
    buildSiparisOnayAnalizSystemPrompt,
    buildSiparisOnayAnalizUserPrompt,
    SIPARIS_ONAY_REQUIRED_FIELD_KEYS,
    MAX_SIPARIS_ANALIZ_CHARS,
    MAX_SIPARIS_ONAY_CHARS,
};
