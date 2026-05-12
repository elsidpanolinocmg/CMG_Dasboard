"use client";

import { useRef } from "react";

const SWIPE_THRESHOLD_PX = 50;
const MAX_VERTICAL_DRIFT_PX = 60;

type Options = {
  onNext: () => void;
  onPrev: () => void;
  enabled?: boolean;
};

/**
 * Returns touch handlers for left/right swipe navigation.
 * Spread the result onto the container element you want to capture swipes on.
 *
 *   const swipe = useSwipeNav({ onNext, onPrev });
 *   <div {...swipe}>...</div>
 */
export function useSwipeNav({ onNext, onPrev, enabled = true }: Options) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  return {
    onTouchStart: (e: React.TouchEvent) => {
      if (!enabled) return;
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!enabled || startX.current === null || startY.current === null) return;
      const dx = e.changedTouches[0].clientX - startX.current;
      const dy = e.changedTouches[0].clientY - startY.current;
      startX.current = null;
      startY.current = null;
      if (Math.abs(dy) > MAX_VERTICAL_DRIFT_PX) return;
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
      if (dx < 0) onNext();
      else onPrev();
    },
  };
}
