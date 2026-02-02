"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Heart, MessageCircle, MoreHorizontal, Trash2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

interface PostProps {
  post: {
    id: string;
    content: string;
    images: string[];
    createdAt: string;
    author: PostAuthor;
    team?: PostTeam | null;
    _count: {
      likes: number;
      comments: number;
    };
    isLiked: boolean;
  };
  onDelete?: (id: string) => void;
  onLikeToggle?: (id: string) => void;
}

export function PostCard({ post, onDelete, onLikeToggle }: PostProps) {
  const { data: session } = useSession();
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post._count.likes);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAuthor = session?.user?.id === post.author.id;

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
      const response = await fetch(`/api/posts/${post.id}/like`, {
        method: isLiked ? "DELETE" : "POST",
      });

      if (!response.ok) throw new Error();

      setIsLiked(!isLiked);
      setLikesCount((prev) => (isLiked ? prev - 1 : prev + 1));
      onLikeToggle?.(post.id);
    } catch {
      toast.error("Erro ao curtir post");
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <Link
            href={`/profile/${post.author.username}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={post.author.avatar || undefined}
                alt={post.author.name}
                className="object-cover"
              />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(post.author.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{post.author.name}</span>
                {post.author.positions.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {positionLabels[post.author.positions[0]] ||
                      post.author.positions[0]}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span>@{post.author.username}</span>
                {post.team && (
                  <>
                    <span>·</span>
                    <Link
                      href={`/teams/${post.team.slug}`}
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {post.team.name}
                    </Link>
                  </>
                )}
                <span>·</span>
                <span>
                  {formatDistanceToNow(new Date(post.createdAt), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              </div>
            </div>
          </Link>

          {isAuthor && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
      </CardHeader>

      <CardContent className="pb-3">
        <p className="whitespace-pre-wrap">{post.content}</p>

        {post.images.length > 0 && (
          <div className="mt-3 grid gap-2">
            {post.images.map((image, index) => (
              <img
                key={index}
                src={image}
                alt=""
                className="rounded-lg max-h-96 w-full object-cover"
              />
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <div className="flex gap-4">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2",
              isLiked && "text-primary hover:text-primary"
            )}
            onClick={handleLike}
          >
            <Heart
              className={cn("h-4 w-4", isLiked && "fill-current")}
            />
            <span>{likesCount}</span>
          </Button>

          <Link href={`/post/${post.id}`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              <span>{post._count.comments}</span>
            </Button>
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
