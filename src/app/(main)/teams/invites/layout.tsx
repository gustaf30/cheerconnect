import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Convites de Equipe | CheerConnect",
  description: "Veja e gerencie seus convites para equipes de cheerleading.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
