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

    // Track completed items before updating state to detect when a video completes in a playlist
    const beforeItem = useDownloadStore.getState().downloads.find((d) => d.id === payload.id);

    updateProgress(payload);

    // If it's a playlist, detect child video completion by comparing completedItems
    if (beforeItem && beforeItem.isPlaylist && payload.playlistIndex != null) {
      const beforeCompleted = (beforeItem as any).completedItems || 0;
      const afterCompleted = payload.playlistIndex - 1;

      if (afterCompleted > beforeCompleted) {
        // Show success notification for each child video completed in this progress step
        for (let i = beforeCompleted; i < afterCompleted; i++) {
          const child = (beforeItem as any).children?.[i];
          const childTitle = child?.title || `Video #${i + 1}`;
          addToast('success', `✓ Completed: ${childTitle}`);
        }
      }
    }

    // Show success toast when a download completes
    if (payload.status === 'finished') {
      const item = useDownloadStore.getState().downloads.find((d) => d.id === payload.id);
      if (item) {
        if (item.isPlaylist) {
          // Notify the last video in the playlist if it wasn't notified yet
          const beforeCompleted = (item as any).completedItems || 0;
          const totalItems = (item as any).totalItems || 0;
          if (totalItems > beforeCompleted) {
            for (let i = beforeCompleted; i < totalItems; i++) {
              const child = (item as any).children?.[i];
              const childTitle = child?.title || `Video #${i + 1}`;
              addToast('success', `✓ Completed: ${childTitle}`);
            }
          }
          addToast('success', `✓ Playlist download completed: ${item.title}`);
        } else {
          const title = item.title || 'Download';
          addToast('success', `✓ Completed: ${title}`);
        }
      }
    }
    // Show error toast when a download fails
    if (payload.status === 'error' && payload.error) {
      addToast('error', `Download failed: ${payload.error}`);
    }
  });

  const startDownload = async (url: string, options: DownloadOptions, prefetchedInfo?: any) => {
    const id = Math.random().toString(36).substring(2, 9);
    
    // Add default queued item in UI
    if (prefetchedInfo?.isPlaylist) {
      addDownload({
        id,
        url,
        title: prefetchedInfo.title || 'Analyzing playlist URL...',
        status: 'queued',
        platform: prefetchedInfo.platform || 'other',
        mediaType: options.audioOnly ? 'audio' : 'video',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        speed: 0,
        eta: 0,
        format: 'Playlist',
        quality: 'Playlist',
        thumbnailUrl: prefetchedInfo.thumbnailUrl,
        duration: prefetchedInfo.duration,
        createdAt: Date.now(),
        outputPath: '',
        isPlaylist: true,
        playlistTitle: prefetchedInfo.title || 'Unknown Playlist',
        totalItems: prefetchedInfo.totalItems || 0,
        completedItems: 0,
        children: prefetchedInfo.entries?.map((entry: any, index: number) => ({
          id: `${id}-child-${index}`,
          url: entry.url,
          title: entry.title,
          status: 'queued',
          platform: prefetchedInfo.platform || 'other',
          mediaType: options.audioOnly ? 'audio' : 'video',
          progress: 0,
          downloadedBytes: 0,
          totalBytes: 0,
          speed: 0,
          eta: 0,
          format: options.audioOnly ? (options.audioFormat?.toUpperCase() || 'MP3') : 'MP4',
          quality: options.audioOnly ? (options.audioQuality ? `${options.audioQuality.replace('k', '')}kbps` : '320kbps') : (options.maxHeight > 0 ? `${options.maxHeight}p` : 'Auto'),
          createdAt: Date.now(),
          outputPath: ''
        })) || []
      } as any);
    } else {
      addDownload({
        id,
        url,
        title: prefetchedInfo?.title || 'Analyzing video URL...',
        status: 'queued',
        platform: prefetchedInfo?.platform || 'other',
        mediaType: options.audioOnly ? 'audio' : 'video',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        speed: 0,
        eta: 0,
        format: options.audioOnly ? (options.audioFormat?.toUpperCase() || 'MP3') : 'MP4',
        quality: options.audioOnly ? (options.audioQuality ? `${options.audioQuality.replace('k', '')}kbps` : '320kbps') : (options.maxHeight > 0 ? `${options.maxHeight}p` : (prefetchedInfo?.quality || 'Auto')),
        thumbnailUrl: prefetchedInfo?.thumbnailUrl,
        duration: prefetchedInfo?.duration,
        createdAt: Date.now(),
        outputPath: ''
      });
    }

    if (prefetchedInfo) {
      addToast('info', `Starting download: ${prefetchedInfo.title || url}`);
      try {
        const saveDir = settings.storage.defaultDownloadPath || '.';
        await invoke('start_download', { id, url, saveDir, options });
      } catch (err) {
        addToast('error', `Failed to start download: ${String(err)}`);
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
      return;
    }

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
      // Extract height from quality string (e.g. "1920x1080" → 1080, "720p" → 720)
      const qualityMatch = item.quality.match(/(\d+)(?:p|$)/i) || item.quality.match(/x(\d+)/);
      const maxHeight = qualityMatch ? parseInt(qualityMatch[1]) : 1080;
      const isAudio = item.mediaType === 'audio';
      const options = {
        maxHeight: isAudio ? 0 : maxHeight,
        extractSubs: false,
        audioOnly: isAudio,
        audioFormat: isAudio ? item.format.toLowerCase() : undefined,
        audioQuality: isAudio ? (item.quality.includes('kbps') ? item.quality.replace('kbps', 'k') : '320k') : undefined
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
