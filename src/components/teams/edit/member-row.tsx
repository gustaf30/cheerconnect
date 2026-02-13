"use client";

import { Loader2, Trash2, Pencil, Shield, ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";

interface TeamMember {
  id: string;
  role: string;
  hasPermission: boolean;
  isAdmin: boolean;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
    positions: string[];
  };
}

interface MemberRowProps {
  member: TeamMember;
  currentUserIsAdmin: boolean;
  isRemoving: boolean;
  onEdit: (member: TeamMember) => void;
  onRemove: (member: TeamMember) => void;
}

export function MemberRow({
  member,
  currentUserIsAdmin,
  isRemoving,
  onEdit,
  onRemove,
}: MemberRowProps) {
  const canManage = currentUserIsAdmin || (!member.hasPermission && !member.isAdmin);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage
            src={member.user.avatar || undefined}
            className="object-cover"
          />
          <AvatarFallback className="bg-primary text-primary-foreground">
            {getInitials(member.user.name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-display font-medium">{member.user.name}</p>
          <p className="text-sm text-muted-foreground">
            @{member.user.username}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {member.role && (
          <Badge variant="secondary">
            {member.role}
          </Badge>
        )}
        {member.isAdmin && (
          <Badge variant="default" className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            Admin
          </Badge>
        )}
        {member.hasPermission && !member.isAdmin && (
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" />
            Permissão
          </Badge>
        )}
        {canManage && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(member)}
            aria-label="Editar membro"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        {canManage && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onRemove(member)}
            disabled={isRemoving}
            aria-label="Remover membro"
          >
            {isRemoving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
