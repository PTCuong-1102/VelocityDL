import React from 'react';

export const ScheduledPage: React.FC = () => {
  return (
    <div className="flex-col gap-lg w-full">
      <div>
        <h1>Scheduled Downloads</h1>
        <p className="text-muted mt-sm">Manage downloads scheduled for later.</p>
      </div>
    </div>
  );
};

export default ScheduledPage;
