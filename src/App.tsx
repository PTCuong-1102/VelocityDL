import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import DashboardPage from './pages/DashboardPage';
import QueuePage from './pages/QueuePage';
import FinishedPage from './pages/FinishedPage';
import SettingsPage from './pages/SettingsPage';
import useSettingsStore from './stores/settingsStore';
import { invoke } from '@tauri-apps/api/core';

export const App: React.FC = () => {
  const { settings, setAllSettings } = useSettingsStore();

  useEffect(() => {
    document.documentElement.className = `theme-${settings.general.theme}`;
  }, [settings.general.theme]);

  useEffect(() => {
    // Load saved settings from Tauri config on app mount.
    // Falls back to the OS default download dir when nothing was saved yet.
    const loadSettings = async () => {
      try {
        const savedSettings = await invoke<any>('load_settings');
        if (savedSettings) {
          if (!savedSettings?.storage?.defaultDownloadPath) {
            try {
              const osDefault = await invoke<string | null>('get_default_download_path');
              if (osDefault) savedSettings.storage.defaultDownloadPath = osDefault;
            } catch {
              // Keep empty — queue manager falls back to '.'.
            }
          }
          setAllSettings(savedSettings);
        }
      } catch (err) {
        console.warn('Failed to load settings from Tauri backend, using defaults:', err);
      }
    };

    loadSettings();

    // Ask once for desktop-notification permission (honored per-download).
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        void Notification.requestPermission().catch(() => {});
      }
    } catch {
      // Non-browser / restricted webview — ignore.
    }
  }, [setAllSettings]);

  return (
    <Router>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/finished" element={<FinishedPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppShell>
    </Router>
  );
};

export default App;
