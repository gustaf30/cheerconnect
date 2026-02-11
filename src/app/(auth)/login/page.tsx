"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { staggerContainer, fadeSlideUp, noMotion, noMotionContainer, stagger, springs } from "@/lib/animations";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Login realizado com sucesso!");
      router.push("/feed");
      router.refresh();
    } catch {
      toast.error("Erro ao fazer login. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await signIn("google", { callbackUrl: "/feed" });
    } catch {
      toast.error("Erro ao fazer login com Google.");
      setIsLoading(false);
    }
  };

  const shouldReduceMotion = useReducedMotion();
  const containerVariants = shouldReduceMotion
    ? noMotionContainer
    : staggerContainer(stagger.default, 0.15);
  const itemVariants = shouldReduceMotion ? noMotion : fadeSlideUp;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Mobile Logo */}
      <motion.div variants={itemVariants} className="mb-12 text-left">
        <Link href="/" className="inline-block group">
          <h2 className="text-4xl font-display font-extrabold tracking-tight">
            <span className="text-gradient-primary">Cheer</span>
            <span className="text-foreground">Connect</span>
          </h2>
        </Link>
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-2 mb-10">
        <h3 className="text-3xl font-display font-bold text-foreground">
          Bem-vindo de volta
        </h3>
        <p className="text-muted-foreground">
          Acesse sua conta para continuar sua jornada.
        </p>
      </motion.div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-8"
      >
        <motion.div variants={itemVariants} className="floating-label-group relative flex flex-col">
          <input
            type="email"
            placeholder=" "
            disabled={isLoading}
            {...form.register("email")}
            className="peer w-full bg-transparent border-0 border-b-2 border-border py-3 focus:border-primary transition-colors duration-300 outline-none text-foreground font-medium"
          />
          <label className="absolute left-0 pointer-events-none transition-all duration-300 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
            Endereço de Email
          </label>
          {form.formState.errors.email && (
            <p className="text-destructive text-sm mt-1">
              {form.formState.errors.email.message}
            </p>
          )}
        </motion.div>

        <motion.div variants={itemVariants} className="floating-label-group relative flex flex-col">
          <input
            type="password"
            placeholder=" "
            disabled={isLoading}
            {...form.register("password")}
            className="peer w-full bg-transparent border-0 border-b-2 border-border py-3 focus:border-primary transition-colors duration-300 outline-none text-foreground font-medium"
          />
          <label className="absolute left-0 pointer-events-none transition-all duration-300 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
            Sua Senha
          </label>
          {form.formState.errors.password && (
            <p className="text-destructive text-sm mt-1">
              {form.formState.errors.password.message}
            </p>
          )}
        </motion.div>

        <motion.div variants={itemVariants} className="pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-primary hover:bg-[oklch(0.40_0.18_25)] text-primary-foreground font-bold rounded-xl transition-all duration-200 shadow-xl shadow-primary/20 active:scale-[0.98] flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Acessar Plataforma
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </motion.div>
      </form>

      <motion.div variants={itemVariants} className="relative my-10">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-4 text-muted-foreground font-bold tracking-widest">
            ou entre com
          </span>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="flex items-center justify-center gap-3 w-full py-4 bg-card border-2 border-border rounded-xl font-bold text-foreground hover:border-primary/30 hover:bg-accent transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
        >
          <svg className="size-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continuar com Google
        </button>
      </motion.div>

      <motion.div variants={itemVariants} className="mt-12 text-center">
        <p className="text-sm text-muted-foreground font-medium">
          Ainda não faz parte da comunidade?
          <Link
            href="/register"
            className="text-primary font-extrabold hover:text-[oklch(0.40_0.18_25)] ml-1 transition-colors"
          >
            Criar Conta Grátis
          </Link>
        </p>
      </motion.div>
    </motion.div>
  );
}
