import React from 'react';
import { AnyDownloadItem } from '../../types/download';
import { formatBytes } from '../../utils/format';
import { getPlatformColor } from '../../utils/platform';
import PlatformIcon from '../shared/PlatformIcon';

interface FinishedCardProps {
  item: AnyDownloadItem;
  onPlay?: (path: string) => void;
  onOpenFolder?: (path: string) => void;
}

export const FinishedCard: React.FC<FinishedCardProps> = ({
  item,
  onPlay,
  onOpenFolder
}) => {
  const platformColor = getPlatformColor(item.platform);

  return (
    <div
      className="glass-panel glass-panel-hoverable"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '260px',
        padding: '0',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Thumbnail Cover container */}
      <div
        style={{
          width: '100%',
          height: '140px',
          backgroundColor: 'var(--surface-container-lowest)',
          position: 'relative',
          overflow: 'hidden',
          borderBottom: '1px solid var(--outline-variant)'
        }}
      >
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
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
              size={48} 
              color="var(--on-surface-variant)" 
            />
          </div>
        )}

        {/* Media type format badge top-right */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            backgroundColor: 'rgba(11, 19, 38, 0.85)',
            border: '1px solid var(--outline-variant)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 6px',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--on-surface)'
          }}
        >
          {item.format}
        </div>

        {/* Platform Badge Overlay top-left */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            width: '24px',
            height: '24px',
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
            size={14} 
            color={platformColor} 
          />
        </div>

        {/* Duration badge bottom-right */}
        {item.duration && (
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '10px',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)'
            }}
          >
            {item.duration}
          </div>
        )}
      </div>

      {/* Info details body */}
      <div
        className="flex-col"
        style={{
          padding: '12px 16px',
          flexGrow: 1,
          justifyContent: 'space-between'
        }}
      >
        <div className="flex-col" style={{ gap: '4px' }}>
          {/* Video title (line-clamp-2) */}
          <h3
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--on-surface)',
              lineHeight: '1.4',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
            title={item.title}
          >
            {item.title}
          </h3>

          {/* Technical Metadata info */}
          <div className="flex-row gap-sm mono text-muted" style={{ fontSize: '11px', flexWrap: 'wrap', marginTop: '2px' }}>
            <span>{formatBytes(item.totalBytes)}</span>
            <span>•</span>
            <span className="text-primary-color">{item.quality}</span>
          </div>
        </div>

        {/* Action triggers footer */}
        <div
          className="flex-row gap-sm"
          style={{
            marginTop: '8px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            paddingTop: '8px'
          }}
        >
          {onPlay && (
            <button
              className="btn btn-ghost"
              style={{
                flexGrow: 1,
                fontSize: '12px',
                padding: '6px 12px',
                height: '28px',
                borderColor: 'rgba(195, 192, 255, 0.25)',
                color: 'var(--primary)'
              }}
              onClick={() => onPlay(item.outputPath)}
            >
              <span className="icon" style={{ fontSize: '16px' }}>play_arrow</span>
              Play
            </button>
          )}

          {onOpenFolder && (
            <button
              className="btn btn-ghost btn-icon flex-center"
              style={{
                width: '28px',
                height: '28px'
              }}
              onClick={() => onOpenFolder(item.outputPath)}
              title="Open enclosing folder"
            >
              <span className="icon" style={{ fontSize: '16px' }}>folder_open</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinishedCard;
