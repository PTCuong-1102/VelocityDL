import { create } from 'zustand';
import { AppSettings } from '../types/settings';

interface SettingsState {
  settings: AppSettings;
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

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  
  updateSetting: (category, setting, value) => set((state) => ({
    settings: {
      ...state.settings,
      [category]: {
        ...state.settings[category],
        [setting]: value,
      },
    },
  })),
  
  setAllSettings: (settings) => set({ settings }),
  
  resetDefaults: () => set({ settings: DEFAULT_SETTINGS }),
}));

export default useSettingsStore;
