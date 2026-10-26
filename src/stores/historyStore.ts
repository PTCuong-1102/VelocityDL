import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { AnyDownloadItem } from '../types/download';

/**
 * Permanent download history, persisted by the Rust backend to
 * `<app_config>/history.json` (capacity 1000 entries, newest first).
 *
 * Previously finished items lived in the localStorage-backed download
 * store: a webview data purge (or the 200-entry trim in trimFinished)
 * wiped history, and old entries accumulated in localStorage forever.
 * Here the finished items are snapshot-recorded at completion and then
 * removed from the active download store.
 */
interface HistoryState {
  history: AnyDownloadItem[];
  loaded: boolean;
  /** Called once at app mount; never throws into the caller's flow. */
  loadHistory: () => Promise<void>;
  /** Snapshot a finished item at the front, de-duplicated by id. */
  recordFinished: (item: AnyDownloadItem) => void;
  removeEntry: (id: string) => void;
  clearAll: () => void;
}

// Backend applies its own cap; mirror it so the UI never shows entries the
// next save will drop.
const MAX_ENTRY = 1000;

let saveTimer: ReturnType<typeof setTimeout> | undefined;

/** Debounced whole-array save — history writes happen at most every 2s. */
function scheduleSave(items: AnyDownloadItem[]) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    invoke('save_history', { items }).catch((err) =>
      console.warn('Failed to persist download history:', err)
    );
  }, 2000);
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  history: [],
  loaded: false,

  loadHistory: async () => {
    try {
      const items = await invoke<AnyDownloadItem[]>('load_history');
      set({ history: Array.isArray(items) ? items : [], loaded: true });
    } catch (err) {
      console.warn('Failed to load download history:', err);
      set({ loaded: true }); // proceed with empty rather than blocking UI
    }
  },

  recordFinished: (item) => {
    const current = get().history.filter((d) => d.id !== item.id);
    const next = [item, ...current].slice(0, MAX_ENTRY);
    set({ history: next });
    scheduleSave(next);
  },

  removeEntry: (id) => {
    const next = get().history.filter((d) => d.id !== id);
    set({ history: next });
    scheduleSave(next);
  },

  clearAll: () => {
    if (saveTimer) clearTimeout(saveTimer);
    set({ history: [] });
    invoke('save_history', { items: [] }).catch((err) =>
      console.warn('Failed to clear download history:', err)
    );
  },
}));

export default useHistoryStore;
