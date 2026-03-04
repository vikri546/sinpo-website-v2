const https = require('https');

const TOKEN = 'LMyrBrMUP8zpYV5d';
const API_URL = 'https://api.sinpo.id/api/kategori';

const options = {
    headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/json'
    }
};

https.get(API_URL, options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const categories = json.data || [];

            if (categories.length === 0) {
                console.log('Tidak ada kategori ditemukan.');
                return;
            }

            categories.forEach((cat, index) => {
                console.log(`[${index + 1}] ${cat.nama || cat.name}`);
            });

            console.log(`\nBerhasil memuat ${categories.length} kategori.`);
        } catch (e) {
            console.error('Gagal memproses data JSON:', e.message);
            console.log('Raw output:', data.substring(0, 200));
        }
    });
}).on('error', (err) => {
    console.error('Gagal menghubungi API:', err.message);
});
