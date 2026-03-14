/**
 * fatura-sablon-musteri – Çiçekçi → Müşteri faturaları
 * Layout: Sol = işletme bilgileri, Orta = Maliye il kodu amblemi (opsiyonel), Sağ = FATURA + No/Tarih
 * Tablo: AÇIKLAMA, ADET, TUTAR. Alt: BANKA HESAP BİLGİLERİ, Not.
 */

const fs = require('fs');
const path = require('path');

const SABLON_HTML_PATH = path.join(__dirname, '..', '..', 'sablonlar', 'fatura-sablon-musteri.html');

let invoiceStyles = null;
function getMusteriInvoiceStyles() {
    if (invoiceStyles === null) {
        const cssPath = path.join(__dirname, '..', '..', 'css', 'fatura-sablon-musteri.css');
        try {
            invoiceStyles = fs.readFileSync(cssPath, 'utf8');
        } catch (error) {
            console.error('❌ fatura-sablon-musteri CSS okunamadı:', cssPath, error);
            invoiceStyles = '';
        }
    }
    return invoiceStyles;
}

/**
 * Format kurus to TL string
 */
function formatKurus(kurus) {
    return (Number(kurus) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺';
}

/**
 * Çiçekçi → müşteri fatura HTML üretir.
 * params.satirlar: [{ aciklama, adet, tutarKurus, birimFiyatKurus? }] – tablo satırları (birimFiyatKurus yoksa tutarKurus/adet)
 * params.banka_hesaplari: [{ banka_adi, iban, sube, hesap_sahibi, aciklama }]
 * params.fatura_not: faturanın en altındaki not metni
 * params.amblem_data_url: opsiyonel Maliye Bakanlığı il kodu amblemi (data URL)
 */
function generateMusteriInvoiceHtml(params) {
    const {
        faturaNo,
        faturaTarihi,
        satici_unvan = '',
        satici_adres = '',
        satici_il = '',
        satici_ilce = '',
        satici_vergi_dairesi = '',
        satici_vergi_no = '',
        satici_logo_data_url = '',
        alici_unvan = '',
        alici_adres = '',
        alici_il = '',
        alici_ilce = '',
        alici_vergi_dairesi = '',
        alici_vergi_no = '',
        satirlar = null,
        itemDescription = 'Mal / Hizmet satışı',
        araToplam = 0,
        kdvTutari = 0,
        toplamTutar = 0,
        kdvOrani = 20,
        banka_hesaplari = [],
        fatura_not = '',
        amblem_data_url = ''
    } = params;

    const faturaTarihiStr = new Date(faturaTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

    // Sol: İşletme bilgileri
    const saticiAddressHTML = satici_adres ? `<p>${satici_adres}</p>` : '';
    let saticiVergiHTML = '';
    if (satici_vergi_dairesi) saticiVergiHTML += `<p><strong>Vergi Dairesi:</strong> ${satici_vergi_dairesi}</p>`;
    if (satici_vergi_no) saticiVergiHTML += `<p><strong>Vergi No:</strong> ${satici_vergi_no}</p>`;

    // Orta: Amblem (opsiyonel)
    const amblemHTML = amblem_data_url
        ? `<img src="${amblem_data_url}" alt="Maliye Bakanlığı İl Kodu" class="musteri-amblem" />`
        : '';

    // Sağ: Logo (opsiyonel) – artık sağda sadece FATURA başlığı ve no/tarih; logo üstte orta/sağa konabilir veya kaldırılır. Kullanıcı isteği: "FATURA başlığı ve altındakiler sağda" – logo da sağda kalabilir, başlığın üstünde.
    const saticiLogoHTML = satici_logo_data_url
        ? `<img src="${satici_logo_data_url}" alt="" class="musteri-header-logo" />`
        : '';

    // Alıcı (SAYIN)
    const aliciAddressHTML = alici_adres ? `<p>${alici_adres}</p>` : '';
    let aliciVergiHTML = '';
    if (alici_vergi_dairesi) aliciVergiHTML += `<p><strong>Vergi Dairesi:</strong> ${alici_vergi_dairesi}</p>`;
    if (alici_vergi_no) aliciVergiHTML += `<p><strong>Vergi No:</strong> ${alici_vergi_no}</p>`;

    // Tablo satırları: AÇIKLAMA, ADET, BİRİM FİYAT, TUTAR
    let rows = Array.isArray(satirlar) && satirlar.length > 0
        ? satirlar
        : [{ aciklama: itemDescription, adet: 1, tutarKurus: Number(araToplam) }];
    const tableRowsHTML = rows.map(r => {
        const adet = r.adet != null ? Number(r.adet) : 1;
        const tutarKurus = r.tutarKurus != null ? Number(r.tutarKurus) : 0;
        const birimFiyatKurus = r.birimFiyatKurus != null ? Number(r.birimFiyatKurus) : (adet ? Math.round(tutarKurus / adet) : 0);
        return `<tr><td>${(r.aciklama || '').toString().replace(/</g, '&lt;')}</td><td class="musteri-td-center">${adet}</td><td class="musteri-td-right">${formatKurus(birimFiyatKurus)}</td><td class="musteri-td-right">${formatKurus(tutarKurus)}</td></tr>`;
    }).join('');

    const araToplamFormatted = formatKurus(araToplam);
    const kdvTutariFormatted = formatKurus(kdvTutari);
    const toplamTutarFormatted = formatKurus(toplamTutar);
    const currentYear = new Date().getFullYear();

    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    // Banka hesapları HTML – her hesap 3 satır: "Banka · Şube: X" / "IBAN: ..." / "Hesap Sahibi: ... · Not"
    // Hiç hesap yoksa başlık dahil tüm bölüm gizlenir ({{bankaSectionHTML}} boş)
    let bankaHTML = '';
    if (Array.isArray(banka_hesaplari) && banka_hesaplari.length > 0) {
        bankaHTML = banka_hesaplari.map(b => {
            const line1 = [b.banka_adi, b.sube ? `Şube: ${b.sube}` : ''].filter(Boolean).join(' · ');
            const line2 = b.iban ? `IBAN: ${b.iban}` : '';
            const line3 = [b.hesap_sahibi ? `Hesap Sahibi: ${b.hesap_sahibi}` : '', b.aciklama ? b.aciklama : ''].filter(Boolean).join(' · ');
            const parts = [];
            if (line1) parts.push(`<div class="musteri-banka-line musteri-banka-adi">${escapeHtml(line1)}</div>`);
            if (line2) parts.push(`<div class="musteri-banka-line">${escapeHtml(line2)}</div>`);
            if (line3) parts.push(`<div class="musteri-banka-line">${escapeHtml(line3)}</div>`);
            return parts.length ? `<div class="musteri-banka-item">${parts.join('')}</div>` : '';
        }).filter(Boolean).join('');
    }
    const bankaSectionHTML = bankaHTML
        ? `<div class="musteri-banka-section"><h4>BANKA HESAP BİLGİLERİ</h4>${bankaHTML}</div>`
        : '';

    const replacements = {
        '{{faturaNo}}': String(faturaNo),
        '{{invoiceStyles}}': getMusteriInvoiceStyles(),
        '{{faturaTarihi}}': faturaTarihiStr,
        '{{saticiLogoHTML}}': saticiLogoHTML,
        '{{satici_unvan}}': satici_unvan,
        '{{saticiAddressHTML}}': saticiAddressHTML,
        '{{satici_il}}': satici_il,
        '{{satici_ilce}}': satici_ilce,
        '{{satici_il_ilce}}': [satici_il, satici_ilce].filter(Boolean).join(' / ') || '',
        '{{saticiVergiHTML}}': saticiVergiHTML,
        '{{amblemHTML}}': amblemHTML,
        '{{alici_unvan}}': alici_unvan,
        '{{aliciAddressHTML}}': aliciAddressHTML,
        '{{alici_il}}': alici_il,
        '{{alici_ilce}}': alici_ilce,
        '{{alici_il_ilce}}': [alici_il, alici_ilce].filter(Boolean).join(' / ') || '',
        '{{aliciVergiHTML}}': aliciVergiHTML,
        '{{tableRowsHTML}}': tableRowsHTML,
        '{{araToplamFormatted}}': araToplamFormatted,
        '{{kdvOrani}}': String(kdvOrani),
        '{{kdvTutariFormatted}}': kdvTutariFormatted,
        '{{toplamTutarFormatted}}': toplamTutarFormatted,
        '{{currentYear}}': String(currentYear),
        '{{bankaHTML}}': bankaHTML,
        '{{bankaSectionHTML}}': bankaSectionHTML,
        '{{fatura_not}}': (fatura_not || '').toString().replace(/</g, '&lt;').replace(/\n/g, '<br/>')
    };

    if (fs.existsSync(SABLON_HTML_PATH)) {
        try {
            let html = fs.readFileSync(SABLON_HTML_PATH, 'utf8');
            for (const [key, value] of Object.entries(replacements)) {
                html = html.split(key).join(value);
            }
            return html;
        } catch (err) {
            console.warn('⚠️ fatura-sablon-musteri.html okunamadı, inline kullanılıyor:', err.message);
        }
    }

    return `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <title>Fatura - ${faturaNo}</title>
            <style>${getMusteriInvoiceStyles()}</style>
        </head>
        <body>
            <div class="musteri-invoice">
                <header class="musteri-invoice-header">
                    <div class="musteri-header-left">
                        ${saticiLogoHTML}
                        <p class="musteri-header-unvan">${satici_unvan}</p>
                        ${saticiAddressHTML}
                        <p class="musteri-party-place">${satici_il}${satici_ilce ? ' / ' + satici_ilce : ''}</p>
                        ${saticiVergiHTML}
                    </div>
                    <div class="musteri-header-center">${amblemHTML}</div>
                    <div class="musteri-header-right">
                        <h1>FATURA</h1>
                        <p class="musteri-fatura-no">Fatura No: ${faturaNo}</p>
                        <p class="musteri-fatura-tarih">Fatura Tarihi: ${faturaTarihiStr}</p>
                    </div>
                </header>
                <section class="musteri-parties">
                    <div class="musteri-party musteri-buyer">
                        <h3>SAYIN</h3>
                        <p class="musteri-party-name">${alici_unvan}</p>
                        ${aliciAddressHTML}
                        <p class="musteri-party-place">${alici_il}${alici_ilce ? ' / ' + alici_ilce : ''}</p>
                        ${aliciVergiHTML}
                    </div>
                </section>
                <table class="musteri-items">
                    <thead><tr><th>Açıklama</th><th class="musteri-th-center">Adet</th><th class="musteri-th-right">Birim Fiyat</th><th class="musteri-th-right">Tutar</th></tr></thead>
                    <tbody>${tableRowsHTML}</tbody>
                </table>
                <div class="musteri-totals">
                    <div class="musteri-totals-row"><span>Ara Toplam</span><span>${araToplamFormatted}</span></div>
                    <div class="musteri-totals-row"><span>KDV (%${kdvOrani})</span><span>${kdvTutariFormatted}</span></div>
                    <div class="musteri-totals-row musteri-total"><span>Genel Toplam</span><span>${toplamTutarFormatted}</span></div>
                </div>
                ${bankaSectionHTML}
                ${fatura_not ? `<div class="musteri-not-section"><p>${(fatura_not || '').toString().replace(/</g, '&lt;').replace(/\n/g, '<br/>')}</p></div>` : ''}
                <footer class="musteri-footer">
                    <p>Bu belge elektronik ortamda oluşturulmuştur.</p>
                    <p class="musteri-footer-year">© ${currentYear}</p>
                </footer>
            </div>
        </body>
        </html>
    `;
}

module.exports = {
    generateMusteriInvoiceHtml,
    generateCicekciInvoiceHtml: generateMusteriInvoiceHtml,
    getMusteriInvoiceStyles,
    SABLON_HTML_PATH
};
