"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "@/components/shared/sidebar";
import { PageTransitionProvider } from "@/components/providers/page-transition-provider";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Mobile top bar — visible only below lg */}
      <div className="sticky top-0 z-50 flex items-center h-14 px-4 glass lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-accent/80"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <Sidebar />
          </SheetContent>
        </Sheet>
        <Link
          href="/feed"
          className="ml-2 flex items-center gap-0.5 font-display font-extrabold text-xl tracking-tight group"
        >
          <span className="text-primary transition-base group-hover:opacity-90">
            Cheer
          </span>
          <span className="transition-base group-hover:text-primary/80">
            Connect
          </span>
        </Link>
      </div>

      <div className="flex-1 flex max-w-[1440px] mx-auto w-full px-6 md:px-12 py-8 gap-8">
        {/* Desktop Sidebar — always visible on lg+ */}
        <aside className="hidden lg:flex w-72 flex-col gap-4 sticky top-8 h-fit">
          <Sidebar />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <PageTransitionProvider>
            <div className="max-w-[840px]">{children}</div>
          </PageTransitionProvider>
        </main>
      </div>
    </div>
  );
}
