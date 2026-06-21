import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  searchQuery: string;
  addUrlModalOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSearchQuery: (query: string) => void;
  setAddUrlModalOpen: (isOpen: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  searchQuery: '',
  addUrlModalOpen: false,
  
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setAddUrlModalOpen: (isOpen) => set({ addUrlModalOpen: isOpen }),
}));

export default useUIStore;
