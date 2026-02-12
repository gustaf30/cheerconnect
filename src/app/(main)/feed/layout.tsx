import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feed | CheerConnect",
  description: "Veja as últimas publicações da comunidade de cheerleading. Compartilhe novidades, fotos e vídeos com seus amigos e equipes.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
