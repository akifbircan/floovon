/**
 * Centralized Mail Service for Floovon
 * Tüm mail gönderimleri bu servis üzerinden yapılır
 * SPF/DKIM/DMARC uyumluluğu için from/reply-to/return-path tutarlılığı sağlar
 */

const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const mailStyles = require('./mail-teknik-destek-styles');

// Stil objesini inline style string'ine çevir
function styleToString(styles) {
    if (!styles) return '';
    return Object.entries(styles)
        .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
        .join('; ');
}

// İki stil objesini birleştir
function mergeStyles(style1, style2) {
    return { ...style1, ...style2 };
}

class MailService {
    constructor() {
        this.transporter = null; // Destek mailleri için (destek@floovon.com)
        this.noreplyTransporter = null; // Sistem mailleri için (noreply@floovon.com)
        this.initialized = false;
        this.noreplyInitialized = false;
        this.init();
    }

    /**
     * SMTP transporter'ları başlat
     * - destek@floovon.com: Teknik destek mailleri için
     * - noreply@floovon.com: Şifre sıfırlama ve sistem mailleri için
     */
    init() {
        if (this.initialized && this.noreplyInitialized) return;

        try {
            // 1. Destek mailleri için SMTP (destek@floovon.com)
            const supportSmtpConfig = {
                host: process.env.SMTP_HOST || 'smtp.hostinger.com',
                port: parseInt(process.env.SMTP_PORT) || 465,
                secure: true, // SSL için true (port 465)
                auth: {
                    user: process.env.SMTP_USER || 'destek@floovon.com',
                    pass: process.env.SMTP_PASS || ''
                }
            };

            // 2. Sistem mailleri için SMTP (noreply@floovon.com)
            // ÖNEMLİ: noreply@ için MUTLAKA SMTP_NOREPLY_USER kullanılmalı, alternatif kullanılmaz!
            // Eğer SMTP_NOREPLY_PASS boşsa, SMTP_PASS kullanılır (aynı SMTP sunucusu için)
            const noreplyPassword = process.env.SMTP_NOREPLY_PASS || process.env.SMTP_PASS || '';
            const noreplySmtpConfig = {
                host: process.env.SMTP_HOST || 'smtp.hostinger.com',
                port: parseInt(process.env.SMTP_PORT) || 465,
                secure: true,
                auth: {
                    user: process.env.SMTP_NOREPLY_USER || 'noreply@floovon.com',
                    pass: noreplyPassword
                }
            };

            const isDevelopment = process.env.NODE_ENV !== 'production' && 
                                  (!process.env.SERVER_PUBLIC_URL || 
                                   process.env.SERVER_PUBLIC_URL.includes('localhost') || 
                                   process.env.SERVER_PUBLIC_URL.includes('127.0.0.1'));
            
            if (isDevelopment) {
                console.log('🔍 Mail Service init - SMTP ayarları kontrol ediliyor...');
                console.log('📧 SMTP_HOST:', process.env.SMTP_HOST || 'YOK (varsayılan: smtp.hostinger.com)');
                console.log('📧 SMTP_PORT:', process.env.SMTP_PORT || 'YOK (varsayılan: 465)');
                console.log('📧 SMTP_USER (destek):', process.env.SMTP_USER || 'YOK (varsayılan: destek@floovon.com)');
                console.log('📧 SMTP_NOREPLY_USER:', process.env.SMTP_NOREPLY_USER || 'YOK (varsayılan: noreply@floovon.com)');
                console.log('📧 SMTP_PASS:', process.env.SMTP_PASS ? 'VAR (uzunluk: ' + process.env.SMTP_PASS.length + ')' : 'YOK');
                console.log('📧 SMTP_NOREPLY_PASS:', process.env.SMTP_NOREPLY_PASS ? 'VAR' : 'YOK (SMTP_PASS kullanılacak)');
            }

            // Destek SMTP ayarları kontrolü
            if (supportSmtpConfig.auth.user && supportSmtpConfig.auth.pass) {
                this.transporter = nodemailer.createTransport(supportSmtpConfig);
                this.initialized = true;
                if (isDevelopment) {
                    console.log('✅ Destek Mail Service başlatıldı:', supportSmtpConfig.auth.user);
                }
            } else {
                console.error('❌ Destek SMTP ayarları yapılandırılmamış');
            }

            // Noreply SMTP ayarları kontrolü
            // ÖNEMLİ: SMTP_NOREPLY_USER MUTLAKA olmalı!
            // Şifre için: SMTP_NOREPLY_PASS varsa onu kullan, yoksa SMTP_PASS'i kullan
            if (process.env.SMTP_NOREPLY_USER && noreplyPassword) {
                this.noreplyTransporter = nodemailer.createTransport(noreplySmtpConfig);
                this.noreplyInitialized = true;
                if (isDevelopment) {
                    console.log('✅ Noreply Mail Service başlatıldı:', process.env.SMTP_NOREPLY_USER);
                    console.log('📧 Noreply şifre kaynağı:', process.env.SMTP_NOREPLY_PASS ? 'SMTP_NOREPLY_PASS' : 'SMTP_PASS (fallback)');
                }
            } else {
                console.error('❌ Noreply SMTP ayarları yapılandırılmamış!');
                console.error('❌ SMTP_NOREPLY_USER ve şifre (SMTP_NOREPLY_PASS veya SMTP_PASS) .env dosyasında tanımlanmalı!');
                console.error('❌ Şifre sıfırlama ve hoş geldin mailleri gönderilemeyecek!');
            }
        } catch (error) {
            console.error('❌ Mail Service başlatma hatası:', error);
            console.error('❌ Hata detayları:', error.message, error.stack);
        }
    }

    /**
     * Mail gönder (centralized)
     * @param {Object} options - Mail seçenekleri
     * @param {string} options.to - Alıcı
     * @param {string} options.subject - Konu
     * @param {string} options.html - HTML içerik
     * @param {string} options.text - Plain text içerik (opsiyonel)
     * @param {string} options.from - Gönderen (varsayılan: noreply@floovon.com)
     * @param {string} options.replyTo - Reply-to (varsayılan: destek@floovon.com)
     * @param {Array} options.attachments - Ekler (opsiyonel)
     * @param {Object} options.tenantInfo - Tenant bilgisi (opsiyonel)
     */
    async sendMail(options) {
        try {
            const {
                to,
                subject,
                html,
                text,
                from = 'noreply@floovon.com', // Varsayılan: noreply@ (şifre sıfırlama vb.)
                replyTo = 'destek@floovon.com',
                attachments = [],
                tenantInfo = null,
                noTenantInSubject = false
            } = options;

            // From adresine göre doğru transporter'ı seç
            let transporter = null;
            let fromAddress = from;
            
            if (from.includes('noreply@') || from.includes('noreply')) {
                // Noreply mailleri için noreply transporter
                // ÖNEMLİ: MUTLAKA noreplyTransporter kullanılmalı, alternatif yok!
                if (!this.noreplyTransporter || !this.noreplyInitialized) {
                    console.error('❌ Noreply Mail Service başlatılmamış, mail gönderilemedi');
                    console.error('❌ SMTP_NOREPLY_USER ve SMTP_NOREPLY_PASS .env dosyasında tanımlanmalı!');
                    return { success: false, error: 'Noreply mail service başlatılmamış. SMTP_NOREPLY_USER ve SMTP_NOREPLY_PASS tanımlanmalı!' };
                }
                transporter = this.noreplyTransporter;
                // MUTLAKA SMTP_NOREPLY_USER kullanılmalı, alternatif yok!
                fromAddress = process.env.SMTP_NOREPLY_USER || 'noreply@floovon.com';
            } else if (from.includes('destek@') || from.includes('support')) {
                // Destek mailleri için destek transporter
                if (!this.transporter || !this.initialized) {
                    console.error('❌ Destek Mail Service başlatılmamış, mail gönderilemedi');
                    return { success: false, error: 'Destek mail service başlatılmamış' };
                }
                transporter = this.transporter;
                fromAddress = process.env.SMTP_USER || 'destek@floovon.com';
            } else {
                // Varsayılan: noreply kullan
                // ÖNEMLİ: MUTLAKA noreplyTransporter kullanılmalı, alternatif yok!
                if (!this.noreplyTransporter || !this.noreplyInitialized) {
                    console.error('❌ Noreply Mail Service başlatılmamış, mail gönderilemedi');
                    console.error('❌ SMTP_NOREPLY_USER ve SMTP_NOREPLY_PASS .env dosyasında tanımlanmalı!');
                    return { success: false, error: 'Noreply mail service başlatılmamış. SMTP_NOREPLY_USER ve SMTP_NOREPLY_PASS tanımlanmalı!' };
                }
                transporter = this.noreplyTransporter;
                // MUTLAKA SMTP_NOREPLY_USER kullanılmalı, alternatif yok!
                fromAddress = process.env.SMTP_NOREPLY_USER || from;
            }

            // Tenant bilgisi varsa subject'e ekle (şifre sıfırlama mailleri hariç - noTenantInSubject ile atlanır)
            let finalSubject = subject;
            if (tenantInfo && tenantInfo.name && !options.noTenantInSubject) {
                finalSubject = `[Floovon – ${tenantInfo.name}] ${subject}`;
            }

            // Mail seçenekleri - SPF/DKIM/DMARC uyumluluğu için tutarlı
            // fromAddress kullan (transporter'a göre ayarlanmış doğru adres)
            const mailOptions = {
                from: `"Floovon" <${fromAddress}>`,
                to: to,
                replyTo: replyTo,
                returnPath: fromAddress, // Return-path = fromAddress (SPF uyumluluğu)
                subject: finalSubject,
                html: html,
                text: text || this.htmlToText(html),
                attachments: attachments
            };

            console.log('📧 Mail gönderiliyor:', {
                from: fromAddress,
                to: to,
                subject: finalSubject,
                transporterType: from.includes('noreply') ? 'noreply' : 'support'
            });

            const info = await transporter.sendMail(mailOptions);
            console.log('✅ Mail gönderildi:', {
                to: to,
                subject: finalSubject,
                messageId: info.messageId
            });

            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('❌ Mail gönderme hatası:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * HTML'i plain text'e çevir (basit)
     */
    htmlToText(html) {
        if (!html) return '';
        return html
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .trim();
    }

    /**
     * Logo attachment'ını al
     */
    getLogoAttachment() {
        try {
            const logoPngPath = path.join(__dirname, '..', 'assets', 'mail-data', 'logo-floovon-dark.png');
            const logoPngPathAlt = path.join(__dirname, '..', 'assets', 'logo-floovon-dark.png');
            
            let logoPath = null;
            if (fs.existsSync(logoPngPath)) {
                logoPath = logoPngPath;
            } else if (fs.existsSync(logoPngPathAlt)) {
                logoPath = logoPngPathAlt;
            }

            if (logoPath) {
                return [{
                    filename: 'logo-floovon.png',
                    path: logoPath,
                    cid: 'floovon-logo'
                }];
            }
        } catch (error) {
            console.warn('⚠️ Logo okuma hatası:', error.message);
        }
        return [];
    }

    /**
     * Teknik destek maili gönder
     * @param {Object} destekData - Teknik destek verileri
     * @param {string} destekData.konu - Konu
     * @param {string} destekData.mesaj - Mesaj
     * @param {string} destekData.email - Gönderen email
     * @param {string} destekData.telefon - Telefon (opsiyonel)
     * @param {string} destekData.oncelik - Öncelik (Normal, Yüksek, Acil)
     * @param {string} destekData.kullaniciAdi - Kullanıcı adı (opsiyonel)
     */
    async sendSupportMail(destekData) {
        console.log('📨 sendSupportMail çağrıldı:', {
            konu: destekData.konu,
            email: destekData.email,
            initialized: this.initialized,
            hasTransporter: !!this.transporter
        });

        if (!this.transporter || !this.initialized) {
            console.error('❌ Mail Service başlatılmamış, mail gönderilemedi');
            console.error('❌ initialized:', this.initialized);
            console.error('❌ transporter:', this.transporter ? 'VAR' : 'YOK');
            return false;
        }

        try {
            // Teknik destek mailleri destek@floovon.com'dan gönderilir
            const fromAddress = process.env.SMTP_USER || 'destek@floovon.com';
            const recipientEmail = process.env.TEKNIK_DESTEK_EMAIL || 'destek@floovon.com';
            const oncelik = destekData.oncelik || 'Normal';

            const subject = `Teknik Destek ||| ${destekData.konu} — ! ${oncelik}`;
            
            console.log('📧 Teknik destek maili gönderiliyor:', {
                from: fromAddress,
                to: recipientEmail,
                subject: subject
            });

            // Logo attachment'ı ekle
            const attachments = this.getLogoAttachment();
            let logoHtml = '';
            if (attachments.length > 0) {
                logoHtml = `<div style="${styleToString(mailStyles.logoContainer)}">
                    <img src="cid:floovon-logo" alt="Floovon Logo" style="${styleToString(mailStyles.logo)}" />
                   </div>`;
            }

            const html = `
                <div style="${styleToString(mailStyles.container)}">
                    ${logoHtml}
                    <h2 style="${styleToString(mailStyles.title)}">Yeni Teknik Destek Talebi</h2>
                    <div style="${styleToString(mailStyles.infoBox)}">
                        <div style="${styleToString(mailStyles.pContainer)}">
                            <table style="width: 100%; border-collapse: collapse; margin: 0;">
                                <tr>
                                    <td style="${styleToString(mailStyles.infoLabel)}">Konu:</td>
                                    <td style="${styleToString(mergeStyles(mailStyles.infoValue, mailStyles.infoValueKonu))}">${destekData.konu}</td>
                                </tr>
                                <tr>
                                    <td style="${styleToString(mergeStyles(mailStyles.infoLabel, mailStyles.infoLabelOncelik))}">Öncelik:</td>
                                    <td style="${styleToString(mergeStyles(mailStyles.infoValue, mailStyles.infoValueOncelik))}">${oncelik}</td>
                                </tr>
                            </table>
                        </div>
                        <table style="width: 100%; border-collapse: collapse; margin: 0;">
                            <tr>
                                <td style="${styleToString(mailStyles.infoLabel)}">Gönderen:</td>
                                <td style="${styleToString(mergeStyles(mailStyles.infoValue, mailStyles.infoValueGonder))}">${destekData.email}</td>
                            </tr>
                            ${destekData.telefon ? `<tr><td style="${styleToString(mailStyles.infoLabel)}">Telefon:</td><td style="${styleToString(mergeStyles(mailStyles.infoValue, mailStyles.infoValueTelefon))}"><a href="tel:${destekData.telefon}" style="color: inherit; text-decoration: none;">${destekData.telefon}</a></td></tr>` : ''}
                            ${destekData.kullaniciAdi ? `<tr><td style="${styleToString(mailStyles.infoLabel)}">Kullanıcı Adı:</td><td style="${styleToString(mergeStyles(mailStyles.infoValue, mailStyles.infoValueKullaniciAdi))}">${destekData.kullaniciAdi}</td></tr>` : ''}
                            ${(destekData.isim || destekData.soyisim || destekData.name || destekData.surname) ? `<tr><td style="${styleToString(mailStyles.infoLabel)}">Kullanıcı:</td><td style="${styleToString(mergeStyles(mailStyles.infoValue, mailStyles.infoValueKullaniciAdi))}">${[(destekData.name || destekData.isim), (destekData.surname || destekData.soyisim)].filter(Boolean).join(' ')}</td></tr>` : ''}
                        </table>
                    </div>
                    <div style="${styleToString(mailStyles.messageBox)}">
                        <h3 style="${styleToString(mailStyles.messageTitle)}">Mesaj:</h3>
                        <p style="${styleToString(mailStyles.messageText)}">${destekData.mesaj}</p>
                    </div>
                    <p style="${styleToString(mailStyles.footer)}">
                        Bu mail Floovon Teknik Destek sisteminden otomatik olarak gönderilmiştir.<br>
                        Tarih: ${new Date().toLocaleString('tr-TR')}
                    </p>
                </div>
            `;

            const text = `
Yeni Teknik Destek Talebi

Konu: ${destekData.konu}
Öncelik: ${oncelik}
Gönderen: ${destekData.email}
${destekData.telefon ? `Telefon: ${destekData.telefon}` : ''}
${destekData.kullaniciAdi ? `Kullanıcı Adı: ${destekData.kullaniciAdi}` : ''}
${(destekData.isim || destekData.soyisim || destekData.name || destekData.surname) ? `Kullanıcı: ${[(destekData.name || destekData.isim), (destekData.surname || destekData.soyisim)].filter(Boolean).join(' ')}` : ''}

Mesaj:
${destekData.mesaj}

---
Bu mail Floovon Teknik Destek sisteminden otomatik olarak gönderilmiştir.
Tarih: ${new Date().toLocaleString('tr-TR')}
            `;

            const result = await this.sendMail({
                to: recipientEmail,
                subject: subject,
                html: html,
                text: text,
                from: 'destek@floovon.com', // Teknik destek mailleri destek@'dan gider
                replyTo: destekData.email, // Kullanıcının mailine cevap verilebilmesi için
                attachments: attachments
            });

            console.log('📨 sendMail sonucu:', result);
            
            if (result.success) {
                console.log('✅ Teknik destek maili başarıyla gönderildi');
            } else {
                console.error('❌ Teknik destek maili gönderilemedi:', result.error);
            }

            return result.success;
        } catch (error) {
            console.error('❌ Teknik destek maili gönderme hatası:', error);
            console.error('❌ Hata detayları:', error.message, error.stack);
            return false;
        }
    }

    /**
     * İletişim formu maili gönder (iletisim@floovon.com)
     */
    async sendContactMail(contactData) {
        console.log('📨 sendContactMail çağrıldı:', {
            konu: contactData.subject,
            email: contactData.email,
            initialized: this.initialized,
            hasTransporter: !!this.transporter
        });

        if (!this.transporter || !this.initialized) {
            console.error('❌ Mail Service başlatılmamış, mail gönderilemedi');
            console.error('❌ initialized:', this.initialized);
            console.error('❌ transporter:', this.transporter ? 'VAR' : 'YOK');
            return false;
        }

        try {
            // İletişim mailleri destek@floovon.com'dan gönderilir, iletisim@floovon.com'a gider
            const fromAddress = process.env.SMTP_USER || 'destek@floovon.com';
            const recipientEmail = 'iletisim@floovon.com';

            const subject = `İletişim Formu ||| ${contactData.subject || 'Genel Bilgi'}`;
            
            console.log('📧 İletişim formu maili gönderiliyor:', {
                from: fromAddress,
                to: recipientEmail,
                subject: subject
            });

            // Logo attachment'ı ekle
            const attachments = this.getLogoAttachment();
            let logoHtml = '';
            if (attachments.length > 0) {
                logoHtml = `<div style="${styleToString(mailStyles.logoContainer)}">
                    <img src="cid:floovon-logo" alt="Floovon Logo" style="${styleToString(mailStyles.logo)}" />
                   </div>`;
            }

            const html = `
                <div style="${styleToString(mailStyles.container)}">
                    ${logoHtml}
                    <h2 style="${styleToString(mailStyles.title)}">Yeni İletişim Formu Mesajı</h2>
                    <div style="${styleToString(mailStyles.infoBox)}">
                        <table style="width: 100%; border-collapse: collapse; margin: 0;">
                            <tr>
                                <td style="${styleToString(mailStyles.infoLabel)}">Konu:</td>
                                <td style="${styleToString(mergeStyles(mailStyles.infoValue, mailStyles.infoValueKonu))}">${contactData.subject || 'Genel Bilgi'}</td>
                            </tr>
                            <tr>
                                <td style="${styleToString(mailStyles.infoLabel)}">Gönderen:</td>
                                <td style="${styleToString(mergeStyles(mailStyles.infoValue, mailStyles.infoValueGonder))}">${contactData.name || 'Bilinmeyen'} (${contactData.email})</td>
                            </tr>
                            ${contactData.phone ? `<tr><td style="${styleToString(mailStyles.infoLabel)}">Telefon:</td><td style="${styleToString(mergeStyles(mailStyles.infoValue, mailStyles.infoValueTelefon))}"><a href="tel:${contactData.phone}" style="color: inherit; text-decoration: none;">${contactData.phone}</a></td></tr>` : ''}
                            ${contactData.company ? `<tr><td style="${styleToString(mailStyles.infoLabel)}">Şirket/Mağaza:</td><td style="${styleToString(mergeStyles(mailStyles.infoValue, mailStyles.infoValueKullaniciAdi))}">${contactData.company}</td></tr>` : ''}
                        </table>
                    </div>
                    <div style="${styleToString(mailStyles.messageBox)}">
                        <h3 style="${styleToString(mailStyles.messageTitle)}">Mesaj:</h3>
                        <p style="${styleToString(mailStyles.messageText)}">${contactData.message}</p>
                    </div>
                    <p style="${styleToString(mailStyles.footer)}">
                        Bu mail Floovon İletişim Formu'ndan otomatik olarak gönderilmiştir.<br>
                        Tarih: ${new Date().toLocaleString('tr-TR')}
                    </p>
                </div>
            `;

            const text = `
Yeni İletişim Formu Mesajı

Konu: ${contactData.subject || 'Genel Bilgi'}
Gönderen: ${contactData.name || 'Bilinmeyen'} (${contactData.email})
${contactData.phone ? `Telefon: ${contactData.phone}` : ''}
${contactData.company ? `Şirket/Mağaza: ${contactData.company}` : ''}

Mesaj:
${contactData.message}

---
Bu mail Floovon İletişim Formu'ndan otomatik olarak gönderilmiştir.
Tarih: ${new Date().toLocaleString('tr-TR')}
            `;

            const result = await this.sendMail({
                to: recipientEmail,
                subject: subject,
                html: html,
                text: text,
                from: 'destek@floovon.com', // İletişim mailleri destek@'dan gider
                replyTo: contactData.email, // Kullanıcının mailine cevap verilebilmesi için
                attachments: attachments
            });

            console.log('📨 sendMail sonucu:', result);
            
            if (result.success) {
                console.log('✅ İletişim formu maili başarıyla gönderildi');
            } else {
                console.error('❌ İletişim formu maili gönderilemedi:', result.error);
            }

            return result.success;
        } catch (error) {
            console.error('❌ İletişim formu maili gönderme hatası:', error);
            console.error('❌ Hata detayları:', error.message, error.stack);
            return false;
        }
    }
}

// Singleton instance
let mailServiceInstance = null;

function getMailService() {
    if (!mailServiceInstance) {
        mailServiceInstance = new MailService();
    }
    return mailServiceInstance;
}

module.exports = {
    MailService,
    getMailService
};

