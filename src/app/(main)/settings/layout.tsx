import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Configurações | CheerConnect",
  description: "Gerencie suas preferências de conta, notificações e privacidade no CheerConnect.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
