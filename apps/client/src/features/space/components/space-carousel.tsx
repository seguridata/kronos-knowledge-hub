import {
  Text,
  Card,
  rem,
  Group,
  Button,
  Skeleton,
  Title,
  Alert,
} from "@mantine/core";
import {
  prefetchSpace,
  useGetSpacesQuery,
} from "@/features/space/queries/space-query.ts";
import { getSpaceUrl } from "@/lib/config.ts";
import { Link } from "react-router-dom";
import classes from "./space-carousel.module.css";
import { formatMemberCount } from "@/lib";
import { useTranslation } from "react-i18next";
import { IconArrowRight, IconLayoutGrid } from "@tabler/icons-react";
import { EmptyState } from "@/components/ui/empty-state";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";
import CardCarousel from "@/components/ui/card-carousel";
import { motion, useReducedMotion } from "motion/react";

// Stagger each card's entrance by 40ms so the carousel reveals as a wave
// rather than popping in all at once.
const STAGGER_STEP_S = 0.04;

function SpaceCardSkeleton() {
  return (
    <div className={classes.bezel}>
      <Card p="sm" radius="lg" withBorder={false} className={classes.card}>
        <Card.Section className={classes.cardSection} h={52} />
        <Skeleton height={38} width={38} mt={rem(-20)} radius="md" />
        <Skeleton height={14} mt="xs" width="70%" radius="xl" />
        <Skeleton height={10} mt="sm" width="90%" radius="xl" />
        <Skeleton height={10} mt="md" width="40%" radius="xl" />
      </Card>
    </div>
  );
}

export default function SpaceCarousel() {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useGetSpacesQuery({
    limit: 20,
  });
  const shouldReduceMotion = useReducedMotion();

  if (isPending) {
    return (
      <>
        <Group justify="space-between" align="center" mb="md">
          <Title order={2} size="h6" fw={500}>
            {t("Spaces you belong to")}
          </Title>
        </Group>
        <CardCarousel ariaLabel={t("Spaces you belong to")}>
          {Array.from({ length: 4 }, (_, i) => (
            <SpaceCardSkeleton key={i} />
          ))}
        </CardCarousel>
      </>
    );
  }

  if (isError)
    return (
      <Alert color="gray" title={t("Unable to load spaces")}>
        <Text size="sm" mb="sm">
          {t("Check your connection and try again.")}
        </Text>
        <Button size="xs" variant="default" onClick={() => void refetch()}>
          {t("Try again")}
        </Button>
      </Alert>
    );

  if (!data?.items.length)
    return (
      <EmptyState
        icon={IconLayoutGrid}
        title={t("No spaces yet")}
        description={t(
          "Explore the available spaces to start working with your team.",
        )}
        action={
          <Button component={Link} to="/spaces" variant="default" size="sm">
            {t("Explore spaces")}
          </Button>
        }
      />
    );

  const cards = data.items.map((space, index) => (
    <motion.div
      key={space.id}
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.25,
        delay: Math.min(index, 4) * STAGGER_STEP_S,
        ease: "easeOut",
      }}
    >
      <div className={classes.bezel}>
        <Card
          p="sm"
          radius="lg"
          component={Link}
          to={getSpaceUrl(space.slug)}
          onMouseEnter={() => prefetchSpace(space.slug, space.id)}
          className={`${classes.card} app-glass-surface`}
          withBorder={false}
        >
          <Card.Section className={classes.cardSection} h={52} />
          <CustomAvatar
            name={space.name}
            avatarUrl={space.logo}
            type={AvatarIconType.SPACE_ICON}
            color="initials"
            variant="filled"
            size="md"
            radius="md"
            mt={rem(-20)}
          />

          <Text fz="md" fw={600} mt="xs" className={classes.title}>
            {space.name}
          </Text>

          {space.description ? (
            <Text
              c="dimmed"
              size="xs"
              mt={6}
              lineClamp={2}
              className={classes.description}
            >
              {space.description}
            </Text>
          ) : null}

          <Text c="dimmed" size="xs" fw={600} mt="md">
            {formatMemberCount(space.memberCount, t)}
          </Text>
        </Card>
      </div>
    </motion.div>
  ));

  return (
    <>
      <Group justify="space-between" align="end" mb="md">
        <div>
          <Text size="xs" tt="uppercase" fw={700} lts="0.12em" c="dimmed">
            {t("Collections")}
          </Text>
          <Title order={2} size="h5" fw={650} mt={4}>
            {t("Spaces you belong to")}
          </Title>
        </div>
      </Group>

      <CardCarousel ariaLabel={t("Spaces you belong to")}>{cards}</CardCarousel>

      {data?.items && data.items.length > 1 && (
        <Group justify="flex-end" mt="lg">
          <Button
            component={Link}
            to="/spaces"
            variant="subtle"
            rightSection={<IconArrowRight size={16} />}
            size="sm"
          >
            {t("View all spaces")}
          </Button>
        </Group>
      )}
    </>
  );
}
