import { DownloadItem } from './download';

export interface DownloadProgressPayload {
  id: string;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speed: number;
  eta: number;
  status: DownloadItem['status'];
  error?: string;
  playlistIndex?: number | null;
  playlistTotal?: number | null;
  outputPath?: string;
}

export interface SidecarMessage {
  type: 'progress' | 'status' | 'info' | 'error';
  id: string;
  data: any;
}
