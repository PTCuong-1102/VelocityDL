import React, { useState } from 'react';
import { AnyDownloadItem, isPlaylistItem } from '../../types/download';
import { formatBytes } from '../../utils/format';
import { getPlatformColor } from '../../utils/platform';
import { useI18n } from '../../i18n';
import PlatformIcon from '../shared/PlatformIcon';

/** Quality override for re-downloading a history entry. */
export interface RedownloadChoice {
  /** 0 = original option recorded on the item. */
  maxHeight: number;
  label: string;
}

interface FinishedCardProps {
  item: AnyDownloadItem;
  onPlay?: (path: string) => void;
  onOpenFolder?: (item: AnyDownloadItem) => void;
  /** Re-run this entry with its original options (History v2). */
  onRedownload?: (item: AnyDownloadItem, choice?: RedownloadChoice) => void;
  /** Remove this entry from the persistent history. */
  onRemove?: (id: string) => void;
}

export const FinishedCard: React.FC<FinishedCardProps> = ({
  item,
  onPlay,
  onOpenFolder,
  onRedownload,
  onRemove
}) => {

  const { t } = useI18n();  const platformColor = getPlatformColor(item.platform);
  // Play needs a real file; a playlist parent outputPath is a directory.
  const canPlay = !!item.outputPath && !isPlaylistItem(item);
  // Reveal needs at least one known path (parent dir or any child file).
  const canReveal =
    !!item.outputPath ||
    (isPlaylistItem(item) && (item.children || []).some((c) => !!c.outputPath));
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  const handleRedownloadClick = () => {
    if (item.mediaType === 'audio') {
      // Audio entries carry their format as the "quality" — no height menu.
      onRedownload?.(item);
      return;
    }
    setShowQualityMenu((v) => !v);
  };

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
          {onPlay && canPlay && (
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

          {onOpenFolder && canReveal && (
            <button
              className="btn btn-ghost btn-icon flex-center"
              style={{
                width: '28px',
                height: '28px'
              }}
              onClick={() => onOpenFolder(item)}
              title={t('common.openEnclosing')}
            >
              <span className="icon" style={{ fontSize: '16px' }}>folder_open</span>
            </button>
          )}

          {onRedownload && (
            <div style={{ position: 'relative' }}>
              {showQualityMenu && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '34px',
                    left: '-32px',
                    zIndex: 30,
                    minWidth: '124px',
                    padding: '4px',
                    borderRadius: '10px',
                    border: '1px solid var(--outline-variant)',
                    background: 'var(--surface-container-lowest)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}
                >
                  {[
                    { label: t('finished.currentQuality'), maxHeight: 0 },
                    { label: '1080p', maxHeight: 1080 },
                    { label: '720p', maxHeight: 720 },
                    { label: '480p', maxHeight: 480 },
                  ].map((q) => (
                    <button
                      key={q.label}
                      className="btn btn-ghost"
                      style={{ fontSize: '12px', padding: '4px 10px', height: '26px', justifyContent: 'flex-start' }}
                      onClick={() => {
                        setShowQualityMenu(false);
                        onRedownload?.(item, q.maxHeight === 0 ? undefined : q);
                      }}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              )}
              <button
                className="btn btn-ghost btn-icon flex-center"
                style={{
                  width: '28px',
                  height: '28px'
                }}
                onClick={handleRedownloadClick}
                title={t('finished.redownload')}
              >
                <span className="icon" style={{ fontSize: '16px' }}>refresh</span>
              </button>
            </div>
          )}

          {onRemove && (
            <button
              className="btn btn-ghost btn-icon flex-center"
              style={{
                width: '28px',
                height: '28px',
                color: 'var(--error)'
              }}
              onClick={() => onRemove(item.id)}
              title={t('finished.removeHistory')}
            >
              <span className="icon" style={{ fontSize: '16px' }}>delete</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinishedCard;
