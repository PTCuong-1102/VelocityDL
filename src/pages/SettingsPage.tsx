import React, { useState, useEffect } from 'react';
import GlassPanel from '../components/ui/GlassPanel';
import Toggle from '../components/ui/Toggle';
import NumberStepper from '../components/ui/NumberStepper';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useSettingsStore } from '../stores/settingsStore';
import { useDownloadStore } from '../stores/downloadStore';
import { useToastStore } from '../stores/toastStore';
import { useI18n } from '../i18n';
import { invoke } from '@tauri-apps/api/core';
import { useTauriEvent } from '../hooks/useTauriEvent';
import { getVersion } from '@tauri-apps/api/app';

export const SettingsPage: React.FC = () => {
  const { settings, updateSetting, resetDefaults, isSaving } = useSettingsStore();
  const { addToast } = useToastStore();
  const { t, language } = useI18n();
  // Tool updates are refused by the backend while downloads run.
  const hasActiveDownloads = useDownloadStore((s) =>
    s.downloads.some((d) => d.status === 'downloading' || d.status === 'merging')
  );

  // App Update States
  const [currentVersion, setCurrentVersion] = useState('0.6.3');
  // Tool-update states
  const [toolsStatus, setToolsStatus] = useState<'idle' | 'updating' | 'ready' | 'error'>('idle');
  const [toolsMsg, setToolsMsg] = useState('');
  // Cookie verification states
  const [cookieCheck, setCookieCheck] = useState<{
    status: 'idle' | 'checking' | 'ok' | 'error';
    msg: string;
  }>({ status: 'idle', msg: '' });
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'no-update' | 'downloading' | 'ready' | 'error'>('idle');
  const [updateInfo, setUpdateInfo] = useState<{
    latestVersion: string;
    changelog: string;
    downloadUrl: string;
    fileName: string;
    distroBase?: string;
    distroName?: string;
    installerType?: string;
  } | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [installerPath, setInstallerPath] = useState('');

  useEffect(() => {
    getVersion().then(setCurrentVersion).catch(console.error);
    // Sync the launch-on-boot toggle with the OS state.
    invoke<boolean>('is_launch_on_boot')
      .then((enabled) => {
        if (enabled !== settings.general.launchOnBoot) {
          updateSetting('general', 'launchOnBoot', enabled);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live tool-update messages from the sidecar (update_tools command).
  useTauriEvent<any>('info-progress', (event) => {
    const payload = event.payload;
    if (payload.status === 'updating' && payload.message && toolsStatus === 'updating') {
      setToolsMsg(payload.message);
    } else if (payload.status === 'ready' && payload.message && toolsStatus === 'updating') {
      setToolsMsg(payload.message);
    }
  });

  const handleInstallUpdate = async (pathOverride?: string) => {
    const targetPath = pathOverride || installerPath;
    if (!targetPath) return;
    try {
      addToast('info', t('settings.launchingInstaller'));
      await invoke('install_app_update', { filePath: targetPath });
    } catch (err) {
      console.error(err);
      addToast('error', t('settings.installerFailed', { err: String(err) }));
    }
  };

  // Listen for update download progress events from sidecar
  useTauriEvent<any>('update-progress', (event) => {
    const payload = event.payload;
    if (payload.status === 'downloading') {
      setUpdateStatus('downloading');
      setDownloadProgress(payload.progress || 0);
    } else if (payload.status === 'ready' && payload.filePath) {
      setUpdateStatus('ready');
      setInstallerPath(payload.filePath);
      // Automatically install update once downloaded
      handleInstallUpdate(payload.filePath);
    } else if (payload.status === 'error') {
      setUpdateStatus('error');
      setErrorMsg(payload.message || t('settings.downloadFailedFallback'));
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
          distroBase: res.distroBase,
          distroName: res.distroName,
          installerType: res.installerType,
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

  const handleUpdateTools = async () => {
    if (hasActiveDownloads) {
      addToast('info', t('settings.pauseBeforeTools'));
      return;
    }
    setToolsStatus('updating');
    setToolsMsg(t('settings.startingToolUpdate'));
    try {
      await invoke('update_tools');
      setToolsStatus('ready');
      setToolsMsg(t('settings.toolsUpToDate'));
      addToast('success', t('settings.toolsUpdatedToast'));
    } catch (err) {
      console.error(err);
      setToolsStatus('error');
      setToolsMsg(String(err));
      addToast('error', t('settings.toolsFailedToast', { err: String(err) }));
    }
  };

  const handleLaunchOnBoot = async (enabled: boolean) => {
    updateSetting('general', 'launchOnBoot', enabled);
    try {
      await invoke('set_launch_on_boot', { enabled });
    } catch (err) {
      console.error(err);
      updateSetting('general', 'launchOnBoot', !enabled);
      addToast('error', t('settings.startupFailed', { err: String(err) }));
    }
  };

  const handleBrowsePath = async () => {
    try {
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
        // Pass the fresh path directly — the debounced save may not have
        // persisted it yet when verification reads settings.
        handleVerifyCookies('file', selectedPath);
      }
    } catch (err) {
      console.error('Failed to browse cookie file:', err);
    }
  };

  const handleVerifyCookies = async (source?: string, filePath?: string) => {
    const src = source ?? settings.engine.cookieSource;
    if (src === 'none') {
      setCookieCheck({ status: 'idle', msg: '' });
      return;
    }
    setCookieCheck({ status: 'checking', msg: t('settings.readingCookies') });
    try {
      const res = await invoke<any>('check_cookies', {
        source: src,
        filePath: src === 'file' ? (filePath ?? settings.engine.cookieFilePath ?? '') : '',
      });
      const domains = Array.isArray(res?.domains) ? res.domains.slice(0, 5).join(', ') : '';
      setCookieCheck({
        status: 'ok',
        msg: t('settings.cookiesFrom', { n: res?.cookieCount ?? 0, source: res?.resolvedSource ?? src }) + (domains ? ` (${domains})` : ''),
      });
    } catch (err) {
      console.error(err);
      setCookieCheck({ status: 'error', msg: String(err) });
    }
  };



  return (
    <div className="flex-col gap-lg w-full" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
      {/* Header */}
      <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div className="flex-col">
          <h1>{t('nav.settings')}</h1>
          <p className="text-muted mt-sm">{t('settings.subtitle')}</p>
        </div>
        <div className="flex-row gap-xs text-muted" style={{ fontSize: '13px', alignItems: 'center', backgroundColor: 'var(--surface-container-low)', padding: '6px 14px', borderRadius: 'var(--radius-full)', border: '1px solid var(--outline-variant)' }}>
          {isSaving ? (
            <>
              <span className="icon text-primary-color" style={{ fontSize: '16px', animation: 'pulse 1s infinite ease-in-out' }}>sync</span>
              <span style={{ fontWeight: 500 }}>{t('settings.saving')}</span>
            </>
          ) : (
            <>
              <span className="icon text-secondary-color" style={{ fontSize: '16px' }}>check_circle</span>
              <span style={{ fontWeight: 500 }}>{t('settings.autoSaved')}</span>
            </>
          )}
        </div>
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
          className="flex-col gap-lg settings-main-col"
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
              {t('settings.enginePanel')}
            </h2>
            
            <div className="flex-col gap-md">
              {/* Concurrent threads stepper */}
              <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="flex-col" style={{ gap: '4px' }}>
                  <span style={{ fontWeight: 500, fontSize: '13px' }}>{t('settings.concurrentDownloads')}</span>
                  <span className="text-muted" style={{ fontSize: '11px' }}>{t('settings.maxThreadsDesc')}</span>
                </div>
                <NumberStepper 
                  value={settings.engine.concurrentThreads} 
                  min={1} 
                  max={6} 
                  onChange={(val) => updateSetting('engine', 'concurrentThreads', val)}
                />
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--outline-variant)', margin: '4px 0' }} />

              {/* Speed Limit */}
              <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="flex-col" style={{ gap: '4px' }}>
                  <span style={{ fontWeight: 500, fontSize: '13px' }}>{t('settings.speedLimit')}</span>
                  <span className="text-muted" style={{ fontSize: '11px' }}>{t('settings.speedLimitDesc')}</span>
                </div>
                <select
                  className="select-dark"
                  style={{ width: '150px' }}
                  value={settings.engine.speedLimit || 0}
                  onChange={(e) => updateSetting('engine', 'speedLimit', Number(e.target.value))}
                >
                  <option value={0}>{t("settings.unlimited")}</option>
                  <option value={512}>500 KB/s</option>
                  <option value={1024}>1 MB/s</option>
                  <option value={2048}>2 MB/s</option>
                  <option value={5120}>5 MB/s</option>
                  <option value={10240}>10 MB/s</option>
                  <option value={20480}>20 MB/s</option>
                  <option value={51200}>50 MB/s</option>
                </select>
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--outline-variant)', margin: '4px 0' }} />

              {/* Proxy Type & Address */}
              <div className="flex-col gap-sm">
                <span style={{ fontWeight: 500, fontSize: '13px' }}>{t('settings.proxySettings')}</span>
                <div className="flex-row gap-sm">
                  <select
                    className="select-dark"
                    value={settings.engine.proxyType}
                    onChange={(e) => updateSetting('engine', 'proxyType', e.target.value as any)}
                  >
                    <option value="HTTP">HTTP</option>
                    <option value="SOCKS5">SOCKS5</option>
                  </select>
                  <Input
                    placeholder={t("settings.proxyPlaceholder")}
                    value={settings.engine.proxyAddress}
                    onChange={(e) => updateSetting('engine', 'proxyAddress', e.target.value)}
                    style={{ height: '38px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--outline-variant)', margin: '4px 0' }} />

              {/* Cookie Settings */}
              <div className="flex-col gap-sm">
                <span style={{ fontWeight: 500, fontSize: '13px' }}>{t('settings.cookieAuth')}</span>
                <div className="flex-row gap-sm">
                  <select
                    className="select-dark"
                    style={{ flexGrow: 1, height: '38px' }}
                    value={settings.engine.cookieSource}
                    onChange={(e) => {
                      const v = e.target.value as any;
                      updateSetting('engine', 'cookieSource', v);
                      // Verify immediately so a broken source is caught here,
                      // not later at download time with no feedback.
                      handleVerifyCookies(v);
                    }}
                  >
                    <option value="default">{t("settings.cookieDefault")}</option>
                    <option value="none">{t("settings.cookieNone")}</option>
                    <option value="chrome">Google Chrome</option>
                    <option value="firefox">Mozilla Firefox</option>
                    <option value="edge">Microsoft Edge</option>
                    <option value="safari">Apple Safari</option>
                    <option value="opera">Opera</option>
                    <option value="brave">Brave</option>
                    <option value="chromium">Chromium</option>
                    <option value="vivaldi">Vivaldi</option>
                    <option value="whale">Naver Whale</option>
                    <option value="file">{t("settings.cookieFileOption")}</option>
                  </select>
                </div>
                {settings.engine.cookieSource === 'file' && (
                  <div className="flex-row gap-sm" style={{ marginTop: '4px' }}>
                    <Input
                      readOnly
                      placeholder={t("settings.cookiePlaceholder")}
                      value={settings.engine.cookieFilePath || t('settings.noCookieFile')}
                      style={{ height: '38px', fontSize: '13px' }}
                    />
                    <Button variant="ghost" onClick={handleBrowseCookieFile} style={{ height: '38px' }}>
                      Browse
                    </Button>
                  </div>
                )}
                {settings.engine.cookieSource !== 'none' && (
                  <div className="flex-row gap-sm" style={{ marginTop: '4px', alignItems: 'center' }}>
                    <Button
                      variant="ghost"
                      onClick={() => handleVerifyCookies()}
                      style={{ height: '32px', fontSize: '12px' }}
                    >
                      {cookieCheck.status === 'checking' ? t('settings.checking') : t('settings.verifyCookies')}
                    </Button>
                    {cookieCheck.status === 'ok' && (
                      <span style={{ fontSize: '12px', color: '#6bd8cb' }}>✓ {cookieCheck.msg}</span>
                    )}
                    {cookieCheck.status === 'error' && (
                      <span style={{ fontSize: '12px', color: '#ffb4ab' }}>✕ {cookieCheck.msg}</span>
                    )}
                    {cookieCheck.status === 'checking' && (
                      <span className="text-muted" style={{ fontSize: '12px' }}>{cookieCheck.msg}</span>
                    )}
                  </div>
                )}
                <span className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                  {t('settings.cookieHelp')}
                </span>
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--outline-variant)', margin: '4px 0' }} />

              {/* Auto update yt-dlp */}
              <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="flex-col" style={{ gap: '4px' }}>
                  <span style={{ fontWeight: 500, fontSize: '13px' }}>{t('settings.autoUpdateYtdlp')}</span>
                  <span className="text-muted" style={{ fontSize: '11px' }}>{t('settings.autoUpdateYtdlpDesc')}</span>
                </div>
                <Toggle 
                  checked={settings.engine.autoUpdateYtdlp}
                  onChange={(e) => updateSetting('engine', 'autoUpdateYtdlp', e.target.checked)}
                />
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--outline-variant)', margin: '4px 0' }} />

              {/* Manual tool update */}
              <div className="flex-col gap-sm">
                <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="flex-col" style={{ gap: '4px' }}>
                    <span style={{ fontWeight: 500, fontSize: '13px' }}>{t('settings.toolsVersion')}</span>
                    <span className="text-muted" style={{ fontSize: '11px' }}>
                      {toolsStatus === 'idle' ? t('settings.toolsIdle') : toolsMsg}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={handleUpdateTools}
                    style={{ height: '38px', whiteSpace: 'nowrap' }}
                    title={hasActiveDownloads ? t('settings.unavailableRunning') : undefined}
                  >
                    {toolsStatus === 'updating' ? t('settings.updating') : t('settings.updateToolsNow')}
                  </Button>
                </div>
                {toolsStatus === 'updating' && (
                  <span className="text-muted" style={{ fontSize: '11px' }}>{toolsMsg}</span>
                )}
              </div>
            </div>
          </GlassPanel>

          {/* Storage Settings Panel */}
          <GlassPanel>
            <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="icon text-primary-color">folder</span>
              {t('settings.storagePanel')}
            </h2>

            <div className="flex-col gap-md">
              {/* Save directory select field */}
              <div className="flex-col gap-sm">
                <span style={{ fontWeight: 500, fontSize: '13px' }}>{t('settings.defaultDir')}</span>
                <div className="flex-row gap-sm">
                  <Input
                    readOnly
                    placeholder={t("settings.dirPlaceholder")}
                    value={settings.storage.defaultDownloadPath || t('settings.noDirSelected')}
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
                  <span style={{ fontWeight: 500, fontSize: '13px' }}>{t('settings.subfolders')}</span>
                  <span className="text-muted" style={{ fontSize: '11px' }}>{t('settings.subfoldersDesc')}</span>
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
          className="flex-col gap-lg settings-aside-col"
        >
          {/* General UI Panel */}
          <GlassPanel style={{ height: '100%' }}>
            <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="icon text-tertiary-color">palette</span>
              {t('settings.generalPanel')}
            </h2>

            <div className="flex-col gap-md">
              {/* Interface Theme buttons */}
              <div className="flex-col gap-sm">
                <span style={{ fontWeight: 500, fontSize: '13px' }}>{t('settings.skinTheme')}</span>
                <div className="flex-row gap-sm">
                  <button
                    className={`btn btn-ghost ${settings.general.theme === 'deep-space' ? 'active' : ''}`}
                    style={{ flexGrow: 1, padding: '8px 0', fontSize: '12px' }}
                    onClick={() => updateSetting('general', 'theme', 'deep-space')}
                  >
                    {t('settings.deepSpace')}
                  </button>
                  <button
                    className={`btn btn-ghost ${settings.general.theme === 'system-sync' ? 'active' : ''}`}
                    style={{ flexGrow: 1, padding: '8px 0', fontSize: '12px' }}
                    onClick={() => updateSetting('general', 'theme', 'system-sync')}
                  >
                    {t('settings.systemSync')}
                  </button>
                </div>
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--outline-variant)', margin: '4px 0' }} />

                            {/* Language */}
              <div style={{ height: '1px', backgroundColor: 'var(--outline-variant)', margin: '4px 0' }} />

              <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500, fontSize: '13px' }}>{t('settings.language')}</span>
                <select
                  className="select-dark"
                  style={{ width: '150px' }}
                  value={language}
                  onChange={(e) => updateSetting('general', 'language', e.target.value as 'en' | 'vi')}
                >
                  <option value="en">English</option>
                  <option value="vi">Tiếng Việt</option>
                </select>
              </div>

              {/* Launch on boot */}
              <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="flex-col" style={{ gap: '4px' }}>
                  <span style={{ fontWeight: 500, fontSize: '13px' }}>{t('settings.launchOnBoot')}</span>
                  <span className="text-muted" style={{ fontSize: '11px' }}>{t('settings.launchOnBootDesc')}</span>
                </div>
                <Toggle
                  checked={settings.general.launchOnBoot}
                  onChange={(e) => handleLaunchOnBoot(e.target.checked)}
                />
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--outline-variant)', margin: '4px 0' }} />

              {/* Desktop notifications */}
              <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="flex-col" style={{ gap: '4px' }}>
                  <span style={{ fontWeight: 500, fontSize: '13px' }}>{t('settings.notifications')}</span>
                  <span className="text-muted" style={{ fontSize: '11px' }}>{t('settings.notificationsDesc')}</span>
                </div>
                <Toggle
                  checked={settings.general.desktopNotifications}
                  onChange={(e) => updateSetting('general', 'desktopNotifications', e.target.checked)}
                />
              </div>
            </div>
          </GlassPanel>

          {/* Application Update Panel */}
          <GlassPanel>
            <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="icon text-secondary-color">system_update_alt</span>
              {t('settings.appUpdate')}
            </h2>

            <div className="flex-col gap-md" style={{ fontSize: '13px' }}>
              <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500 }}>{t("settings.currentVersion")}</span>
                <span className="text-muted" style={{ fontWeight: 600 }}>v{currentVersion}</span>
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--outline-variant)', margin: '4px 0' }} />

              {/* Status Rendering */}
              {updateStatus === 'idle' && (
                <div className="flex-col gap-sm">
                  <span className="text-muted" style={{ fontSize: '11px' }}>{t('settings.checkHint')}</span>
                  <Button variant="primary" onClick={handleCheckUpdate} style={{ width: '100%' }}>
                    {t('settings.checkForUpdates')}
                  </Button>
                </div>
              )}

              {updateStatus === 'checking' && (
                <div className="flex-col gap-sm" style={{ alignItems: 'center', padding: '12px 0' }}>
                  <span className="icon text-primary-color" style={{ fontSize: '24px', animation: 'pulse 1s infinite ease-in-out' }}>sync</span>
                  <span style={{ fontSize: '12px' }} className="text-muted">{t("settings.checkingGithub")}</span>
                </div>
              )}

              {updateStatus === 'no-update' && (
                <div className="flex-col gap-sm">
                  <div className="flex-row gap-xs" style={{ alignItems: 'center', color: '#6bd8cb' }}>
                    <span className="icon" style={{ fontSize: '18px' }}>check_circle</span>
                    <span style={{ fontWeight: 500 }}>{t("settings.upToDate")}</span>
                  </div>
                  <span className="text-muted" style={{ fontSize: '11px' }}>{t('settings.onLatest')}</span>
                  <Button variant="ghost" onClick={handleCheckUpdate} style={{ width: '100%', marginTop: '4px' }}>
                    {t('settings.checkAgain')}
                  </Button>
                </div>
              )}

              {updateStatus === 'available' && updateInfo && (
                <div className="flex-col gap-sm">
                  <div className="flex-row gap-xs" style={{ alignItems: 'center', color: '#ffb95f' }}>
                    <span className="icon" style={{ fontSize: '18px' }}>info</span>
                    <span style={{ fontWeight: 500 }}>{t("settings.newUpdate", { ver: updateInfo.latestVersion })}</span>
                  </div>

                  {updateInfo.fileName && (
                    <div style={{ fontSize: '11px', color: 'var(--secondary-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="icon" style={{ fontSize: '14px' }}>inventory_2</span>
                      <span>{t('settings.pkg')} <strong>{updateInfo.fileName}</strong>{updateInfo.distroName ? ` (${updateInfo.distroName})` : ''}</span>
                    </div>
                  )}
                  
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
                    {updateInfo.changelog || t('settings.noReleaseNotes')}
                  </div>

                  <Button variant="primary" onClick={handleDownloadUpdate} style={{ width: '100%', marginTop: '4px' }}>
                    {t('settings.downloadAndInstall')}
                  </Button>
                </div>
              )}

              {updateStatus === 'downloading' && (
                <div className="flex-col gap-sm">
                  <div className="flex-row" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 500 }}>{t("settings.downloadingUpdate")}</span>
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
                      background: 'linear-gradient(90deg, var(--primary-container) 0%, var(--secondary-container) 100%)',
                      transition: 'width 0.2s ease-out'
                    }} />
                  </div>
                </div>
              )}

              {updateStatus === 'ready' && (
                <div className="flex-col gap-sm">
                  <div className="flex-row gap-xs" style={{ alignItems: 'center', color: '#6bd8cb' }}>
                    <span className="icon" style={{ fontSize: '18px' }}>download_done</span>
                    <span style={{ fontWeight: 500 }}>{t("settings.downloadedLaunching")}</span>
                  </div>
                  <span className="text-muted" style={{ fontSize: '11px' }}>
                    {t('settings.installerAuto')}
                  </span>
                  <Button variant="primary" onClick={() => handleInstallUpdate()} style={{ width: '100%', marginTop: '4px' }}>
                    {t('settings.restartInstall')}
                  </Button>
                </div>
              )}

              {updateStatus === 'error' && (
                <div className="flex-col gap-sm">
                  <div className="flex-row gap-xs" style={{ alignItems: 'center', color: '#ffb4ab' }}>
                    <span className="icon" style={{ fontSize: '18px' }}>error</span>
                    <span style={{ fontWeight: 500 }}>{t("settings.updateFailed")}</span>
                  </div>
                  <span className="text-muted" style={{ fontSize: '11px', wordBreak: 'break-all' }}>{errorMsg}</span>
                  <Button variant="ghost" onClick={handleCheckUpdate} style={{ width: '100%', marginTop: '4px' }}>
                    {t('settings.retryCheck')}
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
          onClick={() => {
            resetDefaults();
            addToast('success', t('settings.resetToast'));
          }}
          style={{ height: '38px', padding: '0 20px' }}
        >
          {t('settings.resetDefaults')}
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
