import React from 'react';

export const BrowserPage: React.FC = () => {
  return (
    <div className="flex-col gap-lg w-full" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
      <div>
        <h1>Embedded Browser</h1>
        <p className="text-muted mt-sm">Browse media sites and automatically detect video links.</p>
      </div>

      <div 
        className="glass-panel flex-center"
        style={{
          padding: '80px 20px',
          flexDirection: 'column',
          gap: '20px',
          borderStyle: 'dashed',
          backgroundColor: 'transparent'
        }}
      >
        <span className="icon text-primary-color" style={{ fontSize: '56px' }}>
          construction
        </span>
        <div className="flex-col" style={{ alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Coming Soon</h2>
          <p className="text-muted" style={{ fontSize: '13px', textAlign: 'center', maxWidth: '400px', lineHeight: 1.6 }}>
            The embedded browser will let you browse YouTube, TikTok, Instagram, and more —
            with automatic video link detection and one-click downloads.
          </p>
          <span className="badge badge-primary" style={{ marginTop: '8px' }}>
            Planned for v0.5.0
          </span>
        </div>
      </div>
    </div>
  );
};

export default BrowserPage;
