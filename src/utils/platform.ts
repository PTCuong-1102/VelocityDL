import { Platform } from '../types/download';

export const getPlatformFromUrl = (url: string): Platform => {
  const lowercaseUrl = url.toLowerCase();
  if (lowercaseUrl.includes('youtube.com') || lowercaseUrl.includes('youtu.be')) {
    return 'youtube';
  } else if (lowercaseUrl.includes('tiktok.com')) {
    return 'tiktok';
  } else if (lowercaseUrl.includes('facebook.com') || lowercaseUrl.includes('fb.watch')) {
    return 'facebook';
  } else if (lowercaseUrl.includes('instagram.com')) {
    return 'instagram';
  }
  return 'other';
};

export const getPlatformIcon = (platform: Platform): string => {
  switch (platform) {
    case 'youtube':
      return 'play_circle';
    case 'tiktok':
      return 'audiotrack';
    case 'facebook':
      return 'facebook';
    case 'instagram':
      return 'photo_camera';
    default:
      return 'link';
  }
};

export const getPlatformColor = (platform: Platform): string => {
  switch (platform) {
    case 'youtube':
      return '#ff0000';
    case 'tiktok':
      return '#00f2fe';
    case 'facebook':
      return '#1877f2';
    case 'instagram':
      return '#e1306c';
    default:
      return 'var(--primary)';
  }
};
export default getPlatformFromUrl;
