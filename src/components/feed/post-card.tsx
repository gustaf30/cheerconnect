"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Heart, MessageCircle, MoreHorizontal, Trash2, X, Repeat2, ZoomIn } from "lucide-react";
import { useSession } from "next-auth/react";
import { motion, useAnimation, useReducedMotion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn, getInitials } from "@/lib/utils";
import { positionLabels } from "@/lib/constants";
import { PostAuthor, PostTeam, PostData } from "@/types";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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

  // Para reposts, likes/comentários vão para o post original
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

  const handleLike = async () => {
    try {
      // Animação spring para botão de curtida
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
  };

  const handleRepost = async () => {
    if (isTargetAuthor) {
      toast.error("Você não pode repostar sua própria publicação");
      return;
    }

    setIsReposting(true);
    try {
      if (hasReposted) {
        // Remover repost
        const response = await fetch(`/api/posts/${targetPost.id}/repost`, {
          method: "DELETE",
        });

        if (!response.ok) throw new Error();

        setHasReposted(false);
        setRepostsCount((prev) => prev - 1);
        toast.success("Repost removido");
      } else {
        // Criar repost
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
  };

  const handleDelete = async () => {
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
  };

  const renderAuthorHeader = (
    author: PostAuthor,
    team: PostTeam | null | undefined,
    createdAt: string | Date,
    showRepostIndicator: boolean = false
  ) => (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        {team ? (
          // Post de equipe — mostrar equipe como autor
          <>
            <Link href={`/teams/${team.slug}`}>
              <div>
                <Avatar className="h-10 w-10 ring-2 ring-transparent hover:ring-primary/30 transition-base avatar-glow">
                  <AvatarImage
                    src={team.logo || undefined}
                    alt={team.name}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground font-display font-semibold">
                    {getInitials(team.name)}
                  </AvatarFallback>
                </Avatar>
              </div>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/teams/${team.slug}`}
                  className="font-display font-semibold hover:underline animated-underline"
                >
                  {team.name}
                </Link>
                <Badge variant="subtle" className="text-xs">
                  Equipe
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <time dateTime={new Date(createdAt).toISOString()}>
                  {formatDistanceToNow(new Date(createdAt), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </time>
              </div>
            </div>
          </>
        ) : (
          // Post de usuário — mostrar usuário como autor
          <>
            <Link href={`/profile/${author.username}`}>
              <div>
                <Avatar className="h-10 w-10 ring-2 ring-transparent hover:ring-primary/30 transition-base avatar-glow">
                  <AvatarImage
                    src={author.avatar || undefined}
                    alt={author.name}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground font-display font-semibold">
                    {getInitials(author.name)}
                  </AvatarFallback>
                </Avatar>
              </div>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/profile/${author.username}`}
                  className="font-display font-semibold hover:underline animated-underline"
                >
                  {author.name}
                </Link>
                {author.positions.length > 0 && (
                  <Badge variant="subtle" className="text-xs">
                    {positionLabels[author.positions[0]] ||
                      author.positions[0]}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Link
                  href={`/profile/${author.username}`}
                  className="hover:underline"
                >
                  @{author.username}
                </Link>
                <span>·</span>
                <time dateTime={new Date(createdAt).toISOString()}>
                  {formatDistanceToNow(new Date(createdAt), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </time>
              </div>
            </div>
          </>
        )}
      </div>

      {showRepostIndicator && isAuthor && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent/80" aria-label="Mais opções">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="animate-scale-in">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  const renderPostContent = (content: string, images: string[], videoUrl?: string | null, authorName?: string) => (
    <>
      {content && <p className="whitespace-pre-wrap">{content}</p>}

      {images.length > 0 && (
        <div className={`mt-3 grid gap-1 ${images.length > 1 ? "grid-cols-2" : ""}`}>
          {images.map((image, index) => (
            <div
              key={index}
              className="relative group cursor-pointer overflow-hidden rounded-xl"
              onClick={() => setSelectedImage(image)}
            >
              <Image
                src={image}
                alt={`Imagem ${index + 1} do post de ${authorName || "usuário"}`}
                width={600}
                height={400}
                sizes="(max-width: 768px) 100vw, 600px"
                className="max-h-80 w-full object-contain bg-muted"
                unoptimized
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-base flex items-center justify-center">
                <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-base drop-shadow-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {videoUrl && (
        <div className="mt-3">
          <video
            src={videoUrl}
            controls
            className="rounded-lg max-h-96 w-full"
          />
        </div>
      )}
    </>
  );

  return (
    <div
      className="bento-card-static relative"
    >
      <div className="accent-bar" />

      {/* Indicador de repost */}
      {isRepost && (
        <div className="px-5 pt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Repeat2 className="h-4 w-4" />
          <Link href={`/profile/${post.author.username}`} className="hover:underline font-medium">
            {post.author.name}
          </Link>
          <span>repostou</span>
        </div>
      )}

      <div className="px-5 pt-4 pb-3">
        {isRepost && post.originalPost ? (
          renderAuthorHeader(
            post.originalPost.author,
            post.originalPost.team,
            post.originalPost.createdAt,
            true
          )
        ) : (
          <>
            {renderAuthorHeader(post.author, post.team, post.createdAt, false)}
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
                    onClick={() => setShowDeleteConfirm(true)}
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
            <p className="whitespace-pre-wrap text-sm">{post.content}</p>
          </div>
        )}

        {isRepost && post.originalPost ? (
          renderPostContent(
            post.originalPost.content,
            post.originalPost.images,
            post.originalPost.videoUrl,
            post.originalPost.author.name
          )
        ) : (
          renderPostContent(post.content, post.images, post.videoUrl, post.author.name)
        )}
      </div>

      <div className="px-5 pb-0 flex gap-1">
        <motion.div
          animate={likeControls}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 transition-base like-btn-premium",
              isLiked && "text-primary hover:text-primary",
              justLiked && "liked"
            )}
            onClick={handleLike}
          >
            <Heart
              className={cn(
                "h-4 w-4 transition-fast",
                isLiked && "fill-current animate-heart-pop"
              )}
            />
            <span className="stat-number">{likesCount}</span>
          </Button>
        </motion.div>

        {/* Botão de comentar */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-2 transition-base",
            showCommentInput && "text-primary hover:text-primary"
          )}
          onClick={() => setShowCommentInput((prev) => !prev)}
        >
          <MessageCircle className="h-4 w-4" />
          <span className="stat-number">{commentsCount}</span>
        </Button>

        {/* Botão de repost — exibir apenas para não-reposts e posts de outros */}
        {!isRepost && !isTargetAuthor && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 transition-base",
              hasReposted && "text-green-600 hover:text-green-600"
            )}
            onClick={handleRepost}
            disabled={isReposting}
          >
            <Repeat2 className={cn(
              "h-4 w-4 transition-base",
              hasReposted && "scale-110",
              isReposting && "animate-spin"
            )} />
            <span className="stat-number">{repostsCount}</span>
          </Button>
        )}
      </div>

      <CommentSection
        postId={targetPost.id}
        initialCommentsCount={targetPost._count.comments}
        showInput={showCommentInput}
        onCommentsCountChange={setCommentsCount}
        onInputClose={() => setShowCommentInput(false)}
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
