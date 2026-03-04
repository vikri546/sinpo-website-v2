const API_CONFIG = {
    BASE_URL: 'https://api.sinpo.id/api',
    TOKEN: 'LMyrBrMUP8zpYV5d'
};

async function checkAuthors() {
    try {
        console.log('Fetching news to inspect authors...');
        const response = await fetch(`${API_CONFIG.BASE_URL}/berita?limit=100`, {
            headers: {
                'Authorization': `Bearer ${API_CONFIG.TOKEN}`,
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const json = await response.json();
        const news = json.data || [];
        
        const journalists = new Set();
        const editors = new Set();
        
        news.forEach(item => {
            if (item.journalist) journalists.add(item.journalist.trim());
            if (item.wartawan) journalists.add(item.wartawan.trim());
            if (item.editor) editors.add(item.editor.trim());
            if (item.penulis) editors.add(item.penulis.trim());
        });
        
        console.log('\n--- DAFTAR WARTAWAN / JOURNALIST (Unique) ---');
        Array.from(journalists).sort().forEach(name => console.log(name));
        
        console.log('\n--- DAFTAR EDITOR / PENULIS (Unique) ---');
        Array.from(editors).sort().forEach(name => console.log(name));
        
        console.log('\nTotal Unique Journalists:', journalists.size);
        console.log('Total Unique Editors:', editors.size);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkAuthors();
