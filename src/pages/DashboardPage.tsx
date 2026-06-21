import React from 'react';
import { useNavigate } from 'react-router-dom';
import URLInput, { DownloadOptions } from '../components/shared/URLInput';
import PlatformButton from '../components/ui/PlatformButton';
import DownloadCard from '../components/ui/DownloadCard';
import PlaylistCard from '../components/ui/PlaylistCard';
import GlassPanel from '../components/ui/GlassPanel';
import { useDownloadStore } from '../stores/downloadStore';
import { useDownload } from '../hooks/useDownload';
import { Platform } from '../types/download';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { downloads } = useDownloadStore();
  const { startDownload, pauseDownload, resumeDownload, cancelDownload } = useDownload();

  // Show only active/downloading/queued/paused items, max 3
  const activeItems = downloads
    .filter((d) => d.status !== 'finished')
    .slice(0, 3);

  const handleDownload = (url: string, options: DownloadOptions, prefetchedInfo?: any) => {
    startDownload(url, options, prefetchedInfo);
    // Redirect to Queue page to watch progress
    navigate('/queue');
  };

  const handlePlatformClick = (platform: Platform) => {
    // If clicked, focus input or set template link
    console.log(`Quick download for ${platform}`);
    // Navigate to embedded browser
    navigate('/browser');
  };

  return (
    <div className="flex-col gap-lg w-full" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
      {/* Welcome Banner */}
      <div>
        <h1>VelocityDL</h1>
        <p className="text-muted mt-sm" style={{ fontSize: '14px' }}>
          Next-generation high-speed video downloader engine powered by Deno & Tauri.
        </p>
      </div>

      {/* Main paste hero URL card */}
      <GlassPanel style={{ padding: '32px', position: 'relative' }}>
        {/* Abstract background glow blob */}
        <div
          style={{
            position: 'absolute',
            top: '-60px',
            right: '-60px',
            width: '200px',
            height: '200px',
            background: 'radial-gradient(circle, rgba(195, 192, 255, 0.1) 0%, rgba(0,0,0,0) 70%)',
            pointerEvents: 'none'
          }}
        />
        
        <h2 style={{ marginBottom: '16px', fontWeight: 600 }}>Download New Media</h2>
        <URLInput onDownload={handleDownload} />
      </GlassPanel>

      {/* Quick Start Launcher Grid */}
      <div className="flex-col gap-md">
        <h2>Supported Platforms</h2>
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            width: '100%'
          }}
        >
          <PlatformButton platform="youtube" label="YouTube" onClick={handlePlatformClick} />
          <PlatformButton platform="spotify" label="Spotify" onClick={handlePlatformClick} />
          <PlatformButton platform="tiktok" label="TikTok" onClick={handlePlatformClick} />
          <PlatformButton platform="facebook" label="Facebook" onClick={handlePlatformClick} />
          <PlatformButton platform="instagram" label="Instagram" onClick={handlePlatformClick} />
        </div>
      </div>

      {/* Recent active tasks section */}
      {activeItems.length > 0 && (
        <div className="flex-col gap-md" style={{ marginTop: '8px' }}>
          <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Active Downloads</h2>
            <button 
              className="btn btn-ghost"
              style={{ padding: '4px 12px', fontSize: '12px', height: '28px' }}
              onClick={() => navigate('/queue')}
            >
              View Queue
            </button>
          </div>
          <div className="flex-col gap-md">
            {activeItems.map((item) => (
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
