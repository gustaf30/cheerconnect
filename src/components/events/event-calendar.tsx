"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  endOfDay,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  startOfDay,
  subMonths,
  subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { eventTypeLabels } from "@/lib/constants";

type EventItem = {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  type: string;
  location: string;
};

type EventCalendarProps = {
  query?: string;
  type?: string;
  location?: string;
};

export function EventCalendar({ query = "", type = "", location = "" }: EventCalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const [view, setView] = useState<"month" | "week">("month");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);

  const days = useMemo(() => {
    const anchor = view === "week" ? selectedDay || month : month;
    const start = view === "week"
      ? startOfWeek(anchor, { weekStartsOn: 0 })
      : startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 });
    const end = view === "week"
      ? endOfWeek(anchor, { weekStartsOn: 0 })
      : endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month, selectedDay, view]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const anchor = view === "week" ? selectedDay || month : month;
      const rangeStart = view === "week"
        ? startOfWeek(anchor, { weekStartsOn: 0 })
        : startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 });
      const rangeEnd = view === "week"
        ? endOfWeek(anchor, { weekStartsOn: 0 })
        : endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 });
      const collected: EventItem[] = [];
      let cursor: string | null = null;
      do {
        const params = new URLSearchParams({
          scope: "all",
          from: rangeStart.toISOString(),
          to: rangeEnd.toISOString(),
          limit: "50",
        });
        if (query) params.set("q", query);
        if (type && type !== " ") params.set("type", type);
        if (location) params.set("location", location);
        if (cursor) params.set("cursor", cursor);
        const response = await fetch(`/api/events?${params.toString()}`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        collected.push(...(data.events || []));
        cursor = data.nextCursor || null;
      } while (cursor);
      setEvents(collected);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [location, month, query, selectedDay, type, view]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const eventsForDay = (day: Date) => events.filter((event) => {
    const start = new Date(event.startDate);
    const end = event.endDate ? new Date(event.endDate) : start;
    return day >= startOfDay(start) && day <= endOfDay(end);
  });

  const selectedEvents = selectedDay ? eventsForDay(selectedDay) : [];

  return (
    <section className="bento-card-static p-4 space-y-4" aria-labelledby="calendar-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="calendar-title" className="heading-card flex items-center gap-2">
          <CalendarDays className="h-4 w-4" /> Calendário
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setView(view === "month" ? "week" : "month")}>
            {view === "month" ? "Semana" : "Mês"}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={view === "week" ? "Semana anterior" : "Mês anterior"}
            onClick={() => setMonth(view === "week" ? subWeeks(selectedDay || month, 1) : subMonths(month, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-36 text-center font-medium">
            {format(month, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label={view === "week" ? "Próxima semana" : "Próximo mês"}
            onClick={() => setMonth(view === "week" ? addWeeks(selectedDay || month, 1) : addMonths(month, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground" aria-hidden="true">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => <span key={day} className="py-1">{day}</span>)}
      </div>
      <div className={`grid grid-cols-7 gap-1 ${view === "week" ? "grid-rows-1" : "grid-rows-6"}`}>
        {days.map((day) => {
          const dayEvents = eventsForDay(day);
          const selected = selectedDay ? isSameDay(day, selectedDay) : false;
          return (
            <button
              type="button"
              key={day.toISOString()}
              onClick={() => setSelectedDay(day)}
              aria-label={`${format(day, "d 'de' MMMM", { locale: ptBR })}, ${dayEvents.length} eventos`}
              aria-pressed={selected}
              className={`min-h-16 rounded-lg border p-1 text-left transition-colors sm:min-h-20 ${
                isSameMonth(day, month) ? "bg-background" : "bg-muted/30 text-muted-foreground"
              } ${selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:bg-accent"}`}
            >
              <span className="block text-xs font-medium">{format(day, "d")}</span>
              <span className="mt-1 block space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <span key={event.id} className="block truncate rounded bg-primary/10 px-1 py-0.5 text-[10px] text-primary">
                    {event.name}
                  </span>
                ))}
                {dayEvents.length > 3 && <span className="block text-[10px] text-muted-foreground">+{dayEvents.length - 3}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-t pt-3">
        <h3 className="text-sm font-medium">
          {selectedDay ? format(selectedDay, "d 'de' MMMM", { locale: ptBR }) : "Selecione um dia"}
        </h3>
        {loading ? (
          <p className="mt-2 text-sm text-muted-foreground">Carregando...</p>
        ) : selectedEvents.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum evento neste dia.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {selectedEvents.map((event) => (
              <Link key={event.id} href={`/events/${event.id}`} className="block rounded-lg border p-3 hover:bg-accent">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{event.name}</span>
                  <Badge variant="secondary">{eventTypeLabels[event.type] || event.type}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{event.location}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
