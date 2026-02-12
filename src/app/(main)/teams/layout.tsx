import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Equipes | CheerConnect",
  description: "Explore equipes de cheerleading. Encontre equipes allstar, universitárias, recreativas e profissionais.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
