/**
 * SINPO MEDIA - MAIN APPLICATION (COMPLETE VERSION)
 * Vanilla JavaScript Single Page Application with Full API Integration
 */

// ==========================================
// API CONFIGURATION
// ==========================================
const API_CONFIG = {
    BASE_URL: 'https://api.sinpo.id/api',
    TOKEN: 'LMyrBrMUP8zpYV5d',
    IMAGE_BASE: 'https://sinpo.id',
    HEADERS: {
        'Authorization': 'Bearer LMyrBrMUP8zpYV5d',
        'Accept': '*/*',
    }
};

// ==========================================
// STATE MANAGEMENT
// ==========================================
const AppState = {
    currentPage: 'home',
    currentData: null,
    newsCache: {},
    darkMode: false,
    isLoading: false,
    latestOffset: 0, // Tambahan untuk load more
    latestLimit: 5,   // Jumlah load per klik
    beritaUtamaOffset: 15, // Offset awal untuk Berita Utama
    beritaUtamaLimit: 5,    // Limit untuk load more Berita Utama
    categories: null,       // Cache kategori
    categoryOffset: 0,      // Offset untuk pagination kategori
    categoryLimit: 12,      // Limit per load kategori
    currentCategoryId: null, // ID Kategori aktif
    isFetchingCategory: false, // Flag loading
    hasMoreCategory: true,   // Flag jika masih ada berita
    seenIds: new Set()      // Tracker untuk mencegah duplikasi
};

/**
 * Helper to register news IDs to seenIds
 * @param {Array|Object} items 
 */
function registerSeenNews(items) {
    if (!items) return;
    const array = Array.isArray(items) ? items : [items];
    array.forEach(item => {
        if (item && item.id) AppState.seenIds.add(item.id);
    });
}

/**
 * Filter items that already exist in seenIds
 * @param {Array} items 
 * @returns {Array}
 */
function filterSeenNews(items) {
    if (!items || !Array.isArray(items)) return [];
    return items.filter(item => !AppState.seenIds.has(item.id));
}

// ==========================================
// API REQUEST HANDLER
// ==========================================
async function apiRequest(endpoint, options = {}) {
    try {
        const config = {
            method: options.method || 'GET',
            headers: {
                ...API_CONFIG.HEADERS,
                ...(options.headers || {})
            }
        };

        // Add body if present
        if (options.body) {
            if (options.body instanceof FormData) {
                // Don't set Content-Type for FormData, browser will set it with boundary
                config.body = options.body;
                delete config.headers['Content-Type'];
            } else {
                config.headers['Content-Type'] = 'application/json';
                config.body = JSON.stringify(options.body);
            }
        }

        const url = `${API_CONFIG.BASE_URL}${endpoint}`;
        const response = await fetch(url, config);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Check if API returned success: false
        if (result.success === false) {
            throw new Error(result.message || 'Request failed');
        }

        // Apply mapping if type is specified
        if (result.data && options.type) {
            result.data = mapGeneric(result.data, options.type);
        }
        
        return result;
    } catch (error) {
        console.error('API Error:', error);
        return { 
            success: false, 
            data: null, 
            message: error.message 
        };
    }
}

// ==========================================
// DUMMY DATA (FALLBACK)
// ==========================================
const POLLING_FALLBACK_DATA = [
    {
        id: 101,
        question: "Pilpres 2029, Siapa yang Akan Anda Pilih?",
        options: [
            { id: 1, label: "Prabowo Subianto" },
            { id: 2, label: "Gibran Rakabuming" },
            { id: 3, label: "Anies Baswedan" },
            { id: 4, label: "Ganjar Pranowo" }
        ],
        total_votes: 12450
    },
    {
        id: 102,
        question: "Setujukah Anda dengan RUU Perampasan Aset?",
        options: [
            { id: 1, label: "Sangat Setuju" },
            { id: 2, label: "Setuju" },
            { id: 3, label: "Kurang Setuju" },
            { id: 4, label: "Tidak Setuju" }
        ],
        total_votes: 8320
    },
    {
        id: 103,
        question: "Kinerja KPK Periode Ini Menurut Anda?",
        options: [
            { id: 1, label: "Sangat Baik" },
            { id: 2, label: "Cukup Baik" },
            { id: 3, label: "Buruk" },
            { id: 4, label: "Sangat Buruk" }
        ],
        total_votes: 5600
    }
];

// ==========================================
// API ENDPOINTS
// ==========================================
// ==========================================
// MAPPING FUNCTIONS
// ==========================================

function mapCategory(raw) {
    return {
        id: raw.id,
        name: raw.nama || raw.name || 'Umum',
        slug: raw.slug || (raw.nama ? raw.nama.toLowerCase().replace(/\s+/g, '-') : 'umum'),
    };
}

function mapAuthor(raw) {
    return {
        id: raw.id || 0,
        name: raw.nama || raw.name || 'Redaksi',
        avatar: raw.avatar || '',
        bio: raw.bio || '',
        status: raw.status || '',
    };
}

function mapChannel(raw) {
    return {
        id: raw.id,
        name: raw.nama || raw.name || '',
        slug: raw.slug || (raw.nama ? raw.nama.toLowerCase().replace(/\s+/g, '-') : ''),
        type: raw.tipe,
        navigation: raw.navigasi,
        order: raw.urut,
    };
}

function mapGallery(raw) {
    return {
        id: raw.id,
        title: raw.judul || '',
        article_id: raw.id_berita,
        image: raw.gambar || '',
        created_at: raw.created_at,
    };
}

function mapNewsItem(raw) {
    const channelName = raw.channel?.name || raw.datachannel?.nama || '';
    const categoryName = raw.category?.name || raw.datakategori?.nama || channelName || 'Umum';

    // Handle nested author data which might be in datawartawan or author
    const authorData = raw.datawartawan || raw.author || raw.quartawan || {};

    // 1. Enhanced Channel/Folder Detection
    // Try every possible field that might contain the channel ID
    const channelId = raw.id_channel || 
                      raw.channel_id || 
                      raw.channel?.id || 
                      raw.datachannel?.id || 
                      raw.cid || 
                      0;

    // Try common field names for folder
    const folder = raw.folder || raw.file_folder || raw.directory || raw.path;


    // 2. Logic "force" display image parsing
    // Prioritize keys that likely contain the full URL or specific filename
    let rawImage = raw.gambar_detail || 
                   raw.cover || 
                   raw.gambar || 
                   raw.foto || 
                   raw.thumbnail || 
                   raw.gambar_kecil || 
                   raw.image || 
                   raw.gambar_utama || 
                   raw.foto_utama || 
                   raw.img || 
                   raw.url_gambar ||
                   raw.feature_image ||
                   raw.thumb_url ||
                   raw.image_url ||
                   raw.cover_url;

    // Handle case where image might be an object
    let imageSrc = '';
    if (rawImage) {
        if (typeof rawImage === 'string') {
            imageSrc = rawImage;
        } else if (typeof rawImage === 'object') {
            imageSrc = rawImage.url || rawImage.path || rawImage.file || '';
        }
    }

    // If imageSrc is just a filename (no slashes, no http), try to prepend path
    if (imageSrc && typeof imageSrc === 'string' && !imageSrc.startsWith('http') && !imageSrc.includes('/')) {
       if (folder) {
           imageSrc = `${folder}/${imageSrc}`;
       } else if (channelId) {
            // Default behavior for SinPo: images often in channel folders if not root
            imageSrc = `channel/${channelId}/${imageSrc}`;
       } else {
           // FORCE ATTEMPT: If no folder/channel info but we have a filename, 
           // and we are in a specific category context (which implies a channel usually),
           // we might guess. But better to leave it for getImageUrl to handle as root storage resource.
           // However, user said "force it".
           // If we have category_id, maybe we can try that? unlikely.
       }
    }

    // Final fallback: if completely empty, AND we have id_channel/folder logic that we didn't use (e.g. imageSrc was null)
    if (!imageSrc) {
       if (raw.gambar && channelId) {
            imageSrc = `channel/${channelId}/${raw.gambar}`;
       } else if (raw.gambar && folder) {
            imageSrc = `${folder}/${raw.gambar}`;
       }
    }

    return {
        id: raw.id || raw.id_berita || 0,
        title: raw.title || raw.judul || '',
        slug: raw.slug || '',
        summary: raw.summary || (raw.isi ? raw.isi.replace(/<[^>]*>?/gm, '').substring(0, 160) : ''),
        content: raw.isi || raw.content || '',
        cover: imageSrc || '',
        image: imageSrc || null,
        cover_credit: raw.caption || raw.cover_credit || '',
        created_at: raw.created_at || raw.tanggal_tayang || '',
        updated_at: raw.updated_at || '',
        published_at: raw.published_at || raw.tanggal_tayang || '',
        views: raw.views || raw.counter || 0,
        tags: raw.tags || (raw.tag ? raw.tag.split(',').map(t => t.trim()) : []),
        category: {
            id: raw.category?.id || raw.id_categories || 0,
            name: categoryName,
            slug: raw.category?.slug || '',
        },
        author: mapAuthor(authorData),
        channel: {
            id: channelId,
            name: channelName,
            slug: raw.channel?.slug || '',
        },
        editor: raw.penulis || '',
        journalist: raw.wartawan || '',
        gallery: Array.isArray(raw.datagallery) ? raw.datagallery.map(mapGallery) : [],
    };
}

function mapPhoto(raw) {
    return {
        id: raw.id,
        title: raw.judul || '',
        token: raw.token || '',
        image: raw.gambar || '',
        created_at: raw.created_at,
    };
}

function mapKomentar(raw) {
    return {
        id: raw.id,
        name: raw.nama || '',
        email: raw.email || '',
        comment: raw.komentar || '',
        article_id: raw.id_berita,
        channel_id: raw.id_channel,
        category_id: raw.id_categories,
        is_published: raw.publish === '1',
        date: raw.tanggal || '',
    };
}


function mapStatis(raw) {
    return {
        id: raw.id,
        title: raw.judul || '',
        content: raw.isi || '',
        channel_id: raw.id_channel,
        category_id: raw.id_categories,
        created_at: raw.created_at,
    };
}

function mapIklan(raw) {
    return {
        id: raw.id,
        name: raw.nama || '',
        type: raw.jenis || '',
        position: raw.posisi || '',
        status: raw.status || '',
        order: raw.urutan || 0,
        start_date: raw.awal_tayang || '',
        end_date: raw.akhir_tayang || '',
        image: raw.gambar,
        url: raw.url,
    };
}

function mapLink(raw) {
    return {
        id: raw.id,
        name: raw.nama || '',
        url: raw.url || '',
        channel_id: raw.id_channel,
        category_id: raw.id_categories,
    };
}

function mapNewsletter(raw) {
    return {
        id: raw.id,
        email: raw.email || '',
        channel_id: raw.id_channel,
        status: raw.stts || '',
    };
}

function mapPolling(raw) {
    const options = Array.isArray(raw.options) ? raw.options.map(opt => ({
        id: opt.id,
        label: opt.label || '',
        votes: opt.votes || 0
    })) : [];

    // Fallback for classic structure (answer1, vote1, etc.)
    if (options.length === 0) {
        for (let i = 1; i <= 6; i++) {
            if (raw[`answer${i}`]) {
                options.push({
                    id: i,
                    label: raw[`answer${i}`],
                    votes: raw[`vote${i}`] || 0
                });
            }
        }
    }

    return {
        id: raw.id,
        title: raw.title || '',
        question: raw.question || '',
        total_votes: raw.total_votes || 0,
        options,
        created_at: raw.created_at,
    };
}

function mapGeneric(data, type) {
    if (!data) return data;
    if (Array.isArray(data)) {
        return data.map(item => mapGeneric(item, type));
    }
    
    switch(type) {
        case 'news': return mapNewsItem(data);
        case 'category': return mapCategory(data);
        case 'channel': return mapChannel(data);
        case 'author': return mapAuthor(data);
        case 'gallery': return mapGallery(data);
        case 'photo': return mapPhoto(data);
        case 'komentar': return mapKomentar(data);
        case 'statis': return mapStatis(data);
        case 'iklan': return mapIklan(data);
        case 'link': return mapLink(data);
        case 'newsletter': return mapNewsletter(data);
        case 'polling': return mapPolling(data);
        default: return data;
    }
}

// ==========================================
// API ENDPOINTS
// ==========================================
const API = {
    // BERITA (NEWS)
    berita: {
        list: (params = {}) => {
            const query = new URLSearchParams({
                limit: 10,
                sort: 'desc',
                ...params
            }).toString();
            return apiRequest(`/berita?${query}`, { type: 'news' });
        },
        detail: (id) => apiRequest(`/berita/${id}`, { type: 'news' }),
        headline: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return apiRequest(`/headline?${query}`, { type: 'news' });
        },
        populer: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return apiRequest(`/populer?${query}`, { type: 'news' });
        },
        terkait: (id, params = {}) => {
            const query = new URLSearchParams(params).toString();
            return apiRequest(`/terkait/${id}?${query}`, { type: 'news' });
        }
    },

    // KATEGORI (CATEGORIES)
    kategori: {
        list: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return apiRequest(`/kategori?${query}`, { type: 'category' });
        },
        detail: (id) => apiRequest(`/kategori/${id}`, { type: 'category' })
    },

    // CHANNEL
    channel: {
        list: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return apiRequest(`/channel?${query}`, { type: 'channel' });
        },
        detail: (id) => apiRequest(`/channel/${id}`, { type: 'channel' })
    },

    // GALLERY
    gallery: {
        list: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return apiRequest(`/gallery?${query}`, { type: 'gallery' });
        },
        detail: (id) => apiRequest(`/gallery/${id}`, { type: 'gallery' })
    },

    // AUTHOR (WARTAWAN)
    wartawan: {
        list: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return apiRequest(`/wartawan?${query}`, { type: 'author' });
        },
        detail: (id) => apiRequest(`/wartawan/${id}`, { type: 'author' })
    },

    // PHOTO
    photo: {
        list: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return apiRequest(`/photo?${query}`, { type: 'photo' });
        },
        detail: (id) => apiRequest(`/photo/${id}`, { type: 'photo' })
    },

    // POLLING
    polling: {
        list: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return apiRequest(`/polling?${query}`, { type: 'polling' });
        },
        detail: (id) => apiRequest(`/polling/${id}`, { type: 'polling' }),
        vote: (pollingId, optionId) => {
            const formData = new FormData();
            formData.append('option', String(optionId));
            return apiRequest(`/polling/${pollingId}/vote`, {
                method: 'POST',
                body: formData
            });
        }
    },

    // KOMENTAR (COMMENTS)
    komentar: {
        list: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return apiRequest(`/komentar?${query}`, { type: 'komentar' });
        },
        store: (data) => {
            const formData = new FormData();
            formData.append('berita_id', String(data.berita_id));
            formData.append('nama', data.name);
            if (data.email) formData.append('email', data.email);
            formData.append('komentar', data.comment);
            return apiRequest('/komentar', {
                method: 'POST',
                body: formData
            });
        }
    },

    // NEWSLETTER
    newsletter: {
        subscribe: (email) => {
            const formData = new FormData();
            formData.append('email', email);
            return apiRequest('/newsletter', {
                method: 'POST',
                body: formData,
                type: 'newsletter'
            });
        }
    },

    // IKLAN (ADS)
    iklan: {
        list: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return apiRequest(`/iklan?${query}`, { type: 'iklan' });
        }
    },

    // STATIS (STATIC PAGES)
    statis: {
        list: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return apiRequest(`/statis?${query}`, { type: 'statis' });
        },
        detail: (id) => apiRequest(`/statis/${id}`, { type: 'statis' })
    },

    // LINK
    link: {
        list: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return apiRequest(`/link?${query}`, { type: 'link' });
        }
    }
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

// Format date to Indonesian
function formatDate(dateString) {
    if (!dateString) return 'Tanggal tidak valid';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Tanggal tidak valid';
    
    return date.toLocaleDateString('id-ID', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });
}

// Format relative time
function formatRelativeTime(dateString) {
    if (!dateString) return 'Baru saja';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffSecs / 3600);
    const diffDays = Math.floor(diffSecs / 86400);

    if (diffSecs < 60) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit yang lalu`;
    if (diffHours < 24) return `${diffHours} jam yang lalu`;
    if (diffDays < 7) return `${diffDays} hari yang lalu`;
    
    return formatDate(dateString);
}

// Get image URL with proper base
function getImageUrl(imagePath) {
    if (!imagePath) return 'https://placehold.co/800x600/eee/999?text=SinPo+Media';
    if (imagePath.startsWith('http')) return imagePath;
    
    // Clean path
    let cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
    
    // If already contains storage/ or uploads/, don't prepend storage/
    if (cleanPath.startsWith('storage/') || cleanPath.startsWith('uploads/')) {
        return `${API_CONFIG.IMAGE_BASE}/${cleanPath}`;
    }
    
    return `${API_CONFIG.IMAGE_BASE}/storage/${cleanPath}`;
}

// Strip HTML tags
function stripHtml(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

// Truncate text
function truncateText(text, maxLength = 150) {
    if (!text) return '';
    const clean = stripHtml(text);
    if (clean.length <= maxLength) return clean;
    return clean.substring(0, maxLength) + '...';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Format author name
function formatAuthorName(author) {
    if (!author) return 'Redaksi';
    if (typeof author === 'string') return author;
    return author.name || author.nama || 'Redaksi';
}

// Get author name with priority
function getAuthorName(item) {
    return item?.journalist || item?.wartawan || formatAuthorName(item?.author) || 'Redaksi';
}

// Format category name
function formatCategoryName(category) {
    if (!category) return 'Umum';
    if (typeof category === 'string') return category;
    return category.name || category.nama || 'Umum';
}

// Safe array conversion
function safeArray(data) {
    return Array.isArray(data) ? data : [];
}

// Fix content images to absolute URLs
function fixContentImages(html) {
    if (!html) return '';
    return html.replace(/<img[^>]+src=["'](?!(?:http|https|data):)([^"']+)["']/g, (match, p1) => {
        const cleanPath = p1.startsWith('/') ? p1.substring(1) : p1;
        const newUrl = `${API_CONFIG.IMAGE_BASE}/storage/${cleanPath}`;
        return match.replace(p1, newUrl);
    });
}

// ==========================================
// THEME FUNCTIONS
// ==========================================
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    AppState.darkMode = isDark;
    document.body.classList.toggle('dark-mode', isDark);
    updateThemeIcon();
}

function toggleTheme() {
    AppState.darkMode = !AppState.darkMode;
    document.body.classList.toggle('dark-mode', AppState.darkMode);
    localStorage.setItem('theme', AppState.darkMode ? 'dark' : 'light');
    updateThemeIcon();
}

function updateThemeIcon() {
    // KOSONGKAN SAJA. 
    // Kita sekarang menggunakan CSS untuk mengubah icon (SVG), 
    // jadi tidak perlu mengubah textContent lewat JS lagi.
}

// Update Date Display
function updateDateDisplay() {
    const el = document.getElementById('date-display');
    if (!el) return;

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    const now = new Date();
    const dayName = days[now.getDay()];
    const day = now.getDate();
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    el.textContent = `${dayName}, ${day} ${month} ${year} | ${hours}:${minutes}`;
}

// Update date every minute
setInterval(updateDateDisplay, 60000);

// ==========================================
// NAVIGATION
// ==========================================
function navigate(page, event, params = {}) {
    if (event) event.preventDefault();
    
    AppState.currentPage = page;
    AppState.currentData = params;
    
    // Update URL hash
    if (page === 'home') {
        window.location.hash = '';
    } else if (page === 'article' && params.id) {
        window.location.hash = `article/${params.id}`;
    } else if (page === 'category' && params.id) {
        window.location.hash = `category/${params.id}`;
    } else if (page === 'author' && params.id) {
        window.location.hash = `author/${params.id}`;
    } else if (page === 'gallery') {
        window.location.hash = 'gallery';
    } else if (page === 'search' && params.q) {
        window.location.hash = `search/${encodeURIComponent(params.q)}`;
    }
    
    renderPage(page, params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// PAGE RENDERING
// ==========================================
async function renderPage(page, params) {
    const app = document.getElementById('app');
    
    // Show user feedback immediately
    showLoading();

    // Initial Date Update
    setTimeout(updateDateDisplay, 100);

    try {
        switch (page) {
            case 'home':
                await renderHome();
                break;
            case 'article':
                await renderArticle(params.id);
                break;
            case 'category':
                await renderCategory(params.id);
                break;
            case 'author':
                await renderAuthor(params.id);
                break;
            case 'gallery':
                await renderGallery();
                break;
            case 'search':
                await renderSearch(params.id || params.q);
                break;
            default:
                await renderHome();
        }
    } catch (error) {
        console.error('Render error:', error);
        showError('Terjadi kesalahan saat memuat halaman. Silakan coba lagi.');
    } finally {
        // Ensure loading is hidden after everything is done
        hideLoading();
    }
}

function showLoading() {
    const app = document.getElementById('app');
    document.body.classList.add('is-loading');
    
    app.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
        </div>
    `;
}

function hideLoading() {
    document.body.classList.remove('is-loading');
    // We don't need to clear innerHTML here because render functions usually overwrite it
    // But we should ensure the .loading element is gone if it was appended (here we overwrite app.innerHTML so it's fine)
}

function showError(message) {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="container error-container">
            <div class="error-icon">⚠️</div>
            <h2 class="error-title">Oops! Ada Masalah</h2>
            <p class="error-message">${escapeHtml(message)}</p>
            <button class="btn btn-primary" onclick="navigate('home', event)">
                Kembali ke Beranda
            </button>
        </div>
    `;
}

// ==========================================
// HOME PAGE
// ==========================================


function createHeroSection(headline) {
    return `
        <section class="hero">
            <img src="${getImageUrl(headline.image || headline.cover)}" 
                 alt="${escapeHtml(headline.title)}" 
                 class="hero-image"
                 onerror="this.src='https://placehold.co/1920x1080/000/333?text=SinPo+Media'">
            <div class="hero-overlay"></div>
            <div class="hero-content">
                <div class="hero-meta">
                    <span>👤 ${escapeHtml(getAuthorName(headline))}</span>
                    <span>•</span>
                    <span>🕒 ${formatRelativeTime(headline.published_at || headline.created_at)}</span>
                </div>
                <h1 class="hero-title" onclick="navigate('article', event, {id: ${headline.id}})">
                    ${escapeHtml(headline.title)}
                </h1>
            </div>
        </section>
    `;
}

function createSidebarCard(news) {
    const categoryName = formatCategoryName(news.category);
    const catClass = categoryName.toLowerCase() === 'bongkar' ? 'cat-large-red' : 'cat-small';

    return `
        <div class="sidebar-news-card" onclick="navigate('article', event, {id: ${news.id}})">
            <div class="${catClass}">${escapeHtml(categoryName)}</div>
            <img src="${getImageUrl(news.image || news.cover || news.thumbnail || news.image_url)}" 
                 alt="${escapeHtml(news.title)}"
                 class="sidebar-news-image"
                 onerror="this.src='https://placehold.co/400x300/333/666?text=SinPo'">
            <h4 class="sidebar-news-title">${escapeHtml(news.title)}</h4>
        </div>
    `;
}

// ==========================================
// ARTICLE DETAIL PAGE
// ==========================================
async function renderArticle(id) {
    const [detailRes, relatedRes, commentsRes, sidebarRes] = await Promise.all([
        API.berita.detail(id),
        API.berita.terkait(id, { limit: 6 }),
        API.komentar.list({ id_berita: id, limit: 10 }),
        API.berita.populer({ limit: 7 })
    ]);

    const article = detailRes.data;
    const relatedNews = safeArray(relatedRes.data);
    const comments = safeArray(commentsRes.data);
    const sidebarNews = safeArray(sidebarRes.data);
    
    // Split related news for 2 columns
    const relatedLeft = relatedNews.slice(0, 3);
    const relatedRight = relatedNews.slice(3, 6);

    // Split: 2 for "TDK KALAH PENTING", rest for "BERITA TERPOPULER" (Limit 5)
    const tdkNews = sidebarNews.slice(0, 2);
    const populerNews = sidebarNews.slice(2, 7);

    if (!article) {
        showError('Artikel tidak ditemukan');
        return;
    }

    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="article-wrapper">
            <div class="container article-container-grid">
                <!-- Main Content Column -->
                <div class="article-main-column">
                    <article class="article-detail">
                        <h1 class="article-title">${escapeHtml(article.title)}</h1>
                        <div class="publisher-info-bar">
                            <div class="publisher-group plain-group">
                                <div class="publisher-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3Zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
                                    </svg>
                                </div>
                                <div class="publisher-details">
                                    <span class="publisher-label">WARTAWAN</span>
                                    <span class="publisher-value text-red">${escapeHtml(article.journalist || 'TIM REDAKSI')}</span>
                                </div>
                            </div>

                            <div class="publisher-divider"></div>

                            <div class="publisher-group">
                                <div class="publisher-details">
                                    <span class="publisher-label">EDITOR</span>
                                    <span class="publisher-value">${escapeHtml(article.editor || 'Tim Redaksi')}</span>
                                </div>
                            </div>

                            <div class="publisher-divider"></div>

                            <div class="publisher-group">
                                <div class="publisher-details">
                                    <span class="publisher-label">TERBIT</span>
                                    <span class="publisher-value">${formatDate(article.published_at || article.created_at)}</span>
                                </div>
                            </div>

                            <div class="publisher-spacer"></div>

                            <div class="publisher-group">
                                <div class="publisher-details align-right">
                                    <span class="publisher-label">DILIHAT</span>
                                    <span class="publisher-value">${(article.views || 0).toLocaleString('id-ID')} KALI</span>
                                </div>
                            </div>
                        </div>
                        <img src="${getImageUrl(article.image || article.cover)}" 
                             alt="${escapeHtml(article.title)}" 
                             class="article-image"
                             onerror="this.src='https://placehold.co/800x600/eee/999?text=SinPo+Media'">
                        ${article.cover_credit ? `<p class="image-credit">${escapeHtml(article.cover_credit)}</p>` : ''}
                        <div class="article-content">
                            ${fixContentImages(article.content || '<p>Konten tidak tersedia.</p>')}
                        </div>

                        ${article.tags && article.tags.length > 0 ? `
                            <div class="article-tags">
                                <strong>Tags:</strong>
                                ${article.tags.map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
                            </div>
                        ` : ''}
                    </article>

                    ${relatedNews.length > 0 ? `
                        <div class="related-news">
                            <h3 class="section-title" style="border-bottom:none; margin-bottom:1rem; font-size:1.5rem;">BERITA TERKAIT</h3>
                            <div class="related-news-container">
                                <!-- Left Column -->
                                <div class="related-column">
                                    ${relatedLeft.length > 0 ? createRelatedFeatured(relatedLeft[0]) : ''}
                                    ${relatedLeft.slice(1).map(news => createRelatedText(news)).join('')}
                                </div>
                                <!-- Right Column -->
                                <div class="related-column">
                                     ${relatedRight.length > 0 ? createRelatedFeatured(relatedRight[0]) : ''}
                                     ${relatedRight.slice(1).map(news => createRelatedText(news)).join('')}
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    ${createCommentSection(id, comments)}

                    <div style="margin-top: 3rem; text-align: center;">
                        <button class="btn btn-secondary" onclick="navigate('home', event)">
                            ← Kembali ke Beranda
                        </button>
                    </div>
                </div>

                <!-- Right Sidebar Column -->
                <aside class="article-sidebar">
                    <!-- TDK KALAH PENTING (Limit 2) -->
                    <div class="home-sidebar dark-theme" style="margin-top: 0; padding: 1.5rem; border-radius: 8px; position: relative !important; top: auto !important;">
                        <h3 class="sidebar-title-new">TDK KALAH PENTING</h3>
                        <div class="sidebar-underline"></div>
                        <div class="popular-list-new">
                            ${tdkNews.map((news, index) => `
                                ${index > 0 ? '<div class="sidebar-divider"></div>' : ''}
                                ${createSidebarCard(news)}
                            `).join('')}
                        </div>
                    </div>

                    <!-- NEW: BERITA TERPOPULER -->
                    ${populerNews.length > 0 ? `
                        <div class="popular-section-new" style="margin-top: 3rem;">
                            <h3 class="sidebar-title-strong">BERITA TERPOPULER</h3>
                            
                            <!-- Featured Item (First) -->
                            <div class="populer-featured" onclick="navigate('article', event, {id: ${populerNews[0].id}})">
                                <img src="${getImageUrl(populerNews[0].image || populerNews[0].cover || populerNews[0].thumbnail)}" alt="${escapeHtml(populerNews[0].title)}" class="populer-featured-img" onerror="this.src='https://placehold.co/800x450/333/666?text=SinPo'">
                                <div class="populer-featured-info">
                                    <span class="populer-author">${escapeHtml(getAuthorName(populerNews[0]))}</span>
                                    <span class="populer-date">${formatRelativeTime(populerNews[0].published_at || populerNews[0].created_at)}</span>
                                </div>
                                <h3 class="populer-featured-title">${escapeHtml(populerNews[0].title)}</h3>
                            </div>
                            
                            <!-- List Items (Rest) -->
                            <div class="populer-list-items">
                                ${populerNews.slice(1).map(news => `
                                    <div class="populer-list-row" onclick="navigate('article', event, {id: ${news.id}})">
                                        <img src="${getImageUrl(news.image || news.cover || news.thumbnail)}" alt="${escapeHtml(news.title)}" class="populer-list-thumb" onerror="this.src='https://placehold.co/150x100/333/666?text=SinPo'">
                                        <div class="populer-list-content">
                                            <h4 class="populer-list-title">${escapeHtml(news.title)}</h4>
                                            <div class="populer-list-meta">
                                                <span class="populer-meta-author">${escapeHtml(getAuthorName(news))}</span>
                                                <span class="populer-meta-date">${formatRelativeTime(news.published_at || news.created_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </aside>
            </div>
        </div>
    `;
}

// ==========================================
// CATEGORY PAGE
// ==========================================
// ==========================================
// CATEGORY PAGE WITH INFINITE SCROLL
// ==========================================
async function renderCategory(categoryId) {
    // 1. Ensure categories are loaded for Slug -> ID mapping
    if (!AppState.categories) {
        try {
            const catRes = await API.kategori.list();
            if (catRes.success) {
                AppState.categories = safeArray(catRes.data);
            }
        } catch (e) {
            console.error("Failed to load categories for mapping", e);
        }
    }

    // 2. Resolve Slug to ID
    let finalId = categoryId;
    let categoryName = String(categoryId).toUpperCase();

    if (AppState.categories && Array.isArray(AppState.categories)) {
        const search = String(categoryId).toLowerCase();
        const found = AppState.categories.find(c => 
            (c.slug && c.slug.toLowerCase() === search) || 
            (c.nama && c.nama.toLowerCase() === search) ||
            (c.name && c.name.toLowerCase() === search)
        );

        if (found) {
            finalId = found.id;
            categoryName = found.nama || found.name || categoryName;
            console.log(`Mapped category slug '${categoryId}' to ID: ${finalId} (${categoryName})`);
        }
    }

    // 3. Reset Pagination State
    // We will manually load the first 5 items (1 Hero + 4 List)
    AppState.categoryOffset = 0; 
    AppState.hasMoreCategory = true;
    AppState.isFetchingCategory = false;
    AppState.currentCategoryId = finalId;

    const app = document.getElementById('app');
    
    // Render Initial Frame (Skeleton for Overlay + Highlight)
    app.innerHTML = `
        <div class="container">
            <h1 class="category-label">
                CATEGORY: ${escapeHtml(categoryName.toUpperCase())}
            </h1>

            <!-- New Overlay Hero Section -->
            <div class="category-overlay-hero" id="category-hero-bg">
                <div class="category-overlay-mask"></div>
                <div class="category-overlay-content">
                    
                    <!-- LEFT: Main Article Text (Overlay) -->
                    <div class="cat-overlay-left" id="cat-hero-main">
                        <!-- Skeleton -->
                         <div style="height: 40px; width: 60%; background: rgba(255,255,255,0.2); margin-bottom: 1rem;"></div>
                         <div style="height: 20px; width: 90%; background: rgba(255,255,255,0.2); margin-bottom: 0.5rem;"></div>
                         <div style="height: 20px; width: 80%; background: rgba(255,255,255,0.2);"></div>
                    </div>

                    <!-- RIGHT: News List (Glassmorphism Overlay) -->
                    <div class="cat-overlay-list-wrapper" id="cat-hero-list">
                         <!-- Skeleton -->
                         <div style="height: 60px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 1rem;"></div>
                         <div style="height: 60px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 1rem;"></div>
                    </div>
                </div>
            </div>

            <!-- Highlight Section (Feature + List + Ad) -->
            <section class="category-highlight-section desktop-only" id="category-highlight-section">
                <!-- Header Removed as per request -->
                
                <div class="highlight-grid">
                    <!-- Col 1: Feature Card -->
                    <div class="highlight-feature-card" id="highlight-feature">
                         <!-- Skeleton -->
                         <div style="width: 100%; aspect-ratio: 16/9; background: #eee;"></div>
                         <div style="height: 20px; width: 80%; background: #eee;"></div>
                    </div>

                    <!-- Col 2: List Cards (Horizontal) -->
                    <div class="highlight-list" id="highlight-list">
                         <!-- Skeleton -->
                         <div style="height: 80px; width: 100%; background: #eee;"></div>
                         <div style="height: 80px; width: 100%; background: #eee;"></div>
                         <div style="height: 80px; width: 100%; background: #eee;"></div>
                    </div>

                    <!-- Col 3: Ad Placeholder -->
                    <div class="highlight-ad-col">
                        <div class="highlight-ad-placeholder">ADS</div>
                    </div>
                </div>
            </section>

            <!-- 2-COLUMN CONTENT GRID -->
            <div class="category-content-grid">
                
                <!-- LEFT COLUMN: Main News List + Load More -->
                <div class="category-main-col">
                    <div class="category-news-list" id="category-news-list">
                        <!-- Content injected here (Items 10-14...) -->
                    </div>
                    
                    <!-- Load More Button (Full Width of Column) -->
                    <div id="category-load-more-btn-wrapper" class="hidden" style="margin-top: 2rem;">
                         <button class="btn-load-more-pill btn-col-full" onclick="loadMoreCategoryItems()">Muat lagi</button>
                    </div>
                </div>

                <!-- RIGHT COLUMN: Sidebar (Berita Terkini/Index) -->
                <div class="category-sidebar-col">
                    <h3 class="cat-sidebar-title">BERITA TERKINI</h3>
                    
                    <div class="cat-sidebar-list" id="category-sidebar-list">
                        <!-- Content injected here (Items 15-19...) -->
                         <!-- Skeleton -->
                         <div style="height: 60px; background: #f9f9f9;"></div>
                         <div style="height: 60px; background: #f9f9f9;"></div>
                    </div>

                    <!-- Indeks Button (Full Width of Column) -->
                    <button class="btn-index-pill btn-col-full" onclick="navigate('indeks')">INDEKS BERITA</button>
                </div>

            </div>
        </div>
    `;

    // 4. Manual First Fetch (Fetch 20 items: 5 Hero + 5 Highlight + 5 List + 5 Sidebar)
    try {
        AppState.isFetchingCategory = true;
        const data = await API.berita.list({ 
            kategori: AppState.currentCategoryId, 
            limit: 20, 
            offset: 0
        });
        
        const news = safeArray(data.data);
        AppState.isFetchingCategory = false;

        const heroBgEl = document.getElementById('category-hero-bg');
        const heroMainEl = document.getElementById('cat-hero-main');
        const listEl = document.getElementById('cat-hero-list');
        
        // Highlight Elements
        const highlightSection = document.getElementById('category-highlight-section');
        const highFeatureEl = document.getElementById('highlight-feature');
        const highListEl = document.getElementById('highlight-list');

        // New Columns
        const mainListEl = document.getElementById('category-news-list');
        const sidebarListEl = document.getElementById('category-sidebar-list');
        const loadMoreWrapper = document.getElementById('category-load-more-btn-wrapper');
        
        // Clear skeletons
        mainListEl.innerHTML = '';
        sidebarListEl.innerHTML = '';

        if (news.length > 0) {
            // =========================
            // RENDER HERO (Items 0-4)
            // =========================
            const heroItem = news[0];
            
            // Set Background Image
            const bgUrl = getImageUrl(heroItem.image || heroItem.cover);
            heroBgEl.style.backgroundImage = `url('${bgUrl}')`;

            // Render Main Text
            // Tag Removed as per request
            heroMainEl.innerHTML = `
                <h2 class="cat-overlay-title" onclick="navigate('article', event, {id: ${heroItem.id}})">${escapeHtml(heroItem.title)}</h2>
                <p class="cat-overlay-summary">${escapeHtml(heroItem.summary)}</p>
                <div class="cat-overlay-meta">
                    <span>${escapeHtml(getAuthorName(heroItem)).toUpperCase()}</span> • 
                    <span>${formatDate(heroItem.published_at || heroItem.created_at)}</span>
                </div>
            `;

            // Render Hero List (Items 1-4)
            listEl.innerHTML = ''; 
            if (news.length > 1) {
                const listItems = news.slice(1, 5);
                listItems.forEach((item, index) => {
                    listEl.innerHTML += `
                        <div class="cat-overlay-list-item" onclick="navigate('article', event, {id: ${item.id}})">
                            <span class="cat-list-number">${index + 1}</span>
                            <div class="cat-list-info">
                                <span class="cat-list-category-mobile">${escapeHtml(formatCategoryName(item.category))}</span>
                                <h3 class="cat-overlay-list-title">${escapeHtml(item.title)}</h3>
                                <div class="cat-list-meta-mobile">
                                    <span class="cat-list-time">${formatRelativeTime(item.published_at || item.created_at)}</span>
                                </div>
                                <span class="cat-overlay-list-date">${formatDate(item.published_at || item.created_at)}</span>
                            </div>
                        </div>
                    `;
                });
            } else {
                listEl.style.display = 'none';
            }


            // =========================
            // RENDER HIGHLIGHT (Items 5-9)
            // =========================
            if (news.length > 5) {
                const highItems = news.slice(5, 10);
                
                // Feature Card (Item 5)
                const featItem = highItems[0];
                highFeatureEl.innerHTML = `
                    <div class="highlight-feature-img-wrapper" onclick="navigate('article', event, {id: ${featItem.id}})">
                        <img src="${getImageUrl(featItem.image || featItem.cover)}" class="highlight-feature-img" alt="${escapeHtml(featItem.title)}" 
                        onerror="this.src='https://placehold.co/800x600/eee/999?text=SinPo+Media'">
                    </div>
                    <div class="highlight-feature-content">
                        <div class="highlight-meta" style="margin-bottom:0.5rem; margin-top:0;">
                             <img src="${featItem.author?.avatar || 'https://ui-avatars.com/api/?name=' + getAuthorName(featItem)}" class="highlight-avatar" alt="Avatar">
                             <span>${escapeHtml(getAuthorName(featItem)).toUpperCase()}</span>
                             <span>${formatDate(featItem.published_at)}</span>
                        </div>
                        <h3 onclick="navigate('article', event, {id: ${featItem.id}})">${escapeHtml(featItem.title)}</h3>
                    </div>
                `;

                // List Cards (Items 6-9)
                highListEl.innerHTML = '';
                if (highItems.length > 1) {
                    const sideItems = highItems.slice(1);
                    sideItems.forEach(item => {
                        highListEl.innerHTML += `
                            <div class="highlight-list-card" onclick="navigate('article', event, {id: ${item.id}})">
                                <div class="highlight-list-img-wrapper">
                                    <img src="${getImageUrl(item.image || item.cover)}" class="highlight-list-img" alt="${escapeHtml(item.title)}"
                                    onerror="this.src='https://placehold.co/800x600/eee/999?text=SinPo+Media'">
                                </div>
                                <div class="highlight-list-content">
                                    <div class="highlight-meta" style="margin-top:0; margin-bottom:0.3rem;">
                                        <img src="${item.author?.avatar || 'https://ui-avatars.com/api/?name=' + getAuthorName(item)}" class="highlight-avatar" alt="Avatar">
                                        <span>${escapeHtml(getAuthorName(item)).toUpperCase()}</span>
                                    </div>
                                    <h3>${escapeHtml(item.title)}</h3>
                                    <span class="highlight-meta" style="margin-top: auto;">${formatDate(item.published_at)}</span>
                                </div>
                            </div>
                        `;
                    });
                } /* else handle empty list if needed */

            } else {
                // Determine if we hide the section or show placeholder if not enough data
                // For now, if < 6 items, hide highlight section
                highlightSection.style.display = 'none';
            }


            // =========================
            // RENDER MAIN LIST (Items 10-14) - LEFT COLUMN
            // =========================
            if (news.length > 10) {
                const mainItems = news.slice(10, 15); // Items 11-15
                
                mainItems.forEach(item => {
                    mainListEl.innerHTML += createTimelineItem(item);
                });
            } else {
                // If no main items, show simple message or nothing
                 mainListEl.innerHTML = '<p class="text-center empty-state">Tidak ada berita lainnya.</p>';
            }

            // =========================
            // RENDER SIDEBAR (Items 15-19) - RIGHT COLUMN
            // =========================
            if (news.length > 15) {
                const sidebarItems = news.slice(15, 20); // Items 16-20
                
                sidebarItems.forEach(item => {
                    sidebarListEl.innerHTML += `
                        <div class="cat-sidebar-item" onclick="navigate('article', event, {id: ${item.id}})">
                            <div class="cat-sidebar-meta">
                                <span>${escapeHtml(getAuthorName(item))}</span>
                            </div>
                            <h4 class="cat-sidebar-item-title">${escapeHtml(item.title)}</h4>
                            <span class="cat-sidebar-date">${formatDate(item.published_at)} • ${escapeHtml(item.channel?.name || 'News')}</span>
                        </div>
                    `;
                });
            } else {
                 sidebarListEl.innerHTML = '<p class="text-center" style="color:#999;font-size:0.8rem;">Belum ada berita terkini.</p>';
            }


            // Update Offset & Tracker
            AppState.categoryOffset = 20; // Default fetch was 20
            AppState.seenIds.clear();
            registerSeenNews(news);

            // Check if we have more for "Load More" button 
            // If we got full 20 items, there might be more. 
            if (news.length >= 20) {
                 if(loadMoreWrapper) loadMoreWrapper.classList.remove('hidden');
                 AppState.hasMoreCategory = true;
            } else {
                 AppState.hasMoreCategory = false;
                 // Hide load more if we exhausted list
                 if(loadMoreWrapper) loadMoreWrapper.classList.add('hidden');
            }

        } else {
            // NO DATA AT ALL
            heroBgEl.style.display = 'none';
            highlightSection.style.display = 'none';
             mainListEl.innerHTML = `
                <p class="text-center empty-state" style="grid-column: 1/-1;">
                    Belum ada berita di kategori ini.
                </p>
             `;
            AppState.hasMoreCategory = false;
        }

    } catch (error) {
        console.error("Error loading category initial data:", error);
        AppState.isFetchingCategory = false;
    }

    // 5. Attach Scroll Listener
    // 5. Scroll Listener REMOVED for Manual Load
    window.onscroll = null;
}

// Handler Scroll - DISABLED
function handleCategoryScroll() {}

// Old Load More function replaced by appended one
// Renaming this to avoid conflict if any (though last definition wins)
// We will just comment it out to be safe
/*
async function loadMoreCategoryItems_OLD() {
   ...
}
*/


// ==========================================
// AUTHOR PAGE
// ==========================================
async function renderAuthor(authorId) {
    const [authorRes, articlesRes] = await Promise.all([
        API.wartawan.detail(authorId),
        API.berita.list({ penulis: authorId, limit: 12 })
    ]);

    const author = authorRes.data;
    const articles = safeArray(articlesRes.data);

    if (!author) {
        showError('Profil wartawan tidak ditemukan');
        return;
    }

    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="container author-page">
            <div class="author-header">
                <img src="${author.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(author.name)}&background=D91B1B&color=fff&size=256`}" 
                     alt="${escapeHtml(author.name)}" 
                     class="author-avatar"
                     onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(author.name)}&background=D91B1B&color=fff&size=256'">
                <div class="author-info">
                    <h1 class="author-name">${escapeHtml(author.name)}</h1>
                    <span class="author-badge">REDAKSI SINPO</span>
                    ${author.bio ? `<p class="author-bio">${escapeHtml(author.bio)}</p>` : ''}
                </div>
            </div>

            <h2 class="section-title">Kontribusi Berita</h2>
            ${articles.length > 0 ? `
                <div class="news-grid">
                    ${articles.map(item => createNewsCard(item)).join('')}
                </div>
            ` : `
                <p class="text-center empty-state">Belum ada artikel publikasi.</p>
            `}

            <div style="margin-top: 3rem; text-align: center;">
                <button class="btn btn-secondary" onclick="navigate('home', event)">
                    ← Kembali ke Beranda
                </button>
            </div>
        </div>
    `;
}

// ==========================================
// GALLERY PAGE
// ==========================================
async function renderGallery() {
    const [photosRes, galleriesRes] = await Promise.all([
        API.photo.list({ limit: 12 }),
        API.gallery.list({ limit: 8 })
    ]);

    const photos = safeArray(photosRes.data);
    const galleries = safeArray(galleriesRes.data);

    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="container gallery-page">
            <h1 class="section-title">Galeri Foto</h1>

            ${photos.length > 0 ? `
                <div class="gallery-grid">
                    ${photos.map(photo => createPhotoCard(photo)).join('')}
                </div>
            ` : `
                <p class="text-center empty-state">Belum ada foto tersedia.</p>
            `}

            ${galleries.length > 0 ? `
                <h2 class="section-title" style="margin-top: 4rem;">Koleksi Terkait</h2>
                <div class="gallery-collections">
                    ${galleries.map(item => createGalleryCard(item)).join('')}
                </div>
            ` : ''}

            <div style="margin-top: 3rem; text-align: center;">
                <button class="btn btn-secondary" onclick="navigate('home', event)">
                    ← Kembali ke Beranda
                </button>
            </div>
        </div>
    `;
}

// --- Fungsi Membuat Item Timeline (Sesuai Gambar) ---
function createTimelineItem(news) {
    // const authorImg = news.author?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(getAuthorName(news))}&background=dedede&color=999`;
    
    return `
        <div class="timeline-item" onclick="navigate('article', event, {id: ${news.id}})">
            <div class="timeline-marker"></div>
            
            <div class="timeline-image-wrapper">
                <img src="${getImageUrl(news.image || news.cover)}" 
                     alt="${escapeHtml(news.title)}" 
                     class="timeline-image"
                     onerror="this.src='https://placehold.co/400x300/eee/999?text=SinPo'">
            </div>

            <div class="timeline-content">
                <span class="timeline-category">${escapeHtml(formatCategoryName(news.category))}</span> <!-- Added Category -->
                <h3 class="timeline-title">${escapeHtml(news.title)}</h3>
                
                <div class="timeline-meta-header">
                    <!-- Removed Author Image & Inline Styles -->
                    <span class="timeline-author">${escapeHtml(getAuthorName(news))}</span>
                    <span class="timeline-dot">•</span>
                    <span class="timeline-date">${formatDate(news.published_at || news.created_at)}</span>
                </div>
            </div>
        </div>
    `;
}

// --- Fungsi Logic Load More ---
async function loadMoreNews() {
    const btn = document.getElementById('btn-load-more');
    const container = document.getElementById('latest-news-container');
    
    if (!btn || btn.disabled) return;

    btn.innerHTML = '<div class="btn-spinner"></div> Memuat...';
    btn.disabled = true;

    try {
        const fetchLimit = 20; // Fetch larger batch to find unique items
        const currentOffset = AppState.latestOffset;
        
        const res = await API.berita.list({ 
            limit: fetchLimit, 
            offset: currentOffset 
        });
        
        // Advance offset by the amount fetched
        AppState.latestOffset += fetchLimit;

        const rawItems = safeArray(res.data);
        const newItems = filterSeenNews(rawItems).slice(0, 5); // Take only 5 unique

        if (newItems.length > 0) {
            registerSeenNews(newItems);
            newItems.forEach(item => {
                if (container) {
                    const itemHtml = createTimelineItem(item);
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = itemHtml;
                    container.appendChild(tempDiv.firstElementChild);
                }
            });
            
            btn.innerHTML = 'Muat Lebih Banyak';
            btn.disabled = false;
        } else if (rawItems.length >= fetchLimit) {
            // No unique items found in this batch, but there's more data in API
            // Try one more time automatically
            return loadMoreNews();
        } else {
            // Data benar-benar habis
            btn.innerHTML = 'Semua berita telah dimuat';
            btn.disabled = true;
            btn.style.display = 'none';
        }
    } catch (error) {
        console.error('Gagal memuat berita:', error);
        if (btn) {
            btn.innerHTML = 'Coba Lagi';
            btn.disabled = false;
        }
    }
}

// ==========================================
// COMPONENT CREATORS
// ==========================================
function createNewsCard(news) {
    return `
        <article class="news-card" onclick="navigate('article', event, {id: ${news.id}})">
            <img src="${getImageUrl(news.image || news.cover)}" 
                 alt="${escapeHtml(news.title)}" 
                 class="news-card-image"
                 onerror="this.src='https://placehold.co/800x600/eee/999?text=SinPo+Media'">
            <div class="news-card-content">
                <span class="news-card-category">${escapeHtml(formatCategoryName(news.category))}</span>
                <h3 class="news-card-title">${escapeHtml(news.title)}</h3>
                <div class="news-card-meta">
                    <span>${escapeHtml(getAuthorName(news))}</span> • 
                    <span>${formatRelativeTime(news.published_at || news.created_at)}</span>
                </div>
            </div>
        </article>
    `;
}

function createPhotoCard(photo) {
    return `
        <div class="photo-card">
            <img src="${getImageUrl(photo.image)}" 
                 alt="${escapeHtml(photo.title)}" 
                 class="photo-image"
                 onerror="this.src='https://placehold.co/600x400/eee/999?text=SinPo+Media'">
            <div class="photo-overlay">
                <h4 class="photo-title">${escapeHtml(photo.title)}</h4>
            </div>
        </div>
    `;
}

function createGalleryCard(gallery) {
    return `
        <div class="gallery-card" onclick="${gallery.article_id ? `navigate('article', event, {id: ${gallery.article_id}})` : ''}">
            <img src="${getImageUrl(gallery.image)}" 
                 alt="${escapeHtml(gallery.title)}" 
                 class="gallery-image"
                 onerror="this.src='https://placehold.co/600x400/eee/999?text=SinPo+Media'">
            <h4 class="gallery-title">${escapeHtml(gallery.title)}</h4>
        </div>
    `;
}

function createCommentSection(articleId, comments) {
    return `
        <div class="comment-section">
            <h3 class="section-title">Komentar (${comments.length})</h3>
            
            <form class="comment-form" onsubmit="handleCommentSubmit(event, ${articleId})">
                <h4>Tinggalkan Komentar</h4>
                <input type="text" name="name" placeholder="Nama Lengkap *" required class="form-input">
                <input type="email" name="email" placeholder="Email (Opsional)" class="form-input">
                <textarea name="comment" placeholder="Tulis komentar Anda..." required rows="4" class="form-textarea"></textarea>
                <button type="submit" class="btn btn-primary">Kirim Komentar</button>
            </form>

            <div class="comments-list">
                ${comments.length > 0 ? comments.map(comment => `
                    <div class="comment-item">
                        <div class="comment-avatar">👤</div>
                        <div class="comment-content">
                            <div class="comment-header">
                                <strong class="comment-author">${escapeHtml(comment.name)}</strong>
                                <span class="comment-date">${formatRelativeTime(comment.date)}</span>
                            </div>
                            <p class="comment-text">${escapeHtml(comment.comment)}</p>
                        </div>
                    </div>
                `).join('') : `
                    <p class="empty-state">Belum ada komentar. Jadilah yang pertama!</p>
                `}
            </div>
        </div>
    `;
}

// ==========================================
// FORM HANDLERS
// ==========================================
async function handleCommentSubmit(event, articleId) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Mengirim...';
    
    const formData = {
        berita_id: articleId,
        name: form.name.value,
        email: form.email.value,
        comment: form.comment.value
    };
    
    try {
        const result = await API.komentar.store(formData);
        
        if (result.success) {
            alert('Komentar Anda telah dikirim dan sedang menunggu moderasi.');
            form.reset();
            // Reload comments
            renderArticle(articleId);
        } else {
            throw new Error(result.message || 'Gagal mengirim komentar');
        }
    } catch (error) {
        alert('Gagal mengirim komentar: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
}

// ==========================================
// HOME PAGE
// ==========================================
async function renderHome() {
    try {
        // 1. Reset State
        if (typeof AppState !== 'undefined') {
            AppState.seenIds.clear(); 
            AppState.latestLimit = 5;
            AppState.beritaUtamaLimit = 5;
        }
        
        // 2. FETCH DATA (Unified Force-Load)
        // Fetch a large pool (60 items) to guarantee enough unique content for all slots
        const [headlineRes, newsPoolRes, popularRes] = await Promise.all([
            API.berita.headline({ limit: 1 }).catch(() => ({ data: [] })),
            API.berita.list({ limit: 60 }).catch(() => ({ data: [] })),
            API.berita.populer({ limit: 15 }).catch(() => ({ data: [] }))
        ]);

        // 3. Sequential Distribution of Unique Items
        let pool = safeArray(newsPoolRes?.data);
        const headline = safeArray(headlineRes?.data)[0];
        const allPopular = safeArray(popularRes?.data);
        
        // Count how many items from the pool we actually use
        // to set the next offset correctly
        let usedFromPoolCount = 0;
        const getNextUnique = (count) => {
            const found = [];
            while (found.length < count && pool.length > 0) {
                const item = pool.shift();
                usedFromPoolCount++;
                if (item && !AppState.seenIds.has(item.id)) {
                    found.push(item);
                    registerSeenNews(item);
                }
            }
            return count === 1 ? found[0] : found;
        };

        // Register headline first
        if (headline) registerSeenNews(headline);

        // Assign to sections with exact counts
        const secondary = getNextUnique(1);
        const listItems = getNextUnique(3);
        const timelineNews = getNextUnique(5);
        const beritaUtamaNews = getNextUnique(5);

        // Set Offsets for Load More
        // We start exactly from the point in the API where we stopped
        AppState.latestOffset = usedFromPoolCount;
        AppState.beritaUtamaOffset = usedFromPoolCount;

        // Use the same popular list for both sidebar and mobile to save an API call
        const sidebarNews = allPopular.slice(0, 2);
        const mobilePopularNews = allPopular;

        const app = document.getElementById('app');
        if (!app) return;
        
        let html = '<div class="container">';

        // --- BAGIAN FEATURED ATAS ---
        html += '<section class="featured-section">';
        html += '<div class="featured-grid">';
        if (headline) html += createFeaturedMain(headline);
        
        html += '<div class="featured-side">';
        if (secondary) html += createFeaturedSecondary(secondary);
        
        if (listItems.length > 0) {
            html += '<div class="featured-list">';
            listItems.forEach(item => {
                if (typeof createFeaturedListItem === 'function') html += createFeaturedListItem(item);
            });
            html += '</div>';
        }
        html += '</div></div></section>'; 

        // --- BAGIAN UTAMA (Grid Layout) ---
        html += `<div class="home-grid">`;
        html += `<div class="home-main">`;

        // SECTION POPULER KHUSUS MOBILE 
        if (mobilePopularNews.length > 0) {
            html += `<div class="mobile-popular-section">`;
            html += `<h3 class="mobile-section-title">Berita Terpopuler</h3>`;
            html += `<div class="mobile-underline"></div>`;
            html += `<div class="mobile-popular-list">`;
            // Limit to exact 5 items for mobile home popular section
            mobilePopularNews.slice(0, 5).forEach((news, idx) => {
                html += createMobilePopularItem(news, idx + 1);
            });
            html += `</div></div>`; 
        }

        // SECTION TIMELINE BERITA TERKINI
        html += `<h2 class="section-title">Berita Terkini</h2>`;
        html += `<div class="timeline-container" id="latest-news-container">`;
        if (timelineNews.length > 0) {
            timelineNews.forEach(news => {
                html += createTimelineItem(news);
            });
        } else {
            html += `<p class="text-center empty-state">Belum ada berita tersedia.</p>`;
        }
        html += `</div>`;

        // TOMBOL LOAD MORE
        if (timelineNews.length >= 5) {
            html += `
                <div class="load-more-container">
                    <button id="btn-load-more" class="btn-load-more" onclick="loadMoreNews()">
                        Muat Lebih Banyak
                    </button>
                </div>
            `;
        }
        html += `</div>`;

        // --- KOLOM KANAN (SIDEBAR DESKTOP) ---
        if (sidebarNews.length > 0) {
            html += `<div class="home-sidebar dark-theme">`;
            html += `<h3 class="sidebar-title-new">TDK KALAH PENTING</h3>`;
            html += `<div class="sidebar-underline"></div>`;
            html += `<div class="popular-list-new">`;
            
            sidebarNews.forEach((news, index) => {
                if (index > 0) html += `<div class="sidebar-divider"></div>`;
                if (typeof createSidebarCard === 'function') html += createSidebarCard(news);
            });

            html += `</div></div>`;
        }

        html += `</div></div>`;

        // --- TRENDING SECTION (DESKTOP) ---
        // Using reusing mobilePopularNews data as requested
        if (mobilePopularNews.length > 0) {
            html += createTrendingSection(mobilePopularNews);

            // Inject SIN PO TV Section Here
            html += createSinPoTVSection();
            
            // Inject Polling Section
            html += createPollingSection();

            // Inject Berita Utama Section
            html += createBeritaUtamaSection(beritaUtamaNews);
        }

        html += `</div>`; // Close container

        app.innerHTML = html;

        // --- INITIALIZE CAROUSELS & INTERACTIVE ELEMENTS ---
        // These MUST be called after app.innerHTML is updated
        initTrendingDots();
        initPollingDots();
        initSinPoTV();

    } catch (error) {
        console.error('Render Home Error:', error);
        const app = document.getElementById('app');
        if (app) {
            app.innerHTML = `
                <div class="container text-center" style="padding: 4rem 2rem;">
                    <h2>Oops! Ada Masalah</h2>
                    <p>Terjadi kesalahan saat memuat halaman. Silakan coba lagi.</p>
                    <button class="btn btn-primary" onclick="window.location.reload()">Muat Ulang</button>
                </div>
            `;
        }
    }
}

// Function untuk Main Featured (Kiri Besar)
function createFeaturedMain(news) {
    return `
        <div class="featured-main" onclick="navigate('article', event, {id: ${news.id}})">
            <img src="${getImageUrl(news.image || news.cover)}" 
                 alt="${escapeHtml(news.title)}" 
                 class="featured-main-image"
                 onerror="this.src='https://placehold.co/1200x800/000/333?text=SinPo+Media'">
            
            <div class="featured-main-overlay">
                <div class="featured-main-content-wrapper">
                    
                    <!-- Mobile Meta Row (New Requirement: Pub Left, Cat Center, Date Right) -->
                    <div class="mobile-meta-row">
                        <span class="mobile-author">${escapeHtml(getAuthorName(news))}</span>
                        <span class="mobile-category">${escapeHtml(formatCategoryName(news.category))}</span>
                        <span class="mobile-date">${formatDate(news.published_at || news.created_at)}</span>
                    </div>

                    <h2 class="featured-main-title">
                        ${escapeHtml(news.title)}
                    </h2>

                    <!-- Desktop Meta (Hidden on Mobile) -->
                    <div class="featured-main-meta">
                        <span class="meta-date">
                            ${formatDate(news.published_at || news.created_at)}
                            <span class="meta-dot">•</span>
                        </span>
                        <span class="meta-credit">
                            Foto: ${escapeHtml(news.cover_credit || 'Sin Po')}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Function untuk Featured Secondary (Kanan Atas)
function createFeaturedSecondary(news) {
    return `
        <div class="featured-secondary" onclick="navigate('article', event, {id: ${news.id}})">
            <img src="${getImageUrl(news.image || news.cover)}" 
                 alt="${escapeHtml(news.title)}" 
                 class="featured-secondary-image"
                 onerror="this.src='https://placehold.co/800x600/000/333?text=SinPo+Media'">
            
            <div class="featured-secondary-overlay">
                <h3 class="featured-secondary-title">
                    ${escapeHtml(news.title)}
                </h3>

                <div class="featured-secondary-meta">
                    <span class="meta-date">
                        ${formatDate(news.published_at || news.created_at)}
                        <span class="meta-dot">•</span>
                    </span>
                    <span class="meta-credit">
                        Foto: ${escapeHtml(news.cover_credit || 'Sin Po')}
                    </span>
                </div>
            </div>
        </div>
    `;
}

// --- NEW HELPER FUNCTIONS FOR RELATED NEWS ---
function createRelatedFeatured(news) {
    return `
        <div class="related-featured" onclick="navigate('article', event, {id: ${news.id}})">
            <!-- Layout: Image Left, Meta & Title Right/Beside -->
            <div class="related-featured-row">
                <img src="${getImageUrl(news.image || news.cover)}" alt="${escapeHtml(news.title)}" class="related-featured-img">
                
                <div class="related-featured-content">
                    <div class="related-meta">
                        <img src="${news.author?.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(getAuthorName(news)) + '&background=dedede&color=999'}" class="related-author-avatar">
                        <span class="related-author-name">${escapeHtml(getAuthorName(news))}</span>
                        <span class="related-date">${formatDate(news.published_at || news.created_at)}</span>
                    </div>
                    <h3 class="related-featured-title">${escapeHtml(news.title)}</h3>
                </div>
            </div>
        </div>
    `;
}

function createRelatedText(news) {
    return `
        <div class="related-text-item" onclick="navigate('article', event, {id: ${news.id}})">
             <h4 class="related-text-title">${escapeHtml(news.title)}</h4>
        </div>
    `;
}

function createFeaturedListItem(news) {
    return `
        <div class="featured-list-item" onclick="navigate('article', event, {id: ${news.id}})">
            <img src="${getImageUrl(news.image || news.cover)}" 
                 alt="${escapeHtml(news.title)}" 
                 class="featured-list-image"
                 onerror="this.src='https://placehold.co/200x200/eee/999?text=SinPo'">
            <div class="featured-list-content">
                <h4 class="featured-list-title">${escapeHtml(news.title)}</h4>
                <div class="featured-list-meta">
                    ${formatDate(news.published_at || news.created_at)}
                </div>
            </div>
        </div>
    `;
}

// Fungsi Buka Search Fullscreen
function openSearch() {
    const overlay = document.getElementById('search-overlay');
    const input = document.getElementById('fullscreen-search-input');
    
    overlay.classList.remove('hidden');
    
    // Matikan scroll body saat modal terbuka
    document.body.style.overflow = 'hidden';
    
    // Otomatis fokus ke input setelah animasi selesai
    setTimeout(() => {
        input.focus();
    }, 100);
}

// Fungsi Tutup Search Fullscreen
function closeSearch() {
    const overlay = document.getElementById('search-overlay');
    
    overlay.classList.add('hidden');
    
    // Hidupkan kembali scroll body
    document.body.style.overflow = '';
}

// Event Listener: Tutup saat tekan tombol ESC
document.addEventListener('keydown', function(event) {
    if (event.key === "Escape") {
        closeSearch();
    }
});

/**
 * Handle Search Trigger from Input
 */
function handleSearchKeyPress(event) {
    if (event.key === 'Enter') {
        const query = event.target.value.trim();
        if (query) {
            executeSearch(query);
            // Clear input
            event.target.value = '';
        }
    }
}

/**
 * Execute Search and Navigate
 */
function executeSearch(query) {
    // Close overlay if it's open
    closeSearch();
    
    // Navigate to search page
    navigate('search', null, { q: query });
}

/**
 * Render Search Results Page
 */
async function renderSearch(query) {
    if (!query) return navigate('home');

    // Fetch recommendations and results in parallel FIRST
    // This allows the global showLoading() from renderPage to remain active
    const [resultsRes, recsRes] = await Promise.all([
        API.berita.list({ q: query, limit: 10, offset: 0 }).catch(() => ({ data: [] })),
        API.berita.populer({ limit: 10 }).catch(() => ({ data: [] }))
    ]);

    const app = document.getElementById('app');
    
    // Initialize Search State
    AppState.searchQuery = query;
    AppState.searchOffset = 0;
    AppState.hasMoreSearch = true;

    // Render Layout Structure
    app.innerHTML = `
        <div class="container" style="padding-top: 2rem; padding-bottom: 4rem;">
            <div class="search-results-header" style="margin-bottom: 3rem; border-bottom: 2px solid var(--color-primary); padding-bottom: 1rem;">
                <h1 style="font-size: 1.5rem; font-weight: 700;">HASIL PENCARIAN UNTUK: <span style="color: var(--primary-color); text-transform: uppercase;">"${escapeHtml(query)}"</span></h1>
            </div>
            
            <div class="search-content-grid">
                <!-- LEFT COLUMN: Main Search Results -->
                <div class="search-main-col">
                    <div id="search-results-list" class="berita-utama-left">
                        <!-- Results will be injected here -->
                    </div>

                    <!-- Load More Button -->
                    <div id="search-load-more-container" class="load-more-container text-center hidden" style="margin-top: 3rem;">
                        <button id="btn-load-more-search" class="btn-load-more" onclick="loadMoreSearchResults()">
                            Muat Lebih Banyak
                        </button>
                    </div>
                </div>

                <!-- RIGHT COLUMN: Sidebar (Sticky) -->
                <aside class="search-sidebar-col">
                    <div class="search-sidebar-sticky">
                        <!-- Ad Placeholder -->
                        <div class="search-ad-placeholder">
                            <div class="ad-label">ADVERTISEMENT</div>
                            <div class="ad-9-16">
                                <img src="https://placehold.co/720x1280/eee/999?text=SinPo+Media+Ads" alt="Ads">
                            </div>
                        </div>

                        <!-- Recommendation Section -->
                        <div id="search-recommendations" class="search-recommendation-box">
                            <h3 class="recommendation-title">BERITA REKOMENDASI</h3>
                            <div id="recommendation-list" class="recommendation-list">
                                <!-- Recommendations injected here -->
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    `;

    const results = safeArray(resultsRes.data);
    const resultsList = document.getElementById('search-results-list');
    const loadMoreContainer = document.getElementById('search-load-more-container');

    // Handle Search Results
    if (results.length > 0) {
        resultsList.innerHTML = '';
        results.forEach(item => {
            resultsList.innerHTML += createBeritaUtamaItem(item, true); // true = show description
        });

        AppState.searchOffset = 10;
        if (results.length >= 10) {
            loadMoreContainer.classList.remove('hidden');
        } else {
            AppState.hasMoreSearch = false;
        }
    } else {
        AppState.hasMoreSearch = false;
        resultsList.innerHTML = `
            <div class="no-results" style="text-align: center; padding: 4rem 1rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
                <h3 style="font-size: 1.2rem; margin-bottom: 0.5rem;">Tidak ditemukan hasil untuk "${escapeHtml(query)}"</h3>
                <p style="color: #666;">Coba gunakan kata kunci lain yang lebih umum.</p>
            </div>
        `;
    }

    // Handle Recommendations (berdasarkan berita terbanyak dilihat)
    const recsList = document.getElementById('recommendation-list');
    const recsItems = safeArray(recsRes.data).slice(0, 5);
    
    if (recsItems.length > 0) {
        recsList.innerHTML = '';
        recsItems.forEach((item, index) => {
            recsList.innerHTML += `
                <div class="recommendation-item" onclick="navigate('article', event, {id: ${item.id}})">
                    <span class="recommendation-number">${index + 1}</span>
                    <div class="recommendation-content">
                        <h4 class="recommendation-item-title">${escapeHtml(item.title)}</h4>
                        <div class="recommendation-meta">
                            <span>${escapeHtml(getAuthorName(item))}</span> • 
                            <span>${formatDate(item.published_at || item.created_at)}</span>
                        </div>
                    </div>
                </div>
                ${index < recsItems.length - 1 ? '<div class="recommendation-divider"></div>' : ''}
            `;
        });
    } else {
        recsList.innerHTML = '<p class="text-center" style="font-size:0.8rem; padding: 1rem; color: #999;">Belum ada rekomendasi.</p>';
    }
}

/**
 * Load More Search Results
 */
async function loadMoreSearchResults() {
    const btn = document.getElementById('btn-load-more-search');
    const container = document.getElementById('search-results-list');
    
    if (!btn || btn.disabled || !AppState.hasMoreSearch) return;

    btn.innerHTML = '<div class="btn-spinner"></div> Memuat...';
    btn.disabled = true;

    try {
        const query = AppState.searchQuery;
        const currentOffset = AppState.searchOffset || 10;
        const limit = 10;

        const res = await API.berita.list({
            q: query,
            limit: limit,
            offset: currentOffset
        });

        const newItems = safeArray(res.data);
        
        if (newItems.length > 0) {
            newItems.forEach(item => {
                container.innerHTML += createBeritaUtamaItem(item, true); // true = show description
            });
            
            AppState.searchOffset = currentOffset + limit;
            
            if (newItems.length < limit) {
                AppState.hasMoreSearch = false;
                btn.parentElement.classList.add('hidden');
            }
        } else {
            AppState.hasMoreSearch = false;
            btn.parentElement.classList.add('hidden');
        }
    } catch (error) {
        console.error("Error loading more search results:", error);
    } finally {
        if (btn) {
            btn.innerHTML = 'Muat Lebih Banyak';
            btn.disabled = false;
        }
    }
}

// ==========================================
// ROUTER
// ==========================================
function handleRouteChange() {
    const hash = window.location.hash.slice(1);
    
    if (!hash) {
        navigate('home', null);
    } else {
        const parts = hash.split('/');
        const page = parts[0];
        const id = parts[1] ? decodeURIComponent(parts[1]) : null;
        
        if (page && id) {
            navigate(page, null, { id });
        } else if (page) {
            navigate(page, null);
        }
    }
}

// ==========================================
// SIDE PANEL (HAMBURGER MENU)
// ==========================================
let sidePanelNewsLoaded = false;

function toggleSidePanel() {
    const panel = document.getElementById('side-panel');
    const overlay = document.getElementById('side-panel-overlay');
    if (!panel || !overlay) return;

    const isOpen = panel.classList.contains('open');

    if (isOpen) {
        panel.classList.remove('open');
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    } else {
        panel.classList.add('open');
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        // Load news on first open
        if (!sidePanelNewsLoaded) {
            loadSidePanelNews();
            sidePanelNewsLoaded = true;
        }
    }
}

async function loadSidePanelNews() {
    try {
        const [latestRes, popularRes] = await Promise.all([
            API.berita.list({ limit: 3 }).catch(() => ({ data: [] })),
            API.berita.populer({ limit: 5 }).catch(() => ({ data: [] }))
        ]);

        // Render Latest News
        const latestContainer = document.getElementById('sp-latest-news');
        const latestItems = safeArray(latestRes.data).slice(0, 3);
        if (latestContainer) {
            if (latestItems.length > 0) {
                latestContainer.innerHTML = latestItems.map(news => `
                    <div class="sp-news-item" onclick="navigate('article', event, {id: ${news.id}}); toggleSidePanel();">
                        <img src="${getImageUrl(news.image || news.cover)}" 
                             alt="${escapeHtml(news.title)}" 
                             class="sp-news-thumb"
                             onerror="this.src='https://placehold.co/120x80/eee/999?text=SinPo'">
                        <div class="sp-news-info">
                            <h4 class="sp-news-title">${escapeHtml(news.title)}</h4>
                            <span class="sp-news-date">${formatDate(news.published_at || news.created_at)}</span>
                        </div>
                    </div>
                `).join('');
            } else {
                latestContainer.innerHTML = '<p class="sp-empty">Tidak ada berita.</p>';
            }
        }

        // Render Popular News
        const popularContainer = document.getElementById('sp-popular-news');
        const popularItems = safeArray(popularRes.data).slice(0, 5);
        if (popularContainer) {
            if (popularItems.length > 0) {
                popularContainer.innerHTML = popularItems.map((news, index) => `
                    <div class="sp-popular-item" onclick="navigate('article', event, {id: ${news.id}}); toggleSidePanel();">
                        <span class="sp-popular-number">${index + 1}</span>
                        <h4 class="sp-popular-title">${escapeHtml(news.title)}</h4>
                    </div>
                `).join('');
            } else {
                popularContainer.innerHTML = '<p class="sp-empty">Tidak ada berita.</p>';
            }
        }
    } catch (error) {
        console.error('Error loading side panel news:', error);
    }
}

function switchAuthTab(tab) {
    const slides = document.getElementById('sp-auth-slides');
    const tabs = document.querySelectorAll('.sp-auth-tab');
    if (!slides || !tabs.length) return;

    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));

    if (tab === 'login') {
        slides.style.transform = 'translateX(-50%)';
    } else {
        slides.style.transform = 'translateX(0)';
    }
}

function initSidePanel() {
    // Wire desktop hamburger button
    const desktopBtn = document.querySelector('.menu-btn-desktop');
    if (desktopBtn) {
        desktopBtn.addEventListener('click', toggleSidePanel);
    }
    // Wire mobile hamburger button too
    const mobileBtn = document.querySelector('.menu-btn-mobile');
    if (mobileBtn) {
        mobileBtn.addEventListener('click', toggleSidePanel);
    }
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const panel = document.getElementById('side-panel');
            if (panel && panel.classList.contains('open')) {
                toggleSidePanel();
            }
        }
    });
}

// Make side panel functions global
window.toggleSidePanel = toggleSidePanel;
window.switchAuthTab = switchAuthTab;

// ==========================================
// APPLICATION INITIALIZATION
// ==========================================
function init() {
    console.log('🚀 Initializing SinPo Media Application...');
    
    // Initialize theme
    initTheme();
    
    // Initialize side panel
    initSidePanel();
    
    // Handle initial route
    handleRouteChange();
    
    // Listen for hash changes
    window.addEventListener('hashchange', handleRouteChange);
    
    // Listen for theme system changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            AppState.darkMode = e.matches;
            document.body.classList.toggle('dark-mode', e.matches);
            updateThemeIcon();
        }
    });
    
    console.log('✅ Application initialized successfully!');
}

// ==========================================
// START APPLICATION
// ==========================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Make functions available globally
window.navigate = navigate;
window.toggleTheme = toggleTheme;
window.handleCommentSubmit = handleCommentSubmit;

// ==========================================
// TRENDING SECTION
// ==========================================
function createTrendingSection(newsList) {
    if (!newsList || newsList.length === 0) return '';

    // Take up to 15 items, but only in multiples of 5
    const limit = Math.floor(Math.min(newsList.length, 15) / 5) * 5;
    if (limit === 0) return ''; // Don't show if less than 5 items
    
    const displayList = newsList.slice(0, limit);
    
    // Group items into chunks of 5
    const chunks = [];
    for (let i = 0; i < displayList.length; i += 5) {
        chunks.push(displayList.slice(i, i + 5));
    }
    
    const totalPages = chunks.length;

    return `
        <div class="trending-section">
            <div class="trending-header">
                <h2 class="trending-title">TREN HARI INI</h2>
            </div>
            
            <div class="trending-list" id="trending-scroll-container">
                ${chunks.map((chunk, pageIdx) => `
                    <div class="trending-page" data-page="${pageIdx}">
                        ${chunk.map(news => `
                            <div class="trending-item" onclick="navigate('article', event, {id: ${news.id}})">
                                <img src="${getImageUrl(news.image || news.cover)}" 
                                     alt="${escapeHtml(news.title)}" 
                                     class="trending-image"
                                     onerror="this.src='https://placehold.co/400x225/333/666?text=SinPo'">
                                
                                <div class="trending-content">
                                    <h3 class="trending-item-title">${escapeHtml(news.title)}</h3>
                                    <div class="trending-meta">
                                        <span class="trending-author">${escapeHtml(getAuthorName(news).toUpperCase())}</span>
                                        <span class="trending-date">${formatDate(news.published_at || news.created_at)}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>

            <div class="trending-dots">
                ${Array.from({ length: totalPages }).map((_, i) => `
                    <span class="trending-pagination-dot ${i === 0 ? 'active' : ''}" 
                          data-index="${i}" 
                          onclick="scrollToTrendingSet(${i})"></span>
                `).join('')}
            </div>
        </div>
    `;
}

// Function to scroll to specific page in trending (5 items per page)
window.scrollToTrendingSet = function(pageIndex) {
    const container = document.getElementById('trending-scroll-container');
    if (!container) return;

    const pages = container.querySelectorAll('.trending-page');
    const targetPage = pages[pageIndex];

    if (targetPage) {
        const offsetLeft = targetPage.offsetLeft - container.offsetLeft;
        container.scrollTo({
            left: offsetLeft,
            behavior: 'smooth'
        });
    }
};

// Initialize intersection observer or scroll tracking for trending dots
window.initTrendingDots = function() {
    const container = document.getElementById('trending-scroll-container');
    const dotsList = document.querySelector('.trending-dots');
    
    if (!container || !dotsList) return;

    const updateActiveDot = () => {
        const dots = dotsList.querySelectorAll('.trending-pagination-dot');
        const scrollLeft = container.scrollLeft;
        const containerWidth = container.clientWidth;
        
        if (containerWidth <= 0) return;
        
        // Calculate page index more robustly
        const pageIndex = Math.round(scrollLeft / containerWidth);
        
        dots.forEach((dot, idx) => {
            dot.classList.toggle('active', idx === pageIndex);
        });
    };

    container.addEventListener('scroll', updateActiveDot, { passive: true });
    window.addEventListener('resize', updateActiveDot);
    
    // Initial call
    setTimeout(updateActiveDot, 100);
};

// ==========================================
// SIN PO TV SECTION (YouTube RSS Feed)
// ==========================================

const SINPO_TV_CHANNEL_ID = 'UCKlCoYf-khqH1bCRTA2os6A';
const SINPO_TV_RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${SINPO_TV_CHANNEL_ID}`;
const SINPO_TV_VIDEO_COUNT = 5;

// Cache for fetched videos
let sinpoTvVideos = [];

/**
 * Fetch latest videos from YouTube RSS feed
 */
async function fetchYouTubeVideos() {
    // Return cached if available
    if (sinpoTvVideos.length > 0) return sinpoTvVideos;

    const CORS_PROXIES = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(SINPO_TV_RSS_URL)}`,
        `https://corsproxy.io/?${encodeURIComponent(SINPO_TV_RSS_URL)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(SINPO_TV_RSS_URL)}`
    ];

    for (const proxyUrl of CORS_PROXIES) {
        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) continue;

            const xmlText = await response.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(xmlText, 'application/xml');

            const entries = xml.querySelectorAll('entry');
            if (!entries || entries.length === 0) continue;

            const videos = [];
            const count = Math.min(entries.length, SINPO_TV_VIDEO_COUNT);

            for (let i = 0; i < count; i++) {
                const entry = entries[i];
                const videoId = entry.querySelector('videoId')?.textContent || '';
                const title = entry.querySelector('title')?.textContent || 'Untitled';
                const published = entry.querySelector('published')?.textContent || '';
                const thumbnail = entry.querySelector('thumbnail');
                const thumbUrl = thumbnail?.getAttribute('url') || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                const stats = entry.querySelector('statistics');
                const views = stats?.getAttribute('views') || '0';

                if (videoId) {
                    videos.push({
                        id: videoId,
                        title: title,
                        thumb: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                        thumbSmall: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
                        published: published,
                        views: parseInt(views, 10),
                        url: `https://www.youtube.com/watch?v=${videoId}`
                    });
                }
            }

            if (videos.length > 0) {
                sinpoTvVideos = videos;
                console.log(`✅ Fetched ${videos.length} videos from YouTube RSS`);
                return videos;
            }
        } catch (err) {
            console.warn('CORS proxy failed, trying next...', err);
        }
    }

    // Fallback to empty - section will show loading state
    console.warn('⚠️ All YouTube RSS proxies failed');
    return [];
}

/**
 * Format relative time for video publish date
 */
function formatVideoDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMin < 60) return `${diffMin} menit lalu`;
        if (diffHrs < 24) return `${diffHrs} jam lalu`;
        if (diffDays < 7) return `${diffDays} hari lalu`;
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return '';
    }
}

/**
 * Format view count
 */
function formatViews(views) {
    if (!views || views === 0) return '';
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`;
    return `${views} views`;
}

/**
 * Select a video (swap thumbnail, don't auto-play)
 */
function selectTvVideo(videoId) {
    const video = sinpoTvVideos.find(v => v.id === videoId);
    if (!video) return;

    // Reset to thumbnail view (remove iframe if any)
    const playerContainer = document.getElementById('tv-player-container');
    if (playerContainer) {
        playerContainer.innerHTML = `
            <img 
                id="tv-main-image" 
                src="${video.thumb}" 
                alt="${video.title}" 
                class="tv-video-thumbnail"
                onclick="playTvVideo('${videoId}')"
                style="cursor: pointer;">
            
            <div class="tv-overlay-label">
                <span>BREAKING NEWS</span>
            </div>

            <div class="tv-play-btn" onclick="playTvVideo('${videoId}')">
                <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </div>
        `;
    }

    // Make sure overlays are visible (remove playing state)
    const mainVideo = document.querySelector('.tv-main-video');
    if (mainVideo) mainVideo.classList.remove('playing');

    // Update title overlay
    const headline = document.getElementById('tv-main-headline');
    if (headline) headline.textContent = video.title;

    // Update currently playing title in sidebar
    const currentPlayingTitle = document.getElementById('tv-current-playing-title');
    if (currentPlayingTitle) currentPlayingTitle.textContent = video.title;

    // Update active state in playlist
    document.querySelectorAll('.tv-item').forEach(item => {
        item.classList.toggle('active', item.dataset.videoId === videoId);
    });
}

/**
 * Play a video (embed YouTube iframe)
 */
function playTvVideo(videoId) {
    const video = sinpoTvVideos.find(v => v.id === videoId);
    if (!video) return;

    const playerContainer = document.getElementById('tv-player-container');
    if (playerContainer) {
        playerContainer.innerHTML = `
            <iframe 
                src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" 
                title="${video.title}"
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen
                class="tv-youtube-iframe">
            </iframe>
        `;
    }

    // Hide overlays when video is playing
    const mainVideo = document.querySelector('.tv-main-video');
    if (mainVideo) mainVideo.classList.add('playing');
}

// Keep switchTvVideo as alias for play (used by first video click)
function switchTvVideo(videoId) {
    playTvVideo(videoId);
}

/**
 * Create the SIN PO TV section (with loading state, fetches on render)
 */
function createSinPoTVSection() {
    return `
        <section class="sinpo-tv-section">
            <div class="container">
                <div class="sinpo-tv-header">
                    <h2 class="sinpo-tv-title">SIN PO TV</h2>
                </div>

                <div id="sinpo-tv-content" class="sinpo-tv-container">
                    <div style="display: flex; align-items: center; justify-content: center; width: 100%; min-height: 300px; color: #999;">
                        <div class="spinner"></div>
                    </div>
                </div>

                <!-- Ad Banner -->
                <div class="tv-ad-banner">
                    <div class="tv-ad-content">
                        <span class="tv-ad-size">970x90</span>
                        <div class="tv-ad-text">
                            Smart & Responsive
                            <span>ADVERTISEMENT</span>
                        </div>
                    </div>
                    <a href="#" class="tv-ad-btn">LEARN MORE</a>
                </div>
            </div>
        </section>
    `;
}

/**
 * Initialize SIN PO TV: fetch videos and render into the section
 */
async function initSinPoTV() {
    const container = document.getElementById('sinpo-tv-content');
    if (!container) return;

    const videos = await fetchYouTubeVideos();

    if (!videos || videos.length === 0) {
        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; width: 100%; min-height: 200px; color: #999; flex-direction: column; gap: 1rem; text-align: center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="#666" viewBox="0 0 16 16">
                    <path d="M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.108-.082 2.06l-.008.105-.009.104c-.05.572-.124 1.14-.235 1.558a2.007 2.007 0 0 1-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.007 2.007 0 0 1-1.415-1.419c-.111-.417-.185-.986-.235-1.558L.09 9.82l-.008-.104A31.4 31.4 0 0 1 0 7.68v-.123c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.007 2.007 0 0 1 1.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.172-.006.086-.003.171-.007A99.788 99.788 0 0 1 7.858 2h.193zM6.4 5.209v4.818l4.157-2.408L6.4 5.209z"/>
                </svg>
                <p style="margin: 0; font-size: 0.9rem;">Gagal memuat video. Coba muat ulang atau kunjungi channel kami.</p>
                <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center;">
                    <button onclick="retrySinPoTV()" 
                        style="background: #333; color: white; padding: 0.5rem 1.5rem; border-radius: 4px; border: none; font-weight: 700; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                            <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                        </svg>
                        Muat Ulang
                    </button>
                    <a href="https://youtube.com/@sinpotv" target="_blank" rel="noopener noreferrer" 
                       style="background: #D91B1B; color: white; padding: 0.5rem 1.5rem; border-radius: 4px; text-decoration: none; font-weight: 700; font-size: 0.85rem;">
                        Buka YouTube
                    </a>
                </div>
            </div>
        `;
        return;
    }

    const currentVideo = videos[0];

    container.innerHTML = `
        <!-- Main Video Player -->
        <div class="tv-main-video">
            <div id="tv-player-container" class="tv-player-wrapper">
                <img 
                    id="tv-main-image" 
                    src="${currentVideo.thumb}" 
                    alt="${currentVideo.title}" 
                    class="tv-video-thumbnail"
                    onclick="switchTvVideo('${currentVideo.id}')"
                    style="cursor: pointer;">
                
                <div class="tv-overlay-label">
                    <span>BREAKING NEWS</span>
                </div>

                <div class="tv-play-btn" onclick="switchTvVideo('${currentVideo.id}')">
                    <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                </div>
            </div>

            <div class="tv-video-info-overlay">
                <div class="tv-headline-overlay">
                    <h3 id="tv-main-headline" class="tv-headline-text">${currentVideo.title}</h3>
                </div>
            </div>
        </div>

        <!-- Sidebar Playlist -->
        <div class="tv-playlist">
            <div class="tv-playlist-header">
                <div>
                    <div class="tv-header-info">Sedang diputar ...</div>
                    <div id="tv-current-playing-title" class="tv-header-title">${currentVideo.title}</div>
                </div>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
            </div>
            <div class="tv-playlist-items">
                ${videos.map((video, index) => `
                    <div class="tv-item ${index === 0 ? 'active' : ''}" data-video-id="${video.id}" onclick="selectTvVideo('${video.id}')">
                        <div class="tv-item-thumb-wrapper">
                            <img src="${video.thumbSmall}" alt="${video.title}" class="tv-item-thumb">
                            <div class="tv-item-play-icon">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                        </div>
                        <div class="tv-item-info">
                            <div class="tv-item-title">${video.title}</div>
                            <div class="tv-item-meta">
                                ${formatVideoDate(video.published)}${video.views > 0 ? ' • ' + formatViews(video.views) : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <a href="https://youtube.com/@sinpotv" target="_blank" rel="noopener noreferrer" class="tv-view-all-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.108-.082 2.06l-.008.105-.009.104c-.05.572-.124 1.14-.235 1.558a2.007 2.007 0 0 1-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.007 2.007 0 0 1-1.415-1.419c-.111-.417-.185-.986-.235-1.558L.09 9.82l-.008-.104A31.4 31.4 0 0 1 0 7.68v-.123c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.007 2.007 0 0 1 1.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.172-.006.086-.003.171-.007A99.788 99.788 0 0 1 7.858 2h.193zM6.4 5.209v4.818l4.157-2.408L6.4 5.209z"/>
                </svg>
                Lihat Semua di YouTube
            </a>
        </div>
    `;
}

/**
 * Retry loading SIN PO TV videos (clear cache and re-fetch)
 */
async function retrySinPoTV() {
    const container = document.getElementById('sinpo-tv-content');
    if (!container) return;

    // Show loading spinner
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; width: 100%; min-height: 300px; color: #999;">
            <div class="spinner"></div>
        </div>
    `;

    // Clear cache so fetchYouTubeVideos tries again
    sinpoTvVideos = [];

    // Re-init
    await initSinPoTV();
}

// Ensure functions are global
window.switchTvVideo = switchTvVideo;
window.selectTvVideo = selectTvVideo;
window.playTvVideo = playTvVideo;
window.initSinPoTV = initSinPoTV;
window.retrySinPoTV = retrySinPoTV;

function createMobilePopularItem(news, number) {
    return `
        <div class="mobile-popular-item" onclick="navigate('article', event, {id: ${news.id}})">
            <span class="mobile-popular-number">${number}</span>
            <div class="mobile-popular-content">
                <span class="mobile-popular-category">${escapeHtml(formatCategoryName(news.category))}</span>
                <h4 class="mobile-popular-title">${escapeHtml(news.title)}</h4>
                <div class="mobile-popular-meta">
                    <span class="mobile-popular-time">${formatRelativeTime(news.published_at)}</span>
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// POLLING SECTION FUNCTIONS
// ==========================================
function createPollingSection() {
    // Gunakan data fallback jika API belum siap
    const polls = typeof POLLING_FALLBACK_DATA !== 'undefined' ? POLLING_FALLBACK_DATA : []; 
    if (polls.length === 0) return '';

    return `
        <section class="polling-section">
            <div class="container">
                <div class="polling-header">
                    <h3 class="polling-main-title">JAJAK PENDAPAT</h3>
                    <h2 class="polling-sub-title">SUARA ANDA MENENTUKAN</h2>
                </div>

                <div class="polling-container" id="polling-scroll-container">
                    ${polls.map(poll => createPollingCard(poll)).join('')}
                </div>

                <!-- Pagination Indicator for Mobile -->
                <div class="polling-pagination mobile-only">
                    ${polls.map((_, idx) => `
                        <span class="polling-dot ${idx === 0 ? 'active' : ''}" 
                              data-index="${idx}" 
                              onclick="scrollToPoll(${idx})"></span>
                    `).join('')}
                </div>
            </div>
        </section>
    `;
}

function createPollingCard(poll) {
    return `
        <div class="polling-card" id="poll-card-${poll.id}">
            <div class="polling-badge">POLLING #${poll.id}</div>
            <div class="polling-question">${escapeHtml(poll.question)}</div>
            
            <div class="polling-options">
                ${poll.options.map(opt => `
                    <label class="polling-option-label" onclick="selectPollOption(${poll.id}, ${opt.id})">
                        <input type="radio" name="poll_${poll.id}" value="${opt.id}" class="polling-radio">
                        <span class="polling-check"></span>
                        <span class="polling-option-text">${escapeHtml(opt.label)}</span>
                    </label>
                `).join('')}
            </div>

            <div class="polling-footer">
                <div class="polling-stats">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7Zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.784 6A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 5 1v-1Z"/>
                    </svg>
                    <span>${poll.total_votes.toLocaleString()} VOTES</span>
                </div>
                
                <button id="btn-vote-${poll.id}" class="polling-submit-btn" disabled onclick="submitVote(${poll.id})">
                    Kirim Suara
                </button>
            </div>
        </div>
    `;
}

// Interaction: Select Option
window.selectPollOption = function(pollId, optionId) {
    // Visual selection
    const card = document.getElementById(`poll-card-${pollId}`);
    if (!card) return;

    // Remove selected class from all labels in this card
    const labels = card.querySelectorAll('.polling-option-label');
    labels.forEach(l => l.classList.remove('selected'));

    // Add selected to the clicked one
    const radio = card.querySelector(`input[value="${optionId}"]`);
    if (radio) {
        radio.checked = true;
        radio.closest('.polling-option-label').classList.add('selected');
    }

    // Enable button
    const btn = document.getElementById(`btn-vote-${pollId}`);
    if (btn) btn.disabled = false;
};

// Scroll to specific poll card
window.scrollToPoll = function(index) {
    const container = document.getElementById('polling-scroll-container');
    if (!container) return;
    
    const cards = container.querySelectorAll('.polling-card');
    if (cards[index]) {
        const offsetLeft = cards[index].offsetLeft - container.offsetLeft;
        container.scrollTo({
            left: offsetLeft,
            behavior: 'smooth'
        });
    }
};

// Initialize intersection observer for polling dots
window.initPollingDots = function() {
    const container = document.getElementById('polling-scroll-container');
    const dots = document.querySelectorAll('.polling-dot');
    const cards = container?.querySelectorAll('.polling-card');
    
    if (!container || !dots.length || !cards?.length) return;

    const observerOptions = {
        root: container,
        threshold: 0.6 // Card is considered active when 60% visible
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const index = Array.from(cards).indexOf(entry.target);
                if (index !== -1) {
                    dots.forEach(dot => dot.classList.remove('active'));
                    if (dots[index]) dots[index].classList.add('active');
                }
            }
        });
    }, observerOptions);

    cards.forEach(card => observer.observe(card));
};

// Interaction: Submit Vote
window.submitVote = function(pollId) {
    const btn = document.getElementById(`btn-vote-${pollId}`);
    if (btn) {
        btn.innerHTML = 'Mengirim...';
        btn.disabled = true;
    }

    // Simulate API call delay
    setTimeout(() => {
        alert('Terima kasih atas partisipasi Anda!');
        
        // Reset state (optional) or show results
        if (btn) {
            btn.innerHTML = 'TERKIRIM';
            btn.style.background = '#222';
        }
    }, 1000);
};

// ==========================================
// BERITA UTAMA SECTION
// ==========================================
function createBeritaUtamaSection(newsList) {
    if (!newsList || newsList.length === 0) return '';

    return `
        <section class="berita-utama-section">
            <div class="container">
                <div class="berita-utama-header">
                    <h2 class="berita-utama-title">BERITA UTAMA</h2>
                </div>
                
                <div class="berita-utama-grid">
                    <!-- Left Column: News Items + Load More -->
                    <div class="berita-utama-left-wrapper">
                        <div class="berita-utama-left" id="berita-utama-container">
                            ${newsList.map(news => createBeritaUtamaItem(news)).join('')}
                        </div>
                        
                        <!-- Load More Button (Centered in Left Column) -->
                        <div class="load-more-container text-center" style="margin-top: 2rem;">
                            <button id="btn-load-more-utama" class="btn-load-more" onclick="loadMoreBeritaUtama()">
                                Muat Lebih Banyak
                            </button>
                        </div>
                    </div>

                    <!-- Right Column: Empty / Pending Visual/Opinion -->
                    <div class="berita-utama-right">
                        <!-- Placeholder for future content -->
                    </div>
                </div>
            </div>
        </section>
    `;
}

// Function to Load More Berita Utama
async function loadMoreBeritaUtama() {
    const btn = document.getElementById('btn-load-more-utama');
    const container = document.getElementById('berita-utama-container');
    
    if (!btn || btn.disabled) return;

    btn.innerHTML = '<div class="btn-spinner"></div> Memuat...';
    btn.disabled = true;

    try {
        const fetchLimit = 20;
        const currentOffset = AppState.beritaUtamaOffset || 20;

        const res = await API.berita.list({
            limit: fetchLimit,
            offset: currentOffset
        });

        // Advance offset
        AppState.beritaUtamaOffset = currentOffset + fetchLimit;

        const rawItems = safeArray(res.data);
        const newItems = filterSeenNews(rawItems).slice(0, 5);

        if (newItems.length > 0) {
            registerSeenNews(newItems);
            if (container) {
                newItems.forEach(news => {
                    container.insertAdjacentHTML('beforeend', createBeritaUtamaItem(news));
                });
            }
            btn.innerHTML = 'Muat Lebih Banyak';
            btn.disabled = false;
        } else if (rawItems.length >= fetchLimit) {
            // Try next batch
            return loadMoreBeritaUtama();
        } else {
            btn.innerHTML = 'Semua berita telah dimuat';
            btn.disabled = true;
            btn.style.display = 'none';
        }

    } catch (error) {
        console.error('Error loading more main news:', error);
        if (btn) {
            btn.innerHTML = 'Coba Lagi';
            btn.disabled = false;
        }
    }
}

function createBeritaUtamaItem(news, showDescription = false) {
    let summaryText = news.summary || '';
    
    // Fallback logic if summary is empty but content exists
    if (!summaryText && news.content) {
        summaryText = news.content.replace(/<[^>]*>?/gm, '').substring(0, 160);
    }
    
    const description = showDescription && summaryText ? `<p class="berita-utama-description">${escapeHtml(summaryText)}</p>` : '';
    
    return `
        <div class="berita-utama-item" onclick="navigate('article', event, {id: ${news.id}})">
            <div class="berita-utama-image-wrapper">
                <img src="${getImageUrl(news.image || news.cover)}" 
                     alt="${escapeHtml(news.title)}" 
                     class="berita-utama-image"
                     onerror="this.src='https://placehold.co/400x225/eee/999?text=SinPo'">
            </div>

            <div class="berita-utama-content">
                <span class="berita-utama-category">${escapeHtml(formatCategoryName(news.category))}</span>
                <h3 class="berita-utama-item-title">${escapeHtml(news.title)}</h3>
                ${description}
                <div class="berita-utama-meta">
                    <span>${escapeHtml(getAuthorName(news))}</span>
                    <span>•</span>
                    <span>${formatDate(news.published_at || news.created_at)}</span>
                </div>
            </div>
        </div>
    `;
}
async function loadMoreCategoryItems() {
    const btnBox = document.getElementById('category-load-more-ui');
    const loadBtn = btnBox ? btnBox.querySelector('.btn-load-more-pill') : null;
    const listContainer = document.getElementById('category-news-list');
    
    if (!listContainer || !AppState.hasMoreCategory) return;

    if (loadBtn) {
        const originalText = loadBtn.innerText;
        loadBtn.innerHTML = '<div class="btn-spinner"></div> Memuat...';
        loadBtn.disabled = true;
    }

    try {
        const fetchLimit = 24; // Fetch more to find unique items
        const currentOffset = AppState.categoryOffset;

        const res = await API.berita.list({ 
            kategori: AppState.currentCategoryId, 
            limit: fetchLimit, 
            offset: currentOffset 
        });
        
        // Advance offset
        AppState.categoryOffset = currentOffset + fetchLimit;

        const rawItems = safeArray(res.data);
        const newItems = filterSeenNews(rawItems).slice(0, 12); // Take only 12 unique
        
        if (newItems.length > 0) {
            registerSeenNews(newItems);

            newItems.forEach(item => {
                listContainer.insertAdjacentHTML('beforeend', createTimelineItem(item));
            });
            
            if (loadBtn) {
                 loadBtn.innerText = 'Muat lagi';
                 loadBtn.disabled = false;
            }
            
            if (newItems.length < 12 && rawItems.length < fetchLimit) {
                AppState.hasMoreCategory = false;
                 if (loadBtn) {
                    loadBtn.innerText = 'Semua berita dimuat';
                    loadBtn.disabled = true;
                }
            }
        } else if (rawItems.length >= fetchLimit) {
            // Try next batch
            return loadMoreCategoryItems();
        } else {
            AppState.hasMoreCategory = false;
            if (loadBtn) {
                loadBtn.innerText = 'Semua berita dimuat';
                loadBtn.disabled = true;
            }
        }
    } catch (error) {
        console.error('Error loading more category items:', error);
        if (loadBtn) {
             loadBtn.innerText = 'Coba lagi';
             loadBtn.disabled = false;
        }
    }
}
