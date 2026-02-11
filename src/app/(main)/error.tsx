"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { scaleIn, noMotion, springs } from "@/lib/animations";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const variants = shouldReduceMotion ? noMotion : scaleIn;

  useEffect(() => {
    console.error("Main layout error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <motion.div
        className="bento-card-static w-full max-w-md p-8 text-center"
        variants={variants}
        initial="hidden"
        animate="visible"
      >
        <div className="accent-bar mb-6 rounded-t-2xl -mt-8 -mx-8" />

        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <svg
            className="h-8 w-8 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        <h1 className="font-display mb-2 text-xl font-bold tracking-tight">
          Algo deu errado
        </h1>

        <p className="font-body mb-6 text-sm text-muted-foreground">
          Ocorreu um erro inesperado. Tente novamente ou volte ao inicio.
        </p>

        {error.digest && (
          <p className="font-mono mb-4 text-xs text-muted-foreground/60">
            Codigo: {error.digest}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <motion.button
            onClick={reset}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[oklch(0.40_0.18_25)]"
            whileHover={shouldReduceMotion ? {} : { scale: 1.05 }}
            whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
            transition={springs.snappy}
          >
            Tentar novamente
          </motion.button>
          <Link
            href="/feed"
            className="font-body text-sm font-medium text-muted-foreground hover:text-foreground transition-fast"
          >
            Voltar ao inicio
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
