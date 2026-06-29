import { useEffect, useRef } from 'react';
import { useToastStore } from '../stores/toastStore';
import { useUIStore } from '../stores/uiStore';

const URL_PATTERN = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|tiktok\.com|facebook\.com|fb\.watch|instagram\.com|open\.spotify\.com|spotify\.com)/i;

/**
 * Watches the clipboard for video/audio URLs when the app window is focused.
 * Shows a toast notification with an action to populate the URL input.
 */
export function useClipboardWatcher() {
  const { addToast } = useToastStore();
  const { setUrlInputUrl, urlInputUrl, urlInputAnalyzedInfo } = useUIStore();
  const lastClipRef = useRef<string>('');

  useEffect(() => {
    const handleFocus = async () => {
      try {
        // Clipboard API requires user permission & focus
        const text = await navigator.clipboard.readText();
        const trimmed = text?.trim();

        if (!trimmed) return;
        if (trimmed === lastClipRef.current) return;
        if (trimmed === urlInputUrl) return;
        if (urlInputAnalyzedInfo) return; // Already analyzing something

        if (URL_PATTERN.test(trimmed)) {
          lastClipRef.current = trimmed;
          addToast('info', `Video URL detected in clipboard: ${trimmed.substring(0, 50)}...`, 5000);
          setUrlInputUrl(trimmed);
        }
      } catch {
        // Clipboard API not available or permission denied — silently ignore
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [addToast, setUrlInputUrl, urlInputUrl, urlInputAnalyzedInfo]);
}

export default useClipboardWatcher;
