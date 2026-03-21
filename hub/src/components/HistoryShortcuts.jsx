import { useEffect } from 'react';

export default function HistoryShortcuts({ undo, redo }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return null;
}
