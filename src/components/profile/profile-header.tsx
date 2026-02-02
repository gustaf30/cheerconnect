"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Calendar, Briefcase, UserPlus, UserMinus, Clock, Check, Pencil } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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
  const [status, setStatus] = useState(connectionStatus);
  const [isLoading, setIsLoading] = useState(false);

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

  return (
    <div className="bg-card rounded-xl overflow-hidden border">
      {/* Banner */}
      <div className="h-32 sm:h-48 bg-gradient-to-r from-primary/30 to-primary/10 relative">
        {user.banner && (
          <img
            src={user.banner}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Profile info */}
      <div className="px-4 sm:px-6 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-12 sm:-mt-16">
          <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-background">
            <AvatarImage src={user.avatar || undefined} alt={user.name} className="object-cover" />
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl sm:text-4xl">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>

          <div className="mt-4 sm:mt-0 flex gap-2">
            {isOwnProfile ? (
              <Link href="/profile/edit">
                <Button variant="outline">
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar perfil
                </Button>
              </Link>
            ) : (
              <Button
                onClick={handleConnection}
                disabled={isLoading}
                variant={status === "connected" ? "outline" : "default"}
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
              {user.positions.map((position) => (
                <Badge key={position} variant="secondary">
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
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {user.location}
              </span>
            )}
            {user.experience && (
              <span className="flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                {user.experience} {user.experience === 1 ? "ano" : "anos"} de
                experiência
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-6 pt-2">
            <div>
              <span className="font-bold">{connectionsCount}</span>{" "}
              <span className="text-muted-foreground">conexões</span>
            </div>
            <div>
              <span className="font-bold">{postsCount}</span>{" "}
              <span className="text-muted-foreground">publicações</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
