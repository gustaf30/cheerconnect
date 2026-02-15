import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import PostDetailClient from "./post-detail-client";

interface PostPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      content: true,
      author: { select: { name: true, username: true } },
    },
  });

  if (!post) return { title: "Post | CheerConnect" };

  const authorName = post.author.name || post.author.username;
  const description = post.content
    ? post.content.length > 160
      ? post.content.substring(0, 157) + "..."
      : post.content
    : "Veja este post no CheerConnect";

  return {
    title: `${authorName} no CheerConnect`,
    description,
    openGraph: {
      title: `${authorName} no CheerConnect`,
      description,
      type: "article",
    },
  };
}

export default function PostPage() {
  return <PostDetailClient />;
}
