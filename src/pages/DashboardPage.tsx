import React from 'react';
import { useNavigate } from 'react-router-dom';
import URLInput, { DownloadOptions } from '../components/shared/URLInput';
import PlatformButton from '../components/ui/PlatformButton';
import DownloadCard from '../components/ui/DownloadCard';
import PlaylistCard from '../components/ui/PlaylistCard';
import GlassPanel from '../components/ui/GlassPanel';
import { useDownloadStore } from '../stores/downloadStore';
import { useDownload } from '../hooks/useDownload';
import { Platform, isPlaylistItem } from '../types/download';
import { formatBytes } from '../utils/format';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { downloads } = useDownloadStore();
  const { startDownload, pauseDownload, resumeDownload, cancelDownload, retryDownload } = useDownload();

  // Show only active/downloading/queued/paused items, max 3
  const activeItems = downloads
    .filter((d) => d.status !== 'finished')
    .slice(0, 3);

  // Statistics
  const totalCompleted = downloads.filter((d) => d.status === 'finished').length;
  const totalActive = downloads.filter((d) => ['downloading', 'merging', 'queued', 'paused'].includes(d.status)).length;
  const totalFailed = downloads.filter((d) => d.status === 'error').length;
  const totalDataBytes = downloads
    .filter((d) => d.status === 'finished')
    .reduce((acc, d) => acc + (d.totalBytes || 0), 0);
  const successRate = (totalCompleted + totalFailed) > 0
    ? Math.round((totalCompleted / (totalCompleted + totalFailed)) * 100)
    : 100;

  const statsCards = [
    { icon: 'check_circle', label: 'Completed', value: String(totalCompleted), color: '#6bd8cb' },
    { icon: 'sync', label: 'Active', value: String(totalActive), color: '#c3c0ff' },
    { icon: 'data_usage', label: 'Data Downloaded', value: formatBytes(totalDataBytes), color: '#ffb95f' },
    { icon: 'trending_up', label: 'Success Rate', value: `${successRate}%`, color: successRate >= 80 ? '#6bd8cb' : '#ffb4ab' },
  ];

  const handleDownload = (url: string, options: DownloadOptions, prefetchedInfo?: any) => {
    startDownload(url, options, prefetchedInfo);
    navigate('/queue');
  };

  const handlePlatformClick = (platform: Platform) => {
    console.log(`Quick download for ${platform}`);
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

      {/* Statistics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
          width: '100%'
        }}
      >
        {statsCards.map((stat) => (
          <GlassPanel
            key={stat.label}
            style={{
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-20px',
                right: '-20px',
                width: '80px',
                height: '80px',
                background: `radial-gradient(circle, ${stat.color}15 0%, rgba(0,0,0,0) 70%)`,
                pointerEvents: 'none'
              }}
            />
            <div className="flex-row gap-sm" style={{ alignItems: 'center' }}>
              <span className="icon" style={{ fontSize: '20px', color: stat.color }}>{stat.icon}</span>
              <span className="text-muted" style={{ fontSize: '12px', fontWeight: 500 }}>{stat.label}</span>
            </div>
            <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--on-surface)', letterSpacing: '-0.5px' }}>
              {stat.value}
            </span>
          </GlassPanel>
        ))}
      </div>

      {/* Main paste hero URL card */}
      <GlassPanel style={{ padding: '32px', position: 'relative' }}>
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
              isPlaylistItem(item) ? (
                <PlaylistCard 
                  key={item.id} 
                  item={item}
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
                  onRetry={retryDownload}
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
