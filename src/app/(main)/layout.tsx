import { Header } from "@/components/shared/header";
import { Sidebar } from "@/components/shared/sidebar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 flex-col border-r bg-sidebar">
          <Sidebar />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="container py-6 px-4 md:px-6 max-w-4xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
