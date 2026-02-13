"use client";

import { Loader2, Check, Shield, ShieldCheck } from "lucide-react";
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
import { getInitials } from "@/lib/utils";
import { teamRoleOptions } from "@/lib/constants";

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

const CUSTOM_ROLE = "Outro";
const EMPTY_ROLE = "__none__";

interface MemberEditorProps {
  member: TeamMember;
  currentUserIsAdmin: boolean;
  editRole: string;
  editCustomRole: string;
  editHasPermission: boolean;
  editIsAdmin: boolean;
  isSaving: boolean;
  onEditRoleChange: (value: string) => void;
  onEditCustomRoleChange: (value: string) => void;
  onEditHasPermissionChange: (value: boolean) => void;
  onEditIsAdminChange: (value: boolean) => void;
  onSave: (memberId: string) => void;
  onCancel: () => void;
}

export function MemberEditor({
  member,
  currentUserIsAdmin,
  editRole,
  editCustomRole,
  editHasPermission,
  editIsAdmin,
  isSaving,
  onEditRoleChange,
  onEditCustomRoleChange,
  onEditHasPermissionChange,
  onEditIsAdminChange,
  onSave,
  onCancel,
}: MemberEditorProps) {
  return (
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
          <Select value={editRole} onValueChange={onEditRoleChange}>
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
          {editRole === CUSTOM_ROLE && (
            <Input
              placeholder="Digite a função customizada..."
              value={editCustomRole}
              onChange={(e) => onEditCustomRoleChange(e.target.value)}
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
                checked={editHasPermission}
                onCheckedChange={onEditHasPermissionChange}
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
                checked={editIsAdmin}
                onCheckedChange={(checked) => {
                  onEditIsAdminChange(checked);
                  if (checked) onEditHasPermissionChange(true);
                }}
              />
            </div>
          </>
        )}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            onClick={() => onSave(member.id)}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
