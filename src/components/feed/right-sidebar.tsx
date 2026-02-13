"use client";

import { UpcomingEvents } from "./widgets/upcoming-events";
import { TrendingTags } from "./widgets/trending-tags";
import { PeopleSuggestions } from "./widgets/people-suggestions";

export function RightSidebar() {
  return (
    <div className="flex flex-col gap-4 stagger-children">
      <UpcomingEvents />
      <TrendingTags />
      <PeopleSuggestions />
    </div>
  );
}
