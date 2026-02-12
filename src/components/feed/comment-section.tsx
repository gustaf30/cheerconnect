"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronUp, Loader2, Send, X } from "lucide-react";
import { springs, scaleIn, noMotion } from "@/lib/animations";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { CommentItem } from "./comment-item";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";

interface CommentAuthor {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
}

interface Reply {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  author: CommentAuthor;
  likesCount: number;
  isLiked: boolean;
  parentId: string;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  author: CommentAuthor;
  likesCount: number;
  isLiked: boolean;
  repliesCount?: number;
  replies?: Reply[];
}

interface CommentSectionProps {
  postId: string;
  initialCommentsCount: number;
  showInput?: boolean;
  onCommentsCountChange?: (count: number) => void;
  onInputClose?: () => void;
}

type SortOption = "popular" | "recent";

export function CommentSection({ postId, initialCommentsCount, showInput = false, onCommentsCountChange, onInputClose }: CommentSectionProps) {
  const { data: session } = useSession();
  const shouldReduceMotion = useReducedMotion();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sort, setSort] = useState<SortOption>("popular");
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [commentsCount, setCommentsCountRaw] = useState(initialCommentsCount);
  const [previewLoaded, setPreviewLoaded] = useState(false);

  const setCommentsCount = (updater: number | ((prev: number) => number)) => {
    setCommentsCountRaw(updater);
  };

  useEffect(() => {
    onCommentsCountChange?.(commentsCount);
  }, [commentsCount, onCommentsCountChange]);

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyingToAuthor, setReplyingToAuthor] = useState<string | null>(null);
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);

  const fetchComments = useCallback(async (sortOption: SortOption, cursor?: string | null, limit: number = 3) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        sort: sortOption,
        limit: limit.toString(),
      });
      if (cursor) {
        params.append("cursor", cursor);
      }

      const response = await fetch(`/api/posts/${postId}/comments?${params}`);
      if (!response.ok) throw new Error();

      const data = await response.json();

      if (cursor) {
        // Adicionar aos comentários existentes
        setComments((prev) => [...prev, ...data.comments]);
      } else {
        // Substituir comentários
        setComments(data.comments);
      }

      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch {
      toast.error("Erro ao carregar comentários");
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  // Buscar avatar do usuário atual (não armazenado no JWT para evitar HTTP 431)
  useEffect(() => {
    const fetchUserAvatar = async () => {
      try {
        const res = await fetch("/api/users/me");
        if (res.ok) {
          const data = await res.json();
          setCurrentUserAvatar(data.user.avatar);
        }
      } catch {
        // Ignorar erros - fallback para iniciais
      }
    };
    if (session?.user) {
      fetchUserAvatar();
    }
  }, [session]);

  // Carregar preview ao montar o componente se houver comentários
  useEffect(() => {
    if (initialCommentsCount > 0 && !previewLoaded) {
      fetchComments("popular");
      setPreviewLoaded(true);
    }
  }, [initialCommentsCount, previewLoaded, fetchComments]);

  // Rebuscar quando a ordenação muda e está expandido
  useEffect(() => {
    if (isExpanded && previewLoaded) {
      fetchComments(sort, null, 10);
    }
  }, [sort, isExpanded, previewLoaded, fetchComments]);

  const handleSortChange = () => {
    const newSort = sort === "popular" ? "recent" : "popular";
    setSort(newSort);
    setNextCursor(null);
  };

  const handleExpand = () => {
    if (!isExpanded) {
      setIsExpanded(true);
      // O useEffect vai refetch automaticamente com limit=10
    } else {
      setIsExpanded(false);
      // Mostrar apenas preview novamente
      fetchComments("popular", null, 3);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && nextCursor && !isLoading) {
      fetchComments(sort, nextCursor, 10);
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || isSending) return;

    setIsSending(true);
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newComment.trim(),
          parentId: replyingTo || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao adicionar comentário");
      }

      const data = await response.json();

      if (replyingTo) {
        // Adicionar resposta ao comentário pai
        const newReply: Reply = {
          id: data.comment.id,
          content: data.comment.content,
          createdAt: data.comment.createdAt,
          author: data.comment.author,
          likesCount: 0,
          isLiked: false,
          parentId: replyingTo,
        };

        setComments((prev) =>
          prev.map((c) =>
            c.id === replyingTo
              ? {
                  ...c,
                  replies: [...(c.replies || []), newReply],
                  repliesCount: (c.repliesCount || 0) + 1,
                }
              : c
          )
        );
        setReplyingTo(null);
        setReplyingToAuthor(null);
        toast.success("Resposta adicionada");
      } else {
        // Adicionar novo comentário de nível superior
        const newCommentData: Comment = {
          id: data.comment.id,
          content: data.comment.content,
          createdAt: data.comment.createdAt,
          author: data.comment.author,
          likesCount: 0,
          isLiked: false,
          repliesCount: 0,
          replies: [],
        };

        setComments((prev) => [newCommentData, ...prev]);
        setCommentsCount((prev) => prev + 1);
        toast.success("Comentário adicionado");
      }

      setNewComment("");
      onInputClose?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar comentário");
    } finally {
      setIsSending(false);
    }
  };

  const handleReply = (parentId: string, authorName: string) => {
    setReplyingTo(parentId);
    setReplyingToAuthor(authorName);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyingToAuthor(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleEditComment = (commentId: string, newContent: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, content: newContent, updatedAt: new Date().toISOString() }
          : c
      )
    );
  };

  const handleDeleteComment = (commentId: string) => {
    // Cancelar resposta se estamos respondendo a este comentário
    if (replyingTo === commentId) {
      handleCancelReply();
    }
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setCommentsCount((prev) => prev - 1);
  };

  const handleEditReply = (replyId: string, newContent: string, parentId: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === parentId
          ? {
              ...c,
              replies: c.replies?.map((r) =>
                r.id === replyId
                  ? { ...r, content: newContent, updatedAt: new Date().toISOString() }
                  : r
              ),
            }
          : c
      )
    );
  };

  const handleDeleteReply = (replyId: string, parentId: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === parentId
          ? {
              ...c,
              replies: c.replies?.filter((r) => r.id !== replyId),
              repliesCount: Math.max(0, (c.repliesCount || 0) - 1),
            }
          : c
      )
    );
  };

  const handleLoadMoreReplies = async (commentId: string) => {
    if (loadingReplies.has(commentId)) return;

    setLoadingReplies((prev) => new Set(prev).add(commentId));
    try {
      const comment = comments.find((c) => c.id === commentId);
      const currentRepliesCount = comment?.replies?.length || 0;

      const response = await fetch(
        `/api/comments/${commentId}/replies?offset=${currentRepliesCount}&limit=10`
      );
      if (!response.ok) throw new Error();

      const data = await response.json();

      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                replies: [...(c.replies || []), ...data.replies],
              }
            : c
        )
      );
    } catch {
      toast.error("Erro ao carregar respostas");
    } finally {
      setLoadingReplies((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    }
  };

  // Sem comentários e input oculto — nada a renderizar
  if (commentsCount === 0 && !isExpanded && comments.length === 0 && !showInput) {
    return null;
  }

  // Sem comentários mas input visível
  if (commentsCount === 0 && !isExpanded && comments.length === 0 && showInput) {
    return (
      <div className="px-6 pb-4">
        <Separator className="mb-4" />
        {session?.user && (
          <div className="flex gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={currentUserAvatar || undefined}
                alt={session.user.name || ""}
                className="object-cover"
              />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {session.user.name ? getInitials(session.user.name) : "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 flex gap-2">
              <Textarea
                placeholder="Escreva um comentário..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[40px] max-h-[120px] resize-none"
                rows={1}
                autoFocus
              />
              <Button
                size="icon"
                onClick={handleSubmit}
                disabled={!newComment.trim() || isSending}
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
        )}
      </div>
    );
  }

  return (
    <div className="px-6 pb-4">
      <Separator className="mb-4" />

      {/* Cabeçalho com alternância de ordenação */}
      {commentsCount > 0 && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">
            {commentsCount} {commentsCount === 1 ? "comentário" : "comentários"}
          </span>
          {isExpanded && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={handleSortChange}
            >
              {sort === "popular" ? "Mais curtidos" : "Mais recentes"}
            </Button>
          )}
        </div>
      )}

      {/* Input de comentário — visível apenas quando showInput ou respondendo */}
      {(showInput || replyingTo) && session?.user && (
        <div className="mb-4">
          {/* Indicador de resposta */}
          {replyingTo && replyingToAuthor && (
            <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
              <span>Respondendo a <span className="font-medium text-foreground">@{replyingToAuthor}</span></span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={handleCancelReply}
                aria-label="Cancelar resposta"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="flex gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={currentUserAvatar || undefined}
                alt={session.user.name || ""}
                className="object-cover"
              />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {session.user.name ? getInitials(session.user.name) : "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 flex gap-2">
              <Textarea
                placeholder={replyingTo ? "Escreva uma resposta..." : "Escreva um comentário..."}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[40px] max-h-[120px] resize-none"
                rows={1}
                autoFocus
              />
              <Button
                size="icon"
                onClick={handleSubmit}
                disabled={!newComment.trim() || isSending}
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
      )}

      {/* Lista de comentários */}
      {isLoading && comments.length === 0 ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {comments.map((comment) => (
              <motion.div
                key={comment.id}
                variants={shouldReduceMotion ? noMotion : scaleIn}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={shouldReduceMotion ? { duration: 0.15 } : springs.bouncy}
              >
                <CommentItem
                  comment={comment}
                  currentUserId={session?.user?.id}
                  onEdit={handleEditComment}
                  onDelete={handleDeleteComment}
                  onReply={handleReply}
                  showReplyButton={true}
                />

                {/* Respostas */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="ml-8 border-l-2 border-primary/20 pl-4">
                    <AnimatePresence initial={false}>
                      {comment.replies.map((reply) => (
                        <motion.div
                          key={reply.id}
                          variants={shouldReduceMotion ? noMotion : scaleIn}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          transition={shouldReduceMotion ? { duration: 0.15 } : springs.bouncy}
                        >
                          <CommentItem
                            comment={reply}
                            currentUserId={session?.user?.id}
                            onEdit={(replyId, newContent) => handleEditReply(replyId, newContent, comment.id)}
                            onDelete={(replyId) => handleDeleteReply(replyId, comment.id)}
                            onReply={handleReply}
                            isReply={true}
                            showReplyButton={false}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {/* Botão de carregar mais respostas */}
                    {(comment.repliesCount || 0) > (comment.replies?.length || 0) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground ml-2 mt-1"
                        onClick={() => handleLoadMoreReplies(comment.id)}
                        disabled={loadingReplies.has(comment.id)}
                      >
                        {loadingReplies.has(comment.id) ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : null}
                        Ver mais {(comment.repliesCount || 0) - (comment.replies?.length || 0)} resposta(s)
                      </Button>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Expandir/Recolher e Carregar mais */}
      <div className="flex flex-col items-center gap-2 mt-2">
        {/* Carregar mais (quando expandido e há mais) */}
        <AnimatePresence>
          {isExpanded && hasMore && (
            <motion.div
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={shouldReduceMotion ? { duration: 0.15 } : springs.gentle}
            >
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Carregar mais
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botão expandir/recolher */}
        {commentsCount > 3 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1"
            onClick={handleExpand}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Mostrar menos
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Ver todos os {commentsCount} comentários
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
