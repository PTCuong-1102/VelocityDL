import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// History store calls only @tauri-apps/api/core invoke — mock the module so
// unit tests never touch the IPC layer.
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(() => Promise.resolve()) }));

import { invoke } from '@tauri-apps/api/core';
import useHistoryStore from './historyStore';
import { DownloadItem } from '../types/download';

const item = (id: string, title: string): DownloadItem => ({
  id,
  url: `https://example.com/${id}`,
  title,
  status: 'finished',
  platform: 'youtube',
  mediaType: 'video',
  progress: 100,
  downloadedBytes: 1024,
  totalBytes: 1024,
  speed: 0,
  eta: 0,
  format: 'MP4',
  quality: '1080p',
  outputPath: '/tmp/x.mp4',
  createdAt: Date.now(),
  completedAt: Date.now(),
});

describe('historyStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useHistoryStore.setState({ history: [], loaded: false });
    vi.mocked(invoke).mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('records newest first and drops duplicate ids', () => {
    const { recordFinished } = useHistoryStore.getState();
    recordFinished(item('a', 'first') as any);
    recordFinished(item('b', 'second') as any);
    recordFinished(item('a', 'first') as any); // re-record same id → single entry
    const { history } = useHistoryStore.getState();
    expect(history.length).toBe(2);
    expect(history[0].title).toBe('first'); // re-record moves it back to front
    expect(history[1].title).toBe('second');
  });

  it('debounces saves: two rapid records → single save_history call', async () => {
    const { recordFinished } = useHistoryStore.getState();
    recordFinished(item('a', 'x') as any);
    recordFinished(item('b', 'y') as any);
    const calls = vi.mocked(invoke).mock.calls.length;
    await vi.advanceTimersByTimeAsync(2500);
    expect(invoke).toHaveBeenCalledTimes(calls + 1);
    expect(invoke).toHaveBeenLastCalledWith('save_history', {
      items: expect.arrayContaining([expect.objectContaining({ id: 'a' })]),
    });
  });

  it('removeEntry deletes and schedules save', async () => {
    const { recordFinished, removeEntry } = useHistoryStore.getState();
    recordFinished(item('a', 'x') as any);
    recordFinished(item('b', 'y') as any);
    removeEntry('a');
    expect(useHistoryStore.getState().history.map((h) => h.id)).toEqual(['b']);
    await vi.advanceTimersByTimeAsync(2500);
    expect(
      vi.mocked(invoke).mock.calls.some(([cmd]) => cmd === 'save_history')
    ).toBe(true);
  });

  it('caps history at 1000 entries', () => {
    const { recordFinished } = useHistoryStore.getState();
    for (let i = 0; i < 1100; i++) {
      recordFinished(item(`id-${i}`, `t${i}`) as any);
    }
    expect(useHistoryStore.getState().history.length).toBe(1000);
  });

  it('clearAll wipes store and persists an empty array', async () => {
    const { recordFinished, clearAll } = useHistoryStore.getState();
    recordFinished(item('a', 'x') as any);
    clearAll();
    await vi.advanceTimersByTimeAsync(100);
    expect(useHistoryStore.getState().history).toEqual([]);
    expect(invoke).toHaveBeenLastCalledWith('save_history', { items: [] });
  });
});

// Imported after the mock above to keep the allowed import order.
