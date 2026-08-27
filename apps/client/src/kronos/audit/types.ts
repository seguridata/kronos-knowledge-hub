import { IPagination } from "@/lib/types.ts";

export type AuditLogItem = {
  id: string;
  event: string;
  resourceType: string;
  resourceId: string | null;
  spaceId: string | null;
  actorId: string | null;
  actorType: string;
  ipAddress: string | null;
  changes: unknown;
  metadata: unknown;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
};

export type ListAuditParams = {
  limit?: number;
  cursor?: string;
  event?: string;
  resourceType?: string;
};

export type AuditLogPage = IPagination<AuditLogItem>;
