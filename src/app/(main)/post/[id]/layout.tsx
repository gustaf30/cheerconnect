import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const { id } = await params;
    const post = await prisma.post.findUnique({
      where: { id },
      select: {
        content: true,
        author: { select: { name: true } },
      },
    });

    if (!post) {
      return { title: "Publicação | CheerConnect" };
    }

    const description = post.content
      ? post.content.length > 100
        ? post.content.slice(0, 100) + "..."
        : post.content
      : undefined;

    return {
      title: `${post.author.name} no CheerConnect`,
      description,
    };
  } catch {
    return { title: "Publicação | CheerConnect" };
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
