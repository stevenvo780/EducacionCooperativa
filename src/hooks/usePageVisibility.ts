'use client';

import { useEffect, useState } from 'react';

export function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const updateVisibility = () => {
      setIsVisible(!document.hidden);
    };

    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);

    return () => {
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  return isVisible;
}

export default usePageVisibility;