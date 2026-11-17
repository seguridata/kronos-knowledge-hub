import React from "react";
import { useTranslation } from "react-i18next";
import classes from "./auth.module.css";
import { IconShieldCheck } from "@tabler/icons-react";
import { getAppName } from "@/lib/config.ts";

type AuthLayoutProps = {
  children: React.ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation();
  const appName = getAppName();

  return (
    <div className={classes.authPage}>
      <div className={classes.authGrid}>
        <section className={classes.story} aria-label={t("Product overview")}>
          <div className={classes.logo}>
            <img src="/icons/favicon-32x32.png" alt="" width={32} height={32} />
            <span>{appName}</span>
          </div>
          <div className={classes.storyContent}>
            <div className={classes.brandArt} aria-hidden="true">
              <svg viewBox="0 0 480 300" fill="none" focusable="false">
                <path
                  className={classes.artGrid}
                  d="M0 75H480M0 150H480M0 225H480M80 0V300M160 0V300M240 0V300M320 0V300M400 0V300"
                />
                <circle
                  className={classes.artOrbit}
                  cx="240"
                  cy="150"
                  r="132"
                />
                <circle
                  className={classes.artOrbit}
                  cx="240"
                  cy="150"
                  r="100"
                />
                <g transform="translate(240 150) rotate(-30)">
                  <rect
                    className={classes.artSheetBack}
                    x="-84"
                    y="-90"
                    width="168"
                    height="210"
                    rx="8"
                  />
                  <rect
                    className={classes.artSheetMiddle}
                    x="-84"
                    y="-108"
                    width="168"
                    height="210"
                    rx="8"
                  />
                  <rect
                    className={classes.artSheetFront}
                    x="-84"
                    y="-126"
                    width="168"
                    height="210"
                    rx="8"
                  />
                  <path
                    className={classes.artLines}
                    d="M-54-86H-14M-54-54H54M-54-32H54M-54-10H22"
                  />
                  <path className={classes.artMark} d="M-54 40L-39 55L-10 26" />
                  <path className={classes.artLines} d="M12 43H54" />
                </g>
                <circle cx="372" cy="150" r="5" fill="#84BD00" />
                <circle cx="108" cy="150" r="3" fill="#84BD00" />
              </svg>
            </div>
            <h2>{t("The source of truth for the organization.")}</h2>
            <p>
              {t(
                "Policies, procedures, and decisions live in one governed workspace — searchable, verifiable, and ready when you need them.",
              )}
            </p>
          </div>
          <div className={classes.storyFoot}>
            <IconShieldCheck size={18} aria-hidden="true" />
            <span>{t("Private, self-hosted knowledge")}</span>
          </div>
        </section>
        <main className={classes.formPanel}>
          <div className={classes.formContent}>{children}</div>
        </main>
      </div>
    </div>
  );
}
