"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { eventTypeLabels } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface EventItem {
  id: string;
  name: string;
  location: string;
  startDate: string;
  type: string;
}

const typeBadgeColors: Record<string, string> = {
  COMPETITION: "bg-primary/10 text-primary",
  WORKSHOP: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  CAMP: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  TRYOUT: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  SHOWCASE: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  OTHER: "bg-muted text-muted-foreground",
};

function formatDateParts(dateStr: string) {
  const d = new Date(dateStr);
  const month = d
    .toLocaleString("pt-BR", { month: "short" })
    .replace(".", "")
    .toUpperCase();
  const day = d.getDate();
  return { month, day };
}

export function UpcomingEvents() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events?mode=suggestions");
      if (res.ok) {
        const data = await res.json();
        setEvents((data.events || []).slice(0, 3));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return (
    <div className="bento-card-static shadow-depth-1 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h3 className="font-display font-bold text-sm">Próximos Eventos</h3>
        </div>
        <Link
          href="/events"
          className="text-[10px] text-primary font-medium hover:underline transition-fast"
        >
          Ver todos
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          Nenhum evento próximo
        </p>
      ) : (
        <div className="space-y-2.5">
          {events.map((event) => {
            const { month, day } = formatDateParts(event.startDate);
            return (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="flex items-center gap-3 group hover-flash rounded-lg p-1.5 -mx-1.5"
              >
                {/* Date mini card */}
                <div className="h-10 w-10 rounded-lg bg-primary/5 border border-primary/10 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-primary leading-none">
                    {month}
                  </span>
                  <span className="text-sm font-display font-bold text-foreground leading-tight">
                    {day}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate group-hover:text-primary transition-fast">
                    {event.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-muted-foreground truncate">
                      {event.location}
                    </span>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0",
                        typeBadgeColors[event.type] || typeBadgeColors.OTHER
                      )}
                    >
                      {eventTypeLabels[event.type] || event.type}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
