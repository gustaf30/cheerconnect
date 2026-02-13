"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { X, MoreHorizontal, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useAnimation, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PostData } from "@/types";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PostRepostInfo } from "./post-repost-info";
import { PostHeader } from "./post-header";
import { PostContent, renderContentWithLinks } from "./post-content";
import { PostActions } from "./post-actions";
import { CommentSection } from "./comment-section";

interface PostProps {
  post: PostData;
  onDelete?: (id: string) => void;
  onLikeToggle?: (id: string) => void;
}

export function PostCard({ post, onDelete, onLikeToggle }: PostProps) {
  const { data: session } = useSession();
  const likeControls = useAnimation();
  const shouldReduceMotion = useReducedMotion();

  const targetPost = post.originalPost || post;
  const isRepost = !!post.originalPostId;

  const [isLiked, setIsLiked] = useState(targetPost.isLiked);
  const [likesCount, setLikesCount] = useState(targetPost._count.likes);
  const [repostsCount, setRepostsCount] = useState(targetPost._count.reposts || 0);
  const [hasReposted, setHasReposted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReposting, setIsReposting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [justLiked, setJustLiked] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentsCount, setCommentsCount] = useState(targetPost._count.comments);

  const isAuthor = session?.user?.id === post.author.id;
  const isTargetAuthor = session?.user?.id === targetPost.author.id;

  const handleLike = useCallback(async () => {
    try {
      if (!isLiked && !shouldReduceMotion) {
        likeControls.start({
          scale: [1, 1.3, 0.95, 1.1, 1],
          transition: { duration: 0.4, ease: "easeOut" }
        });
      }

      const response = await fetch(`/api/posts/${targetPost.id}/like`, {
        method: isLiked ? "DELETE" : "POST",
      });

      if (!response.ok) throw new Error();

      if (!isLiked) {
        setJustLiked(true);
        setTimeout(() => setJustLiked(false), 400);
      }

      setIsLiked(!isLiked);
      setLikesCount((prev) => (isLiked ? prev - 1 : prev + 1));
      onLikeToggle?.(post.id);
    } catch {
      toast.error("Erro ao curtir post");
    }
  }, [isLiked, shouldReduceMotion, likeControls, targetPost.id, post.id, onLikeToggle]);

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

  const handleToggleComments = useCallback(() => {
    setShowCommentInput((prev) => !prev);
  }, []);

  const handleImageClick = useCallback((image: string) => {
    setSelectedImage(image);
  }, []);

  const handleCloseCommentInput = useCallback(() => {
    setShowCommentInput(false);
  }, []);

  return (
    <div className="bento-card-static relative">
      <div className="accent-bar" />

      {isRepost && (
        <PostRepostInfo
          authorName={post.author.name}
          authorUsername={post.author.username}
        />
      )}

      <div className="px-5 pt-4 pb-3">
        {isRepost && post.originalPost ? (
          <PostHeader
            author={post.originalPost.author}
            team={post.originalPost.team}
            createdAt={post.originalPost.createdAt}
            isEdited={!!post.originalPost.isEdited}
            showMenu={isAuthor}
            isDeleting={isDeleting}
            onDeleteClick={handleDeleteClick}
          />
        ) : (
          <>
            <PostHeader
              author={post.author}
              team={post.team}
              createdAt={post.createdAt}
              isEdited={!!post.isEdited}
            />
            {isAuthor && !isRepost && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 absolute top-3 right-3 hover:bg-accent/80" aria-label="Mais opções">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="animate-scale-in">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={handleDeleteClick}
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )}
      </div>

      <div className="px-5 pb-3">
        {isRepost && post.content && (
          <div className="mb-3 pb-3 border-b border-border/50">
            <p className="whitespace-pre-wrap text-sm">{renderContentWithLinks(post.content)}</p>
          </div>
        )}

        {isRepost && post.originalPost ? (
          <PostContent
            content={post.originalPost.content}
            images={post.originalPost.images}
            videoUrl={post.originalPost.videoUrl}
            authorName={post.originalPost.author.name}
            onImageClick={handleImageClick}
          />
        ) : (
          <PostContent
            content={post.content}
            images={post.images}
            videoUrl={post.videoUrl}
            authorName={post.author.name}
            onImageClick={handleImageClick}
          />
        )}
      </div>

      <PostActions
        isLiked={isLiked}
        likesCount={likesCount}
        commentsCount={commentsCount}
        repostsCount={repostsCount}
        hasReposted={hasReposted}
        justLiked={justLiked}
        showCommentInput={showCommentInput}
        isRepost={isRepost}
        isTargetAuthor={isTargetAuthor}
        isReposting={isReposting}
        likeControls={likeControls}
        onLike={handleLike}
        onToggleComments={handleToggleComments}
        onRepost={handleRepost}
      />

      <CommentSection
        postId={targetPost.id}
        initialCommentsCount={targetPost._count.comments}
        showInput={showCommentInput}
        onCommentsCountChange={setCommentsCount}
        onInputClose={handleCloseCommentInput}
      />

      {/* Modal de visualização de imagem */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-0 bg-transparent" showCloseButton={false}>
          <DialogTitle className="sr-only">Visualizar imagem</DialogTitle>
          <button
            onClick={() => setSelectedImage(null)}
            aria-label="Fechar imagem"
            className="absolute -top-10 right-0 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-fast z-10 hover:scale-105"
          >
            <X className="h-6 w-6" />
          </button>
          {selectedImage && (
            <Image
              src={selectedImage}
              alt={`Imagem ampliada do post de ${targetPost.author.name}`}
              width={1200}
              height={800}
              className="max-w-full max-h-[90vh] object-contain rounded-lg animate-scale-in"
              unoptimized
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Excluir este post?"
        confirmLabel="Excluir"
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
