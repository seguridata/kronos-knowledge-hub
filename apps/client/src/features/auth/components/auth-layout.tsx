import React from "react";
import { Group, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import classes from "./auth.module.css";
import { IconLock, IconShieldCheck } from "@tabler/icons-react";
import { getAppName } from "@/lib/config.ts";

type AuthLayoutProps = {
  children: React.ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation();
  const appName = getAppName();

  return (
    <div className={classes.authPage}>
      <Group justify="center" gap={8} className={classes.logo}>
        <img src="/icons/favicon-32x32.png" alt={appName} width={22} height={22} />
        <Text size="28px" fw={700} style={{ userSelect: "none" }}>
          {appName}
        </Text>
      </Group>
      <div className={classes.authGrid}>
        <section className={classes.story} aria-label={t("Product overview")}>
          <div className={classes.storyEyebrow}>
            <IconLock size={15} /> {t("Knowledge ledger")}
          </div>
          <h1>{t("The source of truth for the organization.")}</h1>
          <p>
            {t(
              "Policies, procedures, and decisions live in one governed workspace — searchable, verifiable, and ready when you need them.",
            )}
          </p>
          <div className={classes.storyFoot}>
            <IconShieldCheck size={16} /> {t("Private, self-hosted knowledge")}
          </div>
        </section>
        <main>{children}</main>
      </div>
    </div>
  );
}
