import { Text } from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import { Error404 } from "@/components/ui/error-404.tsx";
import { Feature } from "@/ee/features";
import { useHasFeature } from "@/ee/hooks/use-feature";
import useUserRole from "@/hooks/use-user-role.tsx";
import { getAppName } from "@/lib/config.ts";
import AuditLogLedger from "@/kronos/audit/components/audit-log-ledger";

export default function AuditLogs() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const hasAuditLogs = useHasFeature(Feature.AUDIT_LOGS);

  if (!isAdmin || !hasAuditLogs) {
    return <Error404 />;
  }

  return (
    <>
      <Helmet>
        <title>
          {t("Audit log")} - {getAppName()}
        </title>
      </Helmet>
      <SettingsTitle title={t("Audit log")} />
      <Text size="sm" c="dimmed" mb="lg">
        {t("A chronological record of security-relevant actions in this workspace.")}
      </Text>
      <AuditLogLedger />
    </>
  );
}
