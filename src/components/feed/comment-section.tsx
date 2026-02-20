"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { isDuplicateSubmission } from "@/lib/dedup";
import { springs, scaleIn, noMotion } from "@/lib/animations";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CommentItem } from "./comment-item";
import { CommentInput } from "./comment-input";
import { CommentSortControls } from "./comment-sort-controls";
import { COMMENTS_PER_PAGE, COMMENTS_EXPANDED_PER_PAGE, REPLIES_LOAD_LIMIT } from "@/lib/constants";
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

// Cache module-level do avatar do usuário para evitar fetches redundantes em /api/users/me
let cachedUserAvatar: string | null | undefined = undefined;
let avatarFetchPromise: Promise<string | null> | null = null;

async function fetchCachedUserAvatar(): Promise<string | null> {
  if (cachedUserAvatar !== undefined) return cachedUserAvatar;
  if (avatarFetchPromise) return avatarFetchPromise;

  avatarFetchPromise = fetch("/api/users/me")
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        cachedUserAvatar = data.user.avatar ?? null;
        return cachedUserAvatar as string | null;
      }
      cachedUserAvatar = null;
      return null;
    })
    .catch(() => {
      cachedUserAvatar = null;
      return null;
    })
    .finally(() => {
      avatarFetchPromise = null;
    });

  return avatarFetchPromise;
}

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

  const fetchComments = useCallback(async (sortOption: SortOption, cursor?: string | null, limit: number = COMMENTS_PER_PAGE) => {
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
        setComments((prev) => [...prev, ...data.comments]);
      } else {
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

  useEffect(() => {
    if (session?.user) {
      fetchCachedUserAvatar().then((avatar) => {
        setCurrentUserAvatar(avatar);
      });
    }
  }, [session]);

  useEffect(() => {
    if (initialCommentsCount > 0 && !previewLoaded) {
      fetchComments("popular");
      setPreviewLoaded(true);
    }
  }, [initialCommentsCount, previewLoaded, fetchComments]);

  useEffect(() => {
    if (isExpanded && previewLoaded) {
      fetchComments(sort, null, COMMENTS_EXPANDED_PER_PAGE);
    }
  }, [sort, isExpanded, previewLoaded, fetchComments]);

  const handleSortChange = useCallback(() => {
    setSort((prev) => prev === "popular" ? "recent" : "popular");
    setNextCursor(null);
  }, []);

  const handleExpand = useCallback(() => {
    setIsExpanded((prev) => {
      if (!prev) return true;
      fetchComments("popular", null, COMMENTS_PER_PAGE);
      return false;
    });
  }, [fetchComments]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && nextCursor && !isLoading) {
      fetchComments(sort, nextCursor, COMMENTS_EXPANDED_PER_PAGE);
    }
  }, [hasMore, nextCursor, isLoading, sort, fetchComments]);

  const handleSubmit = useCallback(async () => {
    if (!newComment.trim() || isSending) return;

    if (isDuplicateSubmission(newComment)) return;

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
  }, [newComment, isSending, postId, replyingTo, onInputClose]);

  const handleReply = useCallback((parentId: string, authorName: string) => {
    setReplyingTo(parentId);
    setReplyingToAuthor(authorName);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
    setReplyingToAuthor(null);
  }, []);

  const handleEditComment = useCallback((commentId: string, newContent: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, content: newContent, updatedAt: new Date().toISOString() }
          : c
      )
    );
  }, []);

  const handleDeleteComment = useCallback((commentId: string) => {
    if (replyingTo === commentId) {
      handleCancelReply();
    }
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setCommentsCount((prev) => prev - 1);
  }, [replyingTo, handleCancelReply]);

  const handleEditReply = useCallback((replyId: string, newContent: string, parentId: string) => {
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
  }, []);

  const handleDeleteReply = useCallback((replyId: string, parentId: string) => {
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
  }, []);

  const handleLoadMoreReplies = useCallback(async (commentId: string) => {
    if (loadingReplies.has(commentId)) return;

    setLoadingReplies((prev) => new Set(prev).add(commentId));
    try {
      const comment = comments.find((c) => c.id === commentId);
      const currentRepliesCount = comment?.replies?.length || 0;

      const response = await fetch(
        `/api/comments/${commentId}/replies?offset=${currentRepliesCount}&limit=${REPLIES_LOAD_LIMIT}`
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
  }, [loadingReplies, comments]);

  if (commentsCount === 0 && !isExpanded && comments.length === 0 && !showInput) {
    return null;
  }

  if (commentsCount === 0 && !isExpanded && comments.length === 0 && showInput) {
    return (
      <div className="px-6 pb-4">
        <Separator className="mb-4" />
        {session?.user && (
          <CommentInput
            userName={session.user.name || ""}
            userAvatar={currentUserAvatar}
            value={newComment}
            onChange={setNewComment}
            onSubmit={handleSubmit}
            isSending={isSending}
          />
        )}
      </div>
    );
  }

  return (
    <div className="px-6 pb-4">
      <Separator className="mb-4" />

      <CommentSortControls
        commentsCount={commentsCount}
        isExpanded={isExpanded}
        sort={sort}
        onSortChange={handleSortChange}
      />

      {showInput && !replyingTo && session?.user && (
        <CommentInput
          userName={session.user.name || ""}
          userAvatar={currentUserAvatar}
          value={newComment}
          onChange={setNewComment}
          onSubmit={handleSubmit}
          isSending={isSending}
          replyingToAuthor={replyingToAuthor}
          onCancelReply={handleCancelReply}
        />
      )}

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

                {replyingTo === comment.id && session?.user && (
                  <div className="ml-8 pl-4 mt-1">
                    <CommentInput
                      userName={session.user.name || ""}
                      userAvatar={currentUserAvatar}
                      value={newComment}
                      onChange={setNewComment}
                      onSubmit={handleSubmit}
                      isSending={isSending}
                      replyingToAuthor={replyingToAuthor}
                      onCancelReply={handleCancelReply}
                    />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="flex flex-col items-center gap-2 mt-2">
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

        {commentsCount > COMMENTS_PER_PAGE && (
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
