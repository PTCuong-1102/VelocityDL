import React from 'react';
import FinishedCard from '../components/ui/FinishedCard';
import useHistoryStore from '../stores/historyStore';
import { useUIStore } from '../stores/uiStore';
import { useToastStore } from '../stores/toastStore';
import { AnyDownloadItem, isPlaylistItem } from '../types/download';
import { invoke } from '@tauri-apps/api/core';
import { useDownload } from '../hooks/useDownload';

export const FinishedPage: React.FC = () => {
  const { history, removeEntry, clearAll } = useHistoryStore();
  const { searchQuery } = useUIStore();
  const { addToast } = useToastStore();
  const { startDownload } = useDownload();

  // Filter finished items by search query
  const filteredItems = history.filter((item) => {
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

  /**
   * Re-download a history entry with its original options. The original
   * item creation path persists every option the queue manager needs on
   * the item itself (saveDir, maxHeight, subtitles, audio prefs), so the
   * exact same request can be reconstructed without re-analysis.
   */
  const handleRedownload = (item: AnyDownloadItem) => {
    const options = {
      maxHeight: isPlaylistItem(item) ? 0 : (item.maxHeight ?? 0),
      audioOnly: item.mediaType === 'audio',
      extractSubs: item.extractSubs ?? false,
      selectedSubtitles: item.selectedSubtitles ?? [],
      embedSubs: item.embedSubs ?? true,
      audioFormat: item.audioFormat,
      audioQuality: item.audioQuality,
    };
    void startDownload(item.url, options);
    addToast('info', `Re-downloading: ${item.title || item.url}`);
  };

  return (
    <div className="flex-col gap-lg w-full" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
      {/* Header Row */}
      <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="flex-col">
          <h1>Finished Downloads</h1>
          <p className="text-muted mt-sm" style={{ fontSize: '13px' }}>
            {history.length} items downloaded successfully
          </p>
        </div>

        {history.length > 0 && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: '12px', padding: '6px 12px', height: '28px', color: 'var(--error)' }}
            onClick={() => {
              clearAll();
              addToast('info', 'Download history cleared.');
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
              onRedownload={handleRedownload}
              onRemove={removeEntry}
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
