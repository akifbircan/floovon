/**
 * fatura-sablon-floovon – Abonelik faturaları (Floovon → çiçekçi)
 * HTML: D:\FLOOVON\sablonlar\fatura-sablon-floovon.html
 * CSS: D:\FLOOVON\css\fatura-sablon-floovon.css
 * PDF: backend/utils/tenant-fatura-pdf.js
 */

const fs = require('fs');
const path = require('path');

const SABLON_HTML_PATH = path.join(__dirname, '..', '..', 'sablonlar', 'fatura-sablon-floovon.html');

let invoiceStyles = null;
function getInvoiceStyles() {
    if (invoiceStyles === null) {
        const cssPath = path.join(__dirname, '..', '..', 'css', 'fatura-sablon-floovon.css');
        try {
            invoiceStyles = fs.readFileSync(cssPath, 'utf8');
        } catch (error) {
            console.error('❌ fatura-sablon-floovon CSS okunamadı:', cssPath, error);
            invoiceStyles = '';
        }
    }
    return invoiceStyles;
}

function generateFromSablonFile(params) {
    const {
        faturaNo,
        faturaTarihi,
        odemeTarihi,
        company_name,
        address = '',
        city = '',
        state = '',
        tenantInfo = null,
        itemDescription,
        itemDescriptionDetail = '',
        araToplam,
        kdvTutari,
        toplamTutar,
        kdvOrani = 20
    } = params;

    const faturaTarihiStr = new Date(faturaTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
    const odemeTarihiHTML = odemeTarihi
        ? `<div class="invoice-date">Ödeme Tarihi: ${new Date(odemeTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>`
        : '';
    const addressHTML = address ? `<p>${address}</p>` : '';
    let taxInfoHTML = '';
    if (tenantInfo && tenantInfo[0]) {
        if (tenantInfo[0].tax_office) taxInfoHTML += `<p><strong>Vergi Dairesi:</strong> ${tenantInfo[0].tax_office}</p>`;
        if (tenantInfo[0].tax_number) taxInfoHTML += `<p><strong>Vergi No:</strong> ${tenantInfo[0].tax_number}</p>`;
    }
    const itemDescriptionDetailHTML = itemDescriptionDetail ? `<div class="item-description">${itemDescriptionDetail}</div>` : '';
    const araToplamFormatted = (araToplam / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺';
    const kdvTutariFormatted = (kdvTutari / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺';
    const toplamTutarFormatted = (toplamTutar / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺';
    const currentYear = new Date().getFullYear();

    const replacements = {
        '{{faturaNo}}': faturaNo,
        '{{invoiceStyles}}': getInvoiceStyles(),
        '{{faturaTarihi}}': faturaTarihiStr,
        '{{odemeTarihiHTML}}': odemeTarihiHTML,
        '{{company_name}}': company_name,
        '{{addressHTML}}': addressHTML,
        '{{state}}': state || '',
        '{{city}}': city || '',
        '{{taxInfoHTML}}': taxInfoHTML,
        '{{itemDescription}}': itemDescription,
        '{{itemDescriptionDetailHTML}}': itemDescriptionDetailHTML,
        '{{araToplamFormatted}}': araToplamFormatted,
        '{{kdvOrani}}': String(kdvOrani),
        '{{kdvTutariFormatted}}': kdvTutariFormatted,
        '{{toplamTutarFormatted}}': toplamTutarFormatted,
        '{{currentYear}}': String(currentYear)
    };

    let html = fs.readFileSync(SABLON_HTML_PATH, 'utf8');
    for (const [key, value] of Object.entries(replacements)) {
        html = html.split(key).join(value);
    }
    return html;
}

function generateInvoiceHtml(params) {
    const {
        faturaNo,
        faturaTarihi,
        odemeTarihi,
        company_name,
        address = '',
        city = '',
        state = '',
        tenantInfo = null,
        itemDescription,
        itemDescriptionDetail = '',
        araToplam,
        kdvTutari,
        toplamTutar,
        kdvOrani = 20
    } = params;

    if (fs.existsSync(SABLON_HTML_PATH)) {
        try {
            return generateFromSablonFile(params);
        } catch (err) {
            console.warn('⚠️ sablonlar/fatura-sablon-floovon.html okunamadı, inline kullanılıyor:', err.message);
        }
    }

    return `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <title>Fatura - ${faturaNo}</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <style>${getInvoiceStyles()}</style>
        </head>
        <body>
            <div class="invoice-container">
                <div class="invoice-header">
                    <div class="invoice-header-left">
                        <h1>Fatura</h1>
                        <div class="invoice-number-badge">Fatura No: ${faturaNo}</div>
                        <div class="invoice-date">Fatura Tarihi: ${new Date(faturaTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                        ${odemeTarihi ? `<div class="invoice-date">Ödeme Tarihi: ${new Date(odemeTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>` : ''}
                    </div>
                </div>
                <div class="invoice-info-section">
                    <div class="invoice-info-box">
                        <h3>FATURA EDEN</h3>
                        <p><strong>Floovon İnternet Teknolojileri</strong></p>
                        <p>Fetih Mah. Ahmet Hamdi Göğüş Cad. 231/A</p>
                        <p>42030 Karatay/KONYA</p>
                    </div>
                    <div class="invoice-info-box">
                        <h3>Fatura Edilen</h3>
                        <p><strong>${company_name}</strong></p>
                        ${address ? `<p>${address}</p>` : ''}
                        <p>${state || ''} / ${city || ''}</p>
                        ${tenantInfo && tenantInfo[0] && tenantInfo[0].tax_office ? `<p><strong>Vergi Dairesi:</strong> ${tenantInfo[0].tax_office}</p>` : ''}
                        ${tenantInfo && tenantInfo[0] && tenantInfo[0].tax_number ? `<p><strong>Vergi No:</strong> ${tenantInfo[0].tax_number}</p>` : ''}
                    </div>
                </div>
                <table>
                    <thead><tr><th>Açıklama</th><th>Tutar</th></tr></thead>
                    <tbody>
                        <tr>
                            <td>${itemDescription}${itemDescriptionDetail ? `<div class="item-description">${itemDescriptionDetail}</div>` : ''}</td>
                            <td>${(araToplam / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                        </tr>
                    </tbody>
                </table>
                <div class="invoice-totals">
                    <div class="invoice-totals-row"><span>Ara Toplam</span><span>${(araToplam / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span></div>
                    <div class="invoice-totals-row"><span>KDV (%${kdvOrani})</span><span>${(kdvTutari / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span></div>
                    <div class="invoice-totals-row total"><span>Toplam Tutar</span><span>${(toplamTutar / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span></div>
                </div>
                <div class="invoice-footer">
                    <p>Bu fatura elektronik ortamda oluşturulmuştur.</p>
                    <p class="copyright">Floovon © ${new Date().getFullYear()}</p>
                </div>
            </div>
        </body>
        </html>
    `;
}

module.exports = {
    generateInvoiceHtml,
    getInvoiceStyles,
    SABLON_HTML_PATH
};
