import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useDownloadStore } from '../stores/downloadStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useToastStore } from '../stores/toastStore';
import { buildSidecarOptions } from '../utils/downloadOptions';
import { isPlaylistItem } from '../types/download';

/**
 * Queue Manager: watches for 'queued' items and starts downloads
 * up to the concurrent limit.
 *
 * State-driven (no processed-id bookkeeping): an item is eligible iff its
 * status is 'queued'. Pause/cancel move it out of 'queued', retry/resume
 * move it back in — so re-queueing always restarts the job. The
 * `isProcessing` gate plus the synchronous optimistic status flip make
 * double-spawns impossible in one JS turn.
 */
export const useQueueManager = () => {
  const isProcessing = useRef(false);

  useEffect(() => {
    const processQueue = async () => {
      if (isProcessing.current) return;
      isProcessing.current = true;

      try {
        const { downloads, updateProgress } = useDownloadStore.getState();
        const { settings } = useSettingsStore.getState();
        const { addToast } = useToastStore.getState();
        const concurrentThreads = settings.engine.concurrentThreads || 3;

        const activeCount = downloads.filter(
          (d) => d.status === 'downloading' || d.status === 'merging'
        ).length;

        if (activeCount >= concurrentThreads) return;

        const availableSlots = concurrentThreads - activeCount;
        const queuedItems = downloads.filter((d) => d.status === 'queued');

        const itemsToStart = queuedItems.slice(0, availableSlots);

        for (const item of itemsToStart) {
          // Reconstruct saveDir (persist it for later cancel cleanup)
          let saveDir = settings.storage.defaultDownloadPath || '.';
          if (isPlaylistItem(item) && settings.storage.createSubfolders && item.title) {
            const safeTitle = item.title.replace(/[<>:"\/\\|?*]+/g, '_').trim() || 'Playlist';
            saveDir = `${saveDir}/${safeTitle}`;
          }
          useDownloadStore.setState((state) => ({
            downloads: state.downloads.map((d) =>
              d.id === item.id ? { ...d, saveDir } : d
            ),
          }));

          // Forward the exact user options (incl. subtitles) to the backend.
          const options = buildSidecarOptions(item);

          // Optimistically mark as downloading, preserving current progress
          // so resume doesn't visually restart from 0%. This synchronous
          // flip is what prevents a second trigger from re-starting it.
          updateProgress({
            id: item.id,
            progress: item.progress,
            downloadedBytes: item.downloadedBytes,
            totalBytes: item.totalBytes,
            speed: 0,
            eta: 0,
            status: 'downloading'
          });

          try {
            addToast('info', `Starting download: ${item.title || item.url}`);
            await invoke('start_download', { id: item.id, url: item.url, saveDir, options });
          } catch (err) {
            addToast('error', `Failed to start download: ${String(err)}`);
            updateProgress({
              id: item.id,
              progress: 0,
              downloadedBytes: 0,
              totalBytes: 0,
              speed: 0,
              eta: 0,
              status: 'error',
              error: String(err)
            });
          }
        }
      } finally {
        isProcessing.current = false;
      }
    };

    // Subscribe to store changes instead of using downloads in useEffect deps.
    // This fires outside the React render cycle, avoiding the infinite loop.
    const unsubscribe = useDownloadStore.subscribe((state, prevState) => {
      const countActive = (ds: typeof state.downloads) =>
        ds.filter((d) => d.status === 'downloading' || d.status === 'merging').length;
      // A new job became eligible, a slot freed up (pause/cancel/remove),
      // or a job finished/errored.
      const hasNewQueued = state.downloads.some(
        (d) => d.status === 'queued' && !prevState.downloads.some((p) => p.id === d.id && p.status === 'queued')
      );
      const hasFinishedOrError = state.downloads.some((d, i) => {
        const prev = prevState.downloads[i];
        return prev && (prev.status === 'downloading' || prev.status === 'merging') &&
               (d.status === 'finished' || d.status === 'error');
      });
      const slotFreed = countActive(state.downloads) < countActive(prevState.downloads);

      if (hasNewQueued || hasFinishedOrError || slotFreed) {
        processQueue();
      }
    });

    // Initial check on mount
    processQueue();

    return () => {
      unsubscribe();
    };
  }, []); // Empty deps — subscribe handles reactivity
};
