export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'finished' | 'error';
export type Platform = 'youtube' | 'tiktok' | 'facebook' | 'instagram' | 'other';
export type MediaType = 'video' | 'audio' | 'archive';

export interface DownloadItem {
  id: string;
  url: string;
  title: string;
  status: DownloadStatus;
  platform: Platform;
  mediaType: MediaType;
  progress: number;          // 0-100
  downloadedBytes: number;
  totalBytes: number;
  speed: number;             // bytes/sec
  eta: number;               // seconds remaining
  format: string;            // MP4, MKV, FLAC, etc.
  quality: string;           // 4K, 1080p, Hi-Res, etc.
  thumbnailUrl?: string;
  duration?: string;
  outputPath: string;
  createdAt: number;
  completedAt?: number;
  error?: string;
  isPlaylist?: boolean;      // To differentiate normal and playlist card structures
}

export interface PlaylistItem extends DownloadItem {
  isPlaylist: true;
  playlistTitle: string;
  totalItems: number;
  completedItems: number;
  children: DownloadItem[];
}
