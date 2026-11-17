import React from "react";
import { Title } from "@mantine/core";
import classes from "./settings-content.module.css";

export default function SettingsTitle({ title }: { title: string }) {
  return (
    <header className={classes.title}>
      <Title order={1} size="h3">
        {title}
      </Title>
    </header>
  );
}
