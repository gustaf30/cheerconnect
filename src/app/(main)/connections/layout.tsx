import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conexões | CheerConnect",
  description: "Gerencie suas conexões na comunidade de cheerleading. Aceite convites, encontre novos amigos e amplie sua rede.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
