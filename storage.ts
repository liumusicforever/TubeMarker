import { VideoData, Marker, MarkerType } from './types';
import { INITIAL_VIDEOS, INITIAL_MARKERS, INITIAL_MARKER_TYPES } from './constants';

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

// --- Local Storage Implementation ---
const KEYS = {
  VIDEOS: 'yt_timeline_videos',
  MARKERS: 'yt_timeline_markers',
  TYPES: 'yt_timeline_types',
};

export class LocalStorageAdapter implements StorageAdapter {
  constructor() {
    this.seed();
  }

  private seed() {
    if (typeof window === 'undefined') return;

    if (!localStorage.getItem(KEYS.VIDEOS)) {
      localStorage.setItem(KEYS.VIDEOS, JSON.stringify(INITIAL_VIDEOS));
    }
    if (!localStorage.getItem(KEYS.MARKERS)) {
      localStorage.setItem(KEYS.MARKERS, JSON.stringify(INITIAL_MARKERS));
    }
    if (!localStorage.getItem(KEYS.TYPES)) {
      localStorage.setItem(KEYS.TYPES, JSON.stringify(INITIAL_MARKER_TYPES));
    }
  }

  private get<T>(key: string): T[] {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : [];
  }

  private set<T>(key: string, data: T[]) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // --- Videos ---
  async getVideos(): Promise<VideoData[]> {
    return this.get<VideoData>(KEYS.VIDEOS);
  }

  async addVideo(video: VideoData): Promise<void> {
    const videos = this.get<VideoData>(KEYS.VIDEOS);
    this.set(KEYS.VIDEOS, [...videos, video]);
  }

  async updateVideo(video: VideoData): Promise<void> {
    const videos = this.get<VideoData>(KEYS.VIDEOS);
    this.set(KEYS.VIDEOS, videos.map(v => v.id === video.id ? video : v));
  }

  async deleteVideo(id: string): Promise<void> {
    const videos = this.get<VideoData>(KEYS.VIDEOS);
    this.set(KEYS.VIDEOS, videos.filter(v => v.id !== id));
  }

  // --- Markers ---
  async getMarkers(): Promise<Marker[]> {
    return this.get<Marker>(KEYS.MARKERS);
  }

  async addMarker(marker: Marker): Promise<void> {
    const markers = this.get<Marker>(KEYS.MARKERS);
    this.set(KEYS.MARKERS, [...markers, marker]);
  }

  async deleteMarker(id: string): Promise<void> {
    const markers = this.get<Marker>(KEYS.MARKERS);
    this.set(KEYS.MARKERS, markers.filter(m => m.id !== id));
  }

  // --- Types ---
  async getMarkerTypes(): Promise<MarkerType[]> {
    return this.get<MarkerType>(KEYS.TYPES);
  }

  async addMarkerType(type: MarkerType): Promise<void> {
    const types = this.get<MarkerType>(KEYS.TYPES);
    this.set(KEYS.TYPES, [...types, type]);
  }
}

// Export a singleton instance
export const storage = new LocalStorageAdapter();
