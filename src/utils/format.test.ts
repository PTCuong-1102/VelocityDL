import { describe, it, expect } from 'vitest';
import { formatBytes, formatSpeed, formatETA, formatDuration } from './format';

describe('formatBytes', () => {
  it('handles zero and negatives', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-5)).toBe('0 B');
  });
  it('formats KB/MB/GB', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(1024 ** 3)).toBe('1 GB');
  });
});

describe('formatSpeed', () => {
  it('handles zero', () => {
    expect(formatSpeed(0)).toBe('0 B/s');
  });
  it('formats KB/s', () => {
    expect(formatSpeed(2048)).toBe('2 KB/s');
  });
});

describe('formatETA', () => {
  it('handles edge cases', () => {
    expect(formatETA(0)).toBe('00:00');
    expect(formatETA(-1)).toBe('--:--');
    expect(formatETA(NaN)).toBe('--:--');
    expect(formatETA(Infinity)).toBe('--:--');
  });
  it('formats mm:ss and h:mm:ss', () => {
    expect(formatETA(65)).toBe('01:05');
    expect(formatETA(3661)).toBe('1:01:01');
  });
});

describe('formatDuration', () => {
  it('handles undefined and garbage', () => {
    expect(formatDuration(undefined)).toBe('');
    expect(formatDuration('abc')).toBe('');
  });
  it('accepts string seconds', () => {
    expect(formatDuration('90')).toBe('01:30');
    expect(formatDuration(90)).toBe('01:30');
  });
});
