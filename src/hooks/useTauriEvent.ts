import { useEffect } from 'react';
import { listen, EventCallback } from '@tauri-apps/api/event';

export function useTauriEvent<T>(eventName: string, callback: EventCallback<T>) {
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      try {
        unlisten = await listen<T>(eventName, callback);
      } catch (err) {
        console.error(`Failed to register Tauri event listener for ${eventName}:`, err);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [eventName, callback]);
}

export default useTauriEvent;
