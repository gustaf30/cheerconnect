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
import { staggerContainer, fadeSlideUp, noMotion, noMotionContainer, stagger } from "@/lib/animations";
import { toast } from "sonner";

const registerSchema = z
  .object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    email: z.string().email("Email inválido"),
    username: z
      .string()
      .min(3, "Username deve ter pelo menos 3 caracteres")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Username pode conter apenas letras, números e underline"
      ),
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          username: data.username,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Erro ao criar conta");
        return;
      }

      toast.success("Conta criada com sucesso!");

      // Auto login after registration
      await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      router.push("/feed");
      router.refresh();
    } catch {
      toast.error("Erro ao criar conta. Tente novamente.");
    } finally {
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
      <motion.div variants={itemVariants} className="mb-8 text-left">
        <Link href="/" className="inline-block group">
          <h2 className="text-4xl font-display font-extrabold tracking-tight">
            <span className="text-gradient-primary">Cheer</span>
            <span className="text-foreground">Connect</span>
          </h2>
        </Link>
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-2 mb-8">
        <h3 className="text-3xl font-display font-bold text-foreground">
          Crie sua conta
        </h3>
        <p className="text-muted-foreground">
          Junte-se à comunidade de cheerleading do Brasil.
        </p>
      </motion.div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
      >
        <motion.div variants={itemVariants} className="floating-label-group relative flex flex-col">
          <input
            type="text"
            placeholder=" "
            disabled={isLoading}
            {...form.register("name")}
            className="peer w-full bg-transparent border-0 border-b-2 border-border py-3 focus:border-primary transition-colors duration-300 outline-none text-foreground font-medium"
          />
          <label className="absolute left-0 pointer-events-none transition-all duration-300 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
            Nome Completo
          </label>
          {form.formState.errors.name && (
            <p className="text-destructive text-sm mt-1">
              {form.formState.errors.name.message}
            </p>
          )}
        </motion.div>

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
            type="text"
            placeholder=" "
            disabled={isLoading}
            {...form.register("username")}
            className="peer w-full bg-transparent border-0 border-b-2 border-border py-3 focus:border-primary transition-colors duration-300 outline-none text-foreground font-medium"
          />
          <label className="absolute left-0 pointer-events-none transition-all duration-300 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
            Username
          </label>
          {form.formState.errors.username && (
            <p className="text-destructive text-sm mt-1">
              {form.formState.errors.username.message}
            </p>
          )}
        </motion.div>

        <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
          <div className="floating-label-group relative flex flex-col">
            <input
              type="password"
              placeholder=" "
              disabled={isLoading}
              {...form.register("password")}
              className="peer w-full bg-transparent border-0 border-b-2 border-border py-3 focus:border-primary transition-colors duration-300 outline-none text-foreground font-medium"
            />
            <label className="absolute left-0 pointer-events-none transition-all duration-300 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
              Senha
            </label>
            {form.formState.errors.password && (
              <p className="text-destructive text-sm mt-1">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <div className="floating-label-group relative flex flex-col">
            <input
              type="password"
              placeholder=" "
              disabled={isLoading}
              {...form.register("confirmPassword")}
              className="peer w-full bg-transparent border-0 border-b-2 border-border py-3 focus:border-primary transition-colors duration-300 outline-none text-foreground font-medium"
            />
            <label className="absolute left-0 pointer-events-none transition-all duration-300 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
              Confirmar Senha
            </label>
            {form.formState.errors.confirmPassword && (
              <p className="text-destructive text-sm mt-1">
                {form.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-primary hover:bg-[oklch(0.40_0.18_25)] text-primary-foreground font-bold rounded-xl transition-all duration-200 shadow-xl shadow-primary/20 active:scale-[0.98] flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Criar Conta
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </motion.div>
      </form>

      <motion.div variants={itemVariants} className="mt-8 text-center">
        <p className="text-sm text-muted-foreground font-medium">
          Já faz parte da comunidade?
          <Link
            href="/login"
            className="text-primary font-extrabold hover:text-[oklch(0.40_0.18_25)] ml-1 transition-colors"
          >
            Fazer Login
          </Link>
        </p>
      </motion.div>
    </motion.div>
  );
}
