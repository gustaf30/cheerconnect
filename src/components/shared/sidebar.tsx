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
import { Button } from "@/components/ui/button";
import { cn, getInitials } from "@/lib/utils";
import { UserProfile } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NotificationDropdown } from "./notification-dropdown";
import { useAnimatedNumber } from "@/hooks/use-animated-number";
import { useRealtime } from "@/hooks/use-realtime";
import { TrendingTags } from "@/components/feed/widgets/trending-tags";

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

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps = {}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats>({ connections: 0, achievements: 0 });
  const [profileError, setProfileError] = useState(false);
  const { messageCount } = useRealtime();

  const fetchUserProfile = useCallback(async () => {
    setProfileError(false);
    try {
      const response = await fetch("/api/users/me");
      if (response.ok) {
        const data = await response.json();
        setUserProfile({
          name: data.user.name,
          username: data.user.username,
          avatar: data.user.avatar,
        });
      } else {
        setProfileError(true);
      }
    } catch {
      setProfileError(true);
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
      <div className="flex flex-col gap-4 stagger-children py-2">
        {/* Profile Card */}
        {session?.user && profileError && (
          <div className="bento-card-static shadow-depth-1">
            <div className="flex flex-col items-center gap-2 p-6 text-sm text-muted-foreground">
              <p>Erro ao carregar perfil.</p>
              <Button variant="outline" size="sm" onClick={() => { fetchUserProfile(); fetchStats(); }}>
                Tentar novamente
              </Button>
            </div>
          </div>
        )}
        {session?.user && !profileError && (
          <div className="bento-card-static shadow-depth-1">
            <div className="h-14 bg-gradient-to-r from-primary to-primary-hover" />
            <div className="px-4 pb-4">
              <div className="-mt-8 mb-3">
                <Link href={profileUrl} onClick={onNavigate}>
                  <Avatar className="h-16 w-16 rounded-xl border-4 border-white shadow-depth-1 avatar-glow shrink-0 mx-auto">
                    <AvatarImage
                      src={displayAvatar}
                      alt={displayName}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-primary text-primary-foreground font-display font-semibold text-lg rounded-xl">
                      {displayName ? getInitials(displayName) : "U"}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              </div>
              <div className="text-center mb-4">
                <Link href={profileUrl} onClick={onNavigate} className="font-display font-bold text-lg hover:underline transition-fast">
                  {displayName}
                </Link>
                {displayUsername && (
                  <p className="text-xs text-muted-foreground">@{displayUsername}</p>
                )}
              </div>
              <div className="border-t border-border/50 pt-3 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Conexões</span>
                  <span className="stat-number text-primary">{animatedConnections}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Conquistas</span>
                  <span className="stat-number text-primary">{animatedAchievements}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="bento-card-static shadow-depth-1 flex flex-col">
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            const isMessages = item.href === "/messages";
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "nav-indicator flex items-center gap-3 px-4 py-3 text-sm font-medium transition-base",
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
            onClick={onNavigate}
            className={cn(
              "nav-indicator flex items-center gap-3 px-4 py-3 text-sm font-medium transition-base",
              pathname === "/settings" || pathname?.startsWith("/settings/")
                ? "active text-primary bg-primary/5 font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            <Settings className="h-5 w-5" />
            <span>Configurações</span>
          </Link>

          {/* Logout */}
          {session?.user && (
            <div className="border-t border-border/50 mt-1 pt-1">
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-base cursor-pointer w-full"
              >
                <LogOut className="h-5 w-5" />
                <span>Sair</span>
              </button>
            </div>
          )}
        </nav>

        {/* Trending Tags — visible only when right sidebar is hidden */}
        <div className="xl:hidden">
          <TrendingTags />
        </div>

        {/* Logo */}
        <div className="text-center">
          <Link
            href="/feed"
            onClick={onNavigate}
            className="flex items-center justify-center gap-0.5 font-display font-extrabold text-xl tracking-tight opacity-40"
          >
            <span className="text-primary">Cheer</span>
            <span>Connect</span>
          </Link>
        </div>
      </div>
    </ScrollArea>
  );
}
