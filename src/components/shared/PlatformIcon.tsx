import React from 'react';
import { Platform } from '../../types/download';

interface PlatformIconProps {
  platform: Platform | string;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
}

export const PlatformIcon: React.FC<PlatformIconProps> = ({
  platform,
  size = 20,
  color = 'currentColor',
  style,
  className = ''
}) => {
  const normPlatform = (platform || '').toLowerCase();

  switch (normPlatform) {
    case 'youtube':
      return (
        <svg 
          viewBox="0 0 24 24" 
          width={size} 
          height={size} 
          fill={color} 
          style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
          className={className}
        >
          <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      );
    case 'tiktok':
      return (
        <svg 
          viewBox="0 0 24 24" 
          width={size} 
          height={size} 
          fill={color} 
          style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
          className={className}
        >
          <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.52-4.06-1.39-.28-.2-.55-.42-.8-.66v7.06c0 1.9-.53 3.84-1.74 5.25-1.57 1.83-4.14 2.76-6.52 2.37-2.6-.42-4.9-2.3-5.63-4.88-.93-3.23.6-6.91 3.66-8.23.95-.41 1.99-.58 3.02-.53v4.03c-.76-.08-1.55.07-2.22.45-1.12.63-1.68 2.05-1.25 3.26.39 1.13 1.67 1.88 2.87 1.63 1.1-.23 1.87-1.29 1.87-2.42V.02z"/>
        </svg>
      );
    case 'facebook':
      return (
        <svg 
          viewBox="0 0 24 24" 
          width={size} 
          height={size} 
          fill={color} 
          style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
          className={className}
        >
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      );
    case 'instagram':
      return (
        <svg 
          viewBox="0 0 24 24" 
          width={size} 
          height={size} 
          fill={color} 
          style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
          className={className}
        >
          <path d="M12 0C8.74 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.74 0 12s.014 3.667.072 4.947c.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072s3.667-.014 4.947-.072c4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.26-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.26 0 12 0zm0 5.838c3.403 0 6.162 2.759 6.162 6.162 0 3.403-2.759 6.162-6.162 6.162-3.403 0-6.162-2.759-6.162-6.162 0-3.403 2.759-6.162 6.162-6.162zM12 16c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm7.846-10.405a1.44 1.44 0 1 0 0-2.88 1.44 1.44 0 0 0 0 2.88z"/>
        </svg>
      );
    default:
      return (
        <svg 
          viewBox="0 0 24 24" 
          width={size} 
          height={size} 
          fill={color} 
          style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
          className={className}
        >
          <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
        </svg>
      );
  }
};

export default PlatformIcon;
