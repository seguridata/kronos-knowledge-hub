import { useEffect, useState } from "react";
import {
  ActionIcon,
  Badge,
  Container,
  Group,
  Space,
  Text,
  Tooltip,
} from "@mantine/core";
import HomeTabs from "@/features/home/components/home-tabs";
import HomeAiPrompt from "@/features/home/components/home-ai-prompt";
import SpaceCarousel from "@/features/space/components/space-carousel.tsx";
import { getAppName } from "@/lib/config.ts";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAtomValue } from "jotai";
import {
  IconAdjustmentsHorizontal,
  IconArrowUpRight,
  IconCommand,
  IconLayoutGrid,
  IconPlugConnected,
  IconSearch,
  IconSparkles,
  IconStar,
} from "@tabler/icons-react";
import { searchSpotlight } from "@/features/search/constants.ts";
import {
  userAtom,
  workspaceAtom,
} from "@/features/user/atoms/current-user-atom.ts";
import classes from "./home.module.css";

function timeOfDayGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const { t } = useTranslation();
  const workspace = useAtomValue(workspaceAtom);
  const user = useAtomValue(userAtom);
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const greeting = t(timeOfDayGreeting(new Date().getHours()));
  const [focusMode, setFocusMode] = useState(() => {
    return window.localStorage.getItem("seguridata:home-focus-mode") === "true";
  });

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      const isSearchShortcut =
        (!isTyping && event.key === "/") ||
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k");

      if (!isSearchShortcut) return;
      event.preventDefault();
      searchSpotlight.open();
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const toggleFocusMode = () => {
    const nextValue = !focusMode;
    window.localStorage.setItem("seguridata:home-focus-mode", String(nextValue));

    if (document.startViewTransition) {
      document.startViewTransition(() => setFocusMode(nextValue));
    } else {
      setFocusMode(nextValue);
    }
  };

  return (
    <>
      <Helmet>
        <title>
          {t("Home")} - {getAppName()}
        </title>
      </Helmet>
      <Container size="1100" className={classes.page} data-focus-mode={focusMode || undefined}>
        <section className={classes.hero} aria-labelledby="home-title">
          <div className={classes.heroCopy}>
            <Group gap="xs" className={classes.eyebrow}>
              <span className={classes.statusDot} aria-hidden="true" />
              <Text size="xs" fw={700} tt="uppercase" lts="0.12em">
                {workspace?.name || getAppName()}
              </Text>
              <Badge size="sm" variant="light" color="seguridataGreen">
                {t("Knowledge")}
              </Badge>
            </Group>
            <h1 id="home-title" className={classes.title}>
              {firstName ? `${greeting}, ${firstName}` : greeting}
            </h1>
            <Text className={classes.description}>
              {t("Search the workspace, open a space, or continue from where you left off.")}
            </Text>
          </div>
          <div className={classes.heroMeta}>
            <div className={classes.metaLabel}>{t("Today")}</div>
            <div className={classes.metaValue}>
              {new Intl.DateTimeFormat(undefined, {
                weekday: "short",
                day: "numeric",
                month: "short",
              }).format(new Date())}
            </div>
          </div>
        </section>

        <section className={classes.actionRail} aria-label={t("Quick actions")}>
          <button type="button" className={classes.searchAction} onClick={searchSpotlight.open}>
            <span className={classes.actionIcon}><IconSearch size={18} /></span>
            <span className={classes.actionText}>
              <strong>{t("Search workspace")}</strong>
              <small>{t("Find a page, space, or person")}</small>
            </span>
            <kbd className={classes.shortcut}><IconCommand size={12} />K</kbd>
          </button>
          <Link to="/spaces" className={classes.actionLink}>
            <IconLayoutGrid size={18} />
            <span>{t("Explore spaces")}</span>
            <IconArrowUpRight size={15} />
          </Link>
          <Link to="/favorites" className={classes.actionLink}>
            <IconStar size={18} />
            <span>{t("Open favorites")}</span>
            <IconArrowUpRight size={15} />
          </Link>
          <Link to="/settings/ai/mcp" className={classes.actionLink}>
            <IconPlugConnected size={18} />
            <span>{workspace?.settings?.ai?.mcp ? t("MCP connected") : t("Connect MCP")}</span>
            <IconArrowUpRight size={15} />
          </Link>
          <Tooltip label={focusMode ? t("Show all sections") : t("Keep only the essentials")} withArrow>
            <ActionIcon
              variant="subtle"
              size="lg"
              className={classes.focusAction}
              onClick={toggleFocusMode}
              aria-pressed={focusMode}
              aria-label={focusMode ? t("Show all sections") : t("Enable focus mode")}
            >
              <IconAdjustmentsHorizontal size={19} />
            </ActionIcon>
          </Tooltip>
        </section>

        <HomeAiPrompt />

        <Space h="xl" />

        {!focusMode && <SpaceCarousel />}

        <Space h="xl" />

        <section className={classes.activitySurface}>
          <div className={classes.sectionHeading}>
            <div>
              <Text className={classes.sectionKicker}>{t("Library")}</Text>
              <Text component="h2" className={classes.sectionTitle}>
                {t("Continue working")}
              </Text>
            </div>
            <div className={classes.sectionHint}>
              <IconSparkles size={16} />
              {focusMode ? t("Focus mode is on") : t("Recent pages, favorites, and yours")}
            </div>
          </div>
          <HomeTabs />
        </section>
      </Container>
    </>
  );
}
