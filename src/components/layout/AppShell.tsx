import React from 'react';
import SideNav from './SideNav';
import TopBar from './TopBar';
import ToastContainer from '../ui/Toast';
import { useQueueManager } from '../../hooks/useQueueManager';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  // Initialize the global download queue manager
  useQueueManager();

  return (
    <div 
      className="flex-row w-full h-full" 
      style={{ 
        backgroundColor: 'var(--surface)', 
        color: 'var(--on-surface)',
        overflow: 'hidden'
      }}
    >
      {/* Sidebar Nav */}
      <SideNav />

      {/* Main Layout Area */}
      <div 
        className="flex-col h-full" 
        style={{ 
          flexGrow: 1, 
          overflow: 'hidden',
          transition: 'margin-left 0.2s ease',
          position: 'relative'
        }}
      >
        {/* Top bar */}
        <TopBar />

        {/* Page Content Scroll View */}
        <main 
          style={{ 
            flexGrow: 1, 
            overflowY: 'auto', 
            padding: 'var(--spacing-lg)',
            width: '100%',
            maxWidth: 'var(--container-max)',
            margin: '0 auto'
          }}
        >
          {children}
        </main>
      </div>

      {/* Global Toast Notifications */}
      <ToastContainer />
    </div>
  );
};

export default AppShell;
