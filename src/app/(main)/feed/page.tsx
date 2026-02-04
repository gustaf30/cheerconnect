"use client";

import { useState } from "react";
import { CreatePostCard } from "@/components/feed/create-post-card";
import { PostList } from "@/components/feed/post-list";
import { Button } from "@/components/ui/button";
import { Users, Globe } from "lucide-react";

export default function FeedPage() {
  const [feedFilter, setFeedFilter] = useState<"following" | "all">("following");

  return (
    <div className="space-y-6">
      <CreatePostCard />

      {/* Feed filter toggle */}
      <div className="flex gap-2">
        <Button
          variant={feedFilter === "following" ? "default" : "outline"}
          size="sm"
          onClick={() => setFeedFilter("following")}
        >
          <Users className="h-4 w-4 mr-2" />
          Seguindo
        </Button>
        <Button
          variant={feedFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFeedFilter("all")}
        >
          <Globe className="h-4 w-4 mr-2" />
          Todos
        </Button>
      </div>

      <PostList filter={feedFilter} />
    </div>
  );
}
