import {
  Avatar,
  Badge,
  Button,
  Card,
  createTheme,
  CSSVariablesResolver,
  Drawer,
  Menu,
  MantineColorsTuple,
  Modal,
  Overlay,
  Popover,
  Tabs,
  Tooltip,
  v8CssVariablesResolver,
} from "@mantine/core";

// Shared enter/exit motion for overlay-style components (modal, drawer,
// menu, popover): a quick, subtle scale+fade rather than Mantine's default
// per-component transitions, so every "floating" surface in the app feels
// like it belongs to the same motion language. Respects prefers-reduced-motion
// automatically — Mantine's transition engine no-ops when that's set.
const overlayTransitionProps = {
  transition: "pop",
  duration: 180,
  timingFunction: "cubic-bezier(0.215, 0.61, 0.355, 1)",
} as const;

// Frosted glass for floating surfaces (modal, drawer, menu, popover,
// Spotlight). `light-dark()` is a <color> function only — using it for
// backdrop-filter makes the declaration invalid and the browser drops the
// Gaussian blur, leaving a see-through panel. Keep blur as a real filter.
const glassFilter = "var(--app-glass-blur, blur(28px) saturate(155%))";
const glassSurfaceStyle = {
  backgroundColor:
    "light-dark(rgba(255, 255, 255, 0.88), rgba(14, 16, 14, 0.84))",
  backgroundImage: "none",
  backdropFilter: glassFilter,
  WebkitBackdropFilter: glassFilter,
  border:
    "1px solid light-dark(rgba(25, 37, 22, 0.1), rgba(255, 255, 255, 0.14))",
  boxShadow:
    "inset 0 1px 0 light-dark(rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.12)), 0 18px 48px light-dark(rgba(24, 35, 17, 0.12), rgba(0, 0, 0, 0.45))",
} as const;

const overlayScrimProps = {
  backgroundOpacity: 0.5,
  blur: 12,
  color: "#050505",
} as const;

const blue: MantineColorsTuple = [
  "#e7f3ff",
  "#d0e4ff",
  "#a1c6fa",
  "#6ea6f6",
  "#458bf2",
  "#2b7af1",
  "#0b60d8",
  "#1b72f2",
  "#0056c1",
  "#004aac",
];

const red: MantineColorsTuple = [
  "#ffebeb",
  "#fad7d7",
  "#eeadad",
  "#e3807f",
  "#da5a59",
  "#d54241",
  "#d43535",
  "#bc2727",
  "#a82022",
  "#93151b",
];

// SeguriData brand green (#84BD00), used sparingly as an accent color
// (active-state indicators, focus rings) rather than as the app's
// primary color, to avoid saturating the whole UI in green.
const seguridataGreen: MantineColorsTuple = [
  "#f4faE3",
  "#e7f4c2",
  "#d3ec96",
  "#bee266",
  "#abd93d",
  "#9dd220",
  "#84BD00",
  "#71a300",
  "#5f8a00",
  "#4c7000",
];

// Deeper, brand-anchored dark palette replacing Mantine's default flat
// dark.7 (#1a1b1e). Keeps the same lightness ordering (0 = light text on
// dark, 9 = deepest background) so every existing var(--mantine-color-dark-N)
// reference across the app's CSS modules (borders at dark-4, hover at
// dark-6, header/nav flat bg at dark-8, etc.) automatically deepens too.
// dark.7 is pinned to the brand's Negro Carbón (#191919); dark.9 is the
// true page floor, dark.5/6 step up in lightness for popover/hover surfaces
// — a small elevation ladder instead of one flat dark color everywhere.
const dark: MantineColorsTuple = [
  "#C8C9CC",
  "#A8A9AD",
  "#909296",
  "#5c5f66",
  "#35383d",
  "#262626",
  "#212121",
  "#191919",
  "#141414",
  "#101010",
];

// SeguriData brand typography (corporate manual specifies Bahnschrift /
// Aptos, both Windows-only and unlicensed for web embedding — Poppins is
// used instead as the closest widely-licensed geometric sans, self-hosted
// via @fontsource so it renders identically offline).
const fontFamily =
  "Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export const theme = createTheme({
  fontFamily,
  headings: {
    fontFamily,
    fontWeight: "600",
  },
  colors: {
    blue,
    red,
    seguridataGreen,
    dark,
  },
  // Drives every Mantine `--mantine-primary-color-*` CSS variable (input
  // focus borders, Checkbox/Radio/Switch/Slider "checked" fills, the
  // default focus-visible outline, Loader, default Badge/Button fill,
  // etc.) app-wide. Without this Mantine falls back to its built-in blue,
  // which is how the "Buscar espacios" Select focus ring (and every other
  // unstyled input/interactive control) was still rendering blue even
  // though the sidebar's own nav-link CSS had been re-themed. Components
  // that need to stay off-brand-green (Button defaults to gray below,
  // Tabs already pins seguridataGreen explicitly) keep working because
  // their own defaultProps/color still win over this theme-level default.
  primaryColor: "seguridataGreen",
  defaultRadius: 'sm',
  components: {
    // Primary actions (e.g. "Create space") default to gray instead of
    // Mantine's default blue, keeping the brand green reserved for the
    // subtle accents above. Buttons with an explicit color prop are
    // unaffected.
    Avatar: Avatar.extend({
      defaultProps: {
        radius: "md",
      },
    }),
    Button: Button.extend({
      defaultProps: {
        color: "gray",
      },
      classNames: { root: "app-pressable" },
    }),
    // Every Card sits on the wallpaper (or on a parent glass surface). The
    // shared `.app-glass-surface` class supplies the frosted tint + blur;
    // nested Cards drop the extra blur via the carve-out in motion.css.
    Card: Card.extend({
      classNames: { root: "app-glass-surface" },
    }),
    Tooltip: Tooltip.extend({
      defaultProps: {
        events: { hover: true, focus: true, touch: false },
        transitionProps: { transition: "fade", duration: 100 },
      },
    }),
    Overlay: Overlay.extend({
      defaultProps: overlayScrimProps,
    }),
    ModalOverlay: Modal.Overlay.extend({
      defaultProps: overlayScrimProps,
    }),
    DrawerOverlay: Drawer.Overlay.extend({
      defaultProps: overlayScrimProps,
    }),
    Modal: Modal.extend({
      defaultProps: {
        transitionProps: overlayTransitionProps,
        overlayProps: overlayScrimProps,
      },
      classNames: { content: "app-glass" },
      styles: {
        content: glassSurfaceStyle,
        header: { backgroundColor: "transparent" },
      },
    }),
    Drawer: Drawer.extend({
      defaultProps: {
        transitionProps: overlayTransitionProps,
        overlayProps: overlayScrimProps,
      },
      classNames: { content: "app-glass" },
      styles: {
        content: glassSurfaceStyle,
        header: { backgroundColor: "transparent" },
      },
    }),
    Menu: Menu.extend({
      defaultProps: { transitionProps: overlayTransitionProps },
      classNames: { dropdown: "app-glass" },
      styles: { dropdown: glassSurfaceStyle },
    }),
    Popover: Popover.extend({
      defaultProps: { transitionProps: overlayTransitionProps },
      classNames: { dropdown: "app-glass" },
      // Mantine's Combobox (used internally by Select/MultiSelect/
      // Autocomplete/etc.) is a thin wrapper around this same Popover
      // component, and always renders it with withRoles={false} (a real,
      // standalone Popover usage defaults to withRoles: true). That's the
      // one reliable signal to tell them apart. Combobox dropdowns are very
      // often nested inside another already-glass surface (a Select inside
      // a Popover, like the space switcher's "Buscar espacios"), so giving
      // them the same translucent+blurred glassSurfaceStyle stacks two
      // blurred layers and the text behind bleeds through unreadably. Give
      // Combobox-family dropdowns a solid, unblurred surface instead —
      // fixed at the source, app-wide, rather than per-instance.
      // NOTE: an earlier attempt tried patching this via a plain CSS rule
      // in a11y-overrides.css targeting `.mantine-Popover-dropdown[role=
      // "presentation"]` — that never worked, because Mantine applies
      // theme-level `styles` as inline React style attributes, which no
      // external (non-!important) stylesheet rule can ever override
      // regardless of selector specificity. Branching here, at the styles
      // function itself, is the only fix that actually wins.
      styles: (_theme, props) =>
        props.withRoles === false
          ? {
              dropdown: {
                backgroundColor:
                  "light-dark(var(--mantine-color-body), rgba(20, 20, 20, 0.94))",
                backgroundImage: "none",
                backdropFilter: "none",
                WebkitBackdropFilter: "none",
                border:
                  "1px solid light-dark(var(--mantine-color-gray-3), rgba(255, 255, 255, 0.1))",
                boxShadow:
                  "light-dark(var(--mantine-shadow-md), 0 8px 32px rgba(0, 0, 0, 0.35))",
              },
            }
          : { dropdown: glassSurfaceStyle },
    }),
    // Size badges to their content; fit-content collapses inside table cells.
    Badge: Badge.extend({
      styles: (_theme, props) => ({
        root:
          props.fullWidth || props.circle
            ? {}
            : { width: "max-content", maxWidth: "100%" },
      }),
    }),
    Tabs: Tabs.extend({
      // Give the active-tab indicator a subtle brand-green accent by
      // default, without touching Tabs usages that already set an
      // explicit color (e.g. color="dark").
      defaultProps: {
        color: "seguridataGreen",
      },
      vars: (theme, props) => ({
        root: {
          ...(props.color === "dark" && {
            "--tabs-color": "var(--mantine-color-dark-default)",
          }),
        },
      }),
    }),
  },
  /***
  components: {
    ActionIcon: ActionIcon.extend({
      vars: (_theme, props) => {
        return {
          root: {
            ...(props.variant === "subtle" &&
              props.color === "dark" && {
                "--ai-color": "var(--mantine-color-default-color)",
                "--ai-hover": "var(--mantine-color-default-hover)",
              }),
          },
        };
      },
    }),
  },
  ***/
});

export const mantineCssResolver: CSSVariablesResolver = (theme) => ({
  variables: {
    ...v8CssVariablesResolver(theme).variables,
    "--input-error-size": theme.fontSizes.sm,
    // SeguriData brand accent, used sparingly across the app (see
    // global-sidebar.module.css for its main usages).
    "--app-accent-green": "#84BD00",
  },
  light: {
    ...v8CssVariablesResolver(theme).light,
    "--mantine-color-dimmed": "#4b5563",
    "--mantine-color-dark-light-color": "#4e5359",
    "--mantine-color-dark-light-hover": "var(--mantine-color-gray-light-hover)",
    // Override the semantic error color so input error text / borders /
    // required asterisks meet WCAG AA 4.5:1 contrast on the filled-input
    // background (#f1f3f5). red.6 (#d43535) lands at 4.36:1; red.7 (#bc2727)
    // gives ~5.7:1. Does not affect other red usages.
    "--mantine-color-error": "var(--mantine-color-red-7)",
    // Bump subtle-gray icon/text color from gray.6 (#868e96, 2.99:1 on filled
    // input — fails WCAG AA 3:1 for non-text) to gray.7 (#495057, 7.35:1).
    // Affects ActionIcon variant="subtle" color="gray" (password visibility
    // toggle, row action menus, etc.).
    "--mantine-color-gray-light-color": "var(--mantine-color-gray-7)",
    // Bump input placeholder color from gray.5 (#adb5bd, 1.87:1 on filled
    // input — fails WCAG AA 4.5:1) to #686868 (5.01:1 on filled, 5.57:1 on
    // white). Halfway between Mantine's gray.6 and gray.7 so the placeholder
    // stays visually distinct from real text while clearing the bar with a
    // safe margin. Affects placeholders across all Mantine inputs.
    "--mantine-color-placeholder": "#686868",
    // Bump variant="light" red text from red.6 (#d43535, 4.17:1 on the
    // 10% red-over-white blended pink background — fails WCAG AA 4.5:1)
    // to red.7 (#bc2727, 5.26:1). Affects every <Button color="red"
    // variant="light"> and matching Badge / Text usages (destructive
    // actions, red badges).
    "--mantine-color-red-light-color": "var(--mantine-color-red-7)",
    // Bump variant="light" green text. Green is inherently bright in
    // luminance, so even Mantine's green.9 (#2b8a3e, 3.78:1) fails 4.5:1
    // on the light-green bg. Use a custom dark green (#1b5e20, Material
    // green 900) outside the standard palette range. New contrast:
    // ~6.8:1. Affects every <Badge color="green" variant="light"> and
    // matching Button / Text usages.
    "--mantine-color-green-light-color": "#1B5E20",
    "--mantine-color-orange-light-color": "#a63508",
  },
  dark: {
    ...v8CssVariablesResolver(theme).dark,
    "--mantine-color-dark-light-color": "var(--mantine-color-gray-4)",
    "--mantine-color-dark-light-hover": "var(--mantine-color-default-hover)",
  },
});
