// Copied from pulsestudios-app/StudyPulse@700c3d8 (launch-ota): src/theme/{palettes,typography,spacing,radius}.ts
// Keep in sync manually — no monorepo coupling. Changes vs source: the four token files are concatenated; values verbatim. Mirrored as CSS variables in src/styles/tokens.css (tokens.test.ts guards drift).

// --- src/theme/palettes.ts
/** Dark palette (default app look). */
export const colorsDark = {
  background: "#0D0D0D",
  surface: "#1A1A1A",
  border: "#2A2A2A",
  /** Primary CTA / accent (same as lime). */
  primary: "#58CC02",
  lime: "#58CC02",
  sky: "#1CB0F6",
  yellow: "#FFD93D",
  coral: "#FF6F61",
  textPrimary: "#FFFFFF",
  textSecondary: "#B3B3B3",
} as const;

/** Light palette — accents unchanged per product spec. */
export const colorsLight = {
  background: "#F5F5F5",
  surface: "#FFFFFF",
  border: "#E0E0E0",
  primary: "#58CC02",
  lime: "#58CC02",
  sky: "#1CB0F6",
  yellow: "#FFD93D",
  coral: "#FF6F61",
  textPrimary: "#1A1A1A",
  textSecondary: "#5C5C5C",
} as const;

export type ThemePalette = typeof colorsDark | typeof colorsLight;

// --- src/theme/typography.ts
export const typography = {
  header: {
    fontSize: 28,
    fontWeight: "800" as const,
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 20,
    fontWeight: "700" as const,
    letterSpacing: 0.1,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
    lineHeight: 24,
  },
  caption: {
    fontSize: 13,
    fontWeight: "500" as const,
    lineHeight: 18,
  },
  mono: {
    fontSize: 13,
    fontWeight: "500" as const,
    fontFamily: "monospace",
  },
} as const;

// --- src/theme/spacing.ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// --- src/theme/radius.ts
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

