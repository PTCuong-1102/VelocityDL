import { create } from 'zustand';
import { AppSettings } from '../types/settings';
import { invoke } from '@tauri-apps/api/core';

interface SettingsState {
  settings: AppSettings;
  isSaving: boolean;
  updateSetting: <K extends keyof AppSettings, S extends keyof AppSettings[K]>(
    category: K,
    setting: S,
    value: AppSettings[K][S]
  ) => void;
  setAllSettings: (settings: AppSettings) => void;
  resetDefaults: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  engine: {
    concurrentThreads: 3,
    proxyType: 'HTTP',
    proxyAddress: '',
    autoUpdateYtdlp: true,
    cookieSource: 'default',
    cookieFilePath: '',
    speedLimit: 0,
  },
  storage: {
    defaultDownloadPath: '', // Will be filled dynamically by Tauri on startup
    createSubfolders: true,
  },
  general: {
    theme: 'deep-space',
    launchOnBoot: false,
    desktopNotifications: true,
    language: 'en',
  },
};

/**
 * Deep-merge loaded settings over DEFAULT_SETTINGS. settings.json is read
 * raw from disk (versions evolve independently) — a file from an older
 * release might lack keys like `general` or `engine.speedLimit`; storing
 * it verbatim left fields undefined and crashed `settings.general.theme`
 * consumers at render time (white screen on upgrade).
 */
export function mergeWithDefaults(raw: unknown, defaults = DEFAULT_SETTINGS): AppSettings {
  if (typeof raw !== 'object' || raw === null) return defaults;
  const isPlainObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);
  const merge = <T extends Record<string, unknown>>(saved: unknown, defs: T): T => {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(defs)) {
      const def = defs[key];
      const savedVal = (saved as Record<string, unknown>)[key];
      if (isPlainObject(def) && isPlainObject(savedVal)) {
        out[key] = merge(savedVal, def as Record<string, unknown>);
      } else if (savedVal !== undefined && savedVal !== null && typeof savedVal === typeof def) {
        out[key] = savedVal;
      } else {
        out[key] = def;
      }
    }
    return out as T;
  };
  return merge(raw, { ...defaults });
}

// Debounce helper
let saveTimeout: number | undefined;

const saveSettingsDebounced = (settings: AppSettings, set: (state: Partial<SettingsState>) => void) => {
  set({ isSaving: true });
  
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  saveTimeout = window.setTimeout(async () => {
    try {
      await invoke('save_settings', { settings });
      console.log('Settings auto-saved successfully.');
    } catch (err) {
      console.error('Failed to auto-save settings:', err);
    } finally {
      set({ isSaving: false });
    }
  }, 1000); // 1 second debounce
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  isSaving: false,
  
  updateSetting: (category, setting, value) => set((state) => {
    const nextSettings = {
      ...state.settings,
      [category]: {
        ...state.settings[category],
        [setting]: value,
      },
    };
    saveSettingsDebounced(nextSettings, set);
    return { settings: nextSettings };
  }),
  
  setAllSettings: (settings) => set({ settings: mergeWithDefaults(settings) }),
  
  resetDefaults: () => set(() => {
    saveSettingsDebounced(DEFAULT_SETTINGS, set);
    return { settings: DEFAULT_SETTINGS };
  }),
}));

export default useSettingsStore;
