import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notificações | CheerConnect",
  description: "Veja suas notificações de curtidas, comentários, conexões e atividades de equipes.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
