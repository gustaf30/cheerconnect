"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Mail } from "lucide-react";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified") === "true";
  const error = searchParams.get("error");

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
      "token-expired": "O link de verificacao expirou. Registre-se novamente.",
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
        <Link
          href="/register"
          className="inline-block py-3 px-8 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded-xl transition-base shadow-depth-2"
        >
          Registrar novamente
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
        Nao recebeu o email? Verifique sua pasta de spam ou{" "}
        <Link href="/register" className="text-primary font-bold hover:text-primary-hover transition-fast">
          registre-se novamente
        </Link>
        .
      </p>
    </div>
  );
}
