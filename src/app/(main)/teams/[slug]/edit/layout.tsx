import { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  try {
    const { slug } = await params;
    const team = await prisma.team.findUnique({
      where: { slug },
      select: { name: true },
    });

    if (!team) return { title: "Editar Equipe | CheerConnect" };
    return { title: `Editar ${team.name} | CheerConnect` };
  } catch {
    return { title: "Editar Equipe | CheerConnect" };
  }
}

export default function TeamEditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
