"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useIsMounted } from "@/hooks/use-is-mounted";

const pageVariants = {
  initial: {
    opacity: 0,
    y: 8,
    filter: "blur(4px)"
  },
  enter: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.3,
      ease: [0.45, 0, 0.15, 1] // ease-luxury
    }
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: "blur(4px)",
    transition: {
      duration: 0.2
    }
  }
};

const reducedMotionVariants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } }
};

export function PageTransitionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const isMounted = useIsMounted();

  // Skip animation on initial SSR render to avoid hydration mismatch
  // Use initial={false} on first mount, then enable animations for navigation
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        variants={shouldReduceMotion ? reducedMotionVariants : pageVariants}
        initial={isMounted ? "initial" : false}
        animate="enter"
        exit="exit"
        suppressHydrationWarning
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
