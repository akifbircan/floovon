const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

/**
 * siparis_kartlar tablosundaki musteri_id NULL olan siparişleri günceller.
 * Müşteri adı (unvan veya isim_soyisim) ve telefon numarası ile musteriler tablosunda eşleştirme yapar.
 */
async function updateSiparisKartlarMusteriId() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Veritabanı bağlantı hatası:', err);
                return reject(err);
            }
            console.log('✅ Veritabanına bağlandı');
        });

        // Telefon numarası normalizasyon fonksiyonu
        const normalizePhone = (phone) => {
            if (!phone) return '';
            return phone.toString().replace(/\D/g, ''); // Sadece rakamları al
        };

        // Önce musteri_id kolonunun var olup olmadığını kontrol et
        db.all(`PRAGMA table_info(siparis_kartlar)`, (err, columns) => {
            if (err) {
                console.error('❌ Tablo bilgisi alınamadı:', err);
                db.close();
                return reject(err);
            }

            const columnNames = columns.map(col => col.name);
            if (!columnNames.includes('musteri_id')) {
                console.log('⚠️ musteri_id kolonu yok, önce eklenmeli');
                db.close();
                return resolve();
            }

            // musteri_id NULL olan siparişleri bul
            db.all(`
                SELECT 
                    id,
                    tenant_id,
                    musteri_unvan,
                    musteri_isim_soyisim,
                    siparis_veren_telefon
                FROM siparis_kartlar
                WHERE musteri_id IS NULL
                ORDER BY tenant_id, created_at DESC
            `, (err, siparisler) => {
                if (err) {
                    console.error('❌ Siparişler alınamadı:', err);
                    db.close();
                    return reject(err);
                }

                if (siparisler.length === 0) {
                    console.log('✅ musteri_id NULL olan sipariş bulunamadı');
                    db.close();
                    return resolve();
                }

                console.log(`📋 ${siparisler.length} adet musteri_id NULL olan sipariş bulundu`);
                console.log('🔄 Müşteri eşleştirmesi yapılıyor...\n');

                let processed = 0;
                let matched = 0;
                let notMatched = 0;

                // Her sipariş için müşteri eşleştirmesi yap
                const processNext = (index) => {
                    if (index >= siparisler.length) {
                        console.log('\n✅ Migration tamamlandı:');
                        console.log(`   - İşlenen: ${processed}`);
                        console.log(`   - Eşleşen: ${matched}`);
                        console.log(`   - Eşleşmeyen: ${notMatched}`);
                        db.close();
                        return resolve();
                    }

                    const siparis = siparisler[index];
                    processed++;

                    const musteriUnvan = siparis.musteri_unvan || '';
                    const musteriIsimSoyisim = siparis.musteri_isim_soyisim || '';
                    const siparisTelefon = siparis.siparis_veren_telefon || '';
                    const normalizedSiparisTelefon = normalizePhone(siparisTelefon);

                    // Eğer müşteri adı veya telefon yoksa, eşleştirme yapılamaz
                    if ((!musteriUnvan && !musteriIsimSoyisim) || !normalizedSiparisTelefon) {
                        notMatched++;
                        if (processed % 100 === 0) {
                            console.log(`   İşleniyor... ${processed}/${siparisler.length}`);
                        }
                        processNext(index + 1);
                        return;
                    }

                    // Müşteri adı kontrolü (unvan veya isim_soyisim)
                    const nameConditions = [];
                    const whereParams = [siparis.tenant_id];

                    if (musteriUnvan) {
                        nameConditions.push('musteri_unvan = ?');
                        whereParams.push(musteriUnvan);
                    }
                    if (musteriIsimSoyisim) {
                        nameConditions.push('musteri_isim_soyisim = ?');
                        whereParams.push(musteriIsimSoyisim);
                    }

                    if (nameConditions.length === 0) {
                        notMatched++;
                        if (processed % 100 === 0) {
                            console.log(`   İşleniyor... ${processed}/${siparisler.length}`);
                        }
                        processNext(index + 1);
                        return;
                    }

                    // Telefon kontrolü
                    whereParams.push(normalizedSiparisTelefon);

                    // Müşteri eşleştirmesi yap
                    // Telefon eşleştirmesi için normalize edilmiş telefonları karşılaştır
                    // SQLite'da telefon normalizasyonu yapmak zor olduğu için,
                    // önce ad ile eşleşen müşterileri bul, sonra telefon normalizasyonunu JavaScript'te yap
                    const whereClause = `
                        tenant_id = ?
                        AND (${nameConditions.join(' OR ')})
                    `;

                    db.all(`
                        SELECT id, phone FROM musteriler
                        WHERE ${whereClause}
                    `, whereParams.slice(0, -1), (err, musteriler) => {
                        if (err) {
                            console.error(`❌ Sipariş ${siparis.id} için müşteri sorgusu hatası:`, err);
                            notMatched++;
                            processNext(index + 1);
                            return;
                        }

                        // Telefon normalizasyonu ile eşleşen müşteriyi bul
                        let matchedMusteri = null;
                        for (const m of musteriler) {
                            const normalizedMusteriPhone = normalizePhone(m.phone || '');
                            if (normalizedMusteriPhone === normalizedSiparisTelefon) {
                                matchedMusteri = m;
                                break;
                            }
                        }

                        if (matchedMusteri) {
                            // Müşteri bulundu, musteri_id'yi güncelle
                            db.run(`
                                UPDATE siparis_kartlar
                                SET musteri_id = ?
                                WHERE id = ? AND tenant_id = ?
                            `, [matchedMusteri.id, siparis.id, siparis.tenant_id], (updateErr) => {
                                if (updateErr) {
                                    console.error(`❌ Sipariş ${siparis.id} güncellenemedi:`, updateErr);
                                    notMatched++;
                                } else {
                                    matched++;
                                    if (matched % 50 === 0) {
                                        console.log(`   ✅ ${matched} sipariş eşleştirildi...`);
                                    }
                                }
                                processNext(index + 1);
                            });
                        } else {
                            // Müşteri bulunamadı
                            notMatched++;
                            if (processed % 100 === 0) {
                                console.log(`   İşleniyor... ${processed}/${siparisler.length}`);
                            }
                            processNext(index + 1);
                        }
                    });
                };

                processNext(0);
            });
        });
    });
}

// Eğer doğrudan çalıştırılıyorsa
if (require.main === module) {
    updateSiparisKartlarMusteriId()
        .then(() => {
            console.log('\n✅ Migration tamamlandı');
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Migration hatası:', err);
            process.exit(1);
        });
}

module.exports = updateSiparisKartlarMusteriId;

