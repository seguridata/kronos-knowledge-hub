import { Center, Loader, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

export default function PageLoading() {
  const { t } = useTranslation();
  return (
    <Center mih="50svh" p="xl" role="status" aria-live="polite">
      <Stack align="center" gap="md">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          {t("Loading...")}
        </Text>
      </Stack>
    </Center>
  );
}
