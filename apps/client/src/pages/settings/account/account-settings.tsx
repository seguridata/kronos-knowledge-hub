import AccountNameForm from "@/features/user/components/account-name-form";
import ChangeEmail from "@/features/user/components/change-email";
import ChangePassword from "@/features/user/components/change-password";
import { Divider } from "@mantine/core";
import AccountAvatar from "@/features/user/components/account-avatar";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import { getAppName } from "@/lib/config.ts";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { AccountMfaSection } from "@/features/user/components/account-mfa-section";
import SessionList from "@/features/session/components/session-list";
import classes from "@/components/settings/settings-content.module.css";

export default function AccountSettings() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>
          {t("My Profile")} - {getAppName()}
        </title>
      </Helmet>
      <div className={classes.content}>
        <SettingsTitle title={t("My Profile")} />

        <div className={classes.identity}>
          <AccountAvatar />
          <AccountNameForm />
        </div>

        <Divider my="lg" />

        <ChangeEmail />

        <Divider my="lg" />

        <ChangePassword />

        <Divider my="lg" />

        <AccountMfaSection />

        <Divider my="lg" />

        <div className={classes.sessions}>
          <SessionList />
        </div>
      </div>
    </>
  );
}
