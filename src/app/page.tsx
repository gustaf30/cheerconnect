import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Users, Trophy, Calendar, Search, ArrowRight } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-primary">Cheer</span>
            <span>Connect</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link href="/register">
              <Button>Cadastrar</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex items-center">
        <div className="container py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                A rede social para quem vive o{" "}
                <span className="text-primary">cheerleading</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-lg">
                Conecte-se com atletas, técnicos e equipes. Compartilhe suas
                conquistas e encontre novas oportunidades na comunidade de
                cheerleading.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/register">
                  <Button size="lg" className="w-full sm:w-auto">
                    Comece agora
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    Já tenho conta
                  </Button>
                </Link>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/5 rounded-3xl blur-3xl" />
                <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl p-8 border">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-background rounded-xl p-6 shadow-sm">
                      <div className="text-3xl font-bold text-primary">500+</div>
                      <div className="text-sm text-muted-foreground">
                        Atletas conectados
                      </div>
                    </div>
                    <div className="bg-background rounded-xl p-6 shadow-sm">
                      <div className="text-3xl font-bold text-primary">50+</div>
                      <div className="text-sm text-muted-foreground">
                        Equipes cadastradas
                      </div>
                    </div>
                    <div className="bg-background rounded-xl p-6 shadow-sm">
                      <div className="text-3xl font-bold text-primary">20+</div>
                      <div className="text-sm text-muted-foreground">
                        Eventos mensais
                      </div>
                    </div>
                    <div className="bg-background rounded-xl p-6 shadow-sm">
                      <div className="text-3xl font-bold text-primary">100%</div>
                      <div className="text-sm text-muted-foreground">
                        Gratuito
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/30 py-20">
        <div className="container">
          <h2 className="text-3xl font-bold text-center mb-12">
            Tudo que você precisa em um só lugar
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-background rounded-xl p-6 shadow-sm border hover:shadow-md transition-shadow"
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container text-center">
          <h2 className="text-3xl font-bold mb-4">
            Pronto para fazer parte da comunidade?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Cadastre-se gratuitamente e comece a conectar-se com a comunidade de
            cheerleading hoje mesmo.
          </p>
          <Link href="/register">
            <Button size="lg">
              Criar minha conta
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} CheerConnect. Projeto de TCC.
          </p>
        </div>
      </footer>
    </div>
  );
}
