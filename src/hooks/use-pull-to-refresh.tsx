import { useEffect, useRef, useState, useCallback } from "react";

interface PullToRefreshOptions {
  threshold?: number;
  onRefresh?: () => void | Promise<void>;
  enabled?: boolean;
}

export function usePullToRefresh(options: PullToRefreshOptions = {}) {
  const { threshold = 80, onRefresh, enabled = true } = options;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const elementRef = useRef<HTMLDivElement>(null);
  const isPulling = useRef<boolean>(false);
  const hasScrolled = useRef<boolean>(false);

  const resetPull = useCallback(() => {
    setPullDistance(0);
    isPulling.current = false;
    hasScrolled.current = false;
  }, []);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    resetPull();
    
    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        // Default behavior: reload the page
        window.location.reload();
      }
    } catch (error) {
      console.error('Pull to refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, onRefresh, resetPull]);

  useEffect(() => {
    if (!enabled) return;
    
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only enable pull-to-refresh when at the top of the page and not already pulling
      if (window.scrollY === 0 && !isPulling.current && !isRefreshing) {
        startY.current = e.touches[0].clientY;
        isPulling.current = true;
        hasScrolled.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshing) return;

      currentY.current = e.touches[0].clientY;
      const distance = currentY.current - startY.current;

      // Check if user has scrolled horizontally (swipe left/right)
      const startX = e.touches[0].clientX;
      if (Math.abs(startX - (e.touches[0].clientX || startX)) > 10) {
        hasScrolled.current = true;
        return;
      }

      // Only allow downward pulling
      if (distance > 0 && !hasScrolled.current) {
        e.preventDefault();
        const newDistance = Math.min(distance * 0.5, threshold * 2);
        setPullDistance(newDistance);
      }
    };

    const handleTouchEnd = () => {
      if (!isPulling.current || isRefreshing) return;

      if (pullDistance >= threshold && !hasScrolled.current) {
        handleRefresh();
      } else {
        // Reset pull distance if threshold not met or user scrolled horizontally
        resetPull();
      }
    };

    const handleScroll = () => {
      // Disable pull-to-refresh if user scrolls down
      if (window.scrollY > 0 && isPulling.current) {
        resetPull();
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [enabled, threshold, pullDistance, isRefreshing, handleRefresh, resetPull]);

  return {
    elementRef,
    isRefreshing,
    pullDistance,
    threshold,
    resetPull,
  };
}
