"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (session?.user) {
      fetchUserProfile();
      fetchStats();
    }
  }, [session]);

  const fetchUserProfile = async () => {
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
  };

  const fetchStats = async () => {
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
  };

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
        <Link href="/feed" className="flex items-center gap-2 font-bold text-xl">
          <span className="text-primary">Cheer</span>
          <span>Connect</span>
        </Link>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        {/* Profile card */}
        {session?.user && (
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-lg p-3 hover:bg-sidebar-accent transition-colors mb-4"
          >
            <Avatar className="h-10 w-10">
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
              <span className="font-medium truncate">{displayName}</span>
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
                    "w-full justify-start gap-3",
                    isActive && "bg-sidebar-accent font-medium"
                  )}
                >
                  <item.icon className="h-5 w-5" />
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
            <div className="rounded-lg bg-sidebar-accent p-3 text-center">
              <div className="text-2xl font-bold text-primary">{stats.connections}</div>
              <div className="text-xs text-muted-foreground">Conexões</div>
            </div>
            <div className="rounded-lg bg-sidebar-accent p-3 text-center">
              <div className="text-2xl font-bold text-primary">{stats.achievements}</div>
              <div className="text-xs text-muted-foreground">Conquistas</div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
