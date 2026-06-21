import { useDownloadStore } from '../stores/downloadStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useTauriEvent } from './useTauriEvent';
import { invoke } from '@tauri-apps/api/core';
import { DownloadOptions } from '../components/shared/URLInput';
import { Platform } from '../types/download';
import useToastStore from '../stores/toastStore';

export function useDownload() {
  const { 
    downloads, 
    addDownload, 
    updateProgress, 
    pauseDownload: storePause, 
    resumeDownload: storeResume, 
    cancelDownload: storeCancel 
  } = useDownloadStore();
  const { settings } = useSettingsStore();
  const { addToast } = useToastStore();

  // Listen for real-time progress events from Tauri
  useTauriEvent<any>('download-progress', (event) => {
    const payload = event.payload;
    updateProgress(payload);
    // Show success toast when a download completes
    if (payload.status === 'finished') {
      const item = useDownloadStore.getState().downloads.find((d) => d.id === payload.id);
      const title = item?.title || 'Download';
      addToast('success', `✓ Completed: ${title}`);
    }
    // Show error toast when a download fails
    if (payload.status === 'error' && payload.error) {
      addToast('error', `Download failed: ${payload.error}`);
    }
  });

  const startDownload = async (url: string, options: DownloadOptions) => {
    const id = Math.random().toString(36).substring(2, 9);
    
    // Add default queued item in UI
    addDownload({
      id,
      url,
      title: 'Analyzing video URL...',
      status: 'queued',
      platform: 'other',
      mediaType: options.audioOnly ? 'audio' : 'video',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speed: 0,
      eta: 0,
      format: options.audioOnly ? 'MP3' : 'MP4',
      quality: '1080p',
      createdAt: Date.now(),
      outputPath: ''
    });

    addToast('info', 'Fetching video information...');

    try {
      // 1. Fetch metadata using yt-dlp info
      const info = await invoke<any>('get_video_info', { url });
      
      // Update item in store with metadata
      useDownloadStore.setState((state) => ({
        downloads: state.downloads.map((d) => 
          d.id === id 
            ? {
                ...d,
                title: info.title,
                thumbnailUrl: info.thumbnailUrl,
                duration: info.duration,
                platform: info.platform as Platform,
                quality: info.quality
              }
            : d
        )
      }));

      addToast('info', `Starting download: ${info.title || url}`);

      // 2. Trigger the download process in Tauri
      const saveDir = settings.storage.defaultDownloadPath || '.';
      await invoke('start_download', { id, url, saveDir, options });
    } catch (err) {
      addToast('error', `Failed to fetch URL info: ${String(err)}`);
      updateProgress({
        id,
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        speed: 0,
        eta: 0,
        status: 'error',
        error: String(err)
      });
    }
  };

  const pauseDownload = async (id: string) => {
    try {
      await invoke('pause_download', { id });
      storePause(id);
    } catch (err) {
      console.error('Failed to pause download:', err);
    }
  };

  const resumeDownload = async (id: string) => {
    const item = downloads.find((d) => d.id === id);
    if (!item) return;

    try {
      storeResume(id);
      
      // Re-trigger start_download with same URL and settings
      const saveDir = settings.storage.defaultDownloadPath || '.';
      const options = {
        auto4k: item.quality.includes('2160') || item.quality.includes('4K'),
        extractSubs: false,
        audioOnly: item.mediaType === 'audio'
      };

      await invoke('start_download', { id, url: item.url, saveDir, options });
    } catch (err) {
      console.error('Failed to resume download:', err);
      updateProgress({
        id,
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        speed: 0,
        eta: 0,
        status: 'error',
        error: `Resume failed: ${err}`
      });
    }
  };

  const cancelDownload = async (id: string) => {
    try {
      await invoke('cancel_download', { id });
      storeCancel(id);
    } catch (err) {
      console.error('Failed to cancel download:', err);
    }
  };

  return {
    startDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload
  };
}

export default useDownload;
