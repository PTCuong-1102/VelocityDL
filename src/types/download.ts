export type DownloadStatus = 'analyzing' | 'queued' | 'downloading' | 'merging' | 'paused' | 'finished' | 'error';
export type Platform = 'youtube' | 'tiktok' | 'facebook' | 'instagram' | 'spotify' | 'other';
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
  isPlaylist?: false;
}

export interface PlaylistItem extends Omit<DownloadItem, 'isPlaylist'> {
  isPlaylist: true;
  playlistTitle: string;
  totalItems: number;
  completedItems: number;
  children: DownloadItem[];
}

/** Union type for any item in the download store */
export type AnyDownloadItem = DownloadItem | PlaylistItem;

/** Type guard: narrows AnyDownloadItem to PlaylistItem */
export function isPlaylistItem(item: AnyDownloadItem): item is PlaylistItem {
  return item.isPlaylist === true;
}

/** Generate a collision-free download ID */
export function generateDownloadId(): string {
  return crypto.randomUUID();
}
