import { VideoData, Marker, MarkerType } from './types';

// --- Abstract Interface ---
export interface StorageAdapter {
  // Videos
  getVideos(): Promise<VideoData[]>;
  addVideo(video: VideoData): Promise<void>;
  updateVideo(video: VideoData): Promise<void>;
  deleteVideo(id: string): Promise<void>;

  // Markers
  getMarkers(): Promise<Marker[]>;
  addMarker(marker: Marker): Promise<void>;
  deleteMarker(id: string): Promise<void>;

  // Types
  getMarkerTypes(): Promise<MarkerType[]>;
  addMarkerType(type: MarkerType): Promise<void>;
}

// --- API Storage Implementation ---
// 自動判斷環境：本機端使用 localhost，生產環境使用 api.taiwan-cmo.com
const getApiBaseUrl = (): string => {
  // 如果環境變數有設定，優先使用環境變數
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // 檢查是否在本機環境（開發模式或 hostname 為 localhost）
  const isLocalhost = 
    import.meta.env.DEV || // Vite 開發模式
    (typeof window !== 'undefined' && 
     (window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '0.0.0.0'));
  
  // 本機端使用 localhost，生產環境使用 api.taiwan-cmo.com
  return isLocalhost 
    ? 'http://localhost:3001' 
    : 'https://api.taiwan-cmo.com';
};

const API_BASE_URL = getApiBaseUrl();

export class ApiStorageAdapter implements StorageAdapter {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // --- Videos ---
  async getVideos(): Promise<VideoData[]> {
    return this.request<VideoData[]>('/api/videos');
  }

  async addVideo(video: VideoData): Promise<void> {
    await this.request<void>('/api/videos', {
      method: 'POST',
      body: JSON.stringify(video),
    });
  }

  async updateVideo(video: VideoData): Promise<void> {
    await this.request<void>(`/api/videos/${video.id}`, {
      method: 'PUT',
      body: JSON.stringify(video),
    });
  }

  async deleteVideo(id: string): Promise<void> {
    await this.request<void>(`/api/videos/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Markers ---
  async getMarkers(): Promise<Marker[]> {
    return this.request<Marker[]>('/api/markers');
  }

  async addMarker(marker: Marker): Promise<void> {
    await this.request<void>('/api/markers', {
      method: 'POST',
      body: JSON.stringify(marker),
    });
  }

  async deleteMarker(id: string): Promise<void> {
    await this.request<void>(`/api/markers/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Types ---
  async getMarkerTypes(): Promise<MarkerType[]> {
    return this.request<MarkerType[]>('/api/marker-types');
  }

  async addMarkerType(type: MarkerType): Promise<void> {
    await this.request<void>('/api/marker-types', {
      method: 'POST',
      body: JSON.stringify(type),
    });
  }
}

// Export a singleton instance
export const storage = new ApiStorageAdapter();
