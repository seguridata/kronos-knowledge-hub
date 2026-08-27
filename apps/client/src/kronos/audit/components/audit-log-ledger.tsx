import { Badge, Group, Select, Text } from "@mantine/core";
import { IconHistory } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Paginate from "@/components/common/paginate.tsx";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { EmptyState } from "@/components/ui/empty-state.tsx";
import PageListSkeleton from "@/components/ui/page-list-skeleton";
import { useCursorPaginate } from "@/hooks/use-cursor-paginate";
import { formatLocalized, useDateFnsLocale } from "@/lib/date-locale.ts";
import { useKronosAuditQuery } from "@/kronos/audit/queries/audit-query";
import {
  AUDIT_EVENT_OPTIONS,
  AUDIT_RESOURCE_OPTIONS,
  auditEventLabel,
  auditResourceLabel,
} from "@/kronos/audit/event-labels";
import { AuditLogItem } from "@/kronos/audit/types";
import classes from "./audit-log-ledger.module.css";

function actorLabel(item: AuditLogItem, t: (key: string) => string): string {
  if (item.actorName) {
    return item.actorName;
  }
  if (item.actorEmail) {
    return item.actorEmail;
  }
  if (item.actorType === "system") {
    return t("System");
  }
  if (item.actorType === "api_key") {
    return t("API key");
  }
  return t("Unknown");
}

function groupByDay(
  items: AuditLogItem[],
  locale: ReturnType<typeof useDateFnsLocale>,
): { key: string; label: string; items: AuditLogItem[] }[] {
  const groups: { key: string; label: string; items: AuditLogItem[] }[] = [];

  for (const item of items) {
    const date = new Date(item.createdAt);
    const key = formatLocalized(date, "yyyy-MM-dd", "yyyy-MM-dd", locale);
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.items.push(item);
      continue;
    }
    groups.push({
      key,
      label: formatLocalized(date, "EEEE, MMM d, yyyy", "PPP", locale),
      items: [item],
    });
  }

  return groups;
}

export default function AuditLogLedger() {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const { cursor, goNext, goPrev, resetCursor } = useCursorPaginate();
  const [resourceType, setResourceType] = useState<string | null>(null);
  const [event, setEvent] = useState<string | null>(null);

  const params = useMemo(
    () => ({
      limit: 30,
      ...(cursor ? { cursor } : {}),
      ...(resourceType ? { resourceType } : {}),
      ...(event ? { event } : {}),
    }),
    [cursor, resourceType, event],
  );

  const { data, isLoading } = useKronosAuditQuery(params);
  const groups = useMemo(
    () => groupByDay(data?.items ?? [], locale),
    [data?.items, locale],
  );

  const resourceData = [
    { value: "all", label: t("All resources") },
    ...AUDIT_RESOURCE_OPTIONS.map((option) => ({
      value: option.value,
      label: t(option.label),
    })),
  ];

  const eventData = [
    { value: "all", label: t("All events") },
    ...AUDIT_EVENT_OPTIONS.map((option) => ({
      value: option.value,
      label: t(option.label),
    })),
  ];

  const isEmpty = !isLoading && (data?.items.length ?? 0) === 0;

  return (
    <>
      <div className={classes.filters}>
        <Select
          className={classes.filter}
          size="sm"
          aria-label={t("Filter by resource")}
          data={resourceData}
          value={resourceType ?? "all"}
          onChange={(value) => {
            setResourceType(!value || value === "all" ? null : value);
            resetCursor();
          }}
          allowDeselect={false}
        />
        <Select
          className={classes.filter}
          size="sm"
          aria-label={t("Filter by event")}
          data={eventData}
          value={event ?? "all"}
          onChange={(value) => {
            setEvent(!value || value === "all" ? null : value);
            resetCursor();
          }}
          allowDeselect={false}
          searchable
        />
      </div>

      {isLoading && !data ? (
        <PageListSkeleton />
      ) : isEmpty ? (
        <EmptyState
          icon={IconHistory}
          title={t("No activity yet")}
          description={t(
            "Security-relevant actions in this workspace will appear here.",
          )}
        />
      ) : (
        groups.map((group) => (
          <section key={group.key} className={classes.day} aria-label={group.label}>
            <div className={classes.dayLabel}>{group.label}</div>
            {group.items.map((item) => (
              <div key={item.id} className={classes.row}>
                <Text className={classes.time} component="time" dateTime={item.createdAt}>
                  {formatLocalized(new Date(item.createdAt), "h:mma", "p", locale)}
                </Text>
                <Group gap="sm" wrap="nowrap" className={classes.actor}>
                  <CustomAvatar name={actorLabel(item, t)} size={28} />
                  <div>
                    <Text size="sm" fw={500} lineClamp={1}>
                      {t(auditEventLabel(item.event))}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {actorLabel(item, t)}
                    </Text>
                  </div>
                </Group>
                <div className={classes.meta}>
                  {item.ipAddress && (
                    <span className={classes.ip}>{String(item.ipAddress)}</span>
                  )}
                  <Badge variant="light" size="sm">
                    {t(auditResourceLabel(item.resourceType))}
                  </Badge>
                </div>
              </div>
            ))}
          </section>
        ))
      )}

      {(data?.items.length ?? 0) > 0 && (
        <Paginate
          hasPrevPage={Boolean(data?.meta?.hasPrevPage)}
          hasNextPage={Boolean(data?.meta?.hasNextPage)}
          onNext={() => goNext(data?.meta?.nextCursor)}
          onPrev={goPrev}
        />
      )}
    </>
  );
}
