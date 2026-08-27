import { Title, Text, Button, Container, Group } from "@mantine/core";
import classes from "./error-404.module.css";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { getAppName } from "@/lib/config.ts";

export function Error404() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>
          {t("404 page not found")} - {getAppName()}
        </title>
      </Helmet>
      <Container className={classes.root}>
        <p className={classes.kicker}>{t("Missing page")}</p>
        <Title className={classes.title}>{t("This page is not here")}</Title>
        <Text c="dimmed" size="lg" ta="center" className={classes.description}>
          {t("The link may be outdated, or you might not have access to this document.")}
        </Text>
        <Group justify="center">
          <Button component={Link} to={"/home"} variant="subtle" size="md">
            {t("Back to home")}
          </Button>
        </Group>
      </Container>
    </>
  );
}
