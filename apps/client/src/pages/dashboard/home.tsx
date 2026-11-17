import { useEffect, useState } from "react";
import { ActionIcon, Container, Text, Tooltip } from "@mantine/core";
import {
  IconAdjustmentsHorizontal,
  IconArrowRight,
  IconArrowUpRight,
  IconBook2,
  IconCommand,
  IconLayoutGrid,
  IconSearch,
  IconStar,
} from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import HomeTabs from "@/features/home/components/home-tabs";
import HomeAiPrompt from "@/features/home/components/home-ai-prompt";
import SpaceCarousel from "@/features/space/components/space-carousel";
import { getAppName } from "@/lib/config";
import { searchSpotlight } from "@/features/search/constants";
import {
  userAtom,
  workspaceAtom,
} from "@/features/user/atoms/current-user-atom";
import classes from "./home.module.css";

export default function Home() {
  const { t, i18n } = useTranslation();
  const workspace = useAtomValue(workspaceAtom);
  const user = useAtomValue(userAtom);
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = t(
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening",
  );
  const [focusMode, setFocusMode] = useState(() => {
    try {
      return localStorage.getItem("seguridata:home-focus-mode") === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      const isTyping =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          !!target.closest("input, textarea, select, [role='textbox']"));
      if (isTyping || event.defaultPrevented || event.altKey) return;
      if (
        event.key === "/" ||
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")
      ) {
        event.preventDefault();
        searchSpotlight.open();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);
  const toggleFocusMode = () => {
    setFocusMode((current) => {
      try {
        localStorage.setItem("seguridata:home-focus-mode", String(!current));
      } catch {
        /* Preference remains available for this session. */
      }
      return !current;
    });
  };
  return (
    <>
      <Helmet>
        <title>
          {t("Home")} - {getAppName()}
        </title>
      </Helmet>
      <Container
        size="1200"
        className={classes.page}
        data-focus-mode={focusMode || undefined}
      >
        <div className={classes.pageHeading}>
          <span className={classes.location}>
            <IconBook2 size={16} />
            {t("Your workspace", { defaultValue: "Your workspace" })}
          </span>
          <span className={classes.date}>
            {new Intl.DateTimeFormat(i18n.resolvedLanguage, {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(new Date())}
          </span>
        </div>
        <section className={classes.hero} aria-labelledby="home-title">
          <div className={classes.heroCopy}>
            <div className={classes.eyebrow}>
              <span className={classes.statusDot} />
              {workspace?.name || getAppName()}
              <span className={classes.heroDivider}>/</span>
              {t("Knowledge")}
            </div>
            <h1 id="home-title" className={classes.title}>
              {firstName ? `${greeting}, ${firstName}.` : `${greeting}.`}
            </h1>
            <Text className={classes.description}>
              {t("Your next great idea starts here.", {
                defaultValue: "Your next great idea starts here.",
              })}
            </Text>
            <Text className={classes.supporting}>
              {t(
                "Search the workspace, open a space, or continue from where you left off.",
              )}
            </Text>
            <Link to="/spaces" className={classes.heroButton}>
              {t("Explore spaces")}
              <IconArrowRight size={17} />
            </Link>
          </div>
          <div className={classes.heroArt} aria-hidden="true">
            <div className={classes.orbit} />
            <div className={classes.artBack} />
            <div className={classes.artMiddle} />
            <div className={classes.artFront}>
              <div className={classes.artIcon}>
                <IconBook2 size={27} stroke={1.5} />
              </div>
              <span className={classes.artLine} />
              <span className={classes.artLine} />
              <span className={classes.artLineShort} />
              <div className={classes.artFooter}>
                <span />
                <span />
                <span />
                <i />
              </div>
            </div>
            <div className={classes.artSpark}>+</div>
            <span className={classes.artCaption}>SEGURIDATA · KRONOS</span>
          </div>
        </section>
        <section className={classes.actionRail} aria-label={t("Quick actions")}>
          <button
            type="button"
            className={classes.searchAction}
            onClick={searchSpotlight.open}
          >
            <span className={classes.actionIcon}>
              <IconSearch size={21} stroke={1.7} />
            </span>
            <span className={classes.actionText}>
              <strong>{t("Search workspace")}</strong>
              <small>{t("Find a page, space, or person")}</small>
            </span>
            <kbd className={classes.shortcut}>
              <IconCommand size={13} /> K
            </kbd>
          </button>
          <Link to="/spaces" className={classes.actionLink}>
            <span className={classes.actionIcon}>
              <IconLayoutGrid size={21} stroke={1.7} />
            </span>
            <span className={classes.actionText}>
              <strong>{t("Spaces")}</strong>
              <small>{t("Explore spaces")}</small>
            </span>
            <IconArrowUpRight size={17} />
          </Link>
          <Link to="/favorites" className={classes.actionLink}>
            <span className={classes.actionIcon}>
              <IconStar size={21} stroke={1.7} />
            </span>
            <span className={classes.actionText}>
              <strong>{t("Favorites")}</strong>
              <small>{t("Open favorites")}</small>
            </span>
            <IconArrowUpRight size={17} />
          </Link>
        </section>
        <HomeAiPrompt />
        <div className={classes.libraryHeading}>
          <div>
            <span className={classes.sectionKicker}>{t("Library")}</span>
            <h2 className={classes.sectionTitle}>
              {t("Make room for knowledge", {
                defaultValue: "Make room for knowledge",
              })}
            </h2>
          </div>
          <Tooltip
            label={
              focusMode ? t("Show all sections") : t("Keep only the essentials")
            }
            withArrow
          >
            <ActionIcon
              variant="default"
              size="lg"
              radius="md"
              onClick={toggleFocusMode}
              aria-pressed={focusMode}
              aria-label={
                focusMode ? t("Show all sections") : t("Enable focus mode")
              }
            >
              <IconAdjustmentsHorizontal size={18} />
            </ActionIcon>
          </Tooltip>
        </div>
        {!focusMode && (
          <section className={classes.spacesSection}>
            <SpaceCarousel />
          </section>
        )}
        <section
          className={classes.activitySurface}
          aria-labelledby="activity-title"
        >
          <div className={classes.sectionHeading}>
            <h2 id="activity-title" className={classes.sectionTitle}>
              {t("Continue working")}
            </h2>
            <span className={classes.sectionHint}>
              {focusMode
                ? t("Focus mode is on")
                : t("Recent pages, favorites, and yours")}
            </span>
          </div>
          <HomeTabs />
        </section>
        <footer className={classes.footer}>
          <span>
            SeguriData <span className={classes.footerDot}>·</span> Kronos
          </span>
          <span>
            {t("Knowledge, connected.", {
              defaultValue: "Knowledge, connected.",
            })}
          </span>
        </footer>
      </Container>
    </>
  );
}
