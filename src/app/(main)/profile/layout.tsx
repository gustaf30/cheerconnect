import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Meu Perfil | CheerConnect",
  description: "Veja e gerencie seu perfil na comunidade de cheerleading CheerConnect.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
