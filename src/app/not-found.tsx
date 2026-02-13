import Link from "next/link";
import { NotFoundCard } from "./not-found-card";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <NotFoundCard>
        <div className="accent-bar mb-8 rounded-t-2xl -mt-8 -mx-8" />

        <p className="font-mono text-7xl font-bold tracking-tighter text-primary/20 mb-4">
          404
        </p>

        <h1 className="font-display text-xl font-bold tracking-tight mb-2">
          Pagina nao encontrada
        </h1>

        <p className="font-body text-sm text-muted-foreground mb-8">
          A pagina que voce procura nao existe ou foi removida.
        </p>

        <Link
          href="/feed"
          className="inline-flex items-center justify-center w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-base hover:bg-primary-hover"
        >
          Voltar ao inicio
        </Link>
      </NotFoundCard>
    </div>
  );
}
