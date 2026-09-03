import { describe, it, expect } from 'vitest';
import { isPlaylistItem, generateDownloadId, AnyDownloadItem } from './download';

const single: AnyDownloadItem = {
  id: 'a',
  url: 'https://www.youtube.com/watch?v=x',
  title: 't',
  status: 'queued',
  platform: 'youtube',
  mediaType: 'video',
  progress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  speed: 0,
  eta: 0,
  format: 'MP4',
  quality: '1080p',
  outputPath: '',
  createdAt: Date.now(),
  isPlaylist: false,
};

describe('isPlaylistItem', () => {
  it('narrows union correctly', () => {
    expect(isPlaylistItem(single)).toBe(false);
    expect(isPlaylistItem({ ...single, isPlaylist: true, playlistTitle: 'p', totalItems: 0, completedItems: 0, children: [] } as AnyDownloadItem)).toBe(true);
  });
});

describe('generateDownloadId', () => {
  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateDownloadId()));
    expect(ids.size).toBe(100);
  });
});
