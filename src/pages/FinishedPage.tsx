import React from 'react';
import FinishedCard from '../components/ui/FinishedCard';
import { useDownloadStore } from '../stores/downloadStore';
import { useUIStore } from '../stores/uiStore';
import { useToastStore } from '../stores/toastStore';
import { AnyDownloadItem, isPlaylistItem } from '../types/download';
import { invoke } from '@tauri-apps/api/core';

export const FinishedPage: React.FC = () => {
  const { downloads, clearFinished } = useDownloadStore();
  const { searchQuery } = useUIStore();
  const { addToast } = useToastStore();

  // Get finished items
  const finishedItems = downloads.filter((d) => d.status === 'finished');

  // Filter finished items by search query
  const filteredItems = finishedItems.filter((item) => {
    if (!searchQuery.trim()) return true;
    const titleMatch = item.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const formatMatch = item.format?.toLowerCase().includes(searchQuery.toLowerCase());
    return titleMatch || formatMatch;
  });

  const handlePlay = async (path: string) => {
    if (!path) {
      addToast('error', 'No playable file was recorded for this download.');
      return;
    }
    try {
      await invoke('open_file', { path });
    } catch (err) {
      console.error('Failed to play file:', err);
      addToast('error', `Could not open file: ${String(err)}`);
    }
  };

  /** Reveal the best known path: a child file for playlists, else the item path. */
  const revealPathFor = (item: AnyDownloadItem): string => {
    if (isPlaylistItem(item)) {
      const child = (item.children || []).find((c) => !!c.outputPath);
      if (child) return child.outputPath;
    }
    return item.outputPath;
  };

  const handleOpenFolder = async (item: AnyDownloadItem) => {
    const path = revealPathFor(item);
    if (!path) {
      addToast('error', 'No file location was recorded for this download.');
      return;
    }
    try {
      await invoke('open_folder', { path });
    } catch (err) {
      console.error('Failed to open enclosing folder:', err);
      addToast('error', `Could not open folder: ${String(err)}`);
    }
  };

  return (
    <div className="flex-col gap-lg w-full" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
      {/* Header Row */}
      <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="flex-col">
          <h1>Finished Downloads</h1>
          <p className="text-muted mt-sm" style={{ fontSize: '13px' }}>
            {finishedItems.length} items downloaded successfully
          </p>
        </div>

        {finishedItems.length > 0 && (
          <button 
            className="btn btn-ghost" 
            style={{ fontSize: '12px', padding: '6px 12px', height: '28px', color: 'var(--error)' }}
            onClick={() => {
              clearFinished();
            }}
          >
            <span className="icon" style={{ fontSize: '16px' }}>delete_sweep</span>
            Clear History
          </button>
        )}
      </div>

      {/* Bento Grid */}
      {filteredItems.length > 0 ? (
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '20px',
            width: '100%',
            marginTop: '8px'
          }}
        >
          {filteredItems.map((item) => (
            <FinishedCard 
              key={item.id} 
              item={item} 
              onPlay={handlePlay}
              onOpenFolder={handleOpenFolder}
            />
          ))}
        </div>
      ) : (
        <div 
          className="glass-panel flex-center"
          style={{
            padding: '80px 20px',
            flexDirection: 'column',
            gap: '16px',
            borderStyle: 'dashed',
            backgroundColor: 'transparent',
            marginTop: '8px'
          }}
        >
          <span className="icon text-muted" style={{ fontSize: '56px' }}>
            {searchQuery ? 'search_off' : 'folder_special'}
          </span>
          <div className="flex-col" style={{ alignItems: 'center', gap: '4px' }}>
            <h3 style={{ fontSize: '15px', color: 'var(--on-surface-variant)' }}>
              {searchQuery ? 'No matching downloads' : 'No finished downloads yet'}
            </h3>
            <p className="text-muted" style={{ fontSize: '12px' }}>
              {searchQuery ? 'Try checking your spelling.' : 'Completed files will be listed here for quick playback.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinishedPage;
