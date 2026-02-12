"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PostCard } from "@/components/feed/post-card";
import type { PostData } from "@/types";

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [post, setPost] = useState<PostData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchPost = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${params.id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPost(data.post);
    } catch {
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const handleDelete = () => {
    router.push("/feed");
  };

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="hover:bg-primary/10 hover:text-primary transition-fast -ml-2"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>

      {isLoading ? (
        <div className="bento-card-static overflow-hidden">
          <div className="accent-bar" />
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        </div>
      ) : notFound ? (
        <div className="bento-card-static overflow-hidden">
          <div className="accent-bar" />
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="font-display font-semibold text-lg">
              Post não encontrado
            </p>
            <p className="text-sm mt-1 opacity-60">
              Este post pode ter sido removido ou não existe.
            </p>
          </div>
        </div>
      ) : post ? (
        <PostCard post={post} onDelete={handleDelete} />
      ) : null}
    </div>
  );
}
