"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, Briefcase, UserPlus, UserMinus, Clock, Check, Pencil, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

const positionLabels: Record<string, string> = {
  FLYER: "Flyer",
  BASE: "Base",
  BACKSPOT: "Backspot",
  FRONTSPOT: "Frontspot",
  TUMBLER: "Tumbler",
  COACH: "Técnico",
  CHOREOGRAPHER: "Coreógrafo",
  JUDGE: "Juiz",
  OTHER: "Outro",
};

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

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

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
    <div className="bg-card rounded-xl overflow-hidden border animate-fade-in shadow-sm hover:shadow-md transition-shadow duration-300">
      {/* Banner */}
      <div className="h-32 sm:h-48 bg-gradient-to-br from-primary via-primary/60 to-[oklch(0.40_0.18_25)] relative overflow-hidden animate-banner-shimmer">
        {user.banner ? (
          <img
            src={user.banner}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-[oklch(0.40_0.18_25)]" />
        )}
      </div>

      {/* Profile info */}
      <div className="px-4 sm:px-6 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-12 sm:-mt-16">
          <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-background shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_oklch(0.55_0.22_25/0.3)]">
            <AvatarImage src={user.avatar || undefined} alt={user.name} className="object-cover" />
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl sm:text-4xl">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>

          <div className="mt-4 sm:mt-0 flex gap-2">
            {isOwnProfile ? (
              <Link href="/profile/edit">
                <Button variant="outline" className="hover:border-primary/50 hover:text-primary transition-colors duration-200">
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
                    className="hover:border-primary/50 hover:text-primary transition-colors duration-200"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Mensagem
                  </Button>
                )}
                <Button
                  onClick={handleConnection}
                  disabled={isLoading}
                  variant={status === "connected" ? "outline" : "default"}
                  className={cn(
                    "transition-all duration-300",
                    status === "none" && "hover-glow",
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
              </>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <h1 className="text-2xl font-bold">{user.name}</h1>
            <p className="text-muted-foreground">@{user.username}</p>
          </div>

          {/* Positions */}
          {user.positions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {user.positions.map((position, index) => (
                <Badge
                  key={position}
                  variant="subtle"
                  className="animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {positionLabels[position] || position}
                </Badge>
              ))}
            </div>
          )}

          {/* Bio */}
          {user.bio && <p className="text-sm">{user.bio}</p>}

          {/* Meta info */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {user.location && (
              <span className="flex items-center gap-1 transition-colors duration-200 hover:text-foreground">
                <MapPin className="h-4 w-4" />
                {user.location}
              </span>
            )}
            {user.experience && (
              <span className="flex items-center gap-1 transition-colors duration-200 hover:text-foreground">
                <Briefcase className="h-4 w-4" />
                {user.experience} {user.experience === 1 ? "ano" : "anos"} de
                experiência
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-6 pt-2">
            <div className="group cursor-pointer transition-all duration-300 hover:scale-105">
              <span className="font-bold text-gradient-primary">{connectionsCount}</span>{" "}
              <span className="text-muted-foreground group-hover:text-foreground transition-colors duration-200">conexões</span>
            </div>
            <div className="group cursor-pointer transition-all duration-300 hover:scale-105">
              <span className="font-bold text-gradient-primary">{postsCount}</span>{" "}
              <span className="text-muted-foreground group-hover:text-foreground transition-colors duration-200">publicações</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
