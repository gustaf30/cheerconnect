"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutGrid,
  Users,
  Calendar,
  Castle,
  UserSearch,
  MessageCircle,
  Settings,
  LogOut,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { UserProfile } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NotificationDropdown } from "./notification-dropdown";
import { useAnimatedNumber } from "@/hooks/use-animated-number";
import { useRealtime } from "@/hooks/use-realtime";

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
    title: "Pessoas",
    href: "/search",
    icon: UserSearch,
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
  const { messageCount } = useRealtime();

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
  const profileUrl = displayUsername ? `/profile/${displayUsername}` : "/profile";

  const animatedConnections = useAnimatedNumber(stats.connections);
  const animatedAchievements = useAnimatedNumber(stats.achievements);

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-6 stagger-children py-2">
        {/* Logo */}
        <div className="flex h-14 items-center px-6">
          <Link
            href="/feed"
            className="flex items-center gap-0.5 font-display font-extrabold text-2xl tracking-tight group"
          >
            <span className="text-primary transition-base group-hover:opacity-90">
              Cheer
            </span>
            <span className="transition-base group-hover:text-primary/80">
              Connect
            </span>
          </Link>
        </div>

        {/* Profile Card */}
        {session?.user && (
          <div className="bento-card-static">
            <div className="accent-bar" />
            <div className="p-6">
              <Link href={profileUrl} className="flex items-center gap-4 group">
                <Avatar className="h-14 w-14 rounded-2xl border-2 border-white shadow-depth-1 avatar-glow shrink-0">
                  <AvatarImage
                    src={displayAvatar}
                    alt={displayName}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground font-display font-semibold text-lg rounded-2xl">
                    {displayName ? getInitials(displayName) : "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="font-display font-bold text-base truncate group-hover:text-primary transition-fast">
                    {displayName}
                  </span>
                  {displayUsername && (
                    <span className="font-mono text-xs text-muted-foreground truncate">
                      @{displayUsername}
                    </span>
                  )}
                </div>
              </Link>

              {/* Stats */}
              <div className="flex items-center gap-6 mt-5 pt-5 border-t border-border/50">
                <div className="flex flex-col">
                  <span className="stat-number text-lg text-primary">
                    {animatedConnections}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    Conexões
                  </span>
                </div>
                <div className="h-8 w-px bg-border/50" />
                <div className="flex flex-col">
                  <span className="stat-number text-lg text-primary">
                    {animatedAchievements}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    Conquistas
                  </span>
                </div>
              </div>

              {/* Profile link */}
              <Link
                href={profileUrl}
                className="inline-flex mt-4 text-sm font-semibold text-primary hover:text-primary/80 transition-fast animated-underline"
              >
                Ver meu perfil
              </Link>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex flex-col gap-1 px-2">
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            const isMessages = item.href === "/messages";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "nav-indicator flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-base",
                  isActive
                    ? "active text-primary bg-primary/5 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <div className="relative">
                  <item.icon className="h-5 w-5" />
                  <span aria-live="polite" aria-atomic="true">
                    {isMessages && messageCount > 0 && (
                      <span className="absolute -top-2 -right-3 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-sm">
                        {messageCount > 99 ? "99+" : messageCount}
                      </span>
                    )}
                  </span>
                </div>
                <span>{item.title}</span>
              </Link>
            );
          })}

          {/* Notifications */}
          {session?.user && <NotificationDropdown variant="sidebar" />}

          {/* Configurações */}
          <Link
            href="/settings"
            className={cn(
              "nav-indicator flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-base",
              pathname === "/settings" || pathname?.startsWith("/settings/")
                ? "active text-primary bg-primary/5 font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            <Settings className="h-5 w-5" />
            <span>Configurações</span>
          </Link>
        </nav>

        {/* Logout */}
        {session?.user && (
          <div className="pt-2 border-t border-border/50 px-2">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-base cursor-pointer"
            >
              <LogOut className="h-5 w-5" />
              <span>Sair</span>
            </button>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
