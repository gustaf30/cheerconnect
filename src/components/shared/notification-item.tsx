"use client";

import Link from "next/link";
import { Heart, MessageCircle, UserPlus, UserCheck, Mail, Users, Repeat2, Reply, CircleCheck, AtSign } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/format";
import type { CSSProperties, MouseEvent } from "react";

interface NotificationActor {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  actorId: string | null;
  actor: NotificationActor | null;
  relatedId: string | null;
  relatedType: string | null;
  createdAt: string;
}

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  showMarkAsRead?: boolean;
  style?: CSSProperties;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "POST_LIKED":
      return <Heart className="h-4 w-4 text-red-500" />;
    case "POST_COMMENTED":
      return <MessageCircle className="h-4 w-4 text-blue-500" />;
    case "COMMENT_REPLIED":
      return <Reply className="h-4 w-4 text-blue-400" />;
    case "POST_REPOSTED":
      return <Repeat2 className="h-4 w-4 text-green-500" />;
    case "CONNECTION_REQUEST":
      return <UserPlus className="h-4 w-4 text-purple-500" />;
    case "CONNECTION_ACCEPTED":
      return <UserCheck className="h-4 w-4 text-green-500" />;
    case "MESSAGE_RECEIVED":
      return <Mail className="h-4 w-4 text-blue-500" />;
    case "TEAM_INVITE":
      return <Users className="h-4 w-4 text-primary" />;
    case "MENTION":
      return <AtSign className="h-4 w-4 text-amber-500" />;
    default:
      return null;
  }
};

const getNotificationLink = (notification: Notification): string => {
  if (notification.relatedType === "post" && notification.relatedId) {
    return `/post/${notification.relatedId}`;
  }
  if (notification.relatedType === "connection") {
    if (notification.type === "CONNECTION_REQUEST") {
      return "/connections?tab=pending";
    }
    if (notification.actor) {
      return `/profile/${notification.actor.username}`;
    }
  }
  if (notification.relatedType === "conversation" && notification.relatedId) {
    return `/messages/${notification.relatedId}`;
  }
  if (notification.type === "TEAM_INVITE") {
    return "/teams/invites";
  }
  return "/feed";
};

export function NotificationItem({ notification, onRead, showMarkAsRead, style }: NotificationItemProps) {
  const handleClick = () => {
    if (!notification.isRead) {
      onRead(notification.id);
    }
  };

  const handleMarkAsRead = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRead(notification.id);
  };

  return (
    <Link
      href={getNotificationLink(notification)}
      onClick={handleClick}
      style={style}
      className={cn(
        "flex items-start gap-3 p-4 hover:bg-muted/50 transition-base group/notif hover-flash",
        !notification.isRead && "bg-primary/5"
      )}
    >
      <div className="relative">
        <Avatar className="h-10 w-10 ring-2 ring-transparent hover:ring-primary/20 transition-base">
          <AvatarImage
            src={notification.actor?.avatar || undefined}
            alt={notification.actor?.name || ""}
            className="object-cover"
          />
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            {notification.actor?.name ? getInitials(notification.actor.name) : "?"}
          </AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-1 -right-1 rounded-full bg-background p-0.5 shadow-sm">
          {getNotificationIcon(notification.type)}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm transition-fast", !notification.isRead && "font-medium")}>
          {notification.message}
        </p>
        <time dateTime={new Date(notification.createdAt).toISOString()} className="text-xs text-muted-foreground mt-0.5 block">
          {formatTimeAgo(notification.createdAt)}
        </time>
      </div>

      {!notification.isRead && (
        showMarkAsRead ? (
          <button
            onClick={handleMarkAsRead}
            className="shrink-0 mt-1 p-1.5 rounded-full text-primary/60 hover:text-primary hover:bg-primary/10 transition-base cursor-pointer opacity-0 group-hover/notif:opacity-100 focus-visible:opacity-100"
            aria-label="Marcar como lida"
            title="Marcar como lida"
          >
            <CircleCheck className="h-5 w-5" />
          </button>
        ) : (
          <div className="h-2 w-2 rounded-full bg-gradient-to-br from-primary to-[oklch(0.45_0.20_25)] mt-2 shrink-0 animate-pulse" />
        )
      )}
    </Link>
  );
}
