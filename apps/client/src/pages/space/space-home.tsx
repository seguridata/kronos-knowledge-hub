import { useState } from "react";
import {
  Alert,
  Button,
  Container,
  Group,
  Skeleton,
  Text,
  Title,
} from "@mantine/core";
import { IconPlus, IconUsers } from "@tabler/icons-react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import SpaceHomeTabs from "@/features/space/components/space-home-tabs";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type";
import { useTreeMutation } from "@/features/page/tree/hooks/use-tree-mutation";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { AvatarIconType } from "@/features/attachments/types/attachment.types";
import { getAppName } from "@/lib/config";
import { formatMemberCount } from "@/lib";
import classes from "@/styles/workspace-page.module.css";

export default function SpaceHome() {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const {
    data: space,
    isLoading,
    isError,
    refetch,
  } = useGetSpaceBySlugQuery(spaceSlug);
  const ability = useSpaceAbility(space?.membership?.permissions);
  const { handleCreate } = useTreeMutation(space?.id ?? "");
  const [creating, setCreating] = useState(false);
  async function createPage() {
    setCreating(true);
    try {
      await handleCreate(null);
    } catch {
      /* The existing page mutation displays the error notification. */
    } finally {
      setCreating(false);
    }
  }
  return (
    <>
      <Helmet>
        <title>
          {space?.name || t("Overview")} - {getAppName()}
        </title>
      </Helmet>
      <Container size={1000} className={classes.page}>
        {isLoading ? (
          <Skeleton height={140} radius="lg" />
        ) : isError ? (
          <Alert color="gray" title={t("Unable to load spaces")}>
            <Button variant="default" onClick={() => void refetch()}>
              {t("Try again")}
            </Button>
          </Alert>
        ) : (
          space && (
            <>
              <div className={classes.header}>
                <div>
                  <Link to="/spaces" className={classes.kicker}>
                    {t("Spaces")} / {t("Overview")}
                  </Link>
                  <Group gap="md" wrap="nowrap" mt="md" align="flex-start">
                    <CustomAvatar
                      name={space.name}
                      avatarUrl={space.logo}
                      type={AvatarIconType.SPACE_ICON}
                      color="initials"
                      variant="filled"
                      size={48}
                      radius="md"
                    />
                    <div style={{ minWidth: 0 }}>
                      <Title order={1} className={classes.title}>
                        {space.name}
                      </Title>
                      {space.description && (
                        <Text className={classes.description}>
                          {space.description}
                        </Text>
                      )}
                      {space.memberCount !== undefined && (
                        <Group gap={6} mt="sm" c="dimmed">
                          <IconUsers size={14} />
                          <Text size="xs">
                            {formatMemberCount(space.memberCount, t)}
                          </Text>
                        </Group>
                      )}
                    </div>
                  </Group>
                </div>
                {ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page) && (
                  <Button
                    variant="default"
                    leftSection={<IconPlus size={16} />}
                    loading={creating}
                    onClick={createPage}
                  >
                    {t("New page")}
                  </Button>
                )}
              </div>
              <section
                className={classes.surface}
                aria-label={t("Space pages")}
              >
                <SpaceHomeTabs />
              </section>
            </>
          )
        )}
      </Container>
    </>
  );
}
