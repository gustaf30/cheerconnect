"use client";

import { memo } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/format";

interface OtherParticipant {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
}

export interface Conversation {
  id: string;
  otherParticipant: OtherParticipant;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: string;
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive?: boolean;
}

export const ConversationItem = memo(function ConversationItem({ conversation, isActive }: ConversationItemProps) {
  const { otherParticipant, lastMessageAt, lastMessagePreview, unreadCount } = conversation;

  return (
    <Link
      href={`/messages/${conversation.id}`}
      className={cn(
        "flex items-center gap-3 p-3 hover:bg-muted/50 transition-base border-b hover-flash",
        isActive && "bg-muted border-l-2 border-l-primary",
        unreadCount > 0 && "bg-primary/5"
      )}
    >
      <Avatar className="h-12 w-12 avatar-ring-hover transition-base">
        <AvatarImage
          src={otherParticipant.avatar || undefined}
          alt={otherParticipant.name}
          className="object-cover"
        />
        <AvatarFallback className="bg-primary text-primary-foreground">
          {getInitials(otherParticipant.name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("font-medium truncate", unreadCount > 0 && "font-semibold")}>
            {otherParticipant.name}
          </span>
          {lastMessageAt && (
            <time dateTime={new Date(lastMessageAt).toISOString()} className="text-xs text-muted-foreground shrink-0">
              {formatTimeAgo(lastMessageAt)}
            </time>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "text-sm truncate",
              unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
            )}
          >
            {lastMessagePreview || "Nenhuma mensagem ainda"}
          </p>
          {unreadCount > 0 && (
            <span className="shrink-0 h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center animate-scale-in badge-pulse">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
});
