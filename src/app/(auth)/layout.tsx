export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row overflow-hidden bg-gradient-to-br from-background to-secondary">
      {/* Left Brand Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-primary flex-col justify-center px-16 xl:px-24 text-white overflow-hidden">
        {/* Abstract pattern */}
        <div className="absolute inset-0 split-pattern" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-black/10 rounded-full blur-3xl" />

        <div className="relative z-10 space-y-8">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-sm font-semibold">
            <span>A maior rede de cheerleading do Brasil</span>
          </div>

          <h1 className="text-6xl xl:text-7xl font-display font-extrabold leading-[1.1] tracking-tight">
            Impulsione sua <br />
            <span className="text-white/80">carreira</span> hoje.
          </h1>

          <p className="text-lg xl:text-xl text-white/70 max-w-lg leading-relaxed font-light">
            Conecte-se com atletas, treinadores e equipes em uma plataforma
            desenhada exclusivamente para o nosso esporte.
          </p>

          <div className="flex items-center gap-6 pt-8">
            <div className="flex -space-x-3">
              <div className="w-12 h-12 rounded-full border-2 border-primary bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <span className="text-xs font-bold">+5k</span>
              </div>
            </div>
            <p className="text-sm text-white/60">
              Junte-se a milhares de <br /> cheers profissionais.
            </p>
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-24 xl:px-32 py-12 relative">
        <div className="w-full max-w-md mx-auto animate-slide-in-right">
          {children}
        </div>

        {/* Footer */}
        <div className="absolute bottom-8 left-0 right-0 px-6 sm:px-12 lg:px-24 xl:px-32 flex justify-between items-center opacity-40">
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
            &copy; {new Date().getFullYear()} CheerConnect
          </p>
        </div>
      </div>
    </div>
  );
}
