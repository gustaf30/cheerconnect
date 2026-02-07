"use client";

import { Suspense } from "react";
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

  const setFeedFilter = (filter: "following" | "all") => {
    router.replace(`/feed?filter=${filter}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Feed</h1>
      <CreatePostCard />

      {/* Bento filter toggle */}
      <div className="bento-card-static p-1 inline-flex gap-1">
        <button
          onClick={() => setFeedFilter("following")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-[0.9rem] text-sm font-bold transition-all duration-200",
            feedFilter === "following"
              ? "bg-primary text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
          )}
        >
          <Users className="h-4 w-4" />
          Seguindo
        </button>
        <button
          onClick={() => setFeedFilter("all")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-[0.9rem] text-sm font-bold transition-all duration-200",
            feedFilter === "all"
              ? "bg-primary text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
          )}
        >
          <Globe className="h-4 w-4" />
          Todos
        </button>
      </div>

      <PostList filter={feedFilter} />
    </div>
  );
}

function FeedFallback() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-10 w-48 rounded-xl" />
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

export default function FeedPage() {
  return (
    <Suspense fallback={<FeedFallback />}>
      <FeedContent />
    </Suspense>
  );
}
