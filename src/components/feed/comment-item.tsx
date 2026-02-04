"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Heart, Loader2, MessageSquare, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CommentAuthor {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
}

interface CommentItemProps {
  comment: {
    id: string;
    content: string;
    createdAt: string;
    updatedAt?: string;
    author: CommentAuthor;
    likesCount: number;
    isLiked: boolean;
    parentId?: string | null;
  };
  currentUserId?: string;
  onLikeToggle?: (commentId: string, isLiked: boolean) => void;
  onEdit?: (commentId: string, newContent: string) => void;
  onDelete?: (commentId: string) => void;
  onReply?: (parentId: string, authorName: string) => void;
  isReply?: boolean;
  showReplyButton?: boolean;
}

export function CommentItem({
  comment,
  currentUserId,
  onLikeToggle,
  onEdit,
  onDelete,
  onReply,
  isReply = false,
  showReplyButton = true,
}: CommentItemProps) {
  const [isLiked, setIsLiked] = useState(comment.isLiked);
  const [likesCount, setLikesCount] = useState(comment.likesCount);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAuthor = currentUserId === comment.author.id;
  const isEdited = comment.updatedAt && new Date(comment.updatedAt) > new Date(comment.createdAt);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLike = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/comments/${comment.id}/like`, {
        method: "POST",
      });

      if (!response.ok) throw new Error();

      const data = await response.json();
      setIsLiked(data.liked);
      setLikesCount((prev) => (data.liked ? prev + 1 : prev - 1));
      onLikeToggle?.(comment.id, data.liked);
    } catch {
      toast.error("Erro ao curtir comentário");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEdit = () => {
    setEditContent(comment.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditContent(comment.content);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || isSaving) return;
    if (editContent.trim() === comment.content) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/comments/${comment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao editar comentário");
      }

      onEdit?.(comment.id, editContent.trim());
      setIsEditing(false);
      toast.success("Comentário editado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao editar comentário");
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      handleCancelEdit();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    }
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja excluir este comentário?")) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/comments/${comment.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao excluir comentário");
      }

      onDelete?.(comment.id);
      toast.success("Comentário excluído");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir comentário");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReply = () => {
    onReply?.(comment.parentId || comment.id, comment.author.name);
  };

  return (
    <div className={cn("flex gap-3 py-3 transition-all duration-200", isReply && "py-2")}>
      <Link href={`/profile/${comment.author.username}`}>
        <Avatar className={cn("avatar-ring-hover transition-all duration-200", isReply ? "h-6 w-6" : "h-8 w-8")}>
          <AvatarImage
            src={comment.author.avatar || undefined}
            alt={comment.author.name}
            className="object-cover"
          />
          <AvatarFallback className={cn("bg-primary text-primary-foreground", isReply ? "text-[10px]" : "text-xs")}>
            {getInitials(comment.author.name)}
          </AvatarFallback>
        </Avatar>
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${comment.author.username}`}
              className="font-medium text-sm hover:underline"
            >
              {comment.author.name}
            </Link>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.createdAt), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
            {isEdited && (
              <span className="text-xs text-muted-foreground">(editado)</span>
            )}
          </div>

          {isAuthor && !isEditing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={isDeleting}>
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleStartEdit}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {isEditing ? (
          <div className="mt-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[60px] max-h-[120px] resize-none text-sm"
              autoFocus
              disabled={isSaving}
            />
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={!editContent.trim() || isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm mt-1 whitespace-pre-wrap break-words">
            {comment.content}
          </p>
        )}

        <div className="flex items-center gap-1 mt-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 gap-1 text-xs transition-all duration-200",
              isLiked && "text-primary hover:text-primary"
            )}
            onClick={handleLike}
            disabled={isLoading}
          >
            <Heart className={cn(
              "h-3 w-3 transition-transform duration-200",
              isLiked && "fill-current animate-heart-pop"
            )} />
            {likesCount > 0 && <span>{likesCount}</span>}
          </Button>

          {showReplyButton && !isReply && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleReply}
            >
              <MessageSquare className="h-3 w-3" />
              Responder
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
