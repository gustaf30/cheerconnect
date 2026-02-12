import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Eventos | CheerConnect",
  description: "Descubra competições, workshops, camps e tryouts de cheerleading. Fique por dentro dos próximos eventos da comunidade.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
