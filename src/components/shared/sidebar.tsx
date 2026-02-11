"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutGrid,
  Users,
  Calendar,
  Castle,
  UserPlus,
  MessageCircle,
  Settings,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { UserProfile } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAnimatedNumber } from "@/hooks/use-animated-number";

const mainNavItems = [
  {
    title: "Feed",
    href: "/feed",
    icon: LayoutGrid,
  },
  {
    title: "Conexões",
    href: "/connections",
    icon: Users,
  },
  {
    title: "Equipes",
    href: "/teams",
    icon: Castle,
  },
  {
    title: "Eventos",
    href: "/events",
    icon: Calendar,
  },
  {
    title: "Mensagens",
    href: "/messages",
    icon: MessageCircle,
  },
  {
    title: "Configurações",
    href: "/settings",
    icon: Settings,
  },
];

interface Stats {
  connections: number;
  achievements: number;
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats>({ connections: 0, achievements: 0 });

  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await fetch("/api/users/me");
      if (response.ok) {
        const data = await response.json();
        setUserProfile({
          name: data.user.name,
          username: data.user.username,
          avatar: data.user.avatar,
        });
      }
    } catch {
      console.error("Erro ao buscar perfil do usuário");
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const [connectionsRes, achievementsRes] = await Promise.all([
        fetch("/api/connections"),
        fetch("/api/achievements"),
      ]);

      if (connectionsRes.ok && achievementsRes.ok) {
        const connectionsData = await connectionsRes.json();
        const achievementsData = await achievementsRes.json();

        const acceptedConnections = connectionsData.connections?.filter(
          (c: { status: string }) => c.status === "ACCEPTED"
        ).length || 0;

        setStats({
          connections: acceptedConnections,
          achievements: achievementsData.achievements?.length || 0,
        });
      }
    } catch {
      console.error("Erro ao buscar estatísticas");
    }
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchUserProfile();
      fetchStats();
    }
  }, [session, fetchUserProfile, fetchStats]);

  const displayName = userProfile?.name || session?.user?.name || "";
  const displayUsername = userProfile?.username || "";
  const displayAvatar = userProfile?.avatar || session?.user?.image || undefined;

  const animatedConnections = useAnimatedNumber(stats.connections);
  const animatedAchievements = useAnimatedNumber(stats.achievements);

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-4 stagger-children">
        {/* Logo para mobile */}
        <div className="flex h-14 items-center px-4 lg:hidden border-b">
          <Link
            href="/feed"
            className="flex items-center gap-0.5 font-display font-extrabold text-xl group"
          >
            <span className="text-primary transition-base group-hover:opacity-90">
              Cheer
            </span>
            <span className="transition-base group-hover:text-primary/80">
              Connect
            </span>
          </Link>
        </div>

        {/* Card Bento unificado de Perfil e Estatísticas */}
        {session?.user && (
          <div className="bento-card-static">
            <div className="accent-bar" />
            <div className="p-5 flex flex-col items-center text-center">
              <div className="relative">
                <Avatar className="h-20 w-20 rounded-2xl border-2 border-white shadow-sm mb-3">
                  <AvatarImage
                    src={displayAvatar}
                    alt={displayName}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground font-display font-semibold text-xl rounded-2xl">
                    {displayName ? getInitials(displayName) : "U"}
                  </AvatarFallback>
                </Avatar>
              </div>
              <h2 className="font-display font-bold text-lg">{displayName}</h2>
              {displayUsername && (
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-5">
                  @{displayUsername}
                </p>
              )}

              <div className="grid grid-cols-2 w-full gap-4 border-t border-border/50 pt-5">
                <div className="flex flex-col">
                  <span className="font-mono text-xl font-bold text-primary">
                    {animatedConnections}
                  </span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                    Conexões
                  </span>
                </div>
                <div className="flex flex-col border-l border-border/50">
                  <span className="font-mono text-xl font-bold text-primary">
                    {animatedAchievements}
                  </span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                    Conquistas
                  </span>
                </div>
              </div>
            </div>
            <Link
              href={displayUsername ? `/profile/${displayUsername}` : "/profile"}
              className="block w-full text-center py-3 bg-foreground/5 text-xs font-bold hover:bg-primary hover:text-white hover:scale-[1.05] active:scale-[0.98] transition-all duration-300"
            >
              VER MEU PERFIL
            </Link>
          </div>
        )}

        {/* Cards de navegação em grid */}
        <nav className="grid grid-cols-2 gap-3">
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "nav-card flex flex-col items-center justify-center p-4 rounded-2xl bento-card-static border-none shadow-sm",
                    isActive && "active",
                    !isActive && "text-muted-foreground"
                  )}
                >
                  <item.icon className="h-6 w-6 mb-1" />
                  <span className="text-xs font-bold">{item.title}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        {/* Mini card de sugestões */}
        <div className="bento-card-static p-4 bg-primary/5 border-primary/20">
          <p className="text-xs font-bold text-primary mb-3 uppercase tracking-wider">
            Encontrar Atletas
          </p>
          <p className="text-[11px] text-muted-foreground mb-3">
            Descubra atletas e técnicos na sua região.
          </p>
          <Link
            href="/search"
            className="flex items-center justify-center w-full py-1.5 text-[10px] font-bold border border-primary/30 rounded-lg text-primary hover:bg-primary hover:text-white hover:scale-[1.05] active:scale-[0.98] transition-all duration-300 gap-1"
          >
            <UserPlus className="h-3 w-3" />
            BUSCAR PESSOAS
          </Link>
        </div>
      </div>
    </ScrollArea>
  );
}
