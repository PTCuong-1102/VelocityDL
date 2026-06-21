import React, { useState } from 'react';
import { PlaylistItem } from '../../types/download';
import { ProgressBar } from './ProgressBar';
import { StatusDot } from './StatusDot';
import { formatSpeed } from '../../utils/format';
import { getPlatformIcon, getPlatformColor } from '../../utils/platform';

interface PlaylistCardProps {
  item: PlaylistItem;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onCancel?: (id: string) => void;
}

export const PlaylistCard: React.FC<PlaylistCardProps> = ({
  item,
  onPause,
  onResume,
  onCancel
}) => {
  const [expanded, setExpanded] = useState(false);

  const isDownloading = item.status === 'downloading';
  const isPaused = item.status === 'paused';
  const platformColor = getPlatformColor(item.platform);

  return (
    <div 
      className="glass-panel" 
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        gap: '12px',
        opacity: isPaused ? 0.7 : 1,
        transition: 'opacity 0.2s ease',
        overflow: 'hidden'
      }}
    >
      {/* Header Row */}
      <div className="flex-row w-full" style={{ gap: '16px', alignItems: 'center' }}>
        {/* Playlist Icon Cover */}
        <div 
          style={{
            width: '96px',
            height: '64px',
            borderRadius: 'var(--radius-md)',
            background: `linear-gradient(135deg, ${platformColor}33 0%, var(--surface-container-high) 100%)`,
            border: '1px solid var(--outline-variant)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            position: 'relative'
          }}
        >
          <span className="icon text-primary-color" style={{ fontSize: '32px', color: 'var(--primary)' }}>
            playlist_play
          </span>

          {/* Item Count Badge Overlay */}
          <div 
            style={{
              position: 'absolute',
              bottom: '4px',
              right: '4px',
              backgroundColor: 'rgba(0,0,0,0.8)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '10px',
              fontWeight: 600
            }}
          >
            {item.totalItems} videos
          </div>
        </div>

        {/* Main Details */}
        <div className="flex-col" style={{ flexGrow: 1, overflow: 'hidden', gap: '4px' }}>
          <h3 
            style={{ 
              fontSize: '14px', 
              fontWeight: 500, 
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden'
            }}
            title={item.playlistTitle}
          >
            {item.playlistTitle}
          </h3>

          {/* Progress row */}
          <div className="flex-row" style={{ fontSize: '11px', color: 'var(--on-surface-variant)', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="flex-row" style={{ alignItems: 'center', gap: '6px' }}>
              <StatusDot status={item.status} />
              <span>{item.completedItems} / {item.totalItems} completed</span>
            </div>
            <span className="mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>
              {item.progress.toFixed(1)}%
            </span>
          </div>

          <ProgressBar 
            percent={item.progress} 
            variant={isDownloading ? 'primary' : isPaused ? 'muted' : 'secondary'} 
            size="sm"
            shimmer={isDownloading}
          />
        </div>

        {/* Action Controls */}
        <div className="flex-row gap-sm" style={{ flexShrink: 0, alignItems: 'center' }}>
          {isDownloading && onPause && (
            <button 
              className="btn btn-ghost btn-icon flex-center"
              style={{ width: '32px', height: '32px' }}
              onClick={() => onPause(item.id)}
            >
              <span className="icon">pause</span>
            </button>
          )}

          {isPaused && onResume && (
            <button 
              className="btn btn-ghost btn-icon flex-center"
              style={{ width: '32px', height: '32px' }}
              onClick={() => onResume(item.id)}
            >
              <span className="icon">play_arrow</span>
            </button>
          )}

          {onCancel && (
            <button 
              className="btn btn-ghost btn-icon flex-center"
              style={{ width: '32px', height: '32px', color: 'var(--error)' }}
              onClick={() => onCancel(item.id)}
            >
              <span className="icon">close</span>
            </button>
          )}

          {/* Toggle Expand */}
          <button 
            className="btn btn-ghost btn-icon flex-center"
            style={{ width: '32px', height: '32px' }}
            onClick={() => setExpanded(!expanded)}
          >
            <span className="icon">{expanded ? 'expand_less' : 'expand_more'}</span>
          </button>
        </div>
      </div>

      {/* Expanded Sub-items List */}
      {expanded && (
        <div 
          className="flex-col gap-sm" 
          style={{ 
            borderTop: '1px solid var(--outline-variant)',
            paddingTop: '12px',
            paddingLeft: '12px',
            maxHeight: '240px',
            overflowY: 'auto'
          }}
        >
          {item.children && item.children.length > 0 ? (
            item.children.map((child) => (
              <div 
                key={child.id}
                className="flex-row" 
                style={{ 
                  alignItems: 'center', 
                  gap: '12px',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  fontSize: '12px'
                }}
              >
                {/* Micro Thumbnail */}
                <div 
                  style={{
                    width: '40px',
                    height: '24px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--surface-container-lowest)',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}
                >
                  {child.thumbnailUrl ? (
                    <img src={child.thumbnailUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  ) : (
                    <div className="flex-center w-full h-full" style={{ backgroundColor: 'var(--surface-container-high)' }}>
                      <span className="icon" style={{ fontSize: '10px' }}>{getPlatformIcon(child.platform)}</span>
                    </div>
                  )}
                </div>

                {/* Sub-item Title */}
                <span 
                  style={{ 
                    flexGrow: 1, 
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis' 
                  }}
                  title={child.title}
                >
                  {child.title}
                </span>

                {/* Sub-item progress & state */}
                <div className="flex-row mono text-muted" style={{ gap: '10px', alignItems: 'center', flexShrink: 0 }}>
                  {child.status === 'downloading' && (
                    <span className="text-secondary-color">{formatSpeed(child.speed)}</span>
                  )}
                  <span>{child.progress.toFixed(0)}%</span>
                  <StatusDot status={child.status} />
                </div>
              </div>
            ))
          ) : (
            <div className="text-muted" style={{ padding: '8px', fontSize: '12px' }}>
              No items loaded yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PlaylistCard;
