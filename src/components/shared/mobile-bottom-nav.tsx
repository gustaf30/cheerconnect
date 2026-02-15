"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  UserSearch,
  SquarePen,
  Bell,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/hooks/use-realtime";

const navItems = [
  { title: "Feed", href: "/feed", icon: LayoutGrid },
  { title: "Busca", href: "/search", icon: UserSearch },
  { title: "Post", href: "/feed", icon: SquarePen, isAction: true },
  { title: "Alertas", href: "/notifications", icon: Bell, badge: "notifications" as const },
  { title: "Chat", href: "/messages", icon: MessageCircle, badge: "messages" as const },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { messageCount, notificationCount } = useRealtime();

  const getBadgeCount = (type?: "messages" | "notifications") => {
    if (type === "messages") return messageCount;
    if (type === "notifications") return notificationCount;
    return 0;
  };

  const handleNewPost = () => {
    if (pathname === "/feed") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      router.push("/feed");
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass shadow-depth-2 safe-area-bottom lg:hidden">
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (pathname?.startsWith(item.href + "/") && !item.isAction);
          const badgeCount = getBadgeCount(item.badge);

          if (item.isAction) {
            return (
              <button
                key={item.title}
                onClick={handleNewPost}
                className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-primary cursor-pointer"
                aria-label="Criar novo post"
              >
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-depth-1">
                  <item.icon className="h-4 w-4" />
                </div>
              </button>
            );
          }

          return (
            <Link
              key={item.title}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-3 py-1 min-w-[3rem] transition-fast",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              )}
            >
              <div className="relative">
                <item.icon className="h-5 w-5" />
                {badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-sm">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">
                {item.title}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
