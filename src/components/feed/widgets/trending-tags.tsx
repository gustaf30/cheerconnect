"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface TagItem {
  name: string;
  postCount: number;
}

export function TrendingTags() {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/tags/trending");
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  return (
    <div className="bento-card-static shadow-depth-1 p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="font-display font-bold text-sm">Em Alta</h3>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
      ) : tags.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <TrendingUp className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">Nenhuma hashtag em alta ainda</p>
        </div>
      ) : (
        <div className="space-y-1">
          {tags.map((tag) => (
            <Link
              key={tag.name}
              href={`/search?q=%23${encodeURIComponent(tag.name)}`}
              className="flex items-center justify-between py-1.5 px-1.5 -mx-1.5 rounded-lg hover-flash group transition-fast"
            >
              <span className="text-xs font-medium group-hover:text-primary transition-fast">
                #{tag.name}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {tag.postCount} {tag.postCount === 1 ? "post" : "posts"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
