"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { MapPin, Briefcase, UserPlus, UserMinus, Clock, Check, Pencil, MessageSquare } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useAnimatedNumber } from "@/hooks/use-animated-number";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn, getInitials } from "@/lib/utils";
import { positionLabels } from "@/lib/constants";

interface ProfileHeaderProps {
  user: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
    banner: string | null;
    bio: string | null;
    location: string | null;
    positions: string[];
    experience: number | null;
    skills: string[];
  };
  isOwnProfile: boolean;
  connectionStatus: "none" | "pending" | "connected" | "received";
  connectionsCount: number;
  postsCount: number;
}

export function ProfileHeader({
  user,
  isOwnProfile,
  connectionStatus,
  connectionsCount,
  postsCount,
}: ProfileHeaderProps) {
  const router = useRouter();
  const [status, setStatus] = useState(connectionStatus);
  const [isLoading, setIsLoading] = useState(false);
  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const animatedConnectionsCount = useAnimatedNumber(connectionsCount);
  const animatedPostsCount = useAnimatedNumber(postsCount);

  const handleConnection = async () => {
    setIsLoading(true);
    try {
      if (status === "none") {
        const response = await fetch("/api/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receiverId: user.id }),
        });

        if (!response.ok) throw new Error();

        setStatus("pending");
        toast.success("Solicitação de conexão enviada!");
      } else if (status === "received") {
        const response = await fetch(`/api/connections/${user.id}/accept`, {
          method: "POST",
        });

        if (!response.ok) throw new Error();

        setStatus("connected");
        toast.success("Conexão aceita!");
      } else if (status === "connected" || status === "pending") {
        const response = await fetch(`/api/connections/${user.id}`, {
          method: "DELETE",
        });

        if (!response.ok) throw new Error();

        setStatus("none");
        toast.success(
          status === "connected"
            ? "Conexão removida"
            : "Solicitação cancelada"
        );
      }
    } catch {
      toast.error("Erro ao processar conexão");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartConversation = async () => {
    setIsStartingConversation(true);
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: user.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao iniciar conversa");
      }

      const data = await response.json();
      router.push(`/messages/${data.conversation.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao iniciar conversa");
    } finally {
      setIsStartingConversation(false);
    }
  };

  return (
    <div className="bento-card-static overflow-hidden animate-fade-in">
      <div className="accent-bar" />
      {/* Capa */}
      <div className="h-32 sm:h-48 bg-gradient-to-br from-primary via-primary/60 to-[oklch(0.40_0.18_25)] relative overflow-hidden">
        {user.banner ? (
          <Image
            src={user.banner}
            alt={`Banner de ${user.name}`}
            fill
            sizes="(max-width: 640px) 100vw, 840px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-[oklch(0.40_0.18_25)]" />
        )}
      </div>

      {/* Informações do perfil */}
      <div className="px-4 sm:px-6 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-12 sm:-mt-16">
          <div>
            <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-background shadow-depth-4 transition-slow avatar-glow">
              <AvatarImage src={user.avatar || undefined} alt={user.name} className="object-cover" />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl sm:text-4xl font-display font-bold">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="mt-4 sm:mt-0 flex gap-2">
            {isOwnProfile ? (
              <Link href="/profile/edit">
                <Button variant="outline" className="hover:border-primary/50 hover:text-primary transition-fast">
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar perfil
                </Button>
              </Link>
            ) : (
              <>
                {status === "connected" && (
                  <Button
                    onClick={handleStartConversation}
                    disabled={isStartingConversation}
                    variant="outline"
                    className="hover:border-primary/50 hover:text-primary transition-fast"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Mensagem
                  </Button>
                )}
                <motion.div
                  whileHover={shouldReduceMotion ? {} : { scale: 1.05 }}
                  whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Button
                    onClick={handleConnection}
                    disabled={isLoading}
                    variant={status === "connected" ? "outline" : status === "none" ? "premium" : "default"}
                    className={cn(
                      "transition-slow",
                      status === "pending" && "animate-pulse-ring"
                    )}
                  >
                    {status === "none" && (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Conectar
                      </>
                    )}
                    {status === "pending" && (
                      <>
                        <Clock className="h-4 w-4 mr-2" />
                        Pendente
                      </>
                    )}
                    {status === "received" && (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Aceitar
                      </>
                    )}
                    {status === "connected" && (
                      <>
                        <UserMinus className="h-4 w-4 mr-2" />
                        Conectado
                      </>
                    )}
                  </Button>
                </motion.div>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <h1 className="heading-section">{user.name}</h1>
            <p className="text-muted-foreground font-mono">@{user.username}</p>
          </div>

          {/* Posições */}
          {user.positions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {user.positions.map((position, index) => (
                <Badge
                  key={position}
                  variant="gradient"
                  className="animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {positionLabels[position] || position}
                </Badge>
              ))}
            </div>
          )}

          {/* Biografia */}
          {user.bio && <p className="text-editorial whitespace-pre-wrap">{user.bio}</p>}

          {/* Informações adicionais */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {user.location && (
              <span className="flex items-center gap-1 transition-fast hover:text-foreground">
                <MapPin className="h-4 w-4" />
                {user.location}
              </span>
            )}
            {user.experience && (
              <span className="flex items-center gap-1 transition-fast hover:text-foreground">
                <Briefcase className="h-4 w-4" />
                {user.experience} {user.experience === 1 ? "ano" : "anos"} de
                experiência
              </span>
            )}
          </div>

          {/* Estatísticas */}
          <div className="flex gap-4 pt-2">
            <div className="bento-card-static px-5 py-3 text-center">
              <span className="font-mono text-xl font-bold text-primary">{animatedConnectionsCount}</span>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Conexões</p>
            </div>
            <div className="bento-card-static px-5 py-3 text-center">
              <span className="font-mono text-xl font-bold text-primary">{animatedPostsCount}</span>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Publicações</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
