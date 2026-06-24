import React, { useState, useEffect } from 'react';
import GlassPanel from '../components/ui/GlassPanel';
import Toggle from '../components/ui/Toggle';
import NumberStepper from '../components/ui/NumberStepper';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useSettingsStore } from '../stores/settingsStore';
import { invoke } from '@tauri-apps/api/core';
import { useTauriEvent } from '../hooks/useTauriEvent';
import { getVersion } from '@tauri-apps/api/app';

export const SettingsPage: React.FC = () => {
  const { settings, updateSetting, resetDefaults } = useSettingsStore();

  // App Update States
  const [currentVersion, setCurrentVersion] = useState('0.2.1');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'no-update' | 'downloading' | 'ready' | 'error'>('idle');
  const [updateInfo, setUpdateInfo] = useState<{
    latestVersion: string;
    changelog: string;
    downloadUrl: string;
    fileName: string;
  } | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [installerPath, setInstallerPath] = useState('');

  useEffect(() => {
    getVersion().then(setCurrentVersion).catch(console.error);
  }, []);

  // Listen for update download progress events from sidecar
  useTauriEvent<any>('update-progress', (event) => {
    const payload = event.payload;
    if (payload.status === 'downloading') {
      setUpdateStatus('downloading');
      setDownloadProgress(payload.progress || 0);
    } else if (payload.status === 'ready' && payload.filePath) {
      setUpdateStatus('ready');
      setInstallerPath(payload.filePath);
    } else if (payload.status === 'error') {
      setUpdateStatus('error');
      setErrorMsg(payload.message || 'Download failed');
    }
  });

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking');
    setErrorMsg('');
    try {
      const res = await invoke<any>('check_app_update', { currentVersion });
      if (res.updateAvailable) {
        setUpdateStatus('available');
        setUpdateInfo({
          latestVersion: res.latestVersion,
          changelog: res.changelog,
          downloadUrl: res.downloadUrl,
          fileName: res.fileName,
        });
      } else {
        setUpdateStatus('no-update');
      }
    } catch (err) {
      console.error(err);
      setUpdateStatus('error');
      setErrorMsg(String(err));
    }
  };

  const handleDownloadUpdate = async () => {
    if (!updateInfo) return;
    setUpdateStatus('downloading');
    setDownloadProgress(0);
    setErrorMsg('');
    try {
      const saveDir = settings.storage.defaultDownloadPath || '.';
      await invoke('start_app_update_download', {
        url: updateInfo.downloadUrl,
        saveDir,
        fileName: updateInfo.fileName,
      });
    } catch (err) {
      console.error(err);
      setUpdateStatus('error');
      setErrorMsg(String(err));
    }
  };

  const handleInstallUpdate = async () => {
    if (!installerPath) return;
    try {
      await invoke('open_file', { path: installerPath });
      await invoke('exit_app');
    } catch (err) {
      console.error(err);
      alert(`Failed to execute installer: ${err}`);
    }
  };

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

  const handleBrowseCookieFile = async () => {
    try {
      const selectedPath = await invoke<string | null>('browse_cookie_file');
      if (selectedPath) {
        updateSetting('engine', 'cookieFilePath', selectedPath);
      }
    } catch (err) {
      console.error('Failed to browse cookie file:', err);
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

              {/* Cookie Settings */}
              <div className="flex-col gap-sm">
                <span style={{ fontWeight: 500, fontSize: '13px' }}>Cookie Authentication (Instagram/TikTok Stories)</span>
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
                      cursor: 'pointer',
                      flexGrow: 1
                    }}
                    value={settings.engine.cookieSource}
                    onChange={(e) => updateSetting('engine', 'cookieSource', e.target.value as any)}
                  >
                    <option value="none">No Cookies (None)</option>
                    <option value="chrome">Google Chrome</option>
                    <option value="firefox">Mozilla Firefox</option>
                    <option value="edge">Microsoft Edge</option>
                    <option value="safari">Apple Safari</option>
                    <option value="opera">Opera</option>
                    <option value="file">Use cookies.txt file</option>
                  </select>
                </div>
                {settings.engine.cookieSource === 'file' && (
                  <div className="flex-row gap-sm" style={{ marginTop: '4px' }}>
                    <Input
                      readOnly
                      placeholder="Select cookies.txt file..."
                      value={settings.engine.cookieFilePath || 'No cookie file selected'}
                      style={{ height: '38px', fontSize: '13px' }}
                    />
                    <Button variant="ghost" onClick={handleBrowseCookieFile} style={{ height: '38px' }}>
                      Browse
                    </Button>
                  </div>
                )}
                <span className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                  Stories require authentication. If choosing a browser, ensure you are logged in to Instagram/TikTok in that browser. 
                  Alternatively, export and upload a <code>cookies.txt</code> file.
                </span>
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
            </div>
          </GlassPanel>

          {/* Application Update Panel */}
          <GlassPanel>
            <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="icon text-secondary-color">system_update_alt</span>
              App Update
            </h2>

            <div className="flex-col gap-md" style={{ fontSize: '13px' }}>
              <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500 }}>Current Version</span>
                <span className="text-muted" style={{ fontWeight: 600 }}>v{currentVersion}</span>
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--outline-variant)', margin: '4px 0' }} />

              {/* Status Rendering */}
              {updateStatus === 'idle' && (
                <div className="flex-col gap-sm">
                  <span className="text-muted" style={{ fontSize: '11px' }}>Check for the latest features and security updates.</span>
                  <Button variant="primary" onClick={handleCheckUpdate} style={{ width: '100%' }}>
                    Check for Updates
                  </Button>
                </div>
              )}

              {updateStatus === 'checking' && (
                <div className="flex-col gap-sm" style={{ alignItems: 'center', padding: '12px 0' }}>
                  <span className="icon text-primary-color" style={{ fontSize: '24px', animation: 'pulse 1s infinite ease-in-out' }}>sync</span>
                  <span style={{ fontSize: '12px' }} className="text-muted">Checking GitHub repository...</span>
                </div>
              )}

              {updateStatus === 'no-update' && (
                <div className="flex-col gap-sm">
                  <div className="flex-row gap-xs" style={{ alignItems: 'center', color: '#6bd8cb' }}>
                    <span className="icon" style={{ fontSize: '18px' }}>check_circle</span>
                    <span style={{ fontWeight: 500 }}>Up to date</span>
                  </div>
                  <span className="text-muted" style={{ fontSize: '11px' }}>You are on the latest version of VelocityDL.</span>
                  <Button variant="ghost" onClick={handleCheckUpdate} style={{ width: '100%', marginTop: '4px' }}>
                    Check Again
                  </Button>
                </div>
              )}

              {updateStatus === 'available' && updateInfo && (
                <div className="flex-col gap-sm">
                  <div className="flex-row gap-xs" style={{ alignItems: 'center', color: '#ffb95f' }}>
                    <span className="icon" style={{ fontSize: '18px' }}>info</span>
                    <span style={{ fontWeight: 500 }}>New update v{updateInfo.latestVersion}</span>
                  </div>
                  
                  {/* Changelog box */}
                  <div 
                    style={{ 
                      maxHeight: '100px', 
                      overflowY: 'auto', 
                      padding: '8px', 
                      backgroundColor: 'rgba(0,0,0,0.2)', 
                      borderRadius: '8px',
                      fontSize: '11px',
                      lineHeight: '1.4',
                      border: '1px solid var(--outline-variant)',
                      whiteSpace: 'pre-wrap'
                    }}
                    className="custom-scrollbar text-muted"
                  >
                    {updateInfo.changelog || 'No release notes provided.'}
                  </div>

                  <Button variant="primary" onClick={handleDownloadUpdate} style={{ width: '100%', marginTop: '4px' }}>
                    Download & Install
                  </Button>
                </div>
              )}

              {updateStatus === 'downloading' && (
                <div className="flex-col gap-sm">
                  <div className="flex-row" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 500 }}>Downloading update...</span>
                    <span>{downloadProgress}%</span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '6px',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '3px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${downloadProgress}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--primary-color) 0%, var(--secondary-color) 100%)',
                      transition: 'width 0.2s ease-out'
                    }} />
                  </div>
                </div>
              )}

              {updateStatus === 'ready' && (
                <div className="flex-col gap-sm">
                  <div className="flex-row gap-xs" style={{ alignItems: 'center', color: '#6bd8cb' }}>
                    <span className="icon" style={{ fontSize: '18px' }}>download_done</span>
                    <span style={{ fontWeight: 500 }}>Download completed!</span>
                  </div>
                  <span className="text-muted" style={{ fontSize: '11px' }}>The update has been downloaded. Ready to install.</span>
                  <Button variant="primary" onClick={handleInstallUpdate} style={{ width: '100%', marginTop: '4px' }}>
                    Restart & Install
                  </Button>
                </div>
              )}

              {updateStatus === 'error' && (
                <div className="flex-col gap-sm">
                  <div className="flex-row gap-xs" style={{ alignItems: 'center', color: '#ffb4ab' }}>
                    <span className="icon" style={{ fontSize: '18px' }}>error</span>
                    <span style={{ fontWeight: 500 }}>Update failed</span>
                  </div>
                  <span className="text-muted" style={{ fontSize: '11px', wordBreak: 'break-all' }}>{errorMsg}</span>
                  <Button variant="ghost" onClick={handleCheckUpdate} style={{ width: '100%', marginTop: '4px' }}>
                    Retry Check
                  </Button>
                </div>
              )}
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
