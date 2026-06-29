import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import DashboardPage from './pages/DashboardPage';
import QueuePage from './pages/QueuePage';
import FinishedPage from './pages/FinishedPage';
import ScheduledPage from './pages/ScheduledPage';
import BrowserPage from './pages/BrowserPage';
import SettingsPage from './pages/SettingsPage';
import useSettingsStore from './stores/settingsStore';
import { invoke } from '@tauri-apps/api/core';

export const App: React.FC = () => {
  const { settings, setAllSettings } = useSettingsStore();

  useEffect(() => {
    document.documentElement.className = `theme-${settings.general.theme}`;
  }, [settings.general.theme]);

  useEffect(() => {
    // Load saved settings from Tauri config on app mount
    const loadSettings = async () => {
      try {
        const savedSettings = await invoke<any>('load_settings');
        if (savedSettings) {
          setAllSettings(savedSettings);
        }
      } catch (err) {
        console.warn('Failed to load settings from Tauri backend, using defaults:', err);
      }
    };

    loadSettings();
  }, [setAllSettings]);

  return (
    <Router>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/finished" element={<FinishedPage />} />
          <Route path="/scheduled" element={<ScheduledPage />} />
          <Route path="/browser" element={<BrowserPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppShell>
    </Router>
  );
};

export default App;
