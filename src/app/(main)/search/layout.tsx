import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buscar | CheerConnect",
  description: "Busque atletas, técnicos, equipes e eventos de cheerleading na comunidade CheerConnect.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
