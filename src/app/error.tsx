"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { scaleIn, noMotion, springs } from "@/lib/animations";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const variants = shouldReduceMotion ? noMotion : scaleIn;

  useEffect(() => {
    console.error("Root error boundary caught:", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[oklch(0.98_0.005_15)] flex items-center justify-center p-4">
        <motion.div
          className="w-full max-w-md bg-white rounded-2xl border border-neutral-200/60 shadow-sm p-8 text-center"
          variants={variants}
          initial="hidden"
          animate="visible"
        >
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[oklch(0.55_0.22_25/0.1)]">
            <svg
              className="h-8 w-8 text-[oklch(0.55_0.22_25)]"
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

          <h1
            className="mb-2 text-xl font-bold tracking-tight text-neutral-900"
            style={{ fontFamily: "system-ui, sans-serif" }}
          >
            Algo deu errado
          </h1>

          <p className="mb-6 text-sm text-neutral-500">
            Ocorreu um erro inesperado. Tente novamente ou volte ao inicio.
          </p>

          {error.digest && (
            <p
              className="mb-4 text-xs text-neutral-400"
              style={{ fontFamily: "monospace" }}
            >
              Codigo: {error.digest}
            </p>
          )}

          <div className="flex flex-col gap-3">
            <motion.button
              onClick={reset}
              className="w-full rounded-xl bg-[oklch(0.55_0.22_25)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[oklch(0.40_0.18_25)]"
              whileHover={shouldReduceMotion ? {} : { scale: 1.05 }}
              whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
              transition={springs.snappy}
            >
              Tentar novamente
            </motion.button>
            <Link
              href="/feed"
              className="text-sm font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              Voltar ao inicio
            </Link>
          </div>
        </motion.div>
      </body>
    </html>
  );
}
