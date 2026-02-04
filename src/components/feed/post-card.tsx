"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Heart, MoreHorizontal, Trash2, X, Repeat2, ZoomIn } from "lucide-react";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CommentSection } from "./comment-section";

interface PostAuthor {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  positions: string[];
}

interface PostTeam {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
}

interface PostData {
  id: string;
  content: string;
  images: string[];
  videoUrl?: string | null;
  createdAt: string;
  author: PostAuthor;
  team?: PostTeam | null;
  originalPostId?: string | null;
  originalPost?: PostData | null;
  _count: {
    likes: number;
    comments: number;
    reposts?: number;
  };
  isLiked: boolean;
}

interface PostProps {
  post: PostData;
  onDelete?: (id: string) => void;
  onLikeToggle?: (id: string) => void;
  animationDelay?: number;
}

export function PostCard({ post, onDelete, onLikeToggle, animationDelay = 0 }: PostProps) {
  const { data: session } = useSession();

  // For reposts, likes/comments go to the original post
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

  const isAuthor = session?.user?.id === post.author.id;
  const isTargetAuthor = session?.user?.id === targetPost.author.id;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLike = async () => {
    try {
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
        // Remove repost
        const response = await fetch(`/api/posts/${targetPost.id}/repost`, {
          method: "DELETE",
        });

        if (!response.ok) throw new Error();

        setHasReposted(false);
        setRepostsCount((prev) => prev - 1);
        toast.success("Repost removido");
      } else {
        // Create repost
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
    if (!confirm("Tem certeza que deseja excluir este post?")) return;

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

  const positionLabels: Record<string, string> = {
    FLYER: "Flyer",
    BASE: "Base",
    BACKSPOT: "Backspot",
    FRONTSPOT: "Frontspot",
    TUMBLER: "Tumbler",
    COACH: "Técnico",
    CHOREOGRAPHER: "Coreógrafo",
    JUDGE: "Juiz",
    OTHER: "Outro",
  };

  const renderAuthorHeader = (
    author: PostAuthor,
    team: PostTeam | null | undefined,
    createdAt: string,
    showRepostIndicator: boolean = false
  ) => (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        {team ? (
          // Post de equipe - mostrar equipe como autor
          <>
            <Link href={`/teams/${team.slug}`}>
              <Avatar className="h-10 w-10 ring-2 ring-transparent hover:ring-primary/30 transition-all duration-300">
                <AvatarImage
                  src={team.logo || undefined}
                  alt={team.name}
                  className="object-cover"
                />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getInitials(team.name)}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/teams/${team.slug}`}
                  className="font-semibold hover:underline animated-underline"
                >
                  {team.name}
                </Link>
                <Badge variant="subtle" className="text-xs">
                  Equipe
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span>
                  {formatDistanceToNow(new Date(createdAt), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              </div>
            </div>
          </>
        ) : (
          // Post de usuário - mostrar usuário como autor
          <>
            <Link href={`/profile/${author.username}`}>
              <Avatar className="h-10 w-10 ring-2 ring-transparent hover:ring-primary/30 transition-all duration-300">
                <AvatarImage
                  src={author.avatar || undefined}
                  alt={author.name}
                  className="object-cover"
                />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getInitials(author.name)}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/profile/${author.username}`}
                  className="font-semibold hover:underline"
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
                <span>
                  {formatDistanceToNow(new Date(createdAt), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {showRepostIndicator && isAuthor && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent/80">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="animate-scale-in">
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
  );

  const renderPostContent = (content: string, images: string[], videoUrl?: string | null) => (
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
              <img
                src={image}
                alt=""
                className="max-h-80 w-full object-contain transition-all duration-300 group-hover:brightness-95 group-hover:scale-[1.02] bg-muted"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
                <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 drop-shadow-lg" />
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
    <Card
      className="animate-slide-up transition-all duration-300 hover:shadow-depth-2"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Repost indicator */}
      {isRepost && (
        <div className="px-4 pt-3 flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-t-xl">
          <Repeat2 className="h-4 w-4" />
          <Link href={`/profile/${post.author.username}`} className="hover:underline font-medium">
            {post.author.name}
          </Link>
          <span>repostou</span>
        </div>
      )}

      <CardHeader className="pb-3">
        {isRepost && post.originalPost ? (
          // For reposts, show original author
          renderAuthorHeader(
            post.originalPost.author,
            post.originalPost.team,
            post.originalPost.createdAt,
            true
          )
        ) : (
          // Normal post
          <>
            {renderAuthorHeader(post.author, post.team, post.createdAt, false)}
            {isAuthor && !isRepost && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 absolute top-3 right-3 hover:bg-accent/80">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="animate-scale-in">
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
          </>
        )}
      </CardHeader>

      <CardContent className="pb-3">
        {/* Repost comment (if any) */}
        {isRepost && post.content && (
          <div className="mb-3 pb-3 border-b">
            <p className="whitespace-pre-wrap text-sm">{post.content}</p>
          </div>
        )}

        {/* Main content */}
        {isRepost && post.originalPost ? (
          renderPostContent(
            post.originalPost.content,
            post.originalPost.images,
            post.originalPost.videoUrl
          )
        ) : (
          renderPostContent(post.content, post.images, post.videoUrl)
        )}
      </CardContent>

      <CardFooter className="pt-0 pb-0 gap-1">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-2 transition-all duration-300 like-btn-premium",
            isLiked && "text-primary hover:text-primary",
            justLiked && "liked"
          )}
          onClick={handleLike}
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-all duration-200",
              isLiked && "fill-current animate-heart-pop"
            )}
          />
          <span>{likesCount}</span>
        </Button>

        {/* Repost button - only show for non-reposts and not own posts */}
        {!isRepost && !isTargetAuthor && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 transition-all duration-300",
              hasReposted && "text-green-600 hover:text-green-600"
            )}
            onClick={handleRepost}
            disabled={isReposting}
          >
            <Repeat2 className={cn(
              "h-4 w-4 transition-transform duration-300",
              hasReposted && "scale-110",
              isReposting && "animate-spin"
            )} />
            <span>{repostsCount}</span>
          </Button>
        )}
      </CardFooter>

      <CommentSection postId={targetPost.id} initialCommentsCount={targetPost._count.comments} />

      {/* Lightbox Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-0 bg-transparent" showCloseButton={false}>
          <DialogTitle className="sr-only">Visualizar imagem</DialogTitle>
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute -top-10 right-0 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all duration-200 z-10 hover:scale-105"
          >
            <X className="h-6 w-6" />
          </button>
          {selectedImage && (
            <img
              src={selectedImage}
              alt=""
              className="max-w-full max-h-[90vh] object-contain rounded-lg animate-scale-in"
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
