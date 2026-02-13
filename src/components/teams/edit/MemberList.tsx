"use client";

import { useCallback, useMemo, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { teamRoleOptions } from "@/lib/constants";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { MemberInviteDialog } from "./member-invite-dialog";
import { PendingInvitesList } from "./pending-invites-list";
import { MemberRow } from "./member-row";
import { MemberEditor } from "./member-editor";

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
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberEditRole, setMemberEditRole] = useState("");
  const [memberEditCustomRole, setMemberEditCustomRole] = useState("");
  const [memberEditHasPermission, setMemberEditHasPermission] = useState(false);
  const [memberEditIsAdmin, setMemberEditIsAdmin] = useState(false);
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [removeMemberTarget, setRemoveMemberTarget] = useState<{ id: string; name: string } | null>(null);

  const memberUserIds = useMemo(() => new Set(members.map((m) => m.user.id)), [members]);
  const inviteUserIds = useMemo(() => new Set(invites.map((i) => i.user.id)), [invites]);

  const handleEditMember = useCallback((member: TeamMember) => {
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
  }, []);

  const handleSaveMember = useCallback(async (memberId: string) => {
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
  }, [memberEditRole, memberEditCustomRole, memberEditHasPermission, memberEditIsAdmin, slug, members, setMembers]);

  const handleCancelEdit = useCallback(() => {
    setEditingMemberId(null);
    setMemberEditRole("");
    setMemberEditCustomRole("");
    setMemberEditHasPermission(false);
    setMemberEditIsAdmin(false);
  }, []);

  const handleRemoveMember = useCallback(async () => {
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
  }, [removeMemberTarget, slug, members, setMembers]);

  const handleRemoveClick = useCallback((member: TeamMember) => {
    setRemoveMemberTarget({ id: member.id, name: member.user.name });
  }, []);

  const handleOpenInviteDialog = useCallback(() => {
    setInviteDialogOpen(true);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Membros da Equipe</h3>
        <Button onClick={handleOpenInviteDialog}>
          <UserPlus className="h-4 w-4 mr-2" />
          Convidar
        </Button>
      </div>

      {/* Pending Invites */}
      <PendingInvitesList
        slug={slug}
        invites={invites}
        setInvites={setInvites}
      />

      {/* Active Members */}
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
                    <MemberEditor
                      member={member}
                      currentUserIsAdmin={currentUserIsAdmin}
                      editRole={memberEditRole}
                      editCustomRole={memberEditCustomRole}
                      editHasPermission={memberEditHasPermission}
                      editIsAdmin={memberEditIsAdmin}
                      isSaving={isSavingMember}
                      onEditRoleChange={setMemberEditRole}
                      onEditCustomRoleChange={setMemberEditCustomRole}
                      onEditHasPermissionChange={setMemberEditHasPermission}
                      onEditIsAdminChange={setMemberEditIsAdmin}
                      onSave={handleSaveMember}
                      onCancel={handleCancelEdit}
                    />
                  ) : (
                    <MemberRow
                      member={member}
                      currentUserIsAdmin={currentUserIsAdmin}
                      isRemoving={removingMemberId === member.id}
                      onEdit={handleEditMember}
                      onRemove={handleRemoveClick}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Invite Dialog */}
      <MemberInviteDialog
        slug={slug}
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        currentUserIsAdmin={currentUserIsAdmin}
        memberUserIds={memberUserIds}
        inviteUserIds={inviteUserIds}
        onInviteSent={fetchInvites}
      />

      {/* Remove Confirmation */}
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
