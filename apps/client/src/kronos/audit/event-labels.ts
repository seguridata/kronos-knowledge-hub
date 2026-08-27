export const AUDIT_RESOURCE_OPTIONS = [
  { value: "workspace", label: "Workspace" },
  { value: "user", label: "User" },
  { value: "space", label: "Space" },
  { value: "page", label: "Page" },
  { value: "group", label: "Group" },
  { value: "share", label: "Share" },
  { value: "api_key", label: "API key" },
  { value: "workspace_invitation", label: "Invitation" },
  { value: "license", label: "License" },
] as const;

export const AUDIT_EVENT_OPTIONS = [
  { value: "user.login", label: "Signed in" },
  { value: "user.logout", label: "Signed out" },
  { value: "user.created", label: "User created" },
  { value: "user.deleted", label: "User deleted" },
  { value: "user.role_changed", label: "Role changed" },
  { value: "user.deactivated", label: "User deactivated" },
  { value: "user.activated", label: "User activated" },
  { value: "workspace.updated", label: "Workspace updated" },
  { value: "workspace.invite_created", label: "Invite sent" },
  { value: "workspace.invite_revoked", label: "Invite revoked" },
  { value: "space.created", label: "Space created" },
  { value: "space.updated", label: "Space updated" },
  { value: "space.deleted", label: "Space deleted" },
  { value: "page.trashed", label: "Page moved to trash" },
  { value: "page.deleted", label: "Page deleted" },
  { value: "page.restored", label: "Page restored" },
  { value: "share.created", label: "Share created" },
  { value: "share.deleted", label: "Share deleted" },
  { value: "group.created", label: "Group created" },
  { value: "group.deleted", label: "Group deleted" },
] as const;

const EVENT_LABELS: Record<string, string> = Object.fromEntries(
  AUDIT_EVENT_OPTIONS.map((option) => [option.value, option.label]),
);

const RESOURCE_LABELS: Record<string, string> = Object.fromEntries(
  AUDIT_RESOURCE_OPTIONS.map((option) => [option.value, option.label]),
);

export function auditEventLabel(event: string): string {
  return EVENT_LABELS[event] ?? humanizeToken(event);
}

export function auditResourceLabel(resourceType: string): string {
  return RESOURCE_LABELS[resourceType] ?? humanizeToken(resourceType);
}

function humanizeToken(value: string): string {
  const trimmed = value.replace(/[._]+/g, " ").trim();
  if (!trimmed) {
    return value;
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
