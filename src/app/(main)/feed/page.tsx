"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CreatePostCard } from "@/components/feed/create-post-card";
import { PostList } from "@/components/feed/post-list";
import { Users, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

function FeedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const feedFilter = (searchParams.get("filter") as "following" | "all") || "following";
  const [refreshKey, setRefreshKey] = useState(0);

  const setFeedFilter = (filter: "following" | "all") => {
    router.replace(`/feed?filter=${filter}`, { scroll: false });
  };

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Feed</h1>
      <CreatePostCard onPostCreated={() => setRefreshKey((k) => k + 1)} />

      {/* Feed filter with line separator */}
      <div className="flex items-center gap-2 px-1">
        <div className="h-px flex-1 bg-border" />
        <div className="flex gap-1">
          <button
            onClick={() => setFeedFilter("following")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-base",
              feedFilter === "following"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="h-3.5 w-3.5" />
            Seguindo
          </button>
          <button
            onClick={() => setFeedFilter("all")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-base",
              feedFilter === "all"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Globe className="h-3.5 w-3.5" />
            Todos
          </button>
        </div>
      </div>

      <PostList filter={feedFilter} refreshKey={refreshKey} />
    </div>
  );
}

function FeedFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-6 w-48 rounded-lg" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="bento-card-static shadow-depth-1">
          <div className="p-4">
            <div className="flex gap-3">
              <Skeleton className="h-12 w-12 rounded-lg" />
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

export default function FeedPage() {
  return (
    <Suspense fallback={<FeedFallback />}>
      <FeedContent />
    </Suspense>
  );
}
