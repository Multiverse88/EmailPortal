'use client';

import { useEffect } from 'react';

/**
 * Global handler to prevent default browser behavior when files or text
 * are dragged and dropped over any page.
 * Without this, dropping a file causes modern browsers (Firefox/Chrome)
 * to attempt navigation to file:///..., triggering:
 * "Security Error: Content at https://... may not load or link to file:///."
 */
export function GlobalDropHandler() {
  useEffect(() => {
    const prevent = (e: DragEvent) => {
      e.preventDefault();
    };

    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);

    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  return null;
}
