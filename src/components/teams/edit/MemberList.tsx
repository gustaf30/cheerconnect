"use client";

import { useState } from "react";
import {
  Loader2,
  UserPlus,
  Search,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";
import { teamRoleOptions } from "@/lib/constants";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

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

interface ConnectedUser {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
}

const CUSTOM_ROLE = "Outro";
const EMPTY_ROLE = "__none__";

interface MemberListProps {
  slug: string;
  members: TeamMember[];
  setMembers: (members: TeamMember[]) => void;
  invites: TeamInvite[];
  setInvites: (invites: TeamInvite[]) => void;
  isLoadingMembers: boolean;
  currentUserIsAdmin: boolean;
  fetchInvites: () => void;
}

export function MemberList({
  slug,
  members,
  setMembers,
  invites,
  setInvites,
  isLoadingMembers,
  currentUserIsAdmin,
  fetchInvites,
}: MemberListProps) {
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ConnectedUser | null>(null);
  const [inviteRole, setInviteRole] = useState("");
  const [inviteCustomRole, setInviteCustomRole] = useState("");
  const [inviteHasPermission, setInviteHasPermission] = useState(false);
  const [inviteIsAdmin, setInviteIsAdmin] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberEditRole, setMemberEditRole] = useState("");
  const [memberEditCustomRole, setMemberEditCustomRole] = useState("");
  const [memberEditHasPermission, setMemberEditHasPermission] = useState(false);
  const [memberEditIsAdmin, setMemberEditIsAdmin] = useState(false);
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);
  const [removeMemberTarget, setRemoveMemberTarget] = useState<{ id: string; name: string } | null>(null);

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

        const memberUserIds = new Set(members.map((m) => m.user.id));
        const inviteUserIds = new Set(invites.map((i) => i.user.id));

        const filtered = users.filter(
          (u) =>
            !memberUserIds.has(u.id) &&
            !inviteUserIds.has(u.id) &&
            (u.name.toLowerCase().includes(query.toLowerCase()) ||
              u.username.toLowerCase().includes(query.toLowerCase()))
        );

        setConnectedUsers(filtered.slice(0, 10));
      }
    } catch {
      console.error("Erro ao buscar conexões");
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
      setInviteDialogOpen(false);
      setSelectedUser(null);
      setSearchQuery("");
      setConnectedUsers([]);
      setInviteRole("");
      setInviteCustomRole("");
      setInviteHasPermission(false);
      setInviteIsAdmin(false);
      fetchInvites();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar convite");
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleEditMember = (member: TeamMember) => {
    setEditingMemberId(member.id);
    const isPredefinedRole = (teamRoleOptions as readonly string[]).includes(member.role) && member.role !== CUSTOM_ROLE;
    if (isPredefinedRole) {
      setMemberEditRole(member.role);
      setMemberEditCustomRole("");
    } else if (member.role) {
      setMemberEditRole(CUSTOM_ROLE);
      setMemberEditCustomRole(member.role);
    } else {
      setMemberEditRole(EMPTY_ROLE);
      setMemberEditCustomRole("");
    }
    setMemberEditHasPermission(member.hasPermission);
    setMemberEditIsAdmin(member.isAdmin);
  };

  const handleSaveMember = async (memberId: string) => {
    let finalRole = memberEditRole === CUSTOM_ROLE ? memberEditCustomRole : memberEditRole;
    if (finalRole === EMPTY_ROLE) finalRole = "";

    setIsSavingMember(true);
    try {
      const response = await fetch(`/api/teams/${slug}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: finalRole,
          hasPermission: memberEditHasPermission,
          isAdmin: memberEditIsAdmin,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      const data = await response.json();
      setMembers(members.map((m) => m.id === memberId ? data.member : m));
      setEditingMemberId(null);
      toast.success("Informações atualizadas");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar");
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingMemberId(null);
    setMemberEditRole("");
    setMemberEditCustomRole("");
    setMemberEditHasPermission(false);
    setMemberEditIsAdmin(false);
  };

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

  const handleRemoveMember = async () => {
    if (!removeMemberTarget) return;
    setRemovingMemberId(removeMemberTarget.id);
    try {
      const response = await fetch(`/api/teams/${slug}/members/${removeMemberTarget.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      setMembers(members.filter((m) => m.id !== removeMemberTarget.id));
      setRemoveMemberTarget(null);
      toast.success("Membro removido");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao remover membro");
    } finally {
      setRemovingMemberId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Botão de Convite */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Membros da Equipe</h3>
        <Button onClick={() => setInviteDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Convidar
        </Button>
      </div>

      {/* Convites Pendentes */}
      {invites.length > 0 && (
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
      )}

      {/* Membros Atuais */}
      <div className="bento-card-static">
        <div className="p-6 pb-2">
          <h2 className="heading-card font-display text-base">
            Membros Ativos ({members.length})
          </h2>
        </div>
        <div className="p-6 pt-0">
          {isLoadingMembers ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Nenhum membro na equipe.
            </p>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="p-3 rounded-lg bg-muted/50"
                >
                  {editingMemberId === member.id ? (
                    <div className="space-y-4">
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
                          <p className="font-medium">{member.user.name}</p>
                          <p className="text-sm text-muted-foreground">
                            @{member.user.username}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3 pl-13">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Função (opcional)</label>
                          <Select value={memberEditRole} onValueChange={setMemberEditRole}>
                            <SelectTrigger className="w-full">
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
                          {memberEditRole === CUSTOM_ROLE && (
                            <Input
                              placeholder="Digite a função customizada..."
                              value={memberEditCustomRole}
                              onChange={(e) => setMemberEditCustomRole(e.target.value)}
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
                                checked={memberEditHasPermission}
                                onCheckedChange={setMemberEditHasPermission}
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
                                checked={memberEditIsAdmin}
                                onCheckedChange={(checked) => {
                                  setMemberEditIsAdmin(checked);
                                  if (checked) setMemberEditHasPermission(true);
                                }}
                              />
                            </div>
                          </>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveMember(member.id)}
                            disabled={isSavingMember}
                          >
                            {isSavingMember ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Check className="h-4 w-4 mr-2" />
                            )}
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
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
                          <p className="font-medium">{member.user.name}</p>
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
                        {(currentUserIsAdmin || (!member.hasPermission && !member.isAdmin)) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditMember(member)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {(currentUserIsAdmin || (!member.hasPermission && !member.isAdmin)) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setRemoveMemberTarget({ id: member.id, name: member.user.name })}
                            disabled={removingMemberId === member.id}
                          >
                            {removingMemberId === member.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dialog de Convidar Membro */}
      <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
        setInviteDialogOpen(open);
        if (!open) {
          setSelectedUser(null);
          setSearchQuery("");
          setConnectedUsers([]);
          setInviteRole("");
          setInviteCustomRole("");
          setInviteHasPermission(false);
          setInviteIsAdmin(false);
        }
      }}>
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
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
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

      <ConfirmDialog
        open={!!removeMemberTarget}
        onOpenChange={(open) => !open && setRemoveMemberTarget(null)}
        title={`Remover ${removeMemberTarget?.name || ""} da equipe?`}
        confirmLabel="Remover"
        isLoading={!!removingMemberId}
        onConfirm={handleRemoveMember}
      />
    </div>
  );
}
