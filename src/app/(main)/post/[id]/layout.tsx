import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSessionTokenValid } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !(await isSessionTokenValid(session.user.id, session.user.tokenVersion))) {
      return { title: "Publicação | CheerConnect" };
    }
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
