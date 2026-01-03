export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    total_pages?: number;
  };
}


export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface Author {
  id: number;
  name: string;
  avatar: string;
  bio: string;
  status?: string;
}

export interface Channel {
  id: number;
  name: string;
  slug: string;
  type?: string;
  navigation?: string;
  order?: number;
}

export interface NewsItem {
  id: number;
  title: string;
  slug: string;
  summary: string;
  content: string;
  cover: string;
  image?: string | null;
  cover_credit: string;
  created_at: string;
  updated_at: string;
  published_at: string;
  views: number;
  tags: string[];
  category: Category;
  author: Author;
  channel: Channel;
  editor?: string;
  journalist?: string;
  gallery?: Gallery[];
}

export interface Statis {
  id: number;
  title: string;
  content: string;
  channel_id?: number;
  category_id?: number;
  created_at?: string;
}

export type StatisItem = Statis;

export interface Gallery {
  id: number;
  title: string;
  article_id?: number;
  image: string;
  created_at?: string;
}

export type GalleryItem = Gallery;

export interface User {
  id: number;
  username: string;
  level: string;
  status: string;
  email?: string;
}

export interface Photo {
  id: number;
  title: string;
  token: string;
  image: string;
  created_at?: string;
}

export interface Folder {
  id: number;
  name: string;
  admin_id: number;
  parent_id?: number;
}

export interface FolderImage {
  id: number;
  name: string;
  admin_id: number;
  folder_id: number;
  type: string;
  path?: string;
}

export interface Iklan {
  id: number;
  name: string;
  type: string;
  position: string;
  status: string;
  order: number;
  start_date: string;
  end_date: string;
  image?: string;
  url?: string;
}

export interface Link {
  id: number;
  name: string;
  url: string;
  channel_id?: number;
  category_id?: number;
}

export interface Newsletter {
  id: number;
  email: string;
  channel_id?: number;
  status: string;
}

export interface Komentar {
  id: number;
  name: string;
  email: string;
  comment: string;
  article_id: number;
  channel_id?: number;
  category_id?: number;
  is_published: boolean;
  date: string;
}

export interface Setting {
  id: number;
  key: string;
  value: string;
}

export interface Polling {
  id: number;
  title: string;
  question: string;
  total_votes: number;
  options: PollingOption[];
  created_at?: string;
}

export interface PollingOption {
  id: number;
  label: string;
  votes: number;
}

