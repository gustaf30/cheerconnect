"use client";

import { Button } from "@/components/ui/button";

interface CommentSortControlsProps {
  commentsCount: number;
  isExpanded: boolean;
  sort: "popular" | "recent";
  onSortChange: () => void;
}

export function CommentSortControls({
  commentsCount,
  isExpanded,
  sort,
  onSortChange,
}: CommentSortControlsProps) {
  if (commentsCount <= 0) return null;

  return (
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-medium text-muted-foreground">
        {commentsCount} {commentsCount === 1 ? "comentário" : "comentários"}
      </span>
      {isExpanded && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7"
          onClick={onSortChange}
        >
          {sort === "popular" ? "Mais curtidos" : "Mais recentes"}
        </Button>
      )}
    </div>
  );
}
