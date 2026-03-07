/**
 * Abonelik Mail Şablonları
 * Tüm abonelik ile ilgili mail şablonları bu dosyada yönetilir
 */

/**
 * Fiyat formatlama fonksiyonu (Türkçe format)
 */
function formatPrice(priceInKurus) {
    const priceInTL = priceInKurus / 100;
    return priceInTL.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Tarih formatlama fonksiyonu (Türkçe format: DD.MM.YYYY)
 */
function formatDateTR(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

/**
 * Yeni Abonelik Başlatıldı Mail Şablonu
 */
function generateYeniAbonelikMail({
    tenantInfo,
    planAdiFormatli,
    ucretMetni,
    gosterilecekFiyat,
    faturaDongusu,
    faturaNo,
    toplamTutar,
    todayStrFormatted,
    nextPaymentFormatted,
    dashboardUrl
}) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <!--[if mso]>
            <style type="text/css">
                body, table, td {font-family: Arial, sans-serif !important;}
            </style>
            <![endif]-->
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
            <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: relative;">
                <div style="text-align: right; margin-bottom: 20px;"><img src="cid:floovon-logo" alt="Floovon" style="height: 32px; width: auto;" /></div>
                <h2 style="color: #1f2937; font-size: 24px; margin-top: 0; margin-bottom: 20px; font-weight: 600; line-height: 1.2;">Yeni Abonelik Başlatıldı</h2>
                <p style="margin: 12px 0; font-size: 15px; color: #374151; line-height: 1.6;">Merhaba ${tenantInfo[0].firma_adi || tenantInfo[0].yetkili_kisi || 'Değerli Müşterimiz'},</p>
                <p style="margin: 12px 0; font-size: 15px; color: #374151; line-height: 1.6;"><strong>${planAdiFormatli}</strong> planına başarıyla abone oldunuz.</p>
                
                <div style="background-color: #f9fafb; border-left: 4px solid #3b82f6; border-radius: 4px; padding: 20px; margin: 30px 0;">
                    <p style="margin: 8px 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #1f2937; font-weight: 600;">${ucretMetni}:</strong> ${formatPrice(gosterilecekFiyat)} TL</p>
                    <p style="margin: 8px 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #1f2937; font-weight: 600;">Ödeme Dönemi:</strong> ${faturaDongusu === 'yillik' ? 'Yıllık' : 'Aylık'}</p>
                    ${faturaNo ? `<p style="margin: 8px 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #1f2937; font-weight: 600;">Fatura No:</strong> ${faturaNo}</p>` : ''}
                    ${toplamTutar ? `<p style="margin: 8px 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #1f2937; font-weight: 600;">Fatura Tutarı:</strong> ${formatPrice(toplamTutar)} TL (KDV Dahil)</p>` : ''}
                    <p style="margin: 8px 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #1f2937; font-weight: 600;">Abonelik Başlangıç:</strong> ${todayStrFormatted}</p>
                    <p style="margin: 8px 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #1f2937; font-weight: 600;">Sonraki Ödeme Tarihi:</strong> ${nextPaymentFormatted}</p>
                </div>
                
                <p style="margin: 12px 0; font-size: 15px; color: #374151; line-height: 1.6;">Aboneliğiniz aktif edilmiştir. Teşekkür ederiz!</p>
                
                <div style="margin-top: 30px; padding: 15px; background-color: #f9fafb; border-radius: 4px;">
                    <p style="margin: 8px 0; font-size: 14px; color: #374151; line-height: 1.6;">Abonelik bilgilerinizi görüntülemek ve faturalarınıza erişmek için <a href="${dashboardUrl}" style="color: #3b82f6; text-decoration: none; font-weight: 600;">Dashboard panele git</a></p>
                </div>
                
                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5; text-align: center;">Abonelik ve faturalarınız ile ilgili sorularınız için <a href="mailto:destek@floovon.com" style="color: #3b82f6; text-decoration: none;">destek@floovon.com</a> üzerinden iletişime geçebilirsiniz.</p>
                </div>
            </div>
        </body>
        </html>
    `;
}

/**
 * Plan Değişikliği Mail Şablonu
 */
function generatePlanDegisikligiMail({
    tenantInfo,
    planAdiFormatli,
    ucretMetni,
    gosterilecekFiyat,
    faturaDongusu,
    faturaNo,
    faturaTarihiFormatted,
    toplamTutar,
    dashboardUrl
}) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <!--[if mso]>
            <style type="text/css">
                body, table, td {font-family: Arial, sans-serif !important;}
            </style>
            <![endif]-->
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
            <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: relative;">
                <div style="text-align: right; margin-bottom: 20px;"><img src="cid:floovon-logo" alt="Floovon" style="height: 32px; width: auto;" /></div>
                <h2 style="color: #1f2937; font-size: 24px; margin-top: 0; margin-bottom: 20px; font-weight: 600; line-height: 1.2;">Abonelik Planı Güncellemesi</h2>
                <p style="margin: 12px 0; font-size: 15px; color: #374151; line-height: 1.6;">Merhaba ${tenantInfo[0].firma_adi || tenantInfo[0].yetkili_kisi || 'Değerli Müşterimiz'},</p>
                <p style="margin: 12px 0; font-size: 15px; color: #374151; line-height: 1.6;">Aboneliğiniz <strong>${planAdiFormatli}</strong> planına güncellenmiştir.</p>
                
                <div style="background-color: #f9fafb; border-left: 4px solid #3b82f6; border-radius: 4px; padding: 20px; margin: 20px 0;">
                    <p style="margin: 8px 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #1f2937; font-weight: 600;">${ucretMetni}:</strong> ${formatPrice(gosterilecekFiyat)} TL</p>
                    <p style="margin: 8px 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #1f2937; font-weight: 600;">Ödeme Dönemi:</strong> ${faturaDongusu === 'yillik' ? 'Yıllık' : 'Aylık'}</p>
                    <p style="margin: 8px 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #1f2937; font-weight: 600;">Fatura No:</strong> ${faturaNo}</p>
                    <p style="margin: 8px 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #1f2937; font-weight: 600;">Fatura Tarihi:</strong> ${faturaTarihiFormatted}</p>
                    <p style="margin: 8px 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #1f2937; font-weight: 600;">Fatura Tutarı:</strong> ${formatPrice(toplamTutar)} TL (KDV Dahil)</p>
                </div>
                
                <p style="margin: 12px 0; font-size: 15px; color: #374151; line-height: 1.6;">Plan değişikliğiniz aktif edilmiştir. Teşekkür ederiz!</p>
                
                <div style="margin-top: 30px; padding: 15px; background-color: #f9fafb; border-radius: 4px;">
                    <p style="margin: 8px 0; font-size: 14px; color: #374151; line-height: 1.6;">Sipariş panelinize erişmek ve abonelik bilgilerinizi görüntülemek için <a href="${dashboardUrl}" style="color: #3b82f6; text-decoration: none; font-weight: 600;">Dashboard panele git</a></p>
                </div>
                
                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5; text-align: center;">Abonelik ve faturalarınız ile ilgili sorularınız için <a href="mailto:destek@floovon.com" style="color: #3b82f6; text-decoration: none;">destek@floovon.com</a> üzerinden iletişime geçebilirsiniz.</p>
                </div>
            </div>
        </body>
        </html>
    `;
}

/**
 * Abonelik İptali Mail Şablonu
 */
function generateAbonelikIptaliMail({
    tenantInfo,
    planAdiFormatli,
    donemBitisTarihi,
    cancel_reason,
    dashboardUrl
}) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <!--[if mso]>
            <style type="text/css">
                body, table, td {font-family: Arial, sans-serif !important;}
            </style>
            <![endif]-->
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
            <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: relative;">
                <div style="text-align: right; margin-bottom: 20px;"><img src="cid:floovon-logo" alt="Floovon" style="height: 32px; width: auto;" /></div>
                <h2 style="color: #1f2937; font-size: 24px; margin-top: 0; margin-bottom: 20px; font-weight: 600; line-height: 1.2;">Abonelik Plan İptali</h2>
                <p style="margin: 12px 0; font-size: 15px; color: #374151; line-height: 1.6;">Merhaba ${tenantInfo[0].firma_adi || tenantInfo[0].yetkili_kisi || 'Değerli Müşterimiz'},</p>
                <p style="margin: 12px 0; font-size: 15px; color: #374151; line-height: 1.6;"><strong>${planAdiFormatli}</strong> aboneliğiniz için iptal talebiniz alınmıştır.</p>
                
                <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px; padding: 20px; margin: 30px 0;">
                    <p style="margin: 8px 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #1f2937; font-weight: 600;">Abonelik Planı:</strong> ${planAdiFormatli}</p>
                    <p style="margin: 8px 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #1f2937; font-weight: 600;">Etkinlik Süresi:</strong> Aboneliğiniz <strong style="color: #1f2937; font-weight: 600;">${donemBitisTarihi}</strong> tarihine kadar devam edecektir.</p>
                    <p style="margin: 8px 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #1f2937; font-weight: 600;">İptal Nedeni:</strong> ${cancel_reason.trim()}</p>
                </div>
                
                <p style="margin: 12px 0; font-size: 15px; color: #374151; line-height: 1.6;">Aboneliğiniz mevcut fatura döneminin sonuna kadar aktif kalacaktır. Bu süre zarfında tüm özelliklere erişiminiz devam edecektir.</p>
                
                <div style="margin-top: 30px; padding: 15px; background-color: #f9fafb; border-radius: 4px;">
                    <p style="margin: 8px 0; font-size: 14px; color: #374151; line-height: 1.6;">Abonelik bilgilerinizi ve geçmiş faturalarınızı görüntülemek için <a href="${dashboardUrl}" style="color: #3b82f6; text-decoration: none; font-weight: 600;">Dashboard panele git</a></p>
                </div>
                
                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5; text-align: center;">Abonelik ve faturalarınız ile ilgili sorularınız için <a href="mailto:destek@floovon.com" style="color: #3b82f6; text-decoration: none;">destek@floovon.com</a> üzerinden iletişime geçebilirsiniz.</p>
                </div>
            </div>
        </body>
        </html>
    `;
}

module.exports = {
    generateYeniAbonelikMail,
    generatePlanDegisikligiMail,
    generateAbonelikIptaliMail,
    formatPrice,
    formatDateTR
};

