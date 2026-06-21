import React from 'react';
import SearchBar from '../shared/SearchBar';
import { useDownloadStore } from '../../stores/downloadStore';
import { useSettingsStore } from '../../stores/settingsStore';

export const TopBar: React.FC = () => {
  const { downloads } = useDownloadStore();
  const { settings } = useSettingsStore();

  // Calculate speed and active threads
  const activeDownloads = downloads.filter((d) => d.status === 'downloading');
  const totalSpeed = activeDownloads.reduce((acc, curr) => acc + curr.speed, 0);
  
  // Format speed (bytes/sec to human readable)
  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
    return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <header
      className="flex-row"
      style={{
        height: 'var(--topbar-height)',
        borderBottom: '1px solid var(--outline-variant)',
        backgroundColor: 'rgba(11, 19, 38, 0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        width: '100%',
        zIndex: 5
      }}
    >
      {/* Left: context-aware SearchBar */}
      <SearchBar />

      {/* Right: Metrics & System Controls */}
      <div className="flex-row gap-md" style={{ alignItems: 'center' }}>
        {/* Speed & Activity Badge */}
        {activeDownloads.length > 0 && (
          <div 
            className="flex-row gap-sm"
            style={{
              alignItems: 'center',
              backgroundColor: 'rgba(107, 216, 203, 0.1)',
              border: '1px solid rgba(107, 216, 203, 0.2)',
              borderRadius: 'var(--radius-full)',
              padding: '4px 12px',
              height: '32px'
            }}
          >
            <span className="status-dot downloading"></span>
            <span 
              className="mono text-secondary-color" 
              style={{ fontWeight: 600, fontSize: '12px' }}
            >
              {formatSpeed(totalSpeed)}
            </span>
            <span className="text-muted" style={{ fontSize: '11px' }}>
              ({activeDownloads.length} active)
            </span>
          </div>
        )}

        {/* Network & Thread status */}
        <div 
          className="flex-row gap-xs text-muted"
          style={{ fontSize: '12px', alignItems: 'center' }}
        >
          <span className="icon" style={{ fontSize: '16px' }}>memory</span>
          <span className="mono">{settings.engine.concurrentThreads} threads</span>
        </div>

        {/* Divider */}
        <div style={{ height: '20px', width: '1px', backgroundColor: 'var(--outline-variant)' }} />

        {/* Notifications Icon Button */}
        <button 
          className="btn btn-ghost btn-icon flex-center"
          style={{ position: 'relative', border: 'none' }}
        >
          <span className="icon">notifications</span>
          <span 
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--tertiary)',
              border: '2px solid var(--surface-container-low)'
            }}
          />
        </button>

        {/* Help Info Icon */}
        <button className="btn btn-ghost btn-icon flex-center" style={{ border: 'none' }}>
          <span className="icon">help_outline</span>
        </button>
      </div>
    </header>
  );
};

export default TopBar;
