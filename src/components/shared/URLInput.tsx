import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Toggle from '../ui/Toggle';

interface URLInputProps {
  onDownload: (url: string, options: DownloadOptions, prefetchedInfo?: any) => void;
}

export interface DownloadOptions {
  auto4k: boolean;
  extractSubs: boolean;
  audioOnly: boolean;
}

export interface AnalyzedMetadata {
  title: string;
  thumbnailUrl: string;
  duration: string;
  durationSeconds: number;
  uploader: string;
  format: string;
  quality: string;
  platform: 'youtube' | 'tiktok' | 'facebook' | 'instagram' | 'other';
  isPlaylist?: boolean;
  totalItems?: number;
  entries?: Array<{
    title: string;
    id: string;
    duration: string;
    url: string;
  }>;
}

export const URLInput: React.FC<URLInputProps> = ({ onDownload }) => {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedInfo, setAnalyzedInfo] = useState<AnalyzedMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Download options state
  const [downloadMode, setDownloadMode] = useState<'video' | 'audio'>('video');
  const [videoQuality, setVideoQuality] = useState<'4k' | '1080p'>('1080p');
  const [extractSubs, setExtractSubs] = useState(false);

  const handleAnalyze = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    setIsAnalyzing(true);
    setError(null);
    setAnalyzedInfo(null);

    try {
      // Fetch metadata using the Tauri command
      const info = await invoke<AnalyzedMetadata>('get_video_info', { url: trimmedUrl });
      
      if (!info) {
        throw new Error('Failed to retrieve video information.');
      }
      
      setAnalyzedInfo(info);
      // Auto-detect playlist or initial mode
      setDownloadMode(info.platform === 'other' ? 'video' : 'video');
    } catch (err) {
      console.error(err);
      setError(String(err).replace('Error: ', ''));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartDownload = () => {
    if (!analyzedInfo) return;

    const options: DownloadOptions = {
      auto4k: downloadMode === 'video' && videoQuality === '4k',
      audioOnly: downloadMode === 'audio',
      extractSubs: extractSubs
    };

    onDownload(url.trim(), options, analyzedInfo);
  };

  const handleReset = () => {
    setUrl('');
    setAnalyzedInfo(null);
    setError(null);
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'youtube':
        return 'play_circle';
      case 'tiktok':
        return 'music_note';
      case 'facebook':
        return 'thumb_up';
      case 'instagram':
        return 'photo_camera';
      default:
        return 'link';
    }
  };

  const getPlatformName = (platform: string) => {
    if (platform === 'other') return 'Direct Link';
    return platform.charAt(0).toUpperCase() + platform.slice(1);
  };

  return (
    <div className="flex-col gap-md w-full">
      {/* Stage 1: Input URL and Analyze */}
      {!analyzedInfo && (
        <div className="flex-col gap-md w-full">
          <div 
            className="flex-row gap-md w-full"
            style={{
              alignItems: 'center',
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              borderRadius: 'var(--radius-lg)',
              padding: '8px',
              border: '1px solid var(--outline-variant)',
              boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div style={{ flexGrow: 1 }}>
              <Input
                icon="link"
                mono
                placeholder="Paste your video, audio, or playlist URL here..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && url.trim() && !isAnalyzing) {
                    handleAnalyze();
                  }
                }}
                disabled={isAnalyzing}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '14px',
                  height: '42px',
                  color: 'var(--on-surface)'
                }}
              />
            </div>

            <Button
              variant="primary"
              icon={isAnalyzing ? undefined : 'search'}
              style={{
                height: '42px',
                padding: '0 24px',
                borderRadius: 'var(--radius-md)',
                minWidth: '130px'
              }}
              onClick={handleAnalyze}
              disabled={!url.trim() || isAnalyzing}
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze Link'}
            </Button>
          </div>

          {/* Shimmer loading skeleton */}
          {isAnalyzing && (
            <div 
              className="glass-panel flex-col gap-md"
              style={{
                padding: '20px',
                marginTop: '8px',
                animation: 'fadeInUp 0.2s ease-out',
                borderStyle: 'dashed'
              }}
            >
              <div className="flex-row gap-md" style={{ alignItems: 'center' }}>
                <div 
                  className="progress-shimmer"
                  style={{ 
                    width: '160px', 
                    height: '90px', 
                    borderRadius: 'var(--radius-md)', 
                    backgroundColor: 'var(--surface-container-high)' 
                  }} 
                />
                <div className="flex-col gap-sm" style={{ flexGrow: 1 }}>
                  <div className="progress-shimmer" style={{ width: '60%', height: '16px', borderRadius: '4px', backgroundColor: 'var(--surface-container-high)' }} />
                  <div className="progress-shimmer" style={{ width: '40%', height: '12px', borderRadius: '4px', backgroundColor: 'var(--surface-container-high)' }} />
                  <div className="progress-shimmer" style={{ width: '30%', height: '12px', borderRadius: '4px', backgroundColor: 'var(--surface-container-high)' }} />
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div 
              className="flex-row gap-md" 
              style={{
                backgroundColor: 'rgba(255, 180, 171, 0.1)',
                border: '1px solid rgba(255, 180, 171, 0.2)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                alignItems: 'flex-start',
                marginTop: '8px',
                animation: 'fadeInUp 0.2s ease-out'
              }}
            >
              <span className="icon text-tertiary-color" style={{ color: 'var(--error)', fontSize: '24px' }}>error_outline</span>
              <div className="flex-col" style={{ flexGrow: 1, gap: '4px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--error)' }}>Analysis Failed</span>
                <span className="text-muted" style={{ fontSize: '13px', lineHeight: 1.4 }}>{error}</span>
              </div>
              <button 
                className="btn btn-ghost btn-icon flex-center"
                style={{ border: 'none', width: '28px', height: '28px', color: 'var(--on-surface-variant)' }}
                onClick={() => setError(null)}
              >
                <span className="icon" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stage 2: Options Selection & Media Details */}
      {analyzedInfo && (
        <div 
          className="glass-panel flex-col gap-lg"
          style={{
            padding: '24px',
            animation: 'fadeInUp 0.3s ease-out',
            boxShadow: 'var(--shadow-lg), var(--glow-primary)'
          }}
        >
          {/* Media Info Section */}
          <div 
            className="flex-row gap-lg" 
            style={{ 
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              borderBottom: '1px solid var(--outline-variant)',
              paddingBottom: '20px'
            }}
          >
            {/* Thumbnail Preview */}
            <div 
              style={{
                width: '180px',
                height: '100px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--surface-container-lowest)',
                border: '1px solid var(--outline-variant)',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {analyzedInfo.thumbnailUrl ? (
                <img 
                  src={analyzedInfo.thumbnailUrl} 
                  alt={analyzedInfo.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                  onError={(e) => {
                    // Hide broken image and show fallback
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : null}
              <span 
                className="icon text-primary-color" 
                style={{ 
                  position: 'absolute', 
                  fontSize: '36px',
                  opacity: analyzedInfo.thumbnailUrl ? 0.35 : 0.8
                }}
              >
                {analyzedInfo.isPlaylist ? 'playlist_play' : (downloadMode === 'audio' ? 'music_note' : 'play_circle')}
              </span>
              
              {/* Duration overlay badge */}
              {analyzedInfo.duration && (
                <div 
                  className="mono"
                  style={{
                    position: 'absolute',
                    bottom: '6px',
                    right: '6px',
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 500,
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  {analyzedInfo.duration}
                </div>
              )}
            </div>

            {/* Meta details */}
            <div className="flex-col" style={{ flexGrow: 1, minWidth: '240px', gap: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--on-surface)', lineHeight: 1.4 }}>
                {analyzedInfo.title}
              </h3>
              
              <div className="flex-row gap-sm" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Platform Badge */}
                <div 
                  className={`badge ${analyzedInfo.platform === 'youtube' ? 'badge-primary' : 'badge-secondary'}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '4px' }}
                >
                  <span className="icon" style={{ fontSize: '12px' }}>{getPlatformIcon(analyzedInfo.platform)}</span>
                  <span>{getPlatformName(analyzedInfo.platform)}</span>
                </div>

                {analyzedInfo.isPlaylist && (
                  <div 
                    className="badge badge-primary"
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '4px', 
                      padding: '4px 8px', 
                      borderRadius: '4px',
                      backgroundColor: 'rgba(195, 192, 255, 0.15)',
                      color: 'var(--primary)',
                      borderColor: 'rgba(195, 192, 255, 0.3)'
                    }}
                  >
                    <span className="icon" style={{ fontSize: '12px' }}>playlist_play</span>
                    <span>Playlist ({analyzedInfo.totalItems} videos)</span>
                  </div>
                )}

                {/* Uploader name */}
                {analyzedInfo.uploader && (
                  <span className="text-muted" style={{ fontSize: '13px' }}>
                    uploader: <strong style={{ color: 'var(--on-surface-variant)' }}>{analyzedInfo.uploader}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Options Grid */}
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
              gap: '24px' 
            }}
          >
            {/* Download Mode Option */}
            <div className="flex-col gap-sm">
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--on-surface-variant)' }}>
                Download Format Mode
              </span>
              <div className="flex-row gap-sm">
                <button
                  className={`btn ${downloadMode === 'video' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flexGrow: 1, height: '40px', borderRadius: 'var(--radius-md)' }}
                  onClick={() => setDownloadMode('video')}
                >
                  <span className="icon">movie</span>
                  Video
                </button>
                <button
                  className={`btn ${downloadMode === 'audio' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flexGrow: 1, height: '40px', borderRadius: 'var(--radius-md)' }}
                  onClick={() => setDownloadMode('audio')}
                >
                  <span className="icon">music_note</span>
                  Audio Only (MP3)
                </button>
              </div>
            </div>

            {/* Sub-options for Selected Mode */}
            <div className="flex-col gap-sm">
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--on-surface-variant)' }}>
                Quality settings
              </span>
              
              {downloadMode === 'video' ? (
                <div className="flex-row gap-sm">
                  <button
                    className={`btn ${videoQuality === '1080p' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flexGrow: 1, height: '40px', fontSize: '13px' }}
                    onClick={() => setVideoQuality('1080p')}
                  >
                    1080p (Full HD)
                  </button>
                  <button
                    className={`btn ${videoQuality === '4k' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flexGrow: 1, height: '40px', fontSize: '13px' }}
                    onClick={() => setVideoQuality('4k')}
                  >
                    4K (Ultra HD)
                  </button>
                </div>
              ) : (
                <div 
                  className="flex-row" 
                  style={{ 
                    height: '40px', 
                    alignItems: 'center', 
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    padding: '0 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--outline-variant)',
                    fontSize: '13px',
                    color: 'var(--secondary)'
                  }}
                >
                  <span className="icon" style={{ fontSize: '16px', marginRight: '6px' }}>audio_file</span>
                  Hi-Res MP3 extraction (Best bitrate)
                </div>
              )}
            </div>
          </div>

          {/* Subtitles Option */}
          {analyzedInfo.platform === 'youtube' && (
            <div 
              style={{
                backgroundColor: 'rgba(255,255,255,0.02)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                border: '1px solid var(--outline-variant)'
              }}
            >
              <Toggle 
                label="Extract & Download Subtitles (if available)" 
                checked={extractSubs}
                onChange={(e) => setExtractSubs(e.target.checked)}
              />
            </div>
          )}

          {/* Actions footer */}
          <div 
            className="flex-row gap-md" 
            style={{ 
              justifyContent: 'flex-end', 
              borderTop: '1px solid var(--outline-variant)',
              paddingTop: '20px',
              marginTop: '4px',
              flexWrap: 'wrap'
            }}
          >
            <Button 
              variant="ghost" 
              icon="restart_alt"
              style={{ height: '42px', padding: '0 20px' }}
              onClick={handleReset}
            >
              Analyze Another
            </Button>
            <Button 
              variant="primary" 
              icon="download"
              style={{ height: '42px', padding: '0 28px', fontWeight: 600 }}
              onClick={handleStartDownload}
            >
              Start Download
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default URLInput;
