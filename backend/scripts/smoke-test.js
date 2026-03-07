/**
 * Backend Smoke Test
 * 
 * Express minor bump'lerin gerçekten zararsız olduğunu doğrulamak için
 * kritik endpoint'leri test eder.
 * 
 * Kullanım:
 *   node scripts/smoke-test.js
 * 
 * CI'da kullanım:
 *   npm run smoke-test
 */

const http = require('http');

const SERVER_URL = process.env.SMOKE_TEST_URL || 'http://localhost:3001';
const TIMEOUT = 10000; // 10 saniye
const MAX_RETRIES = 30; // Server'ın başlaması için 30 deneme (30 saniye)
const RETRY_INTERVAL = 1000; // Her deneme arası 1 saniye

// Test sonuçları
const results = {
    passed: 0,
    failed: 0,
    tests: []
};

/**
 * HTTP request helper
 */
function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, SERVER_URL);
        const options = {
            method,
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            timeout: TIMEOUT,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (body) {
            const bodyString = JSON.stringify(body);
            options.headers['Content-Length'] = Buffer.byteLength(bodyString);
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const jsonData = data ? JSON.parse(data) : null;
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: jsonData
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: data
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

/**
 * Test helper
 */
function test(name, fn) {
    return fn()
        .then(() => {
            results.passed++;
            results.tests.push({ name, status: 'PASS', error: null });
            console.log(`✅ ${name}`);
        })
        .catch((error) => {
            results.failed++;
            results.tests.push({ name, status: 'FAIL', error: error.message });
            console.error(`❌ ${name}: ${error.message}`);
        });
}

/**
 * Server'ın başlamasını bekle
 */
async function waitForServer() {
    console.log(`⏳ Server'in baslamasini bekliyorum: ${SERVER_URL}`);
    console.log(`   Health endpoint: ${SERVER_URL}/api/health`);
    console.log(`   Max bekleme: ${MAX_RETRIES} saniye\n`);
    
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const response = await makeRequest('GET', '/api/health');
            if (response.statusCode === 200) {
                console.log(`✅ Server hazır (${i + 1}. deneme, ${i + 1} saniye sonra)`);
                if (response.body && response.body.status) {
                    console.log(`   Health status: ${response.body.status}`);
                }
                return true;
            } else {
                // Health endpoint yanıt verdi ama 200 değil
                if (i % 5 === 0) {
                    console.log(`   Deneme ${i + 1}/${MAX_RETRIES}: Health endpoint ${response.statusCode} döndü, bekleniyor...`);
                }
            }
        } catch (error) {
            // Server henüz başlamadı veya bağlantı hatası
            if (i % 5 === 0) {
                console.log(`   Deneme ${i + 1}/${MAX_RETRIES}: Server henüz hazır değil, bekleniyor...`);
            }
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
    }
    
    throw new Error(`Server ${MAX_RETRIES} saniye içinde başlamadı (health endpoint 200 dönmedi)`);
}

/**
 * Smoke test'leri çalıştır
 */
async function runSmokeTests() {
    console.log('\n🧪 Backend Smoke Test Başlatılıyor...\n');
    console.log(`📍 Test URL: ${SERVER_URL}\n`);

    // 1. Health Check - 200 OK beklenir
    await test('Health Check - /api/health returns 200', async () => {
        const response = await makeRequest('GET', '/api/health');
        if (response.statusCode !== 200) {
            throw new Error(`Expected 200, got ${response.statusCode}`);
        }
        if (!response.body || response.body.status !== 'OK') {
            throw new Error('Health check response invalid');
        }
    });

    // 2. Login Endpoint - 400 (bad request) beklenir (credentials olmadan)
    await test('Login Endpoint - /api/auth/login returns 400 without credentials', async () => {
        const response = await makeRequest('POST', '/api/auth/login', {});
        if (response.statusCode !== 400) {
            throw new Error(`Expected 400 (bad request), got ${response.statusCode}`);
        }
        // 400 alırsak endpoint çalışıyor demektir
    });

    // 3. Login Endpoint - 401 (unauthorized) beklenir (yanlış credentials ile)
    await test('Login Endpoint - /api/auth/login returns 401 with invalid credentials', async () => {
        const response = await makeRequest('POST', '/api/auth/login', {
            email: 'test@invalid.com',
            password: 'invalidpassword123'
        });
        // 400 veya 401 kabul edilebilir (her ikisi de endpoint'in çalıştığını gösterir)
        if (response.statusCode !== 400 && response.statusCode !== 401) {
            throw new Error(`Expected 400 or 401, got ${response.statusCode}`);
        }
    });

    // 4. Protected Endpoint - 401 (unauthorized) beklenir (token olmadan)
    await test('Protected Endpoint - /api/organizasyon-kartlar returns 401 without auth', async () => {
        const response = await makeRequest('GET', '/api/organizasyon-kartlar');
        // 401 veya 403 kabul edilebilir (her ikisi de auth middleware'in çalıştığını gösterir)
        if (response.statusCode !== 401 && response.statusCode !== 403) {
            throw new Error(`Expected 401 or 403, got ${response.statusCode}`);
        }
    });

    // 5. Auth Me Endpoint - 401 (unauthorized) beklenir (token olmadan)
    await test('Auth Me Endpoint - /api/auth/me returns 401 without token', async () => {
        const response = await makeRequest('GET', '/api/auth/me');
        // 401 veya 403 kabul edilebilir
        if (response.statusCode !== 401 && response.statusCode !== 403) {
            throw new Error(`Expected 401 or 403, got ${response.statusCode}`);
        }
    });

    console.log('\n📊 Test Sonuçları:');
    console.log(`   ✅ Başarılı: ${results.passed}`);
    console.log(`   ❌ Başarısız: ${results.failed}`);
    console.log(`   📈 Toplam: ${results.passed + results.failed}\n`);

    // Detaylı sonuçlar
    if (results.failed > 0) {
        console.log('❌ Başarısız Testler:');
        results.tests
            .filter(t => t.status === 'FAIL')
            .forEach(t => {
                console.log(`   - ${t.name}: ${t.error}`);
            });
        console.log('');
    }

    // Exit code
    if (results.failed > 0) {
        console.error('❌ Smoke test basarisiz! Express minor bump sorunlu olabilir.');
        process.exit(1);
    } else {
        console.log('✅ Tum smoke testler basarili! Express minor bump zararsiz.');
        process.exit(0);
    }
}

/**
 * Main
 */
async function main() {
    try {
        // Server'ın başlamasını bekle
        await waitForServer();
        
        // Test'leri çalıştır
        await runSmokeTests();
    } catch (error) {
        console.error(`\n❌ Smoke test hatası: ${error.message}\n`);
        process.exit(1);
    }
}

// Script doğrudan çalıştırılıyorsa
if (require.main === module) {
    main();
}

module.exports = { runSmokeTests, waitForServer };

