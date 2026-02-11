"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Menu, LogOut, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";
import { NotificationDropdown } from "./notification-dropdown";
import { MessageButton } from "./message-button";
import { cn, getInitials } from "@/lib/utils";
import { UserProfile } from "@/types";

export function Header() {
  const { data: session } = useSession();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

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

  useEffect(() => {
    if (session?.user) {
      fetchUserProfile();
    }
  }, [session, fetchUserProfile]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full h-16 glass flex items-center justify-between px-6 md:px-12 transition-base animate-fade-in",
        isScrolled && "shadow-depth-3 border-transparent"
      )}
    >
      <div className="flex items-center gap-8">
        {/* Menu mobile */}
        <Sheet>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon" className="hover:bg-accent/80" aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <Sidebar />
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link
          href="/feed"
          className="flex items-center gap-0.5 font-display font-extrabold text-2xl tracking-tight group"
        >
          <span className="text-primary transition-base group-hover:opacity-90">
            Cheer
          </span>
          <span className="text-foreground transition-base group-hover:text-primary/80">
            Connect
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-5">
        {/* Mensagens */}
        <div>
          <MessageButton />
        </div>

        {/* Notificações */}
        <div>
          <NotificationDropdown />
        </div>

        {/* Menu do usuário */}
        {session?.user && (
          <div>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full p-0"
                >
                  <Avatar className="h-9 w-9 ring-2 ring-transparent hover:ring-primary/30 transition-base">
                    <AvatarImage
                      src={
                        userProfile?.avatar || session.user.image || undefined
                      }
                      alt={userProfile?.name || session.user.name || ""}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-display font-semibold">
                      {(userProfile?.name || session.user.name)
                        ? getInitials(
                            userProfile?.name || session.user.name || ""
                          )
                        : "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 animate-scale-in"
                align="end"
                forceMount
              >
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {session.user.name && (
                      <p className="font-display font-semibold">
                        {session.user.name}
                      </p>
                    )}
                    {session.user.email && (
                      <p className="w-[200px] truncate text-sm text-muted-foreground">
                        {session.user.email}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={userProfile?.username ? `/profile/${userProfile.username}` : "/profile"} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Meu Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Configurações
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </header>
  );
}
