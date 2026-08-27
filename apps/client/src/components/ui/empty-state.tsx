import { Stack, Text } from "@mantine/core";
import { type TablerIcon } from "@tabler/icons-react";
import { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import classes from "./empty-state.module.css";

type EmptyStateProps = {
  icon: TablerIcon;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className={classes.root}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.215, 0.61, 0.355, 1] }}
    >
      <Stack align="center" gap="xs">
        <motion.div
          className={classes.iconBadge}
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: 0.04, ease: [0.215, 0.61, 0.355, 1] }}
        >
          <Icon size={26} stroke={1.5} className={classes.icon} />
        </motion.div>
        <Text size="lg" fw={500}>
          {title}
        </Text>
        {description && (
          <Text size="sm" c="dimmed" maw={350}>
            {description}
          </Text>
        )}
        {action}
      </Stack>
    </motion.div>
  );
}
