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
    cookieSource: 'none',
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
  },
};

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
  
  setAllSettings: (settings) => set({ settings }),
  
  resetDefaults: () => set(() => {
    saveSettingsDebounced(DEFAULT_SETTINGS, set);
    return { settings: DEFAULT_SETTINGS };
  }),
}));

export default useSettingsStore;
