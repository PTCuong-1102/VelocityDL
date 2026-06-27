import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AnyDownloadItem, DownloadStatus, isPlaylistItem } from '../types/download';
import { DownloadProgressPayload } from '../types/ipc';

interface DownloadState {
  downloads: AnyDownloadItem[];
  addDownload: (item: AnyDownloadItem) => void;
  updateProgress: (payload: DownloadProgressPayload) => void;
  pauseDownload: (id: string) => void;
  resumeDownload: (id: string) => void;
  cancelDownload: (id: string) => void;
  removeDownload: (id: string) => void;
  clearFinished: () => void;
  setDownloads: (downloads: AnyDownloadItem[]) => void;
}

export const useDownloadStore = create<DownloadState>()(
  persist(
    (set) => ({
      downloads: [],
      
      addDownload: (item) => set((state) => {
        // Avoid duplicates
        if (state.downloads.some((d) => d.id === item.id)) {
          return state;
        }
        return { downloads: [item, ...state.downloads] };
      }),
      
      updateProgress: (payload) => set((state) => ({
        downloads: state.downloads.map((item) => {
          if (item.id !== payload.id) return item;

          if (isPlaylistItem(item)) {
            let completedItems = item.completedItems;
            let totalItems = item.totalItems;
            let progress = item.progress;
            let children = item.children || [];

            if (payload.playlistIndex != null && payload.playlistTotal != null) {
              completedItems = payload.playlistIndex - 1;
              totalItems = payload.playlistTotal;
              progress = ((completedItems + (payload.progress / 100)) / totalItems) * 100;

              children = children.map((child, idx) => {
                if (idx < completedItems) {
                  return { ...child, status: 'finished' as const, progress: 100, speed: 0 };
                } else if (idx === completedItems) {
                  return {
                    ...child,
                    status: payload.status === 'finished' ? 'finished' as const : 'downloading' as const,
                    progress: payload.progress,
                    speed: payload.speed,
                    eta: payload.eta,
                    downloadedBytes: payload.downloadedBytes,
                    totalBytes: payload.totalBytes,
                    outputPath: payload.outputPath || child.outputPath
                  };
                }
                return child;
              });
            }

            if (payload.status === 'finished') {
              completedItems = totalItems;
              progress = 100;
              children = children.map((child) => ({
                ...child,
                status: 'finished' as const,
                progress: 100,
                speed: 0
              }));
            }

            return {
              ...item,
              progress,
              completedItems,
              totalItems,
              children,
              status: payload.status,
              speed: payload.status === 'finished' ? 0 : payload.speed,
              eta: payload.status === 'finished' ? 0 : payload.eta,
              error: payload.error || item.error,
              completedAt: payload.status === 'finished' ? Date.now() : item.completedAt,
              outputPath: payload.outputPath || item.outputPath,
            };
          } else {
            return {
              ...item,
              progress: payload.progress,
              downloadedBytes: payload.downloadedBytes,
              totalBytes: payload.totalBytes,
              speed: payload.speed,
              eta: payload.eta,
              status: payload.status,
              error: payload.error || item.error,
              completedAt: payload.status === 'finished' ? Date.now() : item.completedAt,
              outputPath: payload.outputPath || item.outputPath,
            };
          }
        }),
      })),
      
      pauseDownload: (id) => set((state) => ({
        downloads: state.downloads.map((item) => 
          item.id === id ? { ...item, status: 'paused' as DownloadStatus, speed: 0 } : item
        ),
      })),
      
      resumeDownload: (id) => set((state) => ({
        downloads: state.downloads.map((item) => 
          item.id === id ? { ...item, status: 'queued' as DownloadStatus } : item
        ),
      })),
      
      cancelDownload: (id) => set((state) => ({
        downloads: state.downloads.map((item) => 
          item.id === id ? { ...item, status: 'error' as DownloadStatus, error: 'Cancelled by user', speed: 0 } : item
        ),
      })),
      
      removeDownload: (id) => set((state) => ({
        downloads: state.downloads.filter((item) => item.id !== id),
      })),
      
      clearFinished: () => set((state) => ({
        downloads: state.downloads.filter((item) => item.status !== 'finished'),
      })),

      setDownloads: (downloads) => set({ downloads }),
    }),
    {
      name: 'velocity-download-store',
      // Map active statuses to paused on load/hydration
      onRehydrateStorage: () => (state) => {
        if (state) {
          const sanitized = state.downloads.map((item) => {
            if (
              item.status === 'downloading' ||
              item.status === 'merging' ||
              item.status === 'analyzing'
            ) {
              return { ...item, status: 'paused' as const, speed: 0 };
            }
            return item;
          });
          state.setDownloads(sanitized);
        }
      },
    }
  )
);

export default useDownloadStore;
