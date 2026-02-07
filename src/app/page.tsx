import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Users, Trophy, Calendar, Search, ArrowRight, Sparkles } from "lucide-react";
import { authOptions } from "@/lib/auth";

export default async function LandingPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/feed");
  }

  const features = [
    {
      icon: Users,
      title: "Conecte-se",
      description:
        "Encontre atletas, técnicos e equipes de cheerleading em todo o Brasil.",
    },
    {
      icon: Trophy,
      title: "Compartilhe conquistas",
      description:
        "Mostre suas vitórias, certificações e momentos especiais da sua carreira.",
    },
    {
      icon: Calendar,
      title: "Acompanhe eventos",
      description:
        "Fique por dentro de competições, workshops e tryouts próximos.",
    },
    {
      icon: Search,
      title: "Encontre oportunidades",
      description:
        "Descubra equipes procurando novos membros e oportunidades de coaching.",
    },
  ];

  const stats = [
    { value: "500+", label: "Atletas conectados" },
    { value: "50+", label: "Equipes cadastradas" },
    { value: "20+", label: "Eventos mensais" },
    { value: "100%", label: "Gratuito" },
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
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 text-sm font-bold text-primary">
                <Sparkles className="h-4 w-4" />
                A maior rede de cheerleading do Brasil
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-extrabold tracking-tight leading-[1.1]">
                A rede social para quem vive o{" "}
                <span className="text-gradient-primary">cheerleading</span>
              </h1>

              <p className="text-xl text-muted-foreground max-w-lg leading-relaxed font-light">
                Conecte-se com atletas, técnicos e equipes. Compartilhe suas
                conquistas e encontre novas oportunidades na comunidade.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link href="/register">
                  <button className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-[oklch(0.40_0.18_25)] text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-xl shadow-primary/20 flex items-center justify-center gap-2 group">
                    Comece agora
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </Link>
                <Link href="/login">
                  <button className="w-full sm:w-auto px-8 py-4 border-2 border-border text-foreground font-bold rounded-xl hover:border-primary/30 hover:bg-accent transition-all active:scale-[0.98]">
                    Já tenho conta
                  </button>
                </Link>
              </div>
            </div>

            {/* Stats Bento Grid */}
            <div className="hidden lg:block">
              <div className="grid grid-cols-2 gap-4">
                {stats.map((stat, index) => (
                  <div
                    key={stat.label}
                    className="bento-card-static p-8 text-center"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="accent-bar" />
                    <div className="font-mono text-4xl font-bold text-primary mb-2">
                      {stat.value}
                    </div>
                    <div className="text-sm text-muted-foreground font-medium">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
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

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="bento-card-static group"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="accent-bar" />
                <div className="p-6">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-display font-bold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 md:px-12 py-24">
        <div className="max-w-[1440px] mx-auto">
          <div className="bento-card-static bg-primary text-white overflow-hidden relative">
            <div className="absolute inset-0 split-pattern" />
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
            <div className="relative z-10 p-12 md:p-16 text-center">
              <h2 className="text-3xl md:text-4xl font-display font-extrabold mb-4">
                Pronto para fazer parte da comunidade?
              </h2>
              <p className="text-white/70 mb-8 max-w-md mx-auto font-light text-lg">
                Cadastre-se gratuitamente e comece a conectar-se com a comunidade de
                cheerleading hoje mesmo.
              </p>
              <Link href="/register">
                <button className="px-8 py-4 bg-white text-primary font-bold rounded-xl hover:bg-white/90 transition-all active:scale-[0.98] shadow-xl inline-flex items-center gap-2 group">
                  Criar minha conta
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
            </div>
          </div>
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
