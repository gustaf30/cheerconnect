"use client";

import { Heart, MessageCircle, Repeat2 } from "lucide-react";
import { motion, useAnimation } from "framer-motion";
import { Button } from "@/components/ui/button";
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
    <div className="px-5 pb-0 flex gap-1">
      <motion.div
        animate={likeControls}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-2 transition-base like-btn-premium",
            isLiked && "text-primary hover:text-primary",
            justLiked && "liked"
          )}
          onClick={onLike}
          aria-label={isLiked ? "Descurtir" : "Curtir"}
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-fast",
              isLiked && "fill-current animate-heart-pop"
            )}
          />
          <span className="stat-number">{likesCount}</span>
        </Button>
      </motion.div>

      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "gap-2 transition-base",
          showCommentInput && "text-primary hover:text-primary"
        )}
        onClick={onToggleComments}
        aria-label="Comentar"
      >
        <MessageCircle className="h-4 w-4" />
        <span className="stat-number">{commentsCount}</span>
      </Button>

      {!isRepost && !isTargetAuthor && (
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-2 transition-base",
            hasReposted && "text-green-600 hover:text-green-600"
          )}
          onClick={onRepost}
          disabled={isReposting}
          aria-label={hasReposted ? "Remover repost" : "Repostar"}
        >
          <Repeat2 className={cn(
            "h-4 w-4 transition-base",
            hasReposted && "scale-110",
            isReposting && "animate-spin"
          )} />
          <span className="stat-number">{repostsCount}</span>
        </Button>
      )}
    </div>
  );
}
