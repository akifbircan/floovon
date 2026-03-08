/**
 * Fatura HTML → PDF dönüştürme (Puppeteer ile).
 * Localhost'ta hata olursa terminalde tam mesaj görünür.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

let puppeteer = null;
function getPuppeteer() {
    if (puppeteer === null) {
        try {
            puppeteer = require('puppeteer');
        } catch (e) {
            console.error('❌ [PDF] Puppeteer yüklü değil:', e.message);
            console.error('   Çözüm: backend klasöründe "npm install puppeteer" çalıştırın.');
            return null;
        }
    }
    return puppeteer;
}

/** Windows'ta sistem Chrome yolu (Puppeteer Chromium açamazsa dene). */
function getChromePath() {
    if (os.platform() !== 'win32') return null;
    const candidates = [
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
        process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
        process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe'
    ];
    for (const p of candidates) {
        if (p && fs.existsSync(p)) return p;
    }
    return null;
}

/**
 * HTML içeriğini PDF dosyasına yazar.
 * @param {string} html - Fatura HTML
 * @param {string} outputAbsolutePath - PDF dosyasının tam yolu
 * @returns {Promise<boolean>} Başarılı ise true
 */
async function generateInvoicePdfFromHtml(html, outputAbsolutePath) {
    console.log('[PDF] Fatura PDF üretimi başlıyor:', outputAbsolutePath);

    const pptr = getPuppeteer();
    if (!pptr) {
        console.error('[PDF] Puppeteer yok, PDF atlanıyor.');
        return false;
    }

    const dir = path.dirname(outputAbsolutePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let browser;
    const launchOpts = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run'
        ]
    };

    const chromePath = getChromePath();
    if (chromePath) launchOpts.executablePath = chromePath;

    try {
        console.log('[PDF] Chromium/Chrome başlatılıyor...');
        browser = await pptr.launch(launchOpts);
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'load', timeout: 15000 });
        await page.pdf({
            path: outputAbsolutePath,
            format: 'A4',
            printBackground: true,
            margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
        });
        await browser.close();
        console.log('[PDF] PDF yazıldı:', outputAbsolutePath);
        return true;
    } catch (err) {
        if (browser) try { await browser.close(); } catch (_) {}
        console.error('❌ [PDF] HATA:', err.message);
        if (err.stack) console.error(err.stack);
        if (err.message && err.message.includes('Could not find Chrome') && !launchOpts.executablePath && getChromePath()) {
            console.error('[PDF] İpucu: Sistem Chrome bulundu, bir sonraki denemede kullanılacak.');
        }
        return false;
    }
}

module.exports = {
    generateInvoicePdfFromHtml,
    getPuppeteer
};
