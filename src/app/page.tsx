import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { LandingHero, LandingStats, LandingFeatures, LandingCTA } from "./landing-sections";

export default async function LandingPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/feed");
  }

  const features = [
    {
      icon: "Users" as const,
      title: "Conecte-se",
      description:
        "Encontre atletas, técnicos e equipes de cheerleading em todo o Brasil.",
    },
    {
      icon: "Trophy" as const,
      title: "Compartilhe conquistas",
      description:
        "Mostre suas vitórias, certificações e momentos especiais da sua carreira.",
    },
    {
      icon: "Calendar" as const,
      title: "Acompanhe eventos",
      description:
        "Fique por dentro de competições, workshops e tryouts próximos.",
    },
    {
      icon: "Search" as const,
      title: "Encontre oportunidades",
      description:
        "Descubra equipes procurando novos membros e oportunidades de coaching.",
    },
  ];

  const stats = [
    { value: 500, suffix: "+", label: "Atletas conectados" },
    { value: 50, suffix: "+", label: "Equipes cadastradas" },
    { value: 20, suffix: "+", label: "Eventos mensais" },
    { value: 100, suffix: "%", label: "Gratuito" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full h-16 glass flex items-center justify-between px-6 md:px-12">
        <Link
          href="/"
          className="flex items-center gap-0.5 font-display font-extrabold text-2xl tracking-tight group"
        >
          <span className="text-primary transition-base group-hover:opacity-90">
            Cheer
          </span>
          <span className="text-foreground transition-base group-hover:text-primary/80">
            Connect
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <button className="px-5 py-2 text-sm font-bold text-foreground hover:text-primary transition-colors">
              Entrar
            </button>
          </Link>
          <Link href="/register">
            <button className="px-5 py-2.5 bg-primary hover:bg-[oklch(0.40_0.18_25)] text-white text-sm font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-primary/20">
              Cadastrar
            </button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex items-center px-6 md:px-12">
        <div className="max-w-[1440px] mx-auto w-full py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <LandingHero />

            {/* Stats Bento Grid */}
            <div className="hidden lg:block">
              <LandingStats stats={stats} />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 md:px-12 py-24 bg-secondary/30">
        <div className="max-w-[1440px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Tudo que você precisa em um só lugar
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Uma plataforma completa para a comunidade de cheerleading.
            </p>
          </div>

          <LandingFeatures features={features} />
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 md:px-12 py-24">
        <div className="max-w-[1440px] mx-auto">
          <LandingCTA />
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-8 border-t">
        <div className="max-w-[1440px] mx-auto flex justify-between items-center">
          <Link
            href="/"
            className="font-display font-extrabold text-lg"
          >
            <span className="text-primary">Cheer</span>
            <span className="text-foreground">Connect</span>
          </Link>
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
            &copy; {new Date().getFullYear()} CheerConnect
          </p>
        </div>
      </footer>
    </div>
  );
}
