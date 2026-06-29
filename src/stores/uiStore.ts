import { create } from 'zustand';
import { AnalyzedMetadata } from '../components/shared/URLInput';

interface UIState {
  sidebarCollapsed: boolean;
  searchQuery: string;
  addUrlModalOpen: boolean;
  urlInputUrl: string;
  urlInputAnalyzedInfo: AnalyzedMetadata | null;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSearchQuery: (query: string) => void;
  setAddUrlModalOpen: (isOpen: boolean) => void;
  setUrlInputUrl: (url: string) => void;
  setUrlInputAnalyzedInfo: (info: AnalyzedMetadata | null) => void;
  resetUrlInput: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  searchQuery: '',
  addUrlModalOpen: false,
  urlInputUrl: '',
  urlInputAnalyzedInfo: null,
  
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setAddUrlModalOpen: (isOpen) => set({ addUrlModalOpen: isOpen }),
  setUrlInputUrl: (url) => set({ urlInputUrl: url }),
  setUrlInputAnalyzedInfo: (info) => set({ urlInputAnalyzedInfo: info }),
  resetUrlInput: () => set({ urlInputUrl: '', urlInputAnalyzedInfo: null }),
}));

export default useUIStore;
