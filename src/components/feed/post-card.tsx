"use client";

import Image from "next/image";
import { X, MoreHorizontal, Trash2, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PostData } from "@/types";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { usePostInteractions } from "@/hooks/use-post-interactions";
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
  const {
    targetPost, isRepost, isAuthor, isTargetAuthor,
    isLiked, likesCount, justLiked, likeControls, handleLike,
    hasReposted, repostsCount, isReposting, handleRepost,
    isDeleting, showDeleteConfirm, setShowDeleteConfirm, handleDelete, handleDeleteClick,
    isEditing, setIsEditing, editContent, setEditContent, isSaving, isEdited,
    displayContent, handleEdit, startEditing,
    showCommentInput, commentsCount, setCommentsCount, handleToggleComments, handleCloseCommentInput,
    selectedImage, setSelectedImage, handleImageClick,
  } = usePostInteractions({ post, onDelete, onLikeToggle });

  return (
    <div className="bento-card-static shadow-depth-1 relative">
      {isRepost && (
        <PostRepostInfo
          authorName={post.author.name}
          authorUsername={post.author.username}
        />
      )}

      <div className="px-4 pt-3 pb-2">
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
              isEdited={isEdited}
            />
            {isAuthor && !isRepost && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 absolute top-2 right-2 hover:bg-accent/80" aria-label="Mais opções">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="animate-scale-in">
                  <DropdownMenuItem onClick={startEditing}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
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

      <div className="px-4 pb-3">
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
            content={displayContent}
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
            className="absolute -top-10 right-0 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-fast z-10"
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

      {/* Modal de edição */}
      <Dialog open={isEditing} onOpenChange={setIsEditing} modal={false}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar post</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[120px]"
              placeholder="O que você está pensando?"
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground mt-1.5 text-right">
              {editContent.length}/5000
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEdit}
              disabled={!editContent.trim() || editContent.trim() === displayContent || isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Pencil className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
