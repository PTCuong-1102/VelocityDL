import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Global keyboard shortcuts for VelocityDL.
 *
 * Ctrl+1/2/3/4 → Dashboard / Queue / Finished / Settings
 * Escape → back to Dashboard
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        // Only allow Escape through
        if (e.key !== 'Escape') return;
      }

      // Ctrl+Number navigation
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            navigate('/');
            break;
          case '2':
            e.preventDefault();
            navigate('/queue');
            break;
          case '3':
            e.preventDefault();
            navigate('/finished');
            break;
          case '4':
            e.preventDefault();
            navigate('/settings');
            break;
        }
        return;
      }

      // Escape → back to Dashboard (unless already there)
      if (e.key === 'Escape' && window.location.hash !== '#/') {
        navigate('/');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
}

export default useKeyboardShortcuts;
