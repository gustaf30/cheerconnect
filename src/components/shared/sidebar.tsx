"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Home,
  Users,
  Calendar,
  UserCircle,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const mainNavItems = [
  {
    title: "Feed",
    href: "/feed",
    icon: Home,
  },
  {
    title: "Conexões",
    href: "/connections",
    icon: Users,
  },
  {
    title: "Equipes",
    href: "/teams",
    icon: UsersRound,
  },
  {
    title: "Eventos",
    href: "/events",
    icon: Calendar,
  },
  {
    title: "Pessoas",
    href: "/search",
    icon: UserCircle,
  },
];

interface UserProfile {
  name: string;
  avatar: string | null;
}

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
          avatar: data.user.avatar,
        });
      }
    } catch {
      console.error("Error fetching user profile");
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

        // Count accepted connections
        const acceptedConnections = connectionsData.connections?.filter(
          (c: { status: string }) => c.status === "ACCEPTED"
        ).length || 0;

        setStats({
          connections: acceptedConnections,
          achievements: achievementsData.achievements?.length || 0,
        });
      }
    } catch {
      console.error("Error fetching stats");
    }
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchUserProfile();
      fetchStats();
    }
  }, [session, fetchUserProfile, fetchStats]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const displayName = userProfile?.name || session?.user?.name || "";
  const displayAvatar = userProfile?.avatar || session?.user?.image || undefined;

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Logo for mobile */}
      <div className="flex h-14 items-center px-4 md:hidden border-b">
        <Link href="/feed" className="flex items-center gap-1 font-bold text-xl group">
          <span className="text-gradient-primary transition-all duration-300 group-hover:opacity-90">Cheer</span>
          <span className="transition-all duration-300 group-hover:text-primary/80 group-hover:tracking-wide">Connect</span>
        </Link>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        {/* Profile card */}
        {session?.user && (
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-lg p-3 hover:bg-sidebar-accent transition-all duration-300 mb-4 group hover:shadow-sm hover-glow"
          >
            <Avatar className="h-10 w-10 ring-2 ring-transparent group-hover:ring-primary/30 transition-all duration-300">
              <AvatarImage
                src={displayAvatar}
                alt={displayName}
                className="object-cover"
              />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {displayName ? getInitials(displayName) : "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <span className="font-medium truncate group-hover:text-primary transition-colors duration-300">{displayName}</span>
              <span className="text-xs text-muted-foreground truncate">
                Ver perfil
              </span>
            </div>
          </Link>
        )}

        <Separator className="mb-4" />

        {/* Navigation */}
        <nav className="space-y-1">
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 relative transition-all duration-300 nav-indicator",
                    isActive && "bg-sidebar-accent font-medium active",
                    !isActive && "hover:translate-x-1.5"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5 transition-all duration-300",
                    isActive && "text-primary scale-110"
                  )} />
                  {item.title}
                </Button>
              </Link>
            );
          })}
        </nav>

        <Separator className="my-4" />

        {/* Quick stats */}
        <div className="space-y-2 px-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            Estatísticas
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-gradient-to-br from-sidebar-accent to-sidebar-accent/50 p-3 text-center transition-all duration-300 hover:shadow-md hover:scale-[1.02] group cursor-pointer">
              <div className="text-2xl font-bold text-gradient-primary">{stats.connections}</div>
              <div className="text-xs text-muted-foreground group-hover:text-foreground transition-colors duration-300">Conexões</div>
            </div>
            <div className="rounded-lg bg-gradient-to-br from-sidebar-accent to-sidebar-accent/50 p-3 text-center transition-all duration-300 hover:shadow-md hover:scale-[1.02] group cursor-pointer">
              <div className="text-2xl font-bold text-gradient-primary">{stats.achievements}</div>
              <div className="text-xs text-muted-foreground group-hover:text-foreground transition-colors duration-300">Conquistas</div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
