import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mensagens | CheerConnect",
  description: "Converse com suas conexões na comunidade de cheerleading. Envie e receba mensagens privadas.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
