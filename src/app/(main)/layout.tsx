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
      <div className="flex-1 flex max-w-[1440px] mx-auto w-full px-6 md:px-12 py-8 gap-8">
        {/* Desktop Sidebar - Bento style */}
        <aside className="hidden lg:flex w-72 flex-col gap-4 sticky top-24 h-fit">
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
