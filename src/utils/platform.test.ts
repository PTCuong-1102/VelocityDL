import { describe, it, expect } from 'vitest';
import { getPlatformFromUrl, getPlatformColor, getPlatformIcon } from './platform';

describe('getPlatformFromUrl', () => {
  it('detects known platforms', () => {
    expect(getPlatformFromUrl('https://www.youtube.com/watch?v=abc')).toBe('youtube');
    expect(getPlatformFromUrl('https://youtu.be/abc')).toBe('youtube');
    expect(getPlatformFromUrl('https://www.tiktok.com/@u/video/123')).toBe('tiktok');
    expect(getPlatformFromUrl('https://www.facebook.com/watch/?v=1')).toBe('facebook');
    expect(getPlatformFromUrl('https://fb.watch/xyz')).toBe('facebook');
    expect(getPlatformFromUrl('https://www.instagram.com/p/abc/')).toBe('instagram');
    expect(getPlatformFromUrl('https://open.spotify.com/track/abc')).toBe('spotify');
  });
  it('falls back to other (case-insensitive)', () => {
    expect(getPlatformFromUrl('https://EXAMPLE.com/playlist-review')).toBe('other');
    expect(getPlatformFromUrl('HTTPS://WWW.YOUTUBE.COM/watch?v=x')).toBe('youtube');
  });
});

describe('platform meta', () => {
  it('returns a color and icon for every platform', () => {
    for (const p of ['youtube', 'tiktok', 'facebook', 'instagram', 'spotify', 'other'] as const) {
      expect(getPlatformColor(p)).toBeTruthy();
      expect(getPlatformIcon(p)).toBeTruthy();
    }
  });
});
