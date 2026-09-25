export const TEAM_PERMISSION_FIELDS = [
  "canEdit",
  "canPost",
  "canInvite",
  "canManageMembers",
  "canDeleteTeam",
] as const;

export type TeamPermissionField = (typeof TEAM_PERMISSION_FIELDS)[number];

type PermissionRecord = {
  hasPermission: boolean;
  isAdmin: boolean;
  canEdit?: boolean;
  canPost?: boolean;
  canInvite?: boolean;
  canManageMembers?: boolean;
  canDeleteTeam?: boolean;
};

type PermissionInput = Partial<PermissionRecord>;

export function normalizeTeamPermissions(input: PermissionInput = {}): Required<PermissionInput> {
  const isAdmin = Boolean(
    input.isAdmin || input.canManageMembers || input.canDeleteTeam
  );
  const hasPermission = Boolean(
    input.hasPermission ||
      input.canEdit ||
      input.canPost ||
      input.canInvite ||
      isAdmin
  );

  const hasExplicitOperationalPermission = [
    input.canEdit,
    input.canPost,
    input.canInvite,
  ].some((value) => value !== undefined);
  const legacyPermissionFallback = Boolean(
    input.hasPermission && !hasExplicitOperationalPermission
  );
  const legacyManagementFallback = Boolean(
    input.hasPermission &&
      input.canManageMembers === undefined &&
      !hasExplicitOperationalPermission
  );

  return {
    hasPermission,
    isAdmin,
    canEdit: isAdmin || Boolean(input.canEdit) || legacyPermissionFallback,
    canPost: isAdmin || Boolean(input.canPost) || legacyPermissionFallback,
    canInvite: isAdmin || Boolean(input.canInvite) || legacyPermissionFallback,
    canManageMembers:
      isAdmin || Boolean(input.canManageMembers) || legacyManagementFallback,
    canDeleteTeam: isAdmin || Boolean(input.canDeleteTeam),
  };
}

export function getTeamPermissions(member: PermissionRecord | null | undefined) {
  if (!member) {
    return {
      canEdit: false,
      canPost: false,
      canInvite: false,
      canManageMembers: false,
      canDeleteTeam: false,
    };
  }

  return normalizeTeamPermissions(member);
}

export function canManageTeam(member: PermissionRecord | null | undefined): boolean {
  return getTeamPermissions(member).canManageMembers;
}

export function canOperateTeam(member: PermissionRecord | null | undefined): boolean {
  const permissions = getTeamPermissions(member);
  return permissions.canEdit || permissions.canPost || permissions.canInvite;
}
