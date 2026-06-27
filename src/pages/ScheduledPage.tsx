import React from 'react';

export const ScheduledPage: React.FC = () => {
  return (
    <div className="flex-col gap-lg w-full" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
      <div>
        <h1>Scheduled Downloads</h1>
        <p className="text-muted mt-sm">Manage downloads scheduled for later.</p>
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
        <span className="icon text-tertiary-color" style={{ fontSize: '56px' }}>
          schedule
        </span>
        <div className="flex-col" style={{ alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Coming Soon</h2>
          <p className="text-muted" style={{ fontSize: '13px', textAlign: 'center', maxWidth: '400px', lineHeight: 1.6 }}>
            Schedule downloads to start automatically at a specific time.
            Perfect for off-peak hours or bandwidth management.
          </p>
          <span className="badge badge-primary" style={{ marginTop: '8px' }}>
            Planned for v0.5.0
          </span>
        </div>
      </div>
    </div>
  );
};

export default ScheduledPage;
