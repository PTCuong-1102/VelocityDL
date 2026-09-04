import { useDownloadStore } from '../stores/downloadStore';
import { useTauriEvent } from './useTauriEvent';
import { invoke } from '@tauri-apps/api/core';
import { DownloadOptions } from '../components/shared/URLInput';
import { Platform, PlaylistItem, isPlaylistItem, generateDownloadId } from '../types/download';
import useToastStore from '../stores/toastStore';
import { useSettingsStore } from '../stores/settingsStore';

/** OS-level notification, honoring the user's desktopNotifications setting. */
function notifyDesktop(title: string, body: string) {
  try {
    if (useSettingsStore.getState().settings.general.desktopNotifications !== false) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    }
  } catch {
    // Notifications unavailable — toast feedback already covers it.
  }
}

export function useDownload() {
  const { 
    downloads, 
    addDownload, 
    updateProgress, 
    pauseDownload: storePause, 
    resumeDownload: storeResume, 
    cancelDownload: storeCancel 
  } = useDownloadStore();
  const { addToast } = useToastStore();

  // Listen for real-time progress events from Tauri
  useTauriEvent<any>('info-progress', (event) => {
    const payload = event.payload;
    if (payload.status === 'updating' && payload.message) {
      addToast('info', payload.message);
    } else if (payload.status === 'ready' && payload.message) {
      addToast('success', payload.message);
    }
  });

  useTauriEvent<any>('download-progress', (event) => {
    const payload = event.payload;

    if (payload.status === 'updating' && payload.message) {
      addToast('info', payload.message);
      return;
    }
    
    if (payload.status === 'ready' && payload.message) {
      addToast('success', payload.message);
      return;
    }

    // Track completed items before updating state to detect when a video completes in a playlist
    const beforeItem = useDownloadStore.getState().downloads.find((d) => d.id === payload.id);

    updateProgress(payload);

    // If it's a playlist, detect child video completion by comparing completedItems
    if (beforeItem && isPlaylistItem(beforeItem) && payload.playlistIndex != null) {
      const beforeCompleted = beforeItem.completedItems || 0;
      const afterCompleted = payload.playlistIndex - 1;

      if (afterCompleted > beforeCompleted) {
        // Show success notification for each child video completed in this progress step
        for (let i = beforeCompleted; i < afterCompleted; i++) {
          const child = beforeItem.children?.[i];
          const childTitle = child?.title || `Video #${i + 1}`;
          addToast('success', `✓ Completed: ${childTitle}`);
        }
      }
    }

    // Show success toast when a download completes
    if (payload.status === 'finished') {
      const item = useDownloadStore.getState().downloads.find((d) => d.id === payload.id);
      if (item) {
        if (isPlaylistItem(item)) {
          // Notify the last video in the playlist if it wasn't notified yet
          const beforeCompleted = item.completedItems || 0;
          const totalItems = item.totalItems || 0;
          if (totalItems > beforeCompleted) {
            for (let i = beforeCompleted; i < totalItems; i++) {
              const child = item.children?.[i];
              const childTitle = child?.title || `Video #${i + 1}`;
              addToast('success', `✓ Completed: ${childTitle}`);
            }
          }
          addToast('success', `✓ Playlist download completed: ${item.title}`);
          notifyDesktop('VelocityDL', `Playlist download completed: ${item.title}`);
        } else {
          const title = item.title || 'Download';
          addToast('success', `✓ Completed: ${title}`);
          notifyDesktop('VelocityDL — download finished', title);
        }
      }
    }
    // Show error toast when a download fails
    if (payload.status === 'error' && payload.error) {
      addToast('error', `Download failed: ${payload.error}`);
      notifyDesktop('VelocityDL — download failed', String(payload.error).substring(0, 200));
    }
  });

  const startDownload = async (url: string, options: DownloadOptions, prefetchedInfo?: any) => {
    // Guard against duplicate active entries for the same URL.
    const dupe = useDownloadStore.getState().downloads.some(
      (d) =>
        d.url === url.trim() &&
        (d.status === 'analyzing' || d.status === 'queued' ||
         d.status === 'downloading' || d.status === 'merging' || d.status === 'paused')
    );
    if (dupe) {
      addToast('info', 'This URL is already in your queue.');
      return;
    }

    const id = generateDownloadId();
    // Persist the user's chosen options on the item so the queue manager
    // can forward them verbatim to the backend (subtitles were dropped here).
    const persistedOptions = {
      maxHeight: options.audioOnly ? 0 : options.maxHeight,
      extractSubs: options.extractSubs,
      selectedSubtitles: options.selectedSubtitles ?? [],
      embedSubs: options.embedSubs ?? true,
      audioFormat: options.audioFormat,
      audioQuality: options.audioQuality,
    };

    // Add default queued item in UI
    if (prefetchedInfo?.isPlaylist) {
      const playlistItem: PlaylistItem = {
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
        ...persistedOptions,
        children: prefetchedInfo.entries?.map((entry: any, index: number) => ({
          id: `${id}-child-${index}`,
          url: entry.url,
          title: entry.title,
          status: 'queued' as const,
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
      };
      addDownload(playlistItem);
    } else {
      addDownload({
        id,
        url,
        title: prefetchedInfo?.title || 'Analyzing video URL...',
        status: prefetchedInfo ? 'queued' : 'analyzing',
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
        outputPath: '',
        ...persistedOptions
      });
    }

    if (prefetchedInfo) {
      addToast('info', `Starting download: ${prefetchedInfo.title || url}`);
      // Item is already marked as 'queued'. Queue Manager will pick it up.
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

      // 2. Mark as queued so Queue Manager can pick it up
      useDownloadStore.setState((state) => ({
        downloads: state.downloads.map((d) => 
          d.id === id ? { ...d, status: 'queued' as const } : d
        )
      }));
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
      // Queue Manager will pick it up and call start_download with the same URL
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
    const item = useDownloadStore.getState().downloads.find((d) => d.id === id);
    // Analyzing items have no backend download process (the metadata probe
    // is untracked) — just drop them instead of parking in error state.
    if (item && item.status === 'analyzing') {
      useDownloadStore.getState().removeDownload(id);
      return;
    }
    const filePaths: string[] = [];

    if (item) {
      if (isPlaylistItem(item)) {
        if (item.outputPath) filePaths.push(item.outputPath);
        if (item.children) {
          item.children.forEach((child) => {
            if (child.outputPath) filePaths.push(child.outputPath);
          });
        }
      } else {
        if (item.outputPath) filePaths.push(item.outputPath);
      }
    }

    try {
      await invoke('cancel_download', { id, filePaths, saveDir: item?.saveDir ?? '' });
      storeCancel(id);
    } catch (err) {
      console.error('Failed to cancel download:', err);
    }
  };

  const retryDownload = (id: string) => {
    // Reset the item back to 'queued' so Queue Manager picks it up
    useDownloadStore.setState((state) => ({
      downloads: state.downloads.map((d) =>
        d.id === id
          ? { ...d, status: 'queued' as const, error: undefined, progress: 0, speed: 0, eta: 0, downloadedBytes: 0 }
          : d
      )
    }));
    addToast('info', 'Retrying download...');
  };

  const removeDownloadItem = async (id: string) => {
    const item = useDownloadStore.getState().downloads.find((d) => d.id === id);
    if (!item) return;
    // Kill the backend process first when still active/queued, otherwise it
    // would leak in active_downloads and keep writing files.
    if (item.status === 'downloading' || item.status === 'merging' || item.status === 'queued') {
      await cancelDownload(id);
    }
    useDownloadStore.getState().removeDownload(id);
  };

  return {
    startDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    removeDownloadItem,
    retryDownload
  };
}

export default useDownload;
