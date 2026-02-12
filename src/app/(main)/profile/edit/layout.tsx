import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Editar Perfil | CheerConnect",
  description: "Atualize suas informações pessoais, posições, conquistas e histórico de carreira no cheerleading.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
