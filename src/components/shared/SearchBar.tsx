import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useUIStore } from '../../stores/uiStore';
import { useI18n } from '../../i18n';

export const SearchBar: React.FC = () => {
  const location = useLocation();
  const { searchQuery, setSearchQuery } = useUIStore();
  const { t } = useI18n();

  // Don't leak a filter from one page into another.
  useEffect(() => {
    setSearchQuery('');
  }, [location.pathname, setSearchQuery]);

  const getPlaceholder = () => {
    switch (location.pathname) {
      case '/queue':
        return t('search.queue');
      case '/finished':
        return t('search.finished');
      case '/settings':
        return t('search.settings');
      default:
        return t('search.here');
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
