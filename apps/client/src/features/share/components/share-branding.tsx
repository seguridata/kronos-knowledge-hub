import { Affix, Button } from "@mantine/core";
import { getAppName } from "@/lib/config.ts";

export default function ShareBranding() {
  return (
    <Affix position={{ bottom: 20, right: 20 }}>
      <Button variant="default" component="a" href="/home" radius="xl">
        {getAppName()}
      </Button>
    </Affix>
  );
}
