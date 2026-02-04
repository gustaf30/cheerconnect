"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

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

const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Agora";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
};

const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export function ConversationItem({ conversation, isActive }: ConversationItemProps) {
  const { otherParticipant, lastMessageAt, lastMessagePreview, unreadCount } = conversation;

  return (
    <Link
      href={`/messages/${conversation.id}`}
      className={cn(
        "flex items-center gap-3 p-3 hover:bg-muted/50 transition-all duration-200 border-b hover:translate-x-1",
        isActive && "bg-muted border-l-2 border-l-primary",
        unreadCount > 0 && "bg-primary/5"
      )}
    >
      <Avatar className="h-12 w-12 avatar-ring-hover transition-all duration-200">
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
            <span className="text-xs text-muted-foreground shrink-0">
              {formatTimeAgo(lastMessageAt)}
            </span>
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
}
