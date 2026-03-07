/**
 * Fatura HTML → PDF dönüştürme (Puppeteer ile).
 * Oluşan PDF dosyası verilen yola yazılır; veritabanında pdf_yolu doldurulabilir.
 */

const fs = require('fs');
const path = require('path');

let puppeteer = null;
function getPuppeteer() {
    if (puppeteer === null) {
        try {
            puppeteer = require('puppeteer');
        } catch (e) {
            console.warn('⚠️ Puppeteer yüklü değil; fatura PDF üretimi atlanacak. Yüklemek için: npm install puppeteer');
            return null;
        }
    }
    return puppeteer;
}

/**
 * HTML içeriğini PDF dosyasına yazar.
 * @param {string} html - Fatura HTML
 * @param {string} outputAbsolutePath - PDF dosyasının tam yolu (örn. .../uploads/tenants/1/invoices/FLV-....pdf)
 * @returns {Promise<boolean>} Başarılı ise true, Puppeteer yoksa veya hata olursa false
 */
async function generateInvoicePdfFromHtml(html, outputAbsolutePath) {
    const pptr = getPuppeteer();
    if (!pptr) return false;

    let browser;
    try {
        const dir = path.dirname(outputAbsolutePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        browser = await pptr.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--single-process'
            ]
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'load', timeout: 15000 });
        await page.pdf({
            path: outputAbsolutePath,
            format: 'A4',
            printBackground: true,
            margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
        });
        await browser.close();
        return true;
    } catch (err) {
        if (browser) try { await browser.close(); } catch (_) {}
        console.error('❌ Fatura PDF oluşturulamadı:', err?.message || err);
        return false;
    }
}

module.exports = {
    generateInvoicePdfFromHtml,
    getPuppeteer
};
