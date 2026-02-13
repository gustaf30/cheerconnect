"use client";

import { Heart, MessageCircle, Repeat2 } from "lucide-react";
import { motion, useAnimation } from "framer-motion";
import { cn } from "@/lib/utils";

interface PostActionsProps {
  isLiked: boolean;
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  hasReposted: boolean;
  justLiked: boolean;
  showCommentInput: boolean;
  isRepost: boolean;
  isTargetAuthor: boolean;
  isReposting: boolean;
  likeControls: ReturnType<typeof useAnimation>;
  onLike: () => void;
  onToggleComments: () => void;
  onRepost: () => void;
}

export function PostActions({
  isLiked,
  likesCount,
  commentsCount,
  repostsCount,
  hasReposted,
  justLiked,
  showCommentInput,
  isRepost,
  isTargetAuthor,
  isReposting,
  likeControls,
  onLike,
  onToggleComments,
  onRepost,
}: PostActionsProps) {
  return (
    <div className="flex border-t border-border/50 px-2 py-1">
      <motion.div
        className="flex-1"
        animate={likeControls}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <button
          className={cn(
            "w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-accent/50 rounded-lg transition-base like-btn-premium",
            isLiked && "text-primary hover:text-primary",
            justLiked && "liked"
          )}
          onClick={onLike}
          aria-label={isLiked ? "Descurtir" : "Curtir"}
        >
          <Heart
            className={cn(
              "h-[18px] w-[18px] transition-fast",
              isLiked && "fill-current animate-heart-pop"
            )}
          />
          <span className="leading-none">Curtir</span>
          {likesCount > 0 && <span className="stat-number text-xs">{likesCount}</span>}
        </button>
      </motion.div>

      <div className="w-px bg-border/50 my-2" />

      <div className="flex-1">
        <button
          className={cn(
            "w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-accent/50 rounded-lg transition-base",
            showCommentInput && "text-primary hover:text-primary"
          )}
          onClick={onToggleComments}
          aria-label="Comentar"
        >
          <MessageCircle className="h-[18px] w-[18px]" />
          <span className="leading-none">Comentar</span>
          {commentsCount > 0 && <span className="stat-number text-xs">{commentsCount}</span>}
        </button>
      </div>

      {!isRepost && !isTargetAuthor && (
        <>
          <div className="w-px bg-border/50 my-2" />
          <div className="flex-1">
            <button
              className={cn(
                "w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-accent/50 rounded-lg transition-base",
                hasReposted && "text-green-600 hover:text-green-600"
              )}
              onClick={onRepost}
              disabled={isReposting}
              aria-label={hasReposted ? "Remover repost" : "Repostar"}
            >
              <Repeat2 className={cn(
                "h-[18px] w-[18px] transition-base",
                hasReposted && "scale-110",
                isReposting && "animate-spin"
              )} />
              <span className="leading-none">Repostar</span>
              {repostsCount > 0 && <span className="stat-number text-xs">{repostsCount}</span>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
