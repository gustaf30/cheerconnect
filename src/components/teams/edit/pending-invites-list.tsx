"use client";

import { useState } from "react";
import { Loader2, X, Shield, ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";

interface TeamInvite {
  id: string;
  role: string;
  hasPermission: boolean;
  isAdmin: boolean;
  status: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
  };
}

interface PendingInvitesListProps {
  slug: string;
  invites: TeamInvite[];
  setInvites: (invites: TeamInvite[]) => void;
}

export function PendingInvitesList({ slug, invites, setInvites }: PendingInvitesListProps) {
  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);

  const handleCancelInvite = async (inviteId: string) => {
    setCancellingInviteId(inviteId);
    try {
      const response = await fetch(`/api/teams/${slug}/invites/${inviteId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error();

      setInvites(invites.filter((i) => i.id !== inviteId));
      toast.success("Convite cancelado");
    } catch {
      toast.error("Erro ao cancelar convite");
    } finally {
      setCancellingInviteId(null);
    }
  };

  if (invites.length === 0) return null;

  return (
    <div className="bento-card-static">
      <div className="p-6 pb-2">
        <h2 className="heading-card font-display text-base">Convites Pendentes</h2>
      </div>
      <div className="p-6 pt-0 space-y-3">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={invite.user.avatar || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getInitials(invite.user.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{invite.user.name}</p>
                <p className="text-sm text-muted-foreground">
                  @{invite.user.username}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {invite.role && (
                <Badge variant="secondary">
                  {invite.role}
                </Badge>
              )}
              {invite.isAdmin && (
                <Badge variant="default" className="gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Admin
                </Badge>
              )}
              {invite.hasPermission && !invite.isAdmin && (
                <Badge variant="outline" className="gap-1">
                  <Shield className="h-3 w-3" />
                  Permissão
                </Badge>
              )}
              <Badge variant="outline">Pendente</Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleCancelInvite(invite.id)}
                disabled={cancellingInviteId === invite.id}
              >
                {cancellingInviteId === invite.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
