// using global fetch available in Node 18+

const API_CONFIG = {
    BASE_URL: 'https://api.sinpo.id/api',
    TOKEN: 'LMyrBrMUP8zpYV5d'
};

async function fetchData(endpoint) {
    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${API_CONFIG.TOKEN}`,
                'Accept': 'application/json'
            }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        data.data.forEach(c => {
            console.log(`ID: ${c.id}, Name: ${c.nama}`);
        });
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error.message);
    }
}

async function main() {
    await fetchData('/channel?limit=100');
}

main();

// { id: 7, judul: 'Redaksi' },
// { id: 9, judul: 'Kontak Kami' },
// { id: 10, judul: 'Tentang Kami' },
// { id: 8, judul: 'Disclaimer' },
// { id: 11, judul: 'Privacy Policy' },
// { id: 12, judul: 'Pedoman Pemberitaan Media Siber' }
