"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PostCard } from "./post-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { Loader2 } from "lucide-react";

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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08, // 80ms between each post
      delayChildren: 0.1,
    }
  }
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 260, damping: 28 }
  }
} as const;

export function PostList({ filter = "following" }: PostListProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/posts?filter=${filter}`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      setPosts(data.posts);
      setNextCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } catch {
      setError("Erro ao carregar posts");
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !nextCursor) return;

    setIsLoadingMore(true);
    try {
      const response = await fetch(
        `/api/posts?filter=${filter}&cursor=${nextCursor}`
      );
      if (!response.ok) throw new Error();
      const data = await response.json();
      setPosts((prev) => [...prev, ...data.posts]);
      setNextCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } catch {
      console.error("Error loading more posts");
    } finally {
      setIsLoadingMore(false);
    }
  }, [filter, nextCursor, hasMore, isLoadingMore]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  const handleDelete = (id: string) => {
    setPosts((prev) => prev.filter((post) => post.id !== id));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bento-card-static">
            <div className="accent-bar" />
            <div className="p-5">
              <div className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-20 w-full mt-2" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState message={error} onRetry={() => { setError(null); fetchPosts(); }} />
    );
  }

  if (posts.length === 0) {
    return (
      <div className="bento-card-static">
        <div className="accent-bar" />
        <div className="p-8 text-center">
          <p className="text-muted-foreground">
            Nenhuma publicação ainda. Seja o primeiro a compartilhar algo!
          </p>
        </div>
      </div>
    );
  }

  if (shouldReduceMotion) {
    return (
      <div className="space-y-6">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} onDelete={handleDelete} />
        ))}
        <div ref={sentinelRef} />
        {isLoadingMore && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {posts.map((post) => (
        <motion.div key={post.id} variants={itemVariants}>
          <PostCard post={post} onDelete={handleDelete} />
        </motion.div>
      ))}
      <div ref={sentinelRef} />
      {isLoadingMore && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </motion.div>
  );
}
