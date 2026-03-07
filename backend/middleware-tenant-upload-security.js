/**
 * Tenant Upload Security Middleware
 * 
 * Bu middleware /uploads/ endpoint'lerine gelen isteklerde tenant izolasyonu sağlar.
 * Kullanıcının token'ından gelen tenantId ile URL'deki tenantId eşleşmeli.
 * 
 * KULLANIM (opsiyonel ama önerilen):
 * 
 * simple-server.js içinde:
 * 
 * const { tenantUploadSecurity } = require('./middleware-tenant-upload-security');
 * 
 * // /uploads/ route'undan ÖNCE ekle
 * app.use('/uploads', tenantUploadSecurity);
 * 
 * NOT: Express static middleware'den ÖNCE eklenmelidir!
 */

const path = require('path');

/**
 * Tenant upload security middleware
 * URL'deki tenantId ile kullanıcının tenantId'sini karşılaştırır
 */
async function tenantUploadSecurity(req, res, next) {
    try {
        // Sadece /uploads/tenants/<tenantId>/... path'lerini kontrol et
        const urlPath = req.path;
        
        // Tenant-based path kontrolü: /uploads/tenants/<tenantId>/...
        const tenantPathMatch = urlPath.match(/^\/uploads\/tenants\/([^\/]+)\//);
        
        if (!tenantPathMatch) {
            // Tenant-based path değilse, eski yapıya izin ver (backward compatibility)
            // veya direkt engelleyebilirsiniz
            return next();
        }
        
        const urlTenantId = tenantPathMatch[1];
        
        // Kullanıcının tenant ID'sini al (req.tenantId veya getTenantId'den)
        // NOT: getTenantId fonksiyonu simple-server.js'de tanımlı olmalı
        const userTenantId = req.tenantId;
        
        if (!userTenantId) {
            // Tenant ID yoksa, token'dan almayı dene
            // Bu middleware'i kullanırken getTenantId'yi import etmeniz gerekir
            // const { getTenantId } = require('./simple-server');
            // const userTenantId = await getTenantId(req);
            
            // Şimdilik sadece req.tenantId kontrolü yapıyoruz
            console.warn(`⚠️ Tenant upload security: Tenant ID bulunamadı - URL: ${urlPath}`);
            return res.status(403).json({
                success: false,
                error: 'Tenant ID bulunamadı. Lütfen giriş yapın.'
            });
        }
        
        // Tenant ID'leri karşılaştır
        if (String(urlTenantId) !== String(userTenantId)) {
            console.warn(`⚠️ Tenant upload security: Tenant ID eşleşmedi - URL Tenant: ${urlTenantId}, User Tenant: ${userTenantId}`);
            return res.status(403).json({
                success: false,
                error: 'Bu dosyaya erişim yetkiniz yok.'
            });
        }
        
        // Tenant ID'ler eşleşiyor, devam et
        next();
    } catch (error) {
        console.error('❌ Tenant upload security middleware hatası:', error);
        return res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
    }
}

module.exports = {
    tenantUploadSecurity
};












