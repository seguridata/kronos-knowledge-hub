import { AppShell, Container, Drawer } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SettingsSidebar from "@/components/settings/settings-sidebar.tsx";
import { useAtom } from "jotai";
import {
  asideStateAtom,
  desktopSidebarAtom,
  mobileSidebarAtom,
  sidebarWidthAtom,
} from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { SpaceSidebar } from "@/features/space/components/sidebar/space-sidebar.tsx";
import AiChatSidebar from "@/ee/ai-chat/components/ai-chat-sidebar.tsx";
import { AppHeader } from "@/components/layouts/global/app-header.tsx";
import Aside from "@/components/layouts/global/aside.tsx";
import classes from "./app-shell.module.css";
import GlobalSidebar from "@/components/layouts/global/global-sidebar.tsx";
import { ASIDE_PANEL_ID } from "@/hooks/use-toggle-aside.tsx";
import { MAIN_CONTENT_ID, SkipToMain } from "@/components/ui/skip-to-main.tsx";

export default function GlobalAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [mobileOpened, setMobileOpened] = useAtom(mobileSidebarAtom);
  const isMobile = useMediaQuery("(max-width: 47.99em)");
  const [desktopOpened] = useAtom(desktopSidebarAtom);
  const [{ isAsideOpen, tab: asideTab }] = useAtom(asideStateAtom);
  const [sidebarWidth, setSidebarWidth] = useAtom(sidebarWidthAtom);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const startResizing = React.useCallback((mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = React.useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing && sidebarRef.current) {
        const newWidth =
          mouseMoveEvent.clientX -
          sidebarRef.current.getBoundingClientRect().left;
        if (newWidth < 220) {
          setSidebarWidth(220);
          return;
        }
        if (newWidth > 600) {
          setSidebarWidth(600);
          return;
        }
        setSidebarWidth(newWidth);
      }
    },
    [isResizing, setSidebarWidth],
  );

  useEffect(() => {
    //https://codesandbox.io/p/sandbox/kz9de
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  const location = useLocation();
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const isSpaceRoute = location.pathname.startsWith("/s/");
  const isAiRoute = location.pathname.startsWith("/ai");
  const isPageRoute = location.pathname.includes("/p/");
  const navigationLabel = isSpaceRoute
    ? t("Space navigation")
    : isSettingsRoute
      ? t("Settings navigation")
      : isAiRoute
        ? t("AI navigation")
        : t("Main navigation");
  const sidebarContent = isSpaceRoute ? (
    <SpaceSidebar />
  ) : isSettingsRoute ? (
    <SettingsSidebar />
  ) : isAiRoute ? (
    <AiChatSidebar />
  ) : (
    <GlobalSidebar />
  );
  useEffect(() => {
    setMobileOpened(false);
  }, [location.pathname, isMobile, setMobileOpened]);

  return (
    <>
      <SkipToMain />
      <AppShell
        header={{ height: 64 }}
        navbar={{
          width: isSpaceRoute ? sidebarWidth : 256,
          breakpoint: "sm",
          collapsed: {
            mobile: true,
            desktop: !desktopOpened,
          },
        }}
        aside={
          isPageRoute && {
            width: 350,
            breakpoint: "sm",
            collapsed: { mobile: !isAsideOpen, desktop: !isAsideOpen },
          }
        }
        padding="md"
      >
        <AppShell.Header px="md" className={classes.header}>
          <AppHeader />
        </AppShell.Header>
        {!isMobile && (
          <AppShell.Navbar
            className={classes.navbar}
            withBorder={false}
            ref={sidebarRef}
            aria-label={
              isSpaceRoute
                ? t("Space navigation")
                : isSettingsRoute
                  ? t("Settings navigation")
                  : isAiRoute
                    ? t("AI navigation")
                    : t("Main navigation")
            }
          >
            {isSpaceRoute && (
              <div
                className={classes.resizeHandle}
                onMouseDown={startResizing}
                role="separator"
                aria-label={t("Resize sidebar")}
                aria-orientation="vertical"
                aria-valuemin={220}
                aria-valuemax={600}
                aria-valuenow={sidebarWidth}
                tabIndex={0}
                onKeyDown={(event) => {
                  const widths = {
                    ArrowLeft: sidebarWidth - 16,
                    ArrowRight: sidebarWidth + 16,
                    Home: 220,
                    End: 600,
                  };
                  if (!(event.key in widths)) return;
                  event.preventDefault();
                  setSidebarWidth(
                    Math.min(600, Math.max(220, widths[event.key])),
                  );
                }}
              />
            )}
            {sidebarContent}
          </AppShell.Navbar>
        )}
        <Drawer
          opened={Boolean(isMobile && mobileOpened)}
          onClose={() => setMobileOpened(false)}
          title={navigationLabel}
          position="left"
          size="min(350px, 100%)"
          padding={0}
          styles={{
            header: { height: 64, paddingInline: 18 },
            body: { height: "calc(100% - 64px)", padding: 0 },
          }}
        >
          {isMobile && sidebarContent}
        </Drawer>
        <AppShell.Main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className={classes.main}
        >
          {isSettingsRoute ? (
            <Container size={900} pb={80}>
              {children}
            </Container>
          ) : (
            children
          )}
        </AppShell.Main>

        {isPageRoute && (
          <AppShell.Aside
            id={ASIDE_PANEL_ID}
            tabIndex={-1}
            className={classes.aside}
            p="md"
            withBorder={false}
            aria-label={
              asideTab === "comments"
                ? t("Comments")
                : asideTab === "toc"
                  ? t("Table of contents")
                  : asideTab === "chat"
                    ? t("AI Chat")
                    : asideTab === "details"
                      ? t("Details")
                      : undefined
            }
          >
            <Aside />
          </AppShell.Aside>
        )}
      </AppShell>
    </>
  );
}
