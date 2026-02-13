"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/lib/utils";
import { positionLabels } from "@/lib/constants";
import { PostAuthor, PostTeam } from "@/types";

interface PostHeaderProps {
  author: PostAuthor;
  team?: PostTeam | null;
  createdAt: string | Date;
  isEdited?: boolean;
  showMenu?: boolean;
  isDeleting?: boolean;
  onDeleteClick?: () => void;
}

export function PostHeader({
  author,
  team,
  createdAt,
  isEdited = false,
  showMenu = false,
  isDeleting = false,
  onDeleteClick,
}: PostHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        {team ? (
          <>
            <Link href={`/teams/${team.slug}`}>
              <div>
                <Avatar className="h-12 w-12 rounded-lg ring-2 ring-transparent hover:ring-primary/30 transition-base avatar-glow">
                  <AvatarImage
                    src={team.logo || undefined}
                    alt={team.name}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground font-display font-semibold rounded-lg">
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
                {isEdited && (
                  <><span>·</span><span className="text-xs text-muted-foreground">(editado)</span></>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <Link href={`/profile/${author.username}`}>
              <div>
                <Avatar className="h-12 w-12 rounded-lg ring-2 ring-transparent hover:ring-primary/30 transition-base avatar-glow">
                  <AvatarImage
                    src={author.avatar || undefined}
                    alt={author.name}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground font-display font-semibold rounded-lg">
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
                {isEdited && (
                  <><span>·</span><span className="text-xs text-muted-foreground">(editado)</span></>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {showMenu && onDeleteClick && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent/80" aria-label="Mais opções">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="animate-scale-in">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDeleteClick}
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
}
