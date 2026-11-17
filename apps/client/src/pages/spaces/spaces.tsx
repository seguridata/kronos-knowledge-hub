import { Container, Title, Text, Group, Box } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { getAppName } from "@/lib/config";
import { useGetSpacesQuery } from "@/features/space/queries/space-query";
import CreateSpaceModal from "@/features/space/components/create-space-modal";
import { AllSpacesList } from "@/features/space/components/spaces-page";
import FavoriteSpacesGrid from "@/features/space/components/spaces-page/favorite-spaces-grid";
import { usePaginateAndSearch } from "@/hooks/use-paginate-and-search";
import useUserRole from "@/hooks/use-user-role";
import PageListSkeleton from "@/components/ui/page-list-skeleton";
import classes from "@/styles/workspace-page.module.css";

export default function Spaces() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const { search, cursor, goNext, goPrev, handleSearch } =
    usePaginateAndSearch();

  const { data, isLoading } = useGetSpacesQuery({
    cursor,
    limit: 30,
    query: search,
  });

  return (
    <>
      <Helmet>
        <title>
          {t("Spaces")} - {getAppName()}
        </title>
      </Helmet>

      <Container size={1000} className={classes.page}>
        <div className={classes.header}>
          <div>
            <span className={classes.kicker}>{t("Workspace")}</span>
            <Title order={1} className={classes.title}>
              {t("Spaces")}
            </Title>
            <Text className={classes.description}>
              {t("A place for every team. Knowledge for everyone.", {
                defaultValue: "A place for every team. Knowledge for everyone.",
              })}
            </Text>
          </div>
          {isAdmin && <CreateSpaceModal />}
        </div>

        <FavoriteSpacesGrid />

        <Box className={classes.surface}>
          <Text size="sm" c="dimmed" mb="md">
            {t("All spaces")}
          </Text>

          {isLoading ? (
            <PageListSkeleton />
          ) : (
            <AllSpacesList
              spaces={data?.items || []}
              onSearch={handleSearch}
              hasPrevPage={data?.meta?.hasPrevPage}
              hasNextPage={data?.meta?.hasNextPage}
              onNext={() => goNext(data?.meta?.nextCursor)}
              onPrev={goPrev}
            />
          )}
        </Box>
      </Container>
    </>
  );
}
