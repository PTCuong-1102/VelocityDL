import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useUIStore } from '../../stores/uiStore';

export const SearchBar: React.FC = () => {
  const location = useLocation();
  const { searchQuery, setSearchQuery } = useUIStore();

  // Don't leak a filter from one page into another.
  useEffect(() => {
    setSearchQuery('');
  }, [location.pathname, setSearchQuery]);

  const getPlaceholder = () => {
    switch (location.pathname) {
      case '/queue':
        return 'Search queue...';
      case '/finished':
        return 'Search finished downloads...';
      case '/settings':
        return 'Search settings...';
      default:
        return 'Search here...';
    }
  };

  // Only queue + finished lists are filterable; hide elsewhere
  // (dashboard hero, settings) instead of showing a dead input.
  const isVisible = location.pathname === '/queue' || location.pathname === '/finished';

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
