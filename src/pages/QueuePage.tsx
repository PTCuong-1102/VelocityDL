import React from 'react';
import DownloadCard from '../components/ui/DownloadCard';
import PlaylistCard from '../components/ui/PlaylistCard';
import { useDownloadStore } from '../stores/downloadStore';
import { useUIStore } from '../stores/uiStore';
import { useDownload } from '../hooks/useDownload';

export const QueuePage: React.FC = () => {
  const { downloads } = useDownloadStore();
  const { pauseDownload, resumeDownload, cancelDownload } = useDownload();
  const { searchQuery } = useUIStore();

  // Filter out completed/finished downloads
  const queueItems = downloads.filter((d) => d.status !== 'finished');

  // Apply search query filter if present
  const filteredItems = queueItems.filter((item) => {
    if (!searchQuery.trim()) return true;
    const titleMatch = item.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const urlMatch = item.url?.toLowerCase().includes(searchQuery.toLowerCase());
    return titleMatch || urlMatch;
  });

  const activeCount = queueItems.filter((d) => d.status === 'downloading' || d.status === 'merging').length;
  const pausedCount = queueItems.filter((d) => d.status === 'paused').length;
  const queuedCount = queueItems.filter((d) => d.status === 'queued').length;

  const handlePauseAll = () => {
    downloads.forEach((d) => {
      if (d.status === 'downloading' || d.status === 'merging' || d.status === 'queued') {
        pauseDownload(d.id);
      }
    });
  };

  const handleResumeAll = () => {
    downloads.forEach((d) => {
      if (d.status === 'paused') {
        resumeDownload(d.id);
      }
    });
  };

  return (
    <div className="flex-col gap-lg w-full" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
      {/* Header section with Stats & Global Actions */}
      <div 
        className="flex-row" 
        style={{ 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div className="flex-col">
          <h1>Download Queue</h1>
          <p className="text-muted mt-sm" style={{ fontSize: '13px' }}>
            {activeCount} downloading • {pausedCount} paused • {queuedCount} queued
          </p>
        </div>

        {queueItems.length > 0 && (
          <div className="flex-row gap-sm">
            {activeCount > 0 && (
              <button 
                className="btn btn-ghost" 
                style={{ fontSize: '13px', padding: '6px 12px', height: '32px' }}
                onClick={handlePauseAll}
              >
                <span className="icon" style={{ fontSize: '16px' }}>pause</span>
                Pause All
              </button>
            )}
            {pausedCount > 0 && (
              <button 
                className="btn btn-primary" 
                style={{ fontSize: '13px', padding: '6px 12px', height: '32px' }}
                onClick={handleResumeAll}
              >
                <span className="icon" style={{ fontSize: '16px' }}>play_arrow</span>
                Resume All
              </button>
            )}
          </div>
        )}
      </div>

      {/* Queue items list */}
      <div className="flex-col gap-md" style={{ marginTop: '8px' }}>
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            item.isPlaylist ? (
              <PlaylistCard 
                key={item.id} 
                item={item as any}
                onPause={pauseDownload}
                onResume={resumeDownload}
                onCancel={cancelDownload}
              />
            ) : (
              <DownloadCard 
                key={item.id} 
                item={item}
                onPause={pauseDownload}
                onResume={resumeDownload}
                onCancel={cancelDownload}
              />
            )
          ))
        ) : (
          <div 
            className="glass-panel flex-center"
            style={{
              padding: '60px 20px',
              flexDirection: 'column',
              gap: '16px',
              borderStyle: 'dashed',
              backgroundColor: 'transparent'
            }}
          >
            <span className="icon text-muted" style={{ fontSize: '48px' }}>
              {searchQuery ? 'search_off' : 'cloud_download'}
            </span>
            <div className="flex-col" style={{ alignItems: 'center', gap: '4px' }}>
              <h3 style={{ fontSize: '15px', color: 'var(--on-surface-variant)' }}>
                {searchQuery ? 'No matching downloads' : 'Your queue is empty'}
              </h3>
              <p className="text-muted" style={{ fontSize: '12px' }}>
                {searchQuery ? 'Try adjusting your search terms.' : 'Downloads you start will appear here.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QueuePage;
