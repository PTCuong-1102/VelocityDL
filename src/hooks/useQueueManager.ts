import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useDownloadStore } from '../stores/downloadStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useToastStore } from '../stores/toastStore';

export const useQueueManager = () => {
  const { downloads, updateProgress } = useDownloadStore();
  const { settings } = useSettingsStore();
  const { addToast } = useToastStore.getState();
  
  const concurrentThreads = settings.engine.concurrentThreads || 3;
  const isProcessing = useRef(false);

  useEffect(() => {
    const processQueue = async () => {
      if (isProcessing.current) return;
      isProcessing.current = true;

      try {
        const activeCount = downloads.filter((d) => d.status === 'downloading' || d.status === 'merging').length;
        
        if (activeCount < concurrentThreads) {
          const availableSlots = concurrentThreads - activeCount;
          const queuedItems = downloads.filter((d) => d.status === 'queued');
          
          // Get the next N items to start
          const itemsToStart = queuedItems.slice(0, availableSlots);
          
          for (const item of itemsToStart) {
            // Optimistically mark as starting to prevent duplicate triggers
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
            if (item.isPlaylist && settings.storage.createSubfolders && item.title) {
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
        }
      } finally {
        isProcessing.current = false;
      }
    };

    processQueue();
  }, [downloads, concurrentThreads, settings.storage, addToast, updateProgress]);
};
