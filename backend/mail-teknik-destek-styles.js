/**
 * Teknik Destek Mail Stilleri
 * Bu dosyadaki stiller mail HTML'ine inline olarak eklenir
 */

module.exports = {
    // Ana container
    container: {
        fontFamily: 'Arial, sans-serif',
        maxWidth: '600px',
        margin: '0 auto',
        padding: '20px'
    },
    
    // Logo container
    logoContainer: {
        textAlign: 'left',
        marginBottom: '16px'
    },
    
    // Logo image
    logo: {
        maxWidth: '140px',
        height: 'auto',
        display: 'block',
        margin: '0 auto'
    },

    pContainer: {
        margin: '0 0 16px 0',
        backgroundColor: '#fff',
        // border: '1px solid #ff0000',
        padding: '12px 20px',
        borderRadius: '5px'
    },
    
    // Başlık
    title: {
        color: '#000',
        marginTop: '0',
        textAlign: 'center'
    },
    
    // Bilgi kutusu (gri arka plan)
    infoBox: {
        backgroundColor: '#f5f5f5',
        padding: '20px',
        borderRadius: '8px',
        margin: '20px 0'
    },
    
    // Bilgi kutusu içindeki paragraflar (genel stil) - artık kullanılmıyor, table kullanıyoruz
    infoParagraph: {
        margin: '8px 0'
    },
    
    // Bilgi başlıkları (sol taraf) - table cell için
    infoLabel: {
        fontWeight: 'bold',
        width: '35%',
        paddingRight: '15px',
        verticalAlign: 'top',
        paddingBottom: '8px'
    },
    
    // Öncelik label'ı için özel stil (padding-bottom yok)
    infoLabelOncelik: {
        paddingBottom: '0'
    },
    
    // Bilgi değerleri (sağ taraf) - genel stil - table cell için
    infoValue: {
        textAlign: 'right',
        width: '65%',
        verticalAlign: 'top',
        paddingBottom: '8px'
    },
    
    // Konu içeriği
    infoValueKonu: {
        fontWeight: 'bold'
    },
    
    // Öncelik içeriği
    infoValueOncelik: {
        fontWeight: 'bold',
        paddingBottom: '0'
    },
    
    // Gönderen içeriği
    infoValueGonder: {},
    
    // Telefon içeriği
    infoValueTelefon: {},
    
    // Kullanıcı Adı içeriği
    infoValueKullaniciAdi: {},
    
    // Konu paragrafı
    infoParagraphKonu: {
        margin: '8px 0'
    },
    
    // Öncelik paragrafı
    infoParagraphOncelik: {
        margin: '8px 0'
    },
    
    // Gönderen paragrafı
    infoParagraphGonder: {
        margin: '10px 0'
    },
    
    // Telefon paragrafı
    infoParagraphTelefon: {
        margin: '10px 0'
    },
    
    // Kullanıcı Adı paragrafı
    infoParagraphKullaniciAdi: {
        margin: '0'
    },
    
    // Mesaj kutusu
    messageBox: {
        backgroundColor: '#fff',
        padding: '20px',
        // borderLeft: '4px solid #ec0972',
        border: '1px solid #ccc',
        borderRadius: '5px',
        margin: '20px 0'
    },
    
    // Mesaj başlığı
    messageTitle: {
        color: '#333',
        marginTop: '0'
    },
    
    // Mesaj içeriği
    messageText: {
        whiteSpace: 'pre-wrap',
        color: '#666'
    },
    
    // Footer
    footer: {
        color: '#999',
        fontSize: '12px',
        marginTop: '30px'
    }
};

