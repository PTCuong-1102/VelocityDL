import { useEffect, useRef } from 'react';
import { listen, EventCallback } from '@tauri-apps/api/event';

export function useTauriEvent<T>(eventName: string, callback: EventCallback<T>) {
  const callbackRef = useRef(callback);

  // Keep callbackRef up-to-date with the latest callback
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    let active = true;
    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const u = await listen<T>(eventName, (event) => {
          if (active) {
            callbackRef.current(event);
          }
        });
        if (!active) {
          u();
        } else {
          unlistenFn = u;
        }
      } catch (err) {
        console.error(`Failed to register Tauri event listener for ${eventName}:`, err);
      }
    };

    setupListener();

    return () => {
      active = false;
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [eventName]);
}

export default useTauriEvent;
