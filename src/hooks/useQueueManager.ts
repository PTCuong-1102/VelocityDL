import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useDownloadStore } from '../stores/downloadStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useToastStore } from '../stores/toastStore';
import { isPlaylistItem } from '../types/download';

/**
 * Queue Manager: watches for 'queued' items and starts downloads
 * up to the concurrent limit.
 *
 * Fixed: Uses zustand subscribe + ref-based tracking to avoid
 * the infinite re-render loop caused by depending on `downloads`
 * in a useEffect that mutates `downloads`.
 */
export const useQueueManager = () => {
  const isProcessing = useRef(false);
  const processedIds = useRef(new Set<string>());

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
        const queuedItems = downloads.filter(
          (d) => d.status === 'queued' && !processedIds.current.has(d.id)
        );

        const itemsToStart = queuedItems.slice(0, availableSlots);

        for (const item of itemsToStart) {
          // Mark as processed to prevent duplicate triggers
          processedIds.current.add(item.id);

          // Optimistically mark as downloading
          updateProgress({
            id: item.id,
            progress: 0,
            downloadedBytes: 0,
            totalBytes: 0,
            speed: 0,
            eta: 0,
            status: 'downloading'
          });

          // Reconstruct options and saveDir
          let saveDir = settings.storage.defaultDownloadPath || '.';
          if (isPlaylistItem(item) && settings.storage.createSubfolders && item.title) {
            const safeTitle = item.title.replace(/[<>:"\/\\|?*]+/g, '_').trim() || 'Playlist';
            saveDir = `${saveDir}/${safeTitle}`;
          }

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
      // Only process when there's a status change that might need queue processing
      const hasNewQueued = state.downloads.some(
        (d) => d.status === 'queued' && !processedIds.current.has(d.id)
      );
      const hasFinishedOrError = state.downloads.some((d, i) => {
        const prev = prevState.downloads[i];
        return prev && (prev.status === 'downloading' || prev.status === 'merging') &&
               (d.status === 'finished' || d.status === 'error');
      });

      if (hasNewQueued || hasFinishedOrError) {
        processQueue();
      }
    });

    // Initial check on mount
    processQueue();

    return () => {
      unsubscribe();
    };
  }, []); // Empty deps — subscribe handles reactivity

  // Clean up processedIds for removed/finished/error items periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const { downloads } = useDownloadStore.getState();
      const activeIds = new Set(downloads.map((d) => d.id));
      for (const id of processedIds.current) {
        const item = downloads.find((d) => d.id === id);
        if (!activeIds.has(id) || (item && (item.status === 'finished' || item.status === 'error'))) {
          processedIds.current.delete(id);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);
};
