"use client";

import { useCallback, useState } from "react";
import { useSession } from "next-auth/react";
import { useAnimation, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { PostData } from "@/types";

interface UsePostInteractionsOptions {
  post: PostData;
  onDelete?: (id: string) => void;
  onLikeToggle?: (id: string) => void;
}

export function usePostInteractions({
  post,
  onDelete,
  onLikeToggle,
}: UsePostInteractionsOptions) {
  const { data: session } = useSession();
  const likeControls = useAnimation();
  const shouldReduceMotion = useReducedMotion();

  // Dados derivados
  const targetPost = post.originalPost || post;
  const isRepost = !!post.originalPostId;
  const isAuthor = session?.user?.id === post.author.id;
  const isTargetAuthor = session?.user?.id === targetPost.author.id;

  // Like
  const [isLiked, setIsLiked] = useState(targetPost.isLiked);
  const [likesCount, setLikesCount] = useState(targetPost._count.likes);
  const [justLiked, setJustLiked] = useState(false);

  // Repost
  const [hasReposted, setHasReposted] = useState(false);
  const [repostsCount, setRepostsCount] = useState(targetPost._count.reposts || 0);
  const [isReposting, setIsReposting] = useState(false);

  // Delete
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Edit
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEdited, setIsEdited] = useState(!!post.isEdited);
  const [displayContent, setDisplayContent] = useState(post.content);

  // Comments
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentsCount, setCommentsCount] = useState(targetPost._count.comments);

  // Image
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // --- Handlers ---

  const handleLike = useCallback(async () => {
    const wasLiked = isLiked;
    const prevCount = likesCount;

    // Optimistic update
    setIsLiked(!wasLiked);
    setLikesCount(wasLiked ? prevCount - 1 : prevCount + 1);
    onLikeToggle?.(post.id);

    if (!wasLiked) {
      setJustLiked(true);
      setTimeout(() => setJustLiked(false), 400);
      if (!shouldReduceMotion) {
        likeControls.start({
          scale: [1, 1.04, 0.99, 1.01, 1],
          transition: { duration: 0.4, ease: "easeOut" },
        });
      }
    }

    try {
      const response = await fetch(`/api/posts/${targetPost.id}/like`, {
        method: wasLiked ? "DELETE" : "POST",
      });
      if (!response.ok) throw new Error();
    } catch {
      // Rollback em caso de erro
      setIsLiked(wasLiked);
      setLikesCount(prevCount);
      toast.error("Erro ao curtir post");
    }
  }, [isLiked, likesCount, shouldReduceMotion, likeControls, targetPost.id, post.id, onLikeToggle]);

  const handleRepost = useCallback(async () => {
    if (isTargetAuthor) {
      toast.error("Você não pode repostar sua própria publicação");
      return;
    }

    setIsReposting(true);
    try {
      if (hasReposted) {
        const response = await fetch(`/api/posts/${targetPost.id}/repost`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error();

        setHasReposted(false);
        setRepostsCount((prev) => prev - 1);
        toast.success("Repost removido");
      } else {
        const response = await fetch(`/api/posts/${targetPost.id}/repost`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Erro ao repostar");
        }

        setHasReposted(true);
        setRepostsCount((prev) => prev + 1);
        toast.success("Repostado!");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao repostar");
    } finally {
      setIsReposting(false);
    }
  }, [isTargetAuthor, hasReposted, targetPost.id]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();

      toast.success("Post excluído");
      onDelete?.(post.id);
    } catch {
      toast.error("Erro ao excluir post");
    } finally {
      setIsDeleting(false);
    }
  }, [post.id, onDelete]);

  const handleDeleteClick = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleEdit = useCallback(async () => {
    const trimmed = editContent.trim();
    if (!trimmed || trimmed === displayContent) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao editar post");
      }

      setDisplayContent(trimmed);
      setIsEdited(true);
      setIsEditing(false);
      toast.success("Post editado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao editar post");
    } finally {
      setIsSaving(false);
    }
  }, [editContent, displayContent, post.id]);

  const startEditing = useCallback(() => {
    setEditContent(displayContent);
    setIsEditing(true);
  }, [displayContent]);

  const handleToggleComments = useCallback(() => {
    setShowCommentInput((prev) => !prev);
  }, []);

  const handleImageClick = useCallback((image: string) => {
    setSelectedImage(image);
  }, []);

  const handleCloseCommentInput = useCallback(() => {
    setShowCommentInput(false);
  }, []);

  return {
    // Dados derivados
    targetPost,
    isRepost,
    isAuthor,
    isTargetAuthor,

    // Like
    isLiked,
    likesCount,
    justLiked,
    likeControls,
    handleLike,

    // Repost
    hasReposted,
    repostsCount,
    isReposting,
    handleRepost,

    // Delete
    isDeleting,
    showDeleteConfirm,
    setShowDeleteConfirm,
    handleDelete,
    handleDeleteClick,

    // Edit
    isEditing,
    setIsEditing,
    editContent,
    setEditContent,
    isSaving,
    isEdited,
    displayContent,
    handleEdit,
    startEditing,

    // Comments
    showCommentInput,
    commentsCount,
    setCommentsCount,
    handleToggleComments,
    handleCloseCommentInput,

    // Image
    selectedImage,
    setSelectedImage,
    handleImageClick,
  };
}
