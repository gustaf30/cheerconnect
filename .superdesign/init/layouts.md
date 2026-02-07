# Layout Components

## Root Layout — `src/app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { Bricolage_Grotesque, Source_Sans_3, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/session-provider";
import { Toaster } from "@/components/ui/sonner";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["200", "400", "700", "800"],
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-editorial",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "CheerConnect - Rede Social para Cheerleading",
  description:
    "Conecte-se com atletas, técnicos e equipes de cheerleading. Encontre oportunidades, compartilhe conquistas e faça parte da comunidade.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${bricolage.variable} ${sourceSans.variable} ${jetbrains.variable} ${newsreader.variable} font-body antialiased`}>
        <SessionProvider>
          {children}
          <Toaster position="top-center" richColors />
        </SessionProvider>
      </body>
    </html>
  );
}
```

## Auth Layout — `src/app/(auth)/layout.tsx`

```tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4 relative overflow-hidden">
      {/* Decorative floating orbs */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-primary/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 animate-float" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/15 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 animate-float" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/4 right-1/4 w-48 h-48 bg-[oklch(0.40_0.18_25)]/10 rounded-full blur-2xl animate-float" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-1/3 left-1/4 w-32 h-32 bg-primary/10 rounded-full blur-2xl animate-float" style={{ animationDelay: '1.5s' }} />
      <div className="absolute top-1/2 right-1/3 w-24 h-24 bg-[oklch(0.65_0.18_30)]/15 rounded-full blur-xl animate-float" style={{ animationDelay: '0.5s' }} />

      {/* Content */}
      <div className="w-full max-w-md relative z-10 animate-premium-entrance">{children}</div>
    </div>
  );
}
```

## Main Layout — `src/app/(main)/layout.tsx`

```tsx
import { Header } from "@/components/shared/header";
import { Sidebar } from "@/components/shared/sidebar";
import { PageTransitionProvider } from "@/components/providers/page-transition-provider";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex flex-1">
        {/* Desktop Sidebar - sticky */}
        <aside className="hidden md:flex w-64 flex-col border-r bg-sidebar sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
          <Sidebar />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <PageTransitionProvider>
            <div className="py-8 px-4 md:px-8 lg:px-12 max-w-3xl mx-auto">{children}</div>
          </PageTransitionProvider>
        </main>
      </div>
    </div>
  );
}
```

## Header — `src/components/shared/header.tsx`

```tsx
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
import { cn } from "@/lib/utils";

interface UserProfile {
  name: string;
  avatar: string | null;
}

export function Header() {
  const { data: session } = useSession();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  // ... data fetching logic ...

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b glass transition-base",
        isScrolled && "shadow-depth-3 border-transparent"
      )}
    >
      <div className="container flex h-14 items-center gap-4 px-4 md:px-6">
        {/* Mobile menu (Sheet with Sidebar) */}
        {/* Logo: "Cheer" gradient + "Connect" */}
        {/* Spacer */}
        {/* Right: MessageButton, NotificationDropdown, User DropdownMenu */}
      </div>
    </header>
  );
}
```

## Sidebar — `src/components/shared/sidebar.tsx`

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Home, Users, Calendar, UserCircle, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const mainNavItems = [
  { title: "Feed", href: "/feed", icon: Home },
  { title: "Conexões", href: "/connections", icon: Users },
  { title: "Equipes", href: "/teams", icon: UsersRound },
  { title: "Eventos", href: "/events", icon: Calendar },
  { title: "Pessoas", href: "/search", icon: UserCircle },
];

export function Sidebar() {
  // ... state and data fetching ...

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Mobile logo */}
      <ScrollArea className="flex-1 px-3 py-4">
        {/* Profile card with avatar + name + gradient-border */}
        <Separator />
        {/* Navigation with nav-indicator active states */}
        <Separator />
        {/* Quick stats: Connections + Achievements in glass cards */}
      </ScrollArea>
    </div>
  );
}
```
