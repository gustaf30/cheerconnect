"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Sender {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  sender: Sender;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar?: boolean;
}

const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export function MessageBubble({ message, isOwn, showAvatar = true }: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "flex items-end gap-2 max-w-[80%] animate-slide-up",
        isOwn ? "ml-auto flex-row-reverse" : "mr-auto"
      )}
    >
      {showAvatar && !isOwn ? (
        <Avatar className="h-8 w-8 shrink-0 avatar-ring-hover transition-all duration-200">
          <AvatarImage
            src={message.sender.avatar || undefined}
            alt={message.sender.name}
            className="object-cover"
          />
          <AvatarFallback className="bg-muted text-xs">
            {getInitials(message.sender.name)}
          </AvatarFallback>
        </Avatar>
      ) : (
        !isOwn && <div className="w-8 shrink-0" />
      )}

      <div
        className={cn(
          "rounded-2xl px-4 py-2 break-words transition-all duration-200",
          isOwn
            ? "bg-primary text-primary-foreground rounded-br-sm message-bubble-sent hover:shadow-md"
            : "bg-muted rounded-bl-sm message-bubble-received hover:shadow-sm"
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <p
          className={cn(
            "text-[10px] mt-1",
            isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {formatTime(message.createdAt)}
          {isOwn && message.isRead && " • Lida"}
        </p>
      </div>
    </div>
  );
}
