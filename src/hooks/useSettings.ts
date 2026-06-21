import { useSettingsStore } from '../stores/settingsStore';
import { invoke } from '@tauri-apps/api/core';
import { AppSettings } from '../types/settings';

export function useSettings() {
  const { settings, updateSetting, setAllSettings, resetDefaults } = useSettingsStore();

  const loadSettings = async () => {
    try {
      const saved = await invoke<AppSettings>('load_settings');
      if (saved) {
        setAllSettings(saved);
      }
    } catch (err) {
      console.warn('Failed to load settings:', err);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      await invoke('save_settings', { settings: newSettings });
      setAllSettings(newSettings);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  const selectDownloadDirectory = async () => {
    try {
      const selected = await invoke<string | null>('browse_directory');
      if (selected) {
        updateSetting('storage', 'defaultDownloadPath', selected);
      }
    } catch (err) {
      console.error('Failed to select directory:', err);
    }
  };

  return {
    settings,
    updateSetting,
    resetDefaults,
    loadSettings,
    saveSettings,
    selectDownloadDirectory
  };
}

export default useSettings;
