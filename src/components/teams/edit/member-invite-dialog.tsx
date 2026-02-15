"use client";

import { useState } from "react";
import { Loader2, UserPlus, Search, Plus, X, Shield, ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { reportError } from "@/lib/error-reporter";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";
import { teamRoleOptions } from "@/lib/constants";

interface ConnectedUser {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
}

const CUSTOM_ROLE = "Outro";
const EMPTY_ROLE = "__none__";

interface MemberInviteDialogProps {
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserIsAdmin: boolean;
  memberUserIds: Set<string>;
  inviteUserIds: Set<string>;
  onInviteSent: () => void;
}

export function MemberInviteDialog({
  slug,
  open,
  onOpenChange,
  currentUserIsAdmin,
  memberUserIds,
  inviteUserIds,
  onInviteSent,
}: MemberInviteDialogProps) {
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ConnectedUser | null>(null);
  const [inviteRole, setInviteRole] = useState("");
  const [inviteCustomRole, setInviteCustomRole] = useState("");
  const [inviteHasPermission, setInviteHasPermission] = useState(false);
  const [inviteIsAdmin, setInviteIsAdmin] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  const resetState = () => {
    setSelectedUser(null);
    setSearchQuery("");
    setConnectedUsers([]);
    setInviteRole("");
    setInviteCustomRole("");
    setInviteHasPermission(false);
    setInviteIsAdmin(false);
  };

  const searchConnections = async (query: string) => {
    if (!query.trim()) {
      setConnectedUsers([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch("/api/connections");
      if (response.ok) {
        const data = await response.json();
        const acceptedConnections = data.connections.filter(
          (c: { status: string }) => c.status === "ACCEPTED"
        );

        const users: ConnectedUser[] = acceptedConnections.map(
          (c: { user: ConnectedUser }) => c.user
        );

        const filtered = users.filter(
          (u) =>
            !memberUserIds.has(u.id) &&
            !inviteUserIds.has(u.id) &&
            (u.name.toLowerCase().includes(query.toLowerCase()) ||
              u.username.toLowerCase().includes(query.toLowerCase()))
        );

        setConnectedUsers(filtered.slice(0, 10));
      }
    } catch (error) {
      reportError(error, "MemberInviteDialog.searchConnections");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendInvite = async () => {
    if (!selectedUser) return;

    let finalRole = inviteRole === CUSTOM_ROLE ? inviteCustomRole : inviteRole;
    if (finalRole === EMPTY_ROLE) finalRole = "";

    setIsSendingInvite(true);
    try {
      const response = await fetch(`/api/teams/${slug}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          role: finalRole,
          hasPermission: inviteHasPermission,
          isAdmin: inviteIsAdmin,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      toast.success(`Convite enviado para ${selectedUser.name}`);
      onOpenChange(false);
      resetState();
      onInviteSent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar convite");
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) resetState();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Convidar Membro
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!selectedUser ? (
            <>
              <p className="text-sm text-muted-foreground">
                Busque entre suas conexões para convidar alguém para a equipe.
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou username..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchConnections(e.target.value);
                  }}
                  className="pl-9"
                />
              </div>
              {isSearching ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : connectedUsers.length > 0 ? (
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {connectedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer"
                      onClick={() => setSelectedUser(user)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar || undefined} />
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">
                            @{user.username}
                          </p>
                        </div>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              ) : searchQuery.length > 0 ? (
                <p className="text-center py-4 text-sm text-muted-foreground">
                  Nenhuma conexão encontrada.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedUser.avatar || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getInitials(selectedUser.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{selectedUser.name}</p>
                  <p className="text-sm text-muted-foreground">
                    @{selectedUser.username}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSelectedUser(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Função na Equipe (opcional)</label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma função" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_ROLE}>Nenhuma</SelectItem>
                      {teamRoleOptions.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {inviteRole === CUSTOM_ROLE && (
                    <Input
                      placeholder="Digite a função customizada..."
                      value={inviteCustomRole}
                      onChange={(e) => setInviteCustomRole(e.target.value)}
                      className="mt-2"
                    />
                  )}
                </div>
                {currentUserIsAdmin && (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Tem permissão
                        </label>
                        <p className="text-xs text-muted-foreground">
                          Pode editar equipe, postar e convidar
                        </p>
                      </div>
                      <Switch
                        checked={inviteHasPermission}
                        onCheckedChange={setInviteHasPermission}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4" />
                          É administrador
                        </label>
                        <p className="text-xs text-muted-foreground">
                          Pode gerenciar outros membros com permissão
                        </p>
                      </div>
                      <Switch
                        checked={inviteIsAdmin}
                        onCheckedChange={(checked) => {
                          setInviteIsAdmin(checked);
                          if (checked) setInviteHasPermission(true);
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSendInvite}
            disabled={!selectedUser || isSendingInvite}
          >
            {isSendingInvite && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar Convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
