"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Users, Trophy, Calendar, Search, ArrowRight, Sparkles } from "lucide-react";
import {
  staggerContainer,
  fadeSlideUp,
  scaleIn,
  noMotion,
  noMotionContainer,
  springs,
  stagger,
} from "@/lib/animations";
import { useAnimatedNumber } from "@/hooks/use-animated-number";

const iconMap = { Users, Trophy, Calendar, Search } as const;

// ─── Hero Section ──────────────────────────────────────────────

export function LandingHero() {
  const shouldReduceMotion = useReducedMotion();
  const containerVariants = shouldReduceMotion
    ? noMotionContainer
    : staggerContainer(stagger.slow);
  const itemVariants = shouldReduceMotion ? noMotion : fadeSlideUp;

  return (
    <motion.div
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        variants={itemVariants}
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 text-sm font-bold text-primary"
      >
        <Sparkles className="h-4 w-4" />
        A maior rede de cheerleading do Brasil
      </motion.div>

      <motion.h1
        variants={itemVariants}
        className="text-5xl md:text-6xl lg:text-7xl font-display font-extrabold tracking-tight leading-[1.1]"
      >
        A rede social para quem vive o{" "}
        <span className="text-gradient-primary">cheerleading</span>
      </motion.h1>

      <motion.p
        variants={itemVariants}
        className="text-xl text-muted-foreground max-w-lg leading-relaxed font-light"
      >
        Conecte-se com atletas, tecnicos e equipes. Compartilhe suas
        conquistas e encontre novas oportunidades na comunidade.
      </motion.p>

      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row gap-4 pt-4"
      >
        <Link href="/register">
          <button className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-[oklch(0.40_0.18_25)] text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-xl shadow-primary/20 flex items-center justify-center gap-2 group">
            Comece agora
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </Link>
        <Link href="/login">
          <button className="w-full sm:w-auto px-8 py-4 border-2 border-border text-foreground font-bold rounded-xl hover:border-primary/30 hover:bg-accent transition-all active:scale-[0.98]">
            Ja tenho conta
          </button>
        </Link>
      </motion.div>
    </motion.div>
  );
}

// ─── Animated Stat Card ────────────────────────────────────────

function StatCard({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const display = useAnimatedNumber(value, 600);
  return (
    <div className="bento-card-static p-8 text-center">
      <div className="accent-bar" />
      <div className="font-mono text-4xl font-bold text-primary mb-2">
        {display}{suffix}
      </div>
      <div className="text-sm text-muted-foreground font-medium">
        {label}
      </div>
    </div>
  );
}

// ─── Stats Grid ────────────────────────────────────────────────

interface StatData {
  value: number;
  suffix: string;
  label: string;
}

export function LandingStats({ stats }: { stats: StatData[] }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="grid grid-cols-2 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
          whileInView={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={
            shouldReduceMotion
              ? { duration: 0.15 }
              : { ...springs.gentle, delay: index * 0.1 }
          }
        >
          <StatCard value={stat.value} suffix={stat.suffix} label={stat.label} />
        </motion.div>
      ))}
    </div>
  );
}

// ─── Features Grid ─────────────────────────────────────────────

interface FeatureData {
  icon: keyof typeof iconMap;
  title: string;
  description: string;
}

export function LandingFeatures({ features }: { features: FeatureData[] }) {
  const shouldReduceMotion = useReducedMotion();
  const containerVariants = shouldReduceMotion
    ? noMotionContainer
    : staggerContainer(stagger.default);
  const itemVariants = shouldReduceMotion ? noMotion : fadeSlideUp;

  return (
    <motion.div
      className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      {features.map((feature) => {
        const Icon = iconMap[feature.icon];
        return (
          <motion.div
            key={feature.title}
            variants={itemVariants}
            className="bento-card-static group"
          >
            <div className="accent-bar" />
            <div className="p-6">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display font-bold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ─── CTA Section ───────────────────────────────────────────────

export function LandingCTA() {
  const shouldReduceMotion = useReducedMotion();
  const variants = shouldReduceMotion ? noMotion : scaleIn;

  return (
    <motion.div
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="bento-card-static bg-primary text-white overflow-hidden relative"
    >
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
    </motion.div>
  );
}
