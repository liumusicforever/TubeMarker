export interface MarkerType {
  id: string;
  name: string;
  color: string; // Tailwind class or Hex
  textColor: string;
}

export interface Marker {
  id: string;
  videoId: string;
  typeId: string;
  start: number; // seconds
  end: number; // seconds
  label: string;
  createdAt: number;
}

export interface VideoData {
  id: string;
  title: string; // Original YouTube Title
  customName?: string; // User defined custom name
  thumbnailUrl: string;
  videoUrl: string; // For this demo, we use direct mp4 links to ensure playback
  duration: number; // seconds
  bpm?: number;
  note?: string; // User notes for this video (1:1 relationship)
}

export type PlaybackState = 'playing' | 'paused' | 'ended';

export interface BpmState {
  taps: number[];
  currentBpm: number | null;
  lastTapTime: number;
}
