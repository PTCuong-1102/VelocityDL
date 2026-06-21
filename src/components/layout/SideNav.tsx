import React from 'react';
import { NavLink } from 'react-router-dom';
import { useUIStore } from '../../stores/uiStore';

export const SideNav: React.FC = () => {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: 'dashboard' },
    { path: '/queue', label: 'Download Queue', icon: 'download' },
    { path: '/finished', label: 'Finished', icon: 'check_circle' },
    { path: '/scheduled', label: 'Scheduled', icon: 'schedule' },
    { path: '/browser', label: 'Browser', icon: 'language' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ];

  return (
    <div 
      className="flex-col" 
      style={{
        width: sidebarCollapsed ? '72px' : 'var(--sidebar-width)',
        height: '100%',
        backgroundColor: 'var(--surface-container-low)',
        borderRight: '1px solid var(--outline-variant)',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
        zIndex: 10
      }}
    >
      {/* Brand Header */}
      <div 
        className="flex-row gap-sm"
        style={{
          height: 'var(--topbar-height)',
          alignItems: 'center',
          padding: sidebarCollapsed ? '0 16px' : '0 24px',
          borderBottom: '1px solid var(--outline-variant)',
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
        }}
      >
        <span 
          className="icon text-primary-color" 
          style={{ 
            fontSize: '28px',
            textShadow: 'var(--glow-primary-strong)',
            cursor: 'pointer'
          }}
          onClick={toggleSidebar}
        >
          bolt
        </span>
        {!sidebarCollapsed && (
          <div className="flex-col" style={{ flexGrow: 1 }}>
            <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--on-surface)' }}>VelocityDL</span>
            <span className="badge badge-primary" style={{ alignSelf: 'flex-start', marginTop: '2px', fontSize: '9px', padding: '1px 4px' }}>Pro v2.0</span>
          </div>
        )}
      </div>

      {/* CTA Button */}
      <div style={{ padding: sidebarCollapsed ? '16px 8px' : '16px 24px' }}>
        <button 
          className="btn btn-primary w-full"
          style={{
            padding: sidebarCollapsed ? '10px 0' : '10px 16px',
            borderRadius: 'var(--radius-md)',
            justifyContent: 'center'
          }}
          onClick={() => {
            // Future command / trigger modal
          }}
        >
          <span className="icon">add</span>
          {!sidebarCollapsed && <span>Add URL</span>}
        </button>
      </div>

      {/* Navigation List */}
      <nav 
        className="flex-col gap-xs" 
        style={{ 
          flexGrow: 1, 
          padding: sidebarCollapsed ? '0 8px' : '0 12px',
          overflowY: 'auto' 
        }}
      >
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              color: isActive ? 'var(--primary)' : 'var(--on-surface-variant)',
              backgroundColor: isActive ? 'rgba(195, 192, 255, 0.08)' : 'transparent',
              borderRight: isActive ? '3px solid var(--primary)' : 'none',
              transition: 'all 0.15s ease',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
            })}
            className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
          >
            <span 
              className="icon"
              style={{
                fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24'
              }}
            >
              {item.icon}
            </span>
            {!sidebarCollapsed && <span style={{ fontWeight: 500 }}>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer / User Profile Area */}
      <div 
        className="flex-col" 
        style={{
          borderTop: '1px solid var(--outline-variant)',
          padding: '16px',
          backgroundColor: 'var(--surface-container-lowest)'
        }}
      >
        <div 
          className="flex-row gap-sm" 
          style={{ 
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
          }}
        >
          <span className="icon text-muted" style={{ fontSize: '24px' }}>account_circle</span>
          {!sidebarCollapsed && (
            <div className="flex-col" style={{ flexGrow: 1 }}>
              <span style={{ fontWeight: 500, fontSize: '13px' }}>Guest User</span>
              <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>Free Tier</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SideNav;
