import { create } from 'zustand';
import { DownloadItem, DownloadStatus } from '../types/download';
import { DownloadProgressPayload } from '../types/ipc';

interface DownloadState {
  downloads: DownloadItem[];
  addDownload: (item: DownloadItem) => void;
  updateProgress: (payload: DownloadProgressPayload) => void;
  pauseDownload: (id: string) => void;
  resumeDownload: (id: string) => void;
  cancelDownload: (id: string) => void;
  removeDownload: (id: string) => void;
  clearFinished: () => void;
  setDownloads: (downloads: DownloadItem[]) => void;
}

export const useDownloadStore = create<DownloadState>((set) => ({
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
      if (item.id === payload.id) {
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
        };
      }
      return item;
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
}));
export default useDownloadStore;
