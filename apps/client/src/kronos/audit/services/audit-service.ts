import api from "@/lib/api-client";
import { AuditLogPage, ListAuditParams } from "@/kronos/audit/types";

export async function listAuditLogs(
  params?: ListAuditParams,
): Promise<AuditLogPage> {
  const req = await api.post<AuditLogPage>("/kronos/audit/list", params);
  return req.data;
}
