import React from 'react';
import GlassPanel from '../components/ui/GlassPanel';
import Toggle from '../components/ui/Toggle';
import NumberStepper from '../components/ui/NumberStepper';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useSettingsStore } from '../stores/settingsStore';
import { invoke } from '@tauri-apps/api/core';

export const SettingsPage: React.FC = () => {
  const { settings, updateSetting, resetDefaults } = useSettingsStore();

  const handleBrowsePath = async () => {
    try {
      // In Phase 10 we'll implement browse_directory.
      const selectedPath = await invoke<string | null>('browse_directory');
      if (selectedPath) {
        updateSetting('storage', 'defaultDownloadPath', selectedPath);
      }
    } catch (err) {
      console.error('Failed to browse directory:', err);
    }
  };

  const handleSave = async () => {
    try {
      await invoke('save_settings', { settings });
      alert('Settings saved successfully!');
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  return (
    <div className="flex-col gap-lg w-full" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
      {/* Header */}
      <div>
        <h1>Settings</h1>
        <p className="text-muted mt-sm">Configure Deno backend engine, downloads storage directory, and interface preferences.</p>
      </div>

      {/* Bento Grid */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: '20px',
          width: '100%'
        }}
      >
        {/* Left Column (col-span-8) */}
        <div 
          className="flex-col gap-lg"
          style={{
            gridColumn: 'span 8',
            '@media (max-width: 900px)': {
              gridColumn: 'span 12'
            }
          } as any}
        >
          {/* Deno Engine Panel */}
          <GlassPanel style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: '-40px',
                right: '-40px',
                width: '120px',
                height: '120px',
                background: 'radial-gradient(circle, rgba(107, 216, 203, 0.08) 0%, rgba(0,0,0,0) 70%)',
                pointerEvents: 'none'
              }}
            />
            <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="icon text-secondary-color">settings_suggest</span>
              Deno Backend Engine
            </h2>
            
            <div className="flex-col gap-md">
              {/* Concurrent threads stepper */}
              <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="flex-col" style={{ gap: '4px' }}>
                  <span style={{ fontWeight: 500, fontSize: '13px' }}>Concurrent Downloads</span>
                  <span className="text-muted" style={{ fontSize: '11px' }}>Maximum parallel video downloading threads.</span>
                </div>
                <NumberStepper 
                  value={settings.engine.concurrentThreads} 
                  min={1} 
                  max={6} 
                  onChange={(val) => updateSetting('engine', 'concurrentThreads', val)}
                />
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--outline-variant)', margin: '4px 0' }} />

              {/* Proxy Type & Address */}
              <div className="flex-col gap-sm">
                <span style={{ fontWeight: 500, fontSize: '13px' }}>Network Proxy Settings</span>
                <div className="flex-row gap-sm">
                  <select
                    style={{
                      backgroundColor: 'var(--surface-container-lowest)',
                      border: '1px solid var(--outline-variant)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--on-surface)',
                      padding: '8px 12px',
                      outline: 'none',
                      fontSize: '13px',
                      height: '38px',
                      cursor: 'pointer'
                    }}
                    value={settings.engine.proxyType}
                    onChange={(e) => updateSetting('engine', 'proxyType', e.target.value as any)}
                  >
                    <option value="HTTP">HTTP</option>
                    <option value="SOCKS5">SOCKS5</option>
                  </select>
                  <Input
                    placeholder="Proxy address (e.g. 127.0.0.1:1080)..."
                    value={settings.engine.proxyAddress}
                    onChange={(e) => updateSetting('engine', 'proxyAddress', e.target.value)}
                    style={{ height: '38px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--outline-variant)', margin: '4px 0' }} />

              {/* Auto update yt-dlp */}
              <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="flex-col" style={{ gap: '4px' }}>
                  <span style={{ fontWeight: 500, fontSize: '13px' }}>Auto-update yt-dlp</span>
                  <span className="text-muted" style={{ fontSize: '11px' }}>Keep yt-dlp extractor up-to-date with latest changes.</span>
                </div>
                <Toggle 
                  checked={settings.engine.autoUpdateYtdlp}
                  onChange={(e) => updateSetting('engine', 'autoUpdateYtdlp', e.target.checked)}
                />
              </div>
            </div>
          </GlassPanel>

          {/* Storage Settings Panel */}
          <GlassPanel>
            <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="icon text-primary-color">folder</span>
              Storage & Save Path
            </h2>

            <div className="flex-col gap-md">
              {/* Save directory select field */}
              <div className="flex-col gap-sm">
                <span style={{ fontWeight: 500, fontSize: '13px' }}>Default Downloads Directory</span>
                <div className="flex-row gap-sm">
                  <Input
                    readOnly
                    placeholder="Select save path..."
                    value={settings.storage.defaultDownloadPath || 'No directory selected'}
                    style={{ height: '38px', fontSize: '13px' }}
                  />
                  <Button variant="ghost" onClick={handleBrowsePath} style={{ height: '38px' }}>
                    Browse
                  </Button>
                </div>
              </div>

              {/* Create subfolders option */}
              <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="flex-col" style={{ gap: '4px' }}>
                  <span style={{ fontWeight: 500, fontSize: '13px' }}>Organize by Subfolders</span>
                  <span className="text-muted" style={{ fontSize: '11px' }}>Save playlist videos inside dedicated folders.</span>
                </div>
                <Toggle 
                  checked={settings.storage.createSubfolders}
                  onChange={(e) => updateSetting('storage', 'createSubfolders', e.target.checked)}
                />
              </div>
            </div>
          </GlassPanel>
        </div>

        {/* Right Column (col-span-4) */}
        <div 
          className="flex-col gap-lg"
          style={{
            gridColumn: 'span 4',
            '@media (max-width: 900px)': {
              gridColumn: 'span 12'
            }
          } as any}
        >
          {/* General UI Panel */}
          <GlassPanel style={{ height: '100%' }}>
            <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="icon text-tertiary-color">palette</span>
              General & Themes
            </h2>

            <div className="flex-col gap-md">
              {/* Interface Theme buttons */}
              <div className="flex-col gap-sm">
                <span style={{ fontWeight: 500, fontSize: '13px' }}>Interface Skin Theme</span>
                <div className="flex-row gap-sm">
                  <button
                    className={`btn btn-ghost ${settings.general.theme === 'deep-space' ? 'active' : ''}`}
                    style={{ flexGrow: 1, padding: '8px 0', fontSize: '12px' }}
                    onClick={() => updateSetting('general', 'theme', 'deep-space')}
                  >
                    Deep Space
                  </button>
                  <button
                    className={`btn btn-ghost ${settings.general.theme === 'system-sync' ? 'active' : ''}`}
                    style={{ flexGrow: 1, padding: '8px 0', fontSize: '12px' }}
                    onClick={() => updateSetting('general', 'theme', 'system-sync')}
                  >
                    System Sync
                  </button>
                </div>
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--outline-variant)', margin: '4px 0' }} />

              {/* Launch on boot toggle */}
              <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="flex-col" style={{ gap: '4px' }}>
                  <span style={{ fontWeight: 500, fontSize: '13px' }}>Run on Startup</span>
                </div>
                <Toggle 
                  checked={settings.general.launchOnBoot}
                  onChange={(e) => updateSetting('general', 'launchOnBoot', e.target.checked)}
                />
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--outline-variant)', margin: '4px 0' }} />

              {/* Desktop notifications toggle */}
              <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="flex-col" style={{ gap: '4px' }}>
                  <span style={{ fontWeight: 500, fontSize: '13px' }}>System Notifications</span>
                  <span className="text-muted" style={{ fontSize: '10px' }}>Alert when downloads finish.</span>
                </div>
                <Toggle 
                  checked={settings.general.desktopNotifications}
                  onChange={(e) => updateSetting('general', 'desktopNotifications', e.target.checked)}
                />
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>

      {/* Save Settings footer bar */}
      <div 
        className="flex-row gap-md" 
        style={{ 
          justifyContent: 'flex-end', 
          borderTop: '1px solid var(--outline-variant)',
          paddingTop: '20px',
          marginTop: '8px'
        }}
      >
        <button 
          className="btn btn-ghost" 
          onClick={resetDefaults}
          style={{ height: '38px', padding: '0 20px' }}
        >
          Reset Defaults
        </button>
        <button 
          className="btn btn-primary" 
          onClick={handleSave}
          style={{ height: '38px', padding: '0 24px' }}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
