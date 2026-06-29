import React, { useState } from 'react';
import { DownloadItem } from '../../types/download';
import { ProgressBar } from './ProgressBar';
import { StatusDot } from './StatusDot';
import { formatBytes, formatSpeed, formatETA } from '../../utils/format';
import { getPlatformColor } from '../../utils/platform';
import PlatformIcon from '../shared/PlatformIcon';
import ConfirmDialog from './ConfirmDialog';

interface DownloadCardProps {
  item: DownloadItem;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
}

export const DownloadCard: React.FC<DownloadCardProps> = ({
  item,
  onPause,
  onResume,
  onCancel,
  onRetry
}) => {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const isDownloading = item.status === 'downloading';
  const isMerging = item.status === 'merging';
  const isPaused = item.status === 'paused';
  const isError = item.status === 'error';
  const isQueued = item.status === 'queued';
  const isActive = isDownloading || isMerging;
  const isAudio = item.mediaType === 'audio';

  const platformColor = getPlatformColor(item.platform);

  return (
    <div 
      className="glass-panel" 
      style={{
        display: 'flex',
        flexDirection: 'row',
        padding: '16px',
        gap: '16px',
        alignItems: 'center',
        opacity: isPaused ? 0.7 : 1,
        transition: 'opacity 0.2s ease, box-shadow 0.2s ease',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Glow Effect when active */}
      {isActive && (
        <div 
          style={{
            position: 'absolute',
            top: '-50px',
            left: '-50px',
            width: '100px',
            height: '100px',
            background: `radial-gradient(circle, ${isMerging ? 'rgba(255, 183, 77, 0.3)' : `${platformColor}33`} 0%, rgba(0,0,0,0) 70%)`,
            pointerEvents: 'none'
          }}
        />
      )}

      {/* Thumbnail Container */}
      <div 
        style={{
          width: '128px',
          height: '72px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--surface-container-lowest)',
          overflow: 'hidden',
          position: 'relative',
          flexShrink: 0,
          border: '1px solid var(--outline-variant)'
        }}
      >
        {item.thumbnailUrl ? (
          <img 
            src={item.thumbnailUrl} 
            alt={item.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: isPaused ? 'grayscale(80%)' : 'none'
            }}
          />
        ) : (
          <div 
            className="flex-center w-full h-full"
            style={{
              background: `linear-gradient(135deg, var(--surface-container-low) 0%, var(--surface-container-high) 100%)`
            }}
          >
            <PlatformIcon 
              platform={item.platform} 
              size={32} 
              color="var(--on-surface-variant)" 
            />
          </div>
        )}

        {/* Platform Badge Overlay */}
        <div 
          style={{
            position: 'absolute',
            top: '4px',
            left: '4px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <PlatformIcon 
            platform={item.platform} 
            size={12} 
            color={platformColor} 
          />
        </div>

        {/* Duration Badge Overlay */}
        {item.duration && (
          <div 
            style={{
              position: 'absolute',
              bottom: '4px',
              right: '4px',
              backgroundColor: 'rgba(0,0,0,0.7)',
              padding: '2px 4px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '10px',
              fontWeight: 500
            }}
          >
            {item.duration}
          </div>
        )}
      </div>

      {/* Main Details Area */}
      <div className="flex-col" style={{ flexGrow: 1, overflow: 'hidden', gap: '6px' }}>
        {/* Title */}
        <h3 
          style={{ 
            fontSize: '14px', 
            fontWeight: 500, 
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            color: 'var(--on-surface)'
          }}
          title={item.title}
        >
          {item.title || 'Extracting URL metadata...'}
        </h3>

        {/* Status Line */}
        <div className="flex-row" style={{ alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <StatusDot status={item.status} />
          <span style={{ textTransform: 'capitalize', color: isMerging ? 'var(--warning, #ffb74d)' : 'var(--on-surface-variant)' }}>
            {isMerging 
              ? (isAudio ? 'extracting audio...' : 'Merging audio & video...') 
              : isDownloading ? 'downloading' : isPaused ? 'paused' : isQueued ? 'queued' : isError ? 'error' : 'ready'}
          </span>
          {isMerging && (
            <span className="icon" style={{ fontSize: '14px', color: 'var(--warning, #ffb74d)', animation: 'pulse 1.5s infinite' }}>
              {isAudio ? 'audio_file' : 'merge_type'}
            </span>
          )}
          <span className="mono" style={{ fontWeight: 600, color: 'var(--primary)', marginLeft: 'auto' }}>
            {item.progress.toFixed(1)}%
          </span>
        </div>

        {/* Progress Bar */}
        <ProgressBar 
          percent={item.progress} 
          variant={isMerging ? 'secondary' : isDownloading ? 'primary' : isPaused ? 'muted' : isError ? 'muted' : 'secondary'} 
          size="sm"
          shimmer={isDownloading || isMerging}
        />

        {/* Technical metrics info */}
        <div 
          className="flex-row mono text-muted" 
          style={{ 
            fontSize: '11px', 
            justifyContent: 'space-between',
            marginTop: '2px'
          }}
        >
          {isError ? (
            <span style={{ color: 'var(--error)' }}>Error: {item.error || 'Unknown failure'}</span>
          ) : isMerging ? (
            <span style={{ color: 'var(--warning, #ffb74d)', fontWeight: 500 }}>
              <span className="icon" style={{ fontSize: '11px', verticalAlign: 'middle', marginRight: '4px' }}>
                {isAudio ? 'audio_file' : 'sync'}
              </span>
              {isAudio 
                ? 'FFmpeg is converting audio format to MP3...' 
                : 'FFmpeg is merging video and audio tracks into a single file...'}
            </span>
          ) : (
            <>
              {/* Bytes Downloaded / Total */}
              <span>
                {formatBytes(item.downloadedBytes)} / {item.totalBytes > 0 ? formatBytes(item.totalBytes) : 'Unknown size'}
              </span>

              {/* Download Speed */}
              {isDownloading && (
                <span className="text-secondary-color" style={{ fontWeight: 500 }}>
                  {formatSpeed(item.speed)}
                </span>
              )}

              {/* Time Remaining */}
              <span>
                {isDownloading ? `${formatETA(item.eta)} left` : isQueued ? 'Waiting in queue' : isPaused ? 'Paused' : ''}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex-row gap-sm" style={{ flexShrink: 0 }}>
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

        {onCancel && (isDownloading || isMerging || isPaused || isQueued) && (
          <button 
            className="btn btn-ghost btn-icon flex-center"
            style={{ width: '32px', height: '32px', color: 'var(--error)' }}
            onClick={() => setShowCancelConfirm(true)}
          >
            <span className="icon">close</span>
          </button>
        )}

        {isError && onRetry && (
          <button 
            className="btn btn-ghost btn-icon flex-center"
            style={{ width: '32px', height: '32px', color: 'var(--secondary)' }}
            onClick={() => onRetry(item.id)}
            title="Retry download"
          >
            <span className="icon">refresh</span>
          </button>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        open={showCancelConfirm}
        title="Cancel Download?"
        message={`Are you sure you want to cancel downloading "${item.title || 'this file'}"? Partial files will be deleted.`}
        confirmLabel="Cancel Download"
        cancelLabel="Keep Downloading"
        variant="danger"
        onConfirm={() => {
          setShowCancelConfirm(false);
          onCancel?.(item.id);
        }}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </div>
  );
};

export default DownloadCard;
