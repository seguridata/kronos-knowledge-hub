import { keepPreviousData, useQuery, UseQueryResult } from "@tanstack/react-query";
import { listAuditLogs } from "@/kronos/audit/services/audit-service";
import { AuditLogPage, ListAuditParams } from "@/kronos/audit/types";

export const KRONOS_AUDIT_QUERY_KEY = "kronos-audit";

export function useKronosAuditQuery(
  params?: ListAuditParams,
): UseQueryResult<AuditLogPage, Error> {
  return useQuery({
    queryKey: [KRONOS_AUDIT_QUERY_KEY, params],
    queryFn: () => listAuditLogs(params),
    placeholderData: keepPreviousData,
  });
}
