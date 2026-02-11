"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Smoothly animates a number from its previous value to the target.
 * Uses requestAnimationFrame for 60fps interpolation.
 * Respects `prefers-reduced-motion` — returns target instantly if enabled.
 *
 * @param target - The number to animate toward
 * @param duration - Animation duration in ms (default 400)
 * @returns The current interpolated integer value
 */
export function useAnimatedNumber(target: number, duration = 400): number {
  const [display, setDisplay] = useState(target);
  const prevTarget = useRef(target);
  const rafId = useRef<number | null>(null);

  // Check reduced motion preference
  const prefersReducedMotion = useRef(false);
  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }, []);

  useEffect(() => {
    // If reduced motion or duration is 0, snap immediately
    if (prefersReducedMotion.current || duration <= 0) {
      setDisplay(target);
      prevTarget.current = target;
      return;
    }

    const from = prevTarget.current;
    const to = target;
    prevTarget.current = target;

    if (from === to) return;

    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (to - from) * eased);

      setDisplay(current);

      if (progress < 1) {
        rafId.current = requestAnimationFrame(tick);
      }
    }

    rafId.current = requestAnimationFrame(tick);

    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [target, duration]);

  return display;
}
