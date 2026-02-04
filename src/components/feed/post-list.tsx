"use client";

import { useEffect, useState, useCallback } from "react";
import { PostCard } from "./post-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

interface PostAuthor {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  positions: string[];
}

interface Post {
  id: string;
  content: string;
  images: string[];
  videoUrl?: string | null;
  createdAt: string;
  author: PostAuthor;
  team?: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
  } | null;
  originalPostId?: string | null;
  originalPost?: Post | null;
  _count: {
    likes: number;
    comments: number;
    reposts: number;
  };
  isLiked: boolean;
}

interface PostListProps {
  filter?: "following" | "all";
}

export function PostList({ filter = "following" }: PostListProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/posts?filter=${filter}`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      setPosts(data.posts);
    } catch {
      console.error("Error fetching posts");
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleDelete = (id: string) => {
    setPosts((prev) => prev.filter((post) => post.id !== id));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-20 w-full mt-3" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">
            Nenhuma publicação ainda. Seja o primeiro a compartilhar algo!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} onDelete={handleDelete} />
      ))}
    </div>
  );
}
