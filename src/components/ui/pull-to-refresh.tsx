import React from "react";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  children: React.ReactNode;
  threshold?: number;
  onRefresh?: () => void | Promise<void>;
  className?: string;
}

export function PullToRefresh({
  children,
  threshold = 80,
  onRefresh,
  className,
}: PullToRefreshProps) {
  const { elementRef, isRefreshing, pullDistance, threshold: hookThreshold } = usePullToRefresh({
    threshold,
    onRefresh,
  });

  const progress = Math.min((pullDistance / hookThreshold) * 100, 100);
  const showIndicator = pullDistance > 0;
  const isThresholdMet = pullDistance >= hookThreshold;

  return (
    <div 
      ref={elementRef} 
      className={cn("pull-to-refresh-container relative", className)}
    >
      {/* Pull indicator */}
      {showIndicator && (
        <div className="pull-to-refresh-indicator absolute top-0 left-0 right-0 z-50 flex justify-center items-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 py-4">
            {isRefreshing ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-muted-foreground">Refreshing...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <div className="w-6 h-6 border-2 border-muted-foreground/30 rounded-full relative">
                  <div
                    className={cn(
                      "absolute inset-0 border-2 rounded-full transition-all duration-200",
                      isThresholdMet ? "border-primary" : "border-muted-foreground/50"
                    )}
                    style={{
                      clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%)`,
                      transform: `rotate(${progress * 3.6}deg)`,
                    }}
                  />
                </div>
                <span className={cn(
                  "text-xs transition-colors duration-200",
                  isThresholdMet ? "text-primary" : "text-muted-foreground"
                )}>
                  {isThresholdMet ? "Release to refresh" : "Pull to refresh"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Content */}
      <div
        className={cn(
          "transition-all duration-200 ease-out",
          showIndicator && "transform"
        )}
        style={{
          transform: showIndicator ? `translateY(${Math.min(pullDistance * 0.3, 20)}px)` : "none",
          opacity: showIndicator ? 0.95 : 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}
