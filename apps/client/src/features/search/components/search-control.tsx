import { IconSearch } from "@tabler/icons-react";
import cx from "clsx";
import {
  ActionIcon,
  BoxProps,
  ElementProps,
  Group,
  rem,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import classes from "./search-control.module.css";
import React from "react";
import { useTranslation } from "react-i18next";
import { platformModifierLabel } from "@/lib";

interface SearchControlProps extends BoxProps, ElementProps<"button"> {}

export function SearchControl({ className, ...others }: SearchControlProps) {
  const { t } = useTranslation();

  return (
    <UnstyledButton
      {...others}
      className={cx(classes.root, className)}
      aria-label={t("Search workspace")}
    >
      <Group gap="xs" wrap="nowrap" w="100%">
        <IconSearch style={{ width: rem(16), height: rem(16) }} stroke={1.5} />
        <Text fz="sm" c="dimmed" className={classes.placeholder}>
          {t("Search knowledge")}
        </Text>
        <Text fw={600} className={classes.shortcut}>
          {platformModifierLabel === "⌘" ? "⌘K" : "Ctrl+K"}
        </Text>
      </Group>
    </UnstyledButton>
  );
}

interface SearchMobileControlProps {
  onSearch: () => void;
}

export function SearchMobileControl({ onSearch }: SearchMobileControlProps) {
  const { t } = useTranslation();

  return (
    <Tooltip label={t("Search")} withArrow>
      <ActionIcon
        variant="subtle"
        color="dark"
        aria-label={t("Search")}
        onClick={onSearch}
        size="sm"
      >
        <IconSearch size={20} stroke={2} />
      </ActionIcon>
    </Tooltip>
  );
}
