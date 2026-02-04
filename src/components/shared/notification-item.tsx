"use client";

import Link from "next/link";
import { Heart, MessageCircle, UserPlus, UserCheck, Mail, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

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
  style?: CSSProperties;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "POST_LIKED":
      return <Heart className="h-4 w-4 text-red-500" />;
    case "POST_COMMENTED":
      return <MessageCircle className="h-4 w-4 text-blue-500" />;
    case "CONNECTION_REQUEST":
      return <UserPlus className="h-4 w-4 text-purple-500" />;
    case "CONNECTION_ACCEPTED":
      return <UserCheck className="h-4 w-4 text-green-500" />;
    case "MESSAGE_RECEIVED":
      return <Mail className="h-4 w-4 text-blue-500" />;
    case "TEAM_INVITE":
      return <Users className="h-4 w-4 text-primary" />;
    default:
      return null;
  }
};

const getNotificationLink = (notification: Notification): string => {
  if (notification.relatedType === "post" && notification.relatedId) {
    return `/feed?post=${notification.relatedId}`;
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

export function NotificationItem({ notification, onRead, style }: NotificationItemProps) {
  const handleClick = () => {
    if (!notification.isRead) {
      onRead(notification.id);
    }
  };

  return (
    <Link
      href={getNotificationLink(notification)}
      onClick={handleClick}
      style={style}
      className={cn(
        "flex items-start gap-3 p-3 hover:bg-muted/50 transition-all duration-200",
        !notification.isRead && "bg-primary/5"
      )}
    >
      <div className="relative">
        <Avatar className="h-10 w-10 ring-2 ring-transparent hover:ring-primary/20 transition-all duration-200">
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
        <p className={cn("text-sm transition-colors duration-200", !notification.isRead && "font-medium")}>
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatTimeAgo(notification.createdAt)}
        </p>
      </div>

      {!notification.isRead && (
        <div className="h-2 w-2 rounded-full bg-gradient-to-br from-primary to-[oklch(0.45_0.20_25)] mt-2 shrink-0 animate-pulse" />
      )}
    </Link>
  );
}
