import axios, { AxiosRequestConfig } from "axios";
import { 
  ApiResponse, NewsItem, Category, Polling, PollingOption, Channel, Statis, Gallery, 
  Author, User, Photo, Folder, FolderImage, Iklan, Link, Newsletter, Komentar, Setting 
} from "../types/api";

const getBaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL || 'https://api.sinpo.id';
  return url.endsWith('/api') ? url : `${url}/api`;
};

const API_URL = getBaseUrl();
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || 'LMyrBrMUP8zpYV5d';

// --- AXIOS INSTANCE ---
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Accept': '*/*',
  }
});

// Request interceptor for dynamic logging or header adjustment
api.interceptors.request.use((config) => {
  if (config.method?.toUpperCase() !== 'GET' && !(config.data instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor for error handling
api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  const status = error.response?.status;
  const data = error.response?.data;
  const url = error.config?.url;
  console.error(`API Error ${status} [${url}]:`, data || error.message);
  return Promise.reject(error);
});

// --- MAPPING HELPERS ---

const mapCategory = (raw: any): Category => ({
  id: raw.id,
  name: raw.nama || raw.name || 'Umum',
  slug: raw.slug || (raw.nama ? raw.nama.toLowerCase().replace(/\s+/g, '-') : 'umum'),
});

const mapAuthor = (raw: any): Author => ({
  id: raw.id || 0,
  name: raw.nama || raw.name || 'Redaksi',
  avatar: raw.avatar || '',
  bio: raw.bio || '',
  status: raw.status || '',
});

const mapChannel = (raw: any): Channel => ({
  id: raw.id,
  name: raw.nama || raw.name || '',
  slug: raw.slug || (raw.nama ? raw.nama.toLowerCase().replace(/\s+/g, '-') : ''),
  type: raw.tipe,
  navigation: raw.navigasi,
  order: raw.urut,
});

const mapNewsItem = (raw: any): NewsItem => {
  const channelName = raw.channel?.name || raw.datachannel?.nama || '';
  const categoryName = raw.category?.name || raw.datakategori?.nama || channelName || 'Umum';

  return {
    id: raw.id || raw.id_berita || 0,
    title: raw.title || raw.judul || '',
    slug: raw.slug || '',
    summary: raw.summary || (raw.isi ? raw.isi.replace(/<[^>]*>?/gm, '').substring(0, 160) : ''),
    content: raw.isi || raw.content || '',
    cover: raw.gambar_detail || raw.cover || raw.gambar || raw.foto || raw.thumbnail || raw.gambar_kecil || raw.image || raw.gambar_utama || raw.foto_utama || raw.img || (raw.folder && raw.gambar ? `${raw.folder}/${raw.gambar}` : '') || (raw.id_channel && raw.gambar ? `channel/${raw.id_channel}/${raw.gambar}` : '') || '',
    image: raw.gambar_detail || raw.cover || raw.gambar || raw.foto || raw.thumbnail || raw.gambar_kecil || raw.image || raw.gambar_utama || raw.foto_utama || raw.img || (raw.folder && raw.gambar ? `${raw.folder}/${raw.gambar}` : '') || (raw.id_channel && raw.gambar ? `channel/${raw.id_channel}/${raw.gambar}` : '') || null,
    cover_credit: raw.caption || raw.cover_credit || '',
    created_at: raw.created_at || raw.tanggal_tayang || '',
    updated_at: raw.updated_at || '',
    published_at: raw.published_at || raw.tanggal_tayang || '',
    views: raw.views || raw.counter || 0,
    tags: raw.tags || (raw.tag ? raw.tag.split(',').map((t: string) => t.trim()) : []),
    category: {
      id: raw.category?.id || raw.id_categories || 0,
      name: categoryName,
      slug: raw.category?.slug || '',
    },
    author: mapAuthor(raw.datawartawan || raw.author),
    channel: {
      id: raw.channel?.id || raw.id_channel || 0,
      name: channelName,
      slug: raw.channel?.slug || '',
    },
    editor: raw.penulis || '',
    journalist: raw.wartawan || '',
    gallery: Array.isArray(raw.datagallery) ? raw.datagallery.map(mapGallery) : [],
  };
};

const mapStatis = (raw: any): Statis => ({
  id: raw.id,
  title: raw.judul || '',
  content: raw.isi || '',
  channel_id: raw.id_channel,
  category_id: raw.id_categories,
  created_at: raw.created_at,
});

const mapGallery = (raw: any): Gallery => ({
  id: raw.id,
  title: raw.judul || '',
  article_id: raw.id_berita,
  image: raw.gambar || '',
  created_at: raw.created_at,
});

const mapUser = (raw: any): User => ({
  id: raw.id,
  username: raw.username || '',
  level: raw.level || '',
  status: raw.status || '',
  email: raw.email,
});

const mapPhoto = (raw: any): Photo => ({
  id: raw.id,
  title: raw.judul || '',
  token: raw.token || '',
  image: raw.gambar || '',
  created_at: raw.created_at,
});

const mapIklan = (raw: any): Iklan => ({
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
});

const mapFolder = (raw: any): Folder => ({
  id: raw.id,
  name: raw.nama || '',
  admin_id: raw.id_admin || 0,
  parent_id: raw.id_parent,
});

const mapFolderImage = (raw: any): FolderImage => ({
  id: raw.id,
  name: raw.nama || '',
  admin_id: raw.id_admin || 0,
  folder_id: raw.id_folder || 0,
  type: raw.tipe || '',
  path: raw.file,
});

const mapSetting = (raw: any): Setting => ({
  id: raw.id,
  key: raw.groups || '',
  value: raw.options || '',
});

const mapLink = (raw: any): Link => ({

  id: raw.id,
  name: raw.nama || '',
  url: raw.url || '',
  channel_id: raw.id_channel,
  category_id: raw.id_categories,
});

const mapNewsletter = (raw: any): Newsletter => ({
  id: raw.id,
  email: raw.email || '',
  channel_id: raw.id_channel,
  status: raw.stts || '',
});

const mapKomentar = (raw: any): Komentar => ({
  id: raw.id,
  name: raw.nama || '',
  email: raw.email || '',
  comment: raw.komentar || '',
  article_id: raw.id_berita,
  channel_id: raw.id_channel,
  category_id: raw.id_categories,
  is_published: raw.publish === '1',
  date: raw.tanggal || '',
});

const mapPolling = (raw: any): Polling => {
  const options = Array.isArray(raw.options) ? raw.options.map((opt: any) => ({
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
};

const mapGeneric = (data: any, type: string): any => {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map(item => mapGeneric(item, type));
  }
  
  switch(type) {
    case 'news': return mapNewsItem(data);
    case 'category': return mapCategory(data);
    case 'channel': return mapChannel(data);
    case 'author': return mapAuthor(data);
    case 'statis': return mapStatis(data);
    case 'gallery': return mapGallery(data);
    case 'user': return mapUser(data);
    case 'photo': return mapPhoto(data);
    case 'folder': return mapFolder(data);
    case 'folder-image': return mapFolderImage(data);
    case 'iklan': return mapIklan(data);
    case 'link': return mapLink(data);
    case 'newsletter': return mapNewsletter(data);
    case 'komentar': return mapKomentar(data);
    case 'setting': return mapSetting(data);
    case 'polling': return mapPolling(data);

    default: return data;
  }
};

// --- UNIVERSAL FETCH FUNCTION ---

async function apiRequest<T>(config: AxiosRequestConfig, type?: string): Promise<ApiResponse<T>> {
  try {
    const response = await api.request(config);
    const result = response.data;
    
    // Check success flag even on 200 OK
    if (result.success === false) {
      throw new Error(result.message || "Request failed");
    }
    
    // SIINPO API wraps response in { success, data, meta, message }
    if (result.data && type) {
      result.data = mapGeneric(result.data, type);
    }
    
    return result as ApiResponse<T>;
  } catch (error: any) {
    if (error.response) {
      throw error.response.data || error;
    }
    throw error;
  }
}


// --- ENDPOINT DEFINITIONS ---

// 1. Channel
export const getChannel = {
  list: (params?: { tipe?: string; navigasi?: string; flag?: string }) => 
    apiRequest<Channel[]>({ url: '/channel', params }, 'channel'),
  detail: (id: string | number) => 
    apiRequest<Channel>({ url: `/channel/${id}` }, 'channel'),
};

// 2. Kategori
export const getKategori = {
  list: (params?: { channel?: string | number; flag?: string }) => 
    apiRequest<Category[]>({ url: '/kategori', params }, 'category'),
  detail: (id: string | number) => 
    apiRequest<Category>({ url: `/kategori/${id}` }, 'category'),
};

// 3. Berita
export const getBerita = {
  list: (params?: { 
    page?: number; limit?: number; q?: string; 
    kategori?: string | number; channel?: string | number; 
    tag?: string; penulis?: string; sort?: 'asc' | 'desc' 
  }) => apiRequest<NewsItem[]>({ url: '/berita', params: { limit: 10, sort: 'desc', ...params } }, 'news'),
  detail: (id: string | number) => apiRequest<NewsItem>({ url: `/berita/${id}` }, 'news'),
  terkait: (id: string | number, params?: { limit?: number; sort?: 'asc' | 'desc' }) => 
    apiRequest<NewsItem[]>({ url: `/terkait/${id}`, params }, 'news'),
  headline: (params?: { q?: string; channel?: string | number; kategori?: string | number; limit?: number }) => 
    apiRequest<NewsItem[]>({ url: '/headline', params }, 'news'),
  populer: (params?: { channel?: string | number; kategori?: string | number; days?: number; limit?: number }) => 
    apiRequest<NewsItem[]>({ url: '/populer', params }, 'news'),
  utama: (params?: { limit?: number, page?: number, sort?: 'asc' | 'desc' }) => 
    getBerita.list({ kategori: 'utama', limit: 8, ...params }),
  byKategori: (id: string | number, limit: number = 2) =>
    getBerita.list({ kategori: id, channel: id, limit }),
};

// 4. Statis
export const getStatis = {
  list: (params?: { q?: string; channel?: string | number; kategori?: string | number }) => 
    apiRequest<Statis[]>({ url: '/statis', params }, 'statis'),
  detail: (id: string | number) => 
    apiRequest<Statis>({ url: `/statis/${id}` }, 'statis'),
  opini: (params?: { limit?: number }) => 
    getStatis.list({ q: 'opini', kategori: 'opini', limit: 3, ...params }),
};

// 5. Gallery
export const getGallery = {
  list: (params?: { q?: string; id_berita?: string | number; page?: number; limit?: number; sort?: 'asc' | 'desc' }) => 
    apiRequest<Gallery[]>({ url: '/gallery', params: { limit: 10, sort: 'asc', ...params } }, 'gallery'),
  detail: (id: string | number) => 
    apiRequest<Gallery>({ url: `/gallery/${id}` }, 'gallery'),
  majalah: (params?: { limit?: number }) => 
    getGallery.list({ q: 'majalah', limit: 1, sort: 'desc', ...params }),
};

// 6. Wartawan (Author)
export const getWartawan = {
  list: (params?: { q?: string; status?: string; page?: number; limit?: number; sort?: 'asc' | 'desc' }) => 
    apiRequest<Author[]>({ url: '/wartawan', params: { limit: 10, sort: 'asc', ...params } }, 'author'),
  detail: (id: string | number) => 
    apiRequest<Author>({ url: `/wartawan/${id}` }, 'author'),
};

// 7. User (Admin)
export const getUser = {
  list: (params?: { q?: string; level?: string; status?: string; page?: number; limit?: number; sort?: 'asc' | 'desc' }) => 
    apiRequest<User[]>({ url: '/user', params: { limit: 10, sort: 'asc', ...params } }, 'user'),
  detail: (id: string | number) => 
    apiRequest<User>({ url: `/user/${id}` }, 'user'),
};

// 8. Photo
export const getPhoto = {
  list: (params?: { q?: string; token?: string; page?: number; limit?: number; sort?: 'asc' | 'desc' }) => 
    apiRequest<Photo[]>({ url: '/photo', params: { limit: 10, sort: 'asc', ...params } }, 'photo'),
  detail: (id: string | number) => 
    apiRequest<Photo>({ url: `/photo/${id}` }, 'photo'),
};

// 9. Folder
export const getFolder = {
  list: (params?: { q?: string; admin_id?: number; parent_id?: number; page?: number; limit?: number; sort?: 'asc' | 'desc' }) => 
    apiRequest<Folder[]>({ url: '/folder', params: { limit: 10, sort: 'asc', ...params } }, 'folder'),
  detail: (id: string | number) => 
    apiRequest<Folder>({ url: `/folder/${id}` }, 'folder'),
};

// 10. Folder Image
export const getFolderImage = {
  list: (params?: { q?: string; admin_id?: number; folder_id?: number; type?: string; page?: number; limit?: number; sort?: 'asc' | 'desc' }) => 
    apiRequest<FolderImage[]>({ url: '/folder-image', params: { limit: 10, sort: 'asc', ...params } }, 'folder-image'),
  detail: (id: string | number) => 
    apiRequest<FolderImage>({ url: `/folder-image/${id}` }, 'folder-image'),
};

// 11. Iklan
export const getIklan = {
  list: (params?: { q?: string; jenis?: string; posisi?: string; status?: string; sort?: 'asc' | 'desc'; page?: number; limit?: number }) => 
    apiRequest<Iklan[]>({ url: '/iklan', params: { limit: 10, sort: 'asc', ...params } }, 'iklan'),
  detail: (id: string | number) => 
    apiRequest<Iklan>({ url: `/iklan/${id}` }, 'iklan'),
};

// 12. Link
export const getLink = {
  list: (params?: { q?: string; channel?: string | number; kategori?: string | number; page?: number; limit?: number; sort?: 'asc' | 'desc' }) => 
    apiRequest<Link[]>({ url: '/link', params: { limit: 10, sort: 'asc', ...params } }, 'link'),
  detail: (id: string | number) => 
    apiRequest<Link>({ url: `/link/${id}` }, 'link'),
};

// 13. Newsletter
export const getNewsletter = {
  list: (params?: { q?: string; channel?: string | number; stts?: string; page?: number; limit?: number; sort?: 'asc' | 'desc' }) => 
    apiRequest<Newsletter[]>({ url: '/newsletter', params: { limit: 10, sort: 'asc', ...params } }, 'newsletter'),
  detail: (id: string | number) => 
    apiRequest<Newsletter>({ url: `/newsletter/${id}` }, 'newsletter'),
  subscribe: (email: string) => {
    const formData = new FormData();
    formData.append('email', email);
    return apiRequest<any>({ url: '/newsletter', method: 'POST', data: formData });
  }
};


// 14. Komentar
export const getKomentar = {
  list: (params?: { q?: string; id_berita?: string | number; publish?: string; page?: number; limit?: number; sort?: 'asc' | 'desc' }) => 
    apiRequest<Komentar[]>({ url: '/komentar', params: { limit: 10, sort: 'asc', ...params } }, 'komentar'),
  detail: (id: string | number) => 
    apiRequest<Komentar>({ url: `/komentar/${id}` }, 'komentar'),
  store: (data: { berita_id: string | number; name: string; email?: string; comment: string }) => {
    const formData = new FormData();
    formData.append('berita_id', String(data.berita_id));
    formData.append('nama', data.name);
    if (data.email) formData.append('email', data.email);
    formData.append('komentar', data.comment);
    return apiRequest<any>({ url: '/komentar', method: 'POST', data: formData });
  }
};


// 15. Setting
export const getSetting = {
  list: (params?: { q?: string; page?: number; limit?: number; sort?: 'asc' | 'desc' }) => 
    apiRequest<Setting[]>({ url: '/setting', params: { limit: 10, sort: 'asc', ...params } }, 'setting'),
  detail: (id: string | number) => 
    apiRequest<Setting>({ url: `/setting/${id}` }, 'setting'),
};


// 16. Polling (Updated)
export const getPolling = {
  list: (params?: { q?: string; page?: number; limit?: number; sort?: 'asc' | 'desc' }) => 
    apiRequest<Polling[]>({ url: '/polling', params: { limit: 10, sort: 'asc', ...params } }, 'polling'),
  detail: (id: string | number) => 
    apiRequest<Polling>({ url: `/polling/${id}` }, 'polling'),
  vote: (pollingId: string | number, optionId: string | number) => {
    const formData = new FormData();
    formData.append('option', String(optionId));
    return apiRequest({ 
      url: `/polling/${pollingId}/vote`, 
      method: 'POST', 
      data: formData 
    });
  },
};
