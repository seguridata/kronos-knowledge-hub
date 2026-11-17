import React from "react";
import { MfaSettings } from "@/ee/mfa";
import classes from "@/components/settings/settings-content.module.css";

export function AccountMfaSection() {
  return (
    <div className={classes.mfaSection}>
      <MfaSettings />
    </div>
  );
}
