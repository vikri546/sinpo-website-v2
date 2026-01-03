/**
 * Formats a date string to Indonesian locale (Full)
 * Hubungan: "20 Desember 2025"
 */
export const formatDate = (dateString?: string | null) => {
  if (!dateString) return 'Tanggal tidak valid';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Tanggal tidak valid';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

/**
 * Formats a date string to Indonesian locale (Short)
 * Contoh: "20 Des 2025"
 */
export const formatShortDate = (dateString?: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

/**
 * Formats a date string to relative time (Indonesian)
 * Contoh: "2 jam yang lalu"
 */
export const formatRelativeTime = (dateString?: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Baru saja';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} menit yang lalu`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} jam yang lalu`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} hari yang lalu`;
  
  return formatDate(dateString);
};

/**
 * Strips HTML tags from a string
 */
export const stripHtml = (html?: string) => {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '');
};

/**
 * Truncates text to a specified length
 */
export const truncateText = (text?: string, length: number = 100) => {
  if (!text) return '';
  const cleanText = stripHtml(text);
  if (cleanText.length <= length) return cleanText;
  return cleanText.substring(0, length) + '...';
};

const BASE_URL = 'https://sinpo.id';

/**
 * Gets image URL with fallback according to SINPO requirements
 */
export const getImageUrl = (path?: string | null): string => {
  if (!path) return 'https://placehold.co/800x600/eee/999?text=SinPo+Media';
  
  // If the path is already an absolute URL starting with http, return it
  if (path.startsWith('http')) return path;
  
  // Clean path (remove leading slash if any)
  let cleanPath = path.startsWith('/') ? path.substring(1) : path;

  // IF the path already contains 'storage/' or 'uploads/', don't prepend 'storage/'
  if (cleanPath.startsWith('storage/') || cleanPath.startsWith('uploads/')) {
    return `${BASE_URL}/${cleanPath}`;
  }
  
  // Return absolute URL with SINPO's verified storage prefix
  return `${BASE_URL}/storage/${cleanPath}`;
};

/**
 * Fixes relative image URLs within HTML content
 */
export const fixContentImages = (html?: string) => {
  if (!html) return '';
  
  // Regex to find img src attributes that don't start with http/https/data
  // Rewrites them to absolute URLs using the storage prefix
  return html.replace(/<img[^>]+src=["'](?!(?:http|https|data):)([^"']+)["']/g, (match, p1) => {
    const cleanPath = p1.startsWith('/') ? p1.substring(1) : p1;
    const newUrl = `${BASE_URL}/storage/${cleanPath}`;
    return match.replace(p1, newUrl);
  });
};

/**
 * Formats author name with fallback
 */
export const formatAuthorName = (name?: string) => {
  return name || 'Redaksi';
};

/**
 * Gets author name prioritizing journalist, then author name, then fallback
 */
export const getAuthorName = (item: any) => {
  return item?.journalist || item?.author?.name || 'Redaksi';
};

/**
 * Formats category name with fallback
 */
export const formatCategoryName = (name?: string) => {
  return name || 'Umum';
};

/**
 * Safely parses API response
 */
export const parseApiResponse = <T>(response: any, defaultValue: T): T => {
  if (response && response.data) {
    return response.data as T;
  }
  return defaultValue;
};

/**
 * Safely access array from API response
 */
export const safeArray = <T>(arr: any): T[] => {
  return (Array.isArray(arr) ? arr : []) as T[];
};

/**
 * Checks if data is empty
 */
export const isEmpty = (data: any) => {
  if (!data) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === 'object') return Object.keys(data).length === 0;
  return false;
};
