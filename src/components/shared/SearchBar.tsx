import React from 'react';
import { useLocation } from 'react-router-dom';
import { useUIStore } from '../../stores/uiStore';

export const SearchBar: React.FC = () => {
  const location = useLocation();
  const { searchQuery, setSearchQuery } = useUIStore();

  const getPlaceholder = () => {
    switch (location.pathname) {
      case '/queue':
        return 'Search queue...';
      case '/finished':
        return 'Search finished downloads...';
      case '/scheduled':
        return 'Search scheduled tasks...';
      case '/browser':
        return 'Enter site name or URL...';
      case '/settings':
        return 'Search settings...';
      default:
        return 'Search here...';
    }
  };

  const isVisible = location.pathname !== '/'; // Hide search on main dashboard hero

  if (!isVisible) return <div style={{ flexGrow: 1 }} />;

  return (
    <div 
      className="flex-row" 
      style={{ 
        position: 'relative',
        maxWidth: '400px',
        width: '100%',
        alignItems: 'center'
      }}
    >
      <span 
        className="icon text-muted" 
        style={{ 
          position: 'absolute',
          left: '12px',
          pointerEvents: 'none'
        }}
      >
        search
      </span>
      <input
        type="text"
        className="input-dark"
        style={{
          paddingLeft: '38px',
          height: '36px',
          fontSize: '13px',
          borderRadius: 'var(--radius-full)'
        }}
        placeholder={getPlaceholder()}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
    </div>
  );
};

export default SearchBar;
