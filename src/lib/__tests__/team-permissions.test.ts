import { describe, expect, it } from "vitest";
import { getTeamPermissions, normalizeTeamPermissions } from "@/lib/team-permissions";

describe("team permissions", () => {
  it("gives administrators every operational permission", () => {
    expect(normalizeTeamPermissions({ isAdmin: true })).toMatchObject({
      hasPermission: true,
      isAdmin: true,
      canEdit: true,
      canPost: true,
      canInvite: true,
      canManageMembers: true,
      canDeleteTeam: true,
    });
  });

  it("keeps operational permissions separate from member administration", () => {
    const permissions = normalizeTeamPermissions({ hasPermission: true, canManageMembers: false });
    expect(permissions.canEdit).toBe(true);
    expect(permissions.canPost).toBe(true);
    expect(permissions.canInvite).toBe(true);
    expect(permissions.canManageMembers).toBe(false);
    expect(permissions.canDeleteTeam).toBe(false);
  });

  it("promotes elevated permissions to administrator invariants", () => {
    const permissions = normalizeTeamPermissions({ canDeleteTeam: true });
    expect(permissions.isAdmin).toBe(true);
    expect(permissions.canEdit).toBe(true);
  });

  it("returns no permissions for a missing member", () => {
    expect(getTeamPermissions(null)).toEqual({
      canEdit: false,
      canPost: false,
      canInvite: false,
      canManageMembers: false,
      canDeleteTeam: false,
    });
  });
});
