import type { Variants, Transition } from "framer-motion";

// ─── Spring Presets ──────────────────────────────────────────────

export const springs = {
  /** Default — matches existing feed stagger (260/28) */
  default: { type: "spring" as const, stiffness: 260, damping: 28 },
  /** Snappy — quick interactive feedback */
  snappy: { type: "spring" as const, stiffness: 400, damping: 25 },
  /** Gentle — slow, elegant entrances */
  gentle: { type: "spring" as const, stiffness: 180, damping: 24 },
  /** Bouncy — celebratory, playful */
  bouncy: { type: "spring" as const, stiffness: 300, damping: 15 },
} satisfies Record<string, Transition>;

// ─── Stagger Timing ──────────────────────────────────────────────

export const stagger = {
  /** 50ms — small items (nav, badges, messages) */
  fast: 0.05,
  /** 80ms — standard cards */
  default: 0.08,
  /** 120ms — hero sections, large reveals */
  slow: 0.12,
} as const;

// ─── Reusable Variants ──────────────────────────────────────────

/**
 * Stagger container — wraps children that use item variants.
 * @param staggerDelay — seconds between children (default 0.08)
 * @param delayChildren — initial delay before first child (default 0)
 */
export function staggerContainer(
  staggerDelay: number = stagger.default,
  delayChildren: number = 0
): Variants {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren,
      },
    },
  };
}

/** Fade + slide up — standard item entrance */
export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springs.default,
  },
};

/** Slide from left — incoming messages from others */
export const slideFromLeft: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: springs.default,
  },
};

/** Slide from right — own messages, right-aligned entrances */
export const slideFromRight: Variants = {
  hidden: { opacity: 0, x: 16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: springs.default,
  },
};

/** Scale in — popovers, modals, celebratory items */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springs.default,
  },
};

/** Tab content — smooth tab panel transitions */
export const tabContent: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.15, ease: [0.25, 0.1, 0.25, 1] },
  },
};

/** No motion — reduced-motion fallback (instant) */
export const noMotion: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

/** No motion container — reduced-motion stagger fallback */
export const noMotionContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
};
