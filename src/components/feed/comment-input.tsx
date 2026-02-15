"use client";

import { Loader2, Send, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getInitials } from "@/lib/utils";

interface CommentInputProps {
  userName: string;
  userAvatar: string | null;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isSending: boolean;
  replyingToAuthor?: string | null;
  onCancelReply?: () => void;
}

export function CommentInput({
  userName,
  userAvatar,
  value,
  onChange,
  onSubmit,
  isSending,
  replyingToAuthor,
  onCancelReply,
}: CommentInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="mb-4">
      {replyingToAuthor && (
        <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground min-w-0">
          <span className="truncate">Respondendo a <span className="font-medium text-foreground">@{replyingToAuthor}</span></span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onCancelReply}
            aria-label="Cancelar resposta"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
      <div className="flex gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage
            src={userAvatar || undefined}
            alt={userName}
            className="object-cover"
          />
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            {userName ? getInitials(userName) : "U"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 flex gap-2">
          <Textarea
            placeholder={replyingToAuthor ? "Responder..." : "Comentar..."}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[40px] max-h-[120px] resize-none"
            rows={1}
            autoFocus
          />
          <Button
            size="icon"
            onClick={onSubmit}
            disabled={!value.trim() || isSending}
            aria-label="Enviar comentário"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
