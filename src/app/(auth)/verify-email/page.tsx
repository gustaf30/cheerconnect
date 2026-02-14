"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Mail, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified") === "true";
  const error = searchParams.get("error");
  const emailParam = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(emailParam);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const handleResend = useCallback(async () => {
    if (!email || cooldown > 0) return;

    setIsResending(true);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.status === 429) {
        toast.error("Muitas tentativas. Aguarde um momento.");
        return;
      }

      if (!response.ok) {
        toast.error("Erro ao reenviar. Tente novamente.");
        return;
      }

      toast.success("Se o email estiver cadastrado, enviaremos um novo link!");

      // Cooldown de 60 segundos
      setCooldown(60);
      const interval = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setIsResending(false);
    }
  }, [email, cooldown]);

  if (verified) {
    return (
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
        </div>
        <h2 className="text-3xl font-display font-bold text-foreground">
          Email verificado!
        </h2>
        <p className="text-muted-foreground">
          Sua conta foi ativada com sucesso. Agora voce pode fazer login.
        </p>
        <Link
          href="/login"
          className="inline-block py-3 px-8 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded-xl transition-base shadow-depth-2"
        >
          Fazer Login
        </Link>
      </div>
    );
  }

  if (error) {
    const errorMessages: Record<string, string> = {
      "invalid-token": "Link de verificacao invalido ou expirado.",
      "token-expired": "O link de verificacao expirou.",
      "verification-failed": "Erro ao verificar email. Tente novamente.",
    };

    return (
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <XCircle className="h-16 w-16 text-destructive" />
        </div>
        <h2 className="text-3xl font-display font-bold text-foreground">
          Erro na verificacao
        </h2>
        <p className="text-muted-foreground">
          {errorMessages[error] || "Ocorreu um erro inesperado."}
        </p>

        <div className="space-y-3 max-w-sm mx-auto">
          <p className="text-sm text-muted-foreground">
            Solicite um novo link de verificação:
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Seu email"
            className="w-full bg-transparent border-0 border-b-2 border-border py-3 focus:border-primary transition-fast outline-none text-foreground font-medium text-center"
          />
          <button
            onClick={handleResend}
            disabled={isResending || cooldown > 0 || !email}
            className="w-full py-3 px-8 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded-xl transition-base shadow-depth-2 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isResending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {cooldown > 0
              ? `Reenviar em ${cooldown}s`
              : "Reenviar email de verificação"}
          </button>
        </div>

        <Link
          href="/login"
          className="inline-block text-sm text-muted-foreground hover:text-foreground transition-fast"
        >
          Voltar para Login
        </Link>
      </div>
    );
  }

  // Default: instruction to check email
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <Mail className="h-16 w-16 text-primary" />
      </div>
      <h2 className="text-3xl font-display font-bold text-foreground">
        Verifique seu email
      </h2>
      <p className="text-muted-foreground">
        Enviamos um link de verificacao para o seu email. Clique no link para
        ativar sua conta.
      </p>
      <p className="text-sm text-muted-foreground">
        Nao recebeu? Verifique sua pasta de spam.
      </p>

      <div className="space-y-3 max-w-sm mx-auto">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Seu email"
          className="w-full bg-transparent border-0 border-b-2 border-border py-3 focus:border-primary transition-fast outline-none text-foreground font-medium text-center"
        />
        <button
          onClick={handleResend}
          disabled={isResending || cooldown > 0 || !email}
          className="w-full py-3 px-8 bg-secondary hover:bg-secondary/80 text-foreground font-bold rounded-xl transition-base disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isResending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {cooldown > 0
            ? `Reenviar em ${cooldown}s`
            : "Reenviar email de verificação"}
        </button>
      </div>

      <Link
        href="/login"
        className="inline-block py-3 px-8 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded-xl transition-base shadow-depth-2"
      >
        Voltar para Login
      </Link>
    </div>
  );
}
