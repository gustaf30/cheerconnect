"use client";

import { motion, useReducedMotion } from "framer-motion";
import { scaleIn, noMotion } from "@/lib/animations";

export function NotFoundCard({ children }: { children: React.ReactNode }) {
  const shouldReduceMotion = useReducedMotion();
  const variants = shouldReduceMotion ? noMotion : scaleIn;

  return (
    <motion.div
      className="bento-card-static w-full max-w-md p-8 text-center"
      variants={variants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}
