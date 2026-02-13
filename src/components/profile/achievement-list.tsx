"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trophy, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Achievement {
  id: string;
  title: string;
  description: string | null;
  date: Date | string;
  category: string | null;
}

interface AchievementListProps {
  initialAchievements: Achievement[];
  /** Number of initial items fetched (to determine if "load more" should show) */
  initialLimit: number;
  /** For user achievements: userId. For team achievements: undefined */
  userId?: string;
  /** For team achievements: team slug. For user achievements: undefined */
  teamSlug?: string;
  emptyMessage: string;
}

export function AchievementList({
  initialAchievements,
  initialLimit,
  userId,
  teamSlug,
  emptyMessage,
}: AchievementListProps) {
  const [achievements, setAchievements] = useState<Achievement[]>(initialAchievements);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialAchievements.length >= initialLimit);
  const [cursor, setCursor] = useState<string | null>(
    initialAchievements.length >= initialLimit
      ? initialAchievements[initialAchievements.length - 1]?.id ?? null
      : null
  );

  const loadMore = async () => {
    if (!cursor || isLoadingMore) return;
    setIsLoadingMore(true);

    try {
      let url: string;
      if (teamSlug) {
        url = `/api/teams/${teamSlug}/achievements?cursor=${cursor}&limit=${initialLimit}`;
      } else {
        url = `/api/achievements?cursor=${cursor}&limit=${initialLimit}${userId ? `&userId=${userId}` : ""}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();

      setAchievements((prev) => [...prev, ...data.achievements]);
      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } catch {
      // Manter itens existentes visíveis em caso de erro
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (achievements.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-4">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {achievements.map((achievement) => (
        <div
          key={achievement.id}
          className="flex gap-4 p-4 rounded-lg bg-muted/50"
        >
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h4 className="font-display font-semibold">{achievement.title}</h4>
            {achievement.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {achievement.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <time dateTime={new Date(achievement.date).toISOString()}>
                {format(new Date(achievement.date), "MMMM yyyy", {
                  locale: ptBR,
                })}
              </time>
              {achievement.category && (
                <>
                  <span>•</span>
                  <Badge variant="outline" className="text-xs">
                    {achievement.category}
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Ver mais
          </Button>
        </div>
      )}
    </div>
  );
}
