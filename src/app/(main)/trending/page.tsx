"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, useReducedMotion } from "framer-motion";
import {
  staggerContainer,
  fadeSlideUp,
  noMotion,
  noMotionContainer,
} from "@/lib/animations";

interface TagItem {
  name: string;
  postCount: number;
}

export default function TrendingPage() {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const shouldReduceMotion = useReducedMotion();

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
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h1 className="heading-section font-display">Em Alta</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bento-card-static p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : tags.length === 0 ? (
        <div className="bento-card-static p-8 text-center">
          <TrendingUp className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">
            Nenhuma hashtag em alta ainda
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Use #hashtags nos seus posts para aparecer aqui
          </p>
        </div>
      ) : (
        <motion.div
          className="space-y-3"
          variants={shouldReduceMotion ? noMotionContainer : staggerContainer(0.06)}
          initial="hidden"
          animate="visible"
        >
          {tags.map((tag, index) => (
            <motion.div key={tag.name} variants={shouldReduceMotion ? noMotion : fadeSlideUp}>
              <Link
                href={`/search?q=%23${encodeURIComponent(tag.name)}`}
                className="bento-card-static flex items-center justify-between p-4 group hover-flash transition-base"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground/60 w-5 text-right">
                    {index + 1}
                  </span>
                  <span className="font-display font-semibold group-hover:text-primary transition-fast">
                    #{tag.name}
                  </span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {tag.postCount} {tag.postCount === 1 ? "post" : "posts"}
                </span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
