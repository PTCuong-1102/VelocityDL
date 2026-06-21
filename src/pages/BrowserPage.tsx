import React from 'react';

export const BrowserPage: React.FC = () => {
  return (
    <div className="flex-col gap-lg w-full">
      <div>
        <h1>Embedded Browser</h1>
        <p className="text-muted mt-sm">Browse media sites and automatically detect video links.</p>
      </div>
    </div>
  );
};

export default BrowserPage;
