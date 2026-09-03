import { describe, it, expect } from 'vitest';
import { parseMaxHeight, buildSidecarOptions } from './downloadOptions';
import type { AnyDownloadItem } from '../types/download';

const base: AnyDownloadItem = {
  id: 'x',
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
  createdAt: 0,
  isPlaylist: false,
};

describe('parseMaxHeight', () => {
  it('parses common labels', () => {
    expect(parseMaxHeight('1080p')).toBe(1080);
    expect(parseMaxHeight('720p')).toBe(720);
    expect(parseMaxHeight('1920x1080')).toBe(1080);
    expect(parseMaxHeight('3840x2160')).toBe(2160);
    expect(parseMaxHeight('4K')).toBe(2160);
    expect(parseMaxHeight('8k')).toBe(4320);
  });
  it('falls back for unknown labels', () => {
    expect(parseMaxHeight('Auto')).toBe(1080);
    expect(parseMaxHeight('Playlist')).toBe(1080);
    expect(parseMaxHeight(undefined)).toBe(1080);
    expect(parseMaxHeight('weird', 720)).toBe(720);
  });
});

describe('buildSidecarOptions', () => {
  it('forwards persisted subtitle options verbatim', () => {
    const item: AnyDownloadItem = {
      ...base,
      maxHeight: 720,
      extractSubs: true,
      selectedSubtitles: ['vi', 'en'],
      embedSubs: false,
    };
    expect(buildSidecarOptions(item)).toEqual({
      maxHeight: 720,
      extractSubs: true,
      audioOnly: false,
      selectedSubtitles: ['vi', 'en'],
      embedSubs: false,
    });
  });
  it('reconstructs legacy items without stored options', () => {
    expect(buildSidecarOptions(base)).toEqual({
      maxHeight: 1080,
      extractSubs: false,
      audioOnly: false,
    });
  });
  it('handles audio items', () => {
    const audio: AnyDownloadItem = {
      ...base,
      mediaType: 'audio',
      format: 'MP3',
      quality: '320kbps',
    };
    expect(buildSidecarOptions(audio)).toEqual({
      maxHeight: 0,
      extractSubs: false,
      audioOnly: true,
      audioFormat: 'mp3',
      audioQuality: '320k',
    });
  });
});
