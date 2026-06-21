import React, { useState } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface URLInputProps {
  onDownload: (url: string, options: DownloadOptions) => void;
  isExtracting?: boolean;
}

export interface DownloadOptions {
  auto4k: boolean;
  extractSubs: boolean;
  audioOnly: boolean;
}

export const URLInput: React.FC<URLInputProps> = ({ onDownload, isExtracting = false }) => {
  const [url, setUrl] = useState('');
  const [options, setOptions] = useState<DownloadOptions>({
    auto4k: true,
    extractSubs: false,
    audioOnly: false
  });

  const isPlaylist = url.toLowerCase().includes('list=') || url.toLowerCase().includes('playlist');

  const handleDownload = () => {
    if (!url.trim()) return;
    onDownload(url, options);
  };

  const toggleOption = (key: keyof DownloadOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex-col gap-md w-full">
      {/* Input row wrapper */}
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
          icon={isPlaylist ? 'playlist_add' : 'download'}
          style={{
            height: '42px',
            padding: '0 24px',
            borderRadius: 'var(--radius-md)'
          }}
          onClick={handleDownload}
          disabled={!url.trim() || isExtracting}
        >
          {isExtracting ? 'Analyzing...' : isPlaylist ? 'Download Playlist' : 'Download'}
        </Button>
      </div>

      {/* Option Chips bar */}
      <div 
        className="flex-row gap-sm"
        style={{
          flexWrap: 'wrap',
          padding: '0 4px'
        }}
      >
        {/* Auto 4K option */}
        <button
          className={`badge ${options.auto4k ? 'badge-secondary' : 'badge-primary'}`}
          style={{
            cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.05)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            borderRadius: 'var(--radius-full)'
          }}
          onClick={() => toggleOption('auto4k')}
        >
          {options.auto4k && <span className="icon" style={{ fontSize: '12px' }}>check</span>}
          <span>Auto Best Quality (4K)</span>
        </button>

        {/* Extract Subs option */}
        <button
          className={`badge ${options.extractSubs ? 'badge-secondary' : 'badge-primary'}`}
          style={{
            cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.05)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            borderRadius: 'var(--radius-full)'
          }}
          onClick={() => toggleOption('extractSubs')}
        >
          {options.extractSubs && <span className="icon" style={{ fontSize: '12px' }}>check</span>}
          <span>Extract Subtitles</span>
        </button>

        {/* Audio Only option */}
        <button
          className={`badge ${options.audioOnly ? 'badge-secondary' : 'badge-primary'}`}
          style={{
            cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.05)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            borderRadius: 'var(--radius-full)'
          }}
          onClick={() => toggleOption('audioOnly')}
        >
          {options.audioOnly && <span className="icon" style={{ fontSize: '12px' }}>check</span>}
          <span>Audio Only (MP3/FLAC)</span>
        </button>
      </div>
    </div>
  );
};

export default URLInput;
