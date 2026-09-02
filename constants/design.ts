/**
 * Diaspora Bridge — single source of truth for design tokens.
 *
 * Every screen and component should take layout, radius, type, shadow and
 * accent values from here. Mode-dependent colors (backgrounds, text, borders,
 * glass) come from `usePremiumColors()`; this file holds the values that are
 * identical in light and dark, plus the geometry of the app chrome.
 *
 * `constants/layout.ts` re-exports the legacy token names from this file so
 * existing imports keep working.
 */

/* ------------------------------------------------------------------ *
 * Chrome geometry
 * ------------------------------------------------------------------ */

/**
 * Height of the PremiumHeader blur block, excluding the safe-area inset.
 * row paddingTop 4 + icon button 44 + row paddingBottom 12 + accent line 2.
 * Change this only if PremiumHeader's internal padding changes.
 */
export const HEADER_BLOCK_HEIGHT = 62;

/** Breathing room between the header's bottom edge and the first content row. */
export const SCREEN_TOP_GAP = 26;

/**
 * Total top offset a screen must apply to clear the absolute PremiumHeader.
 * Use `useScreenOffsets().top` instead of hand-writing `insets.top + n`.
 */
export const HEADER_OFFSET = HEADER_BLOCK_HEIGHT + SCREEN_TOP_GAP; // 88

/** Reserved vertical space for the floating glass tab bar. */
export const FLOATING_TAB_BAR_HEIGHT = 98;

/** Visible height of the tab bar pill. */
export const TAB_BAR_VISUAL_HEIGHT = 70;

/**
 * Minimum gap between the tab bar pill and the screen bottom. On devices with a
 * home indicator the bar sits on `insets.bottom` instead, whichever is larger.
 */
export const TAB_BAR_BOTTOM_GAP = 20;

/** Horizontal inset of the tab bar pill from the screen edges. */
export const TAB_BAR_SIDE_INSET = 16;

/**
 * Bottom inset for scrollable content on any screen inside a tab navigator,
 * so the last row never sits under the floating tab bar.
 */
export const SCROLL_BOTTOM_INSET = FLOATING_TAB_BAR_HEIGHT + 40; // 138

/** Bottom inset for screens outside a tab navigator (chat, workroom, auth). */
export const SCROLL_BOTTOM_INSET_PLAIN = 40;

/** The one horizontal page gutter. Nothing should use 16 or 24 any more. */
export const SCREEN_H_PADDING = 20;

/* ------------------------------------------------------------------ *
 * Spacing — 4pt grid
 * ------------------------------------------------------------------ */

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
} as const;

/* ------------------------------------------------------------------ *
 * Corner radius
 *
 * One rule: cards, buttons and inputs are all `radius.lg` (16). Hero and
 * feature surfaces are `radius.xl` (20). Bottom sheets are `radius.xxl` (28).
 * Chips are `radius.sm` (8). Anything circular is `radius.pill`.
 * ------------------------------------------------------------------ */

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

/* ------------------------------------------------------------------ *
 * Type scale
 *
 * Replaces the ad-hoc 10–40 range (which included 13, 15, 17, 19, 26, 38).
 * ------------------------------------------------------------------ */

export const font = {
  micro: 11,
  caption: 12,
  footnote: 14,
  body: 16,
  subtitle: 18,
  title: 20,
  display: 24,
  displayLg: 32,
  hero: 40,
} as const;

/**
 * Two weights only. `heavy` for anything that reads as a heading, number or
 * call to action; `semibold` for supporting copy and labels. This replaces the
 * previous mix of '500' / '600' / '700' / '800' / '900' / 'bold'.
 */
export const weight = {
  semibold: '600',
  heavy: '800',
} as const;

/** Ready-made text styles so screens stop re-declaring the same combinations. */
export const text = {
  /** Screen or hero numbers. */
  hero: { fontSize: font.hero, fontWeight: weight.heavy, letterSpacing: -1 },
  display: { fontSize: font.display, fontWeight: weight.heavy, letterSpacing: -0.5 },
  /** Card and section titles. */
  title: { fontSize: font.title, fontWeight: weight.heavy },
  subtitle: { fontSize: font.subtitle, fontWeight: weight.heavy },
  /** Body copy. */
  body: { fontSize: font.body, fontWeight: weight.semibold },
  footnote: { fontSize: font.footnote, fontWeight: weight.semibold },
  caption: { fontSize: font.caption, fontWeight: weight.semibold },
  /** Uppercase eyebrow labels. */
  label: {
    fontSize: font.caption,
    fontWeight: weight.heavy,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  micro: { fontSize: font.micro, fontWeight: weight.semibold },
} as const;

/* ------------------------------------------------------------------ *
 * Accent colors
 *
 * Identical in light and dark. Collapses the previous 8 golds, 6 greens,
 * 9 blues and 4 reds into one semantic set.
 * ------------------------------------------------------------------ */

export const GOLD = '#D4AF37';
/** Darker gold, for the second stop of a gold gradient only. */
export const GOLD_DEEP = '#B8860B';

export const SUCCESS = '#34D399';
/** Darker success, for the second stop of a success gradient only. */
export const SUCCESS_DEEP = '#059669';

export const WARNING = '#F59E0B';

export const DANGER = '#EF4444';
/** Softer red, used for destructive text on dark surfaces. */
export const DANGER_SOFT = '#F87171';

export const INFO = '#2563EB';
/** Lighter blue, for icons and secondary marks on dark surfaces. */
export const INFO_SOFT = '#60A5FA';

/** Neutral navy used by gradients and non-themed dark surfaces. */
export const NAVY = '#0F172A';
export const NAVY_SOFT = '#1E293B';

/**
 * Carrier brand colors. These are the only places a non-semantic brand color is
 * allowed, because the badge has to be recognisable as MTN or Orange.
 */
export const CARRIER_MTN = '#FFCC00';
export const CARRIER_ORANGE = '#FF6600';

/* ------------------------------------------------------------------ *
 * Alpha
 *
 * A fixed opacity ladder. Previously gold tints alone used ten different
 * alpha values and white fills used six.
 * ------------------------------------------------------------------ */

export const ALPHA = {
  /** Barely-there fill for a resting surface. */
  faint: 0.06,
  /** Default fill for glass cards and icon buttons. */
  soft: 0.1,
  /** Active or selected fill. */
  medium: 0.16,
  /** Border on a tinted surface. */
  strong: 0.35,
  /** Scrim behind a modal. */
  scrim: 0.65,
} as const;

/** Convert a 6-digit hex to rgba at one of the ALPHA steps. */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Tinted fill + border pair for a status surface (pill, callout, badge). */
export function tint(hex: string) {
  return {
    backgroundColor: withAlpha(hex, ALPHA.medium),
    borderColor: withAlpha(hex, ALPHA.strong),
    borderWidth: 1,
  };
}

export const GOLD_TINT = withAlpha(GOLD, ALPHA.medium);
export const GOLD_BORDER = withAlpha(GOLD, ALPHA.strong);
export const SUCCESS_TINT = withAlpha(SUCCESS, ALPHA.medium);
export const SUCCESS_BORDER = withAlpha(SUCCESS, ALPHA.strong);
export const DANGER_TINT = withAlpha(DANGER, ALPHA.medium);
export const DANGER_BORDER = withAlpha(DANGER, ALPHA.strong);
export const WARNING_TINT = withAlpha(WARNING, ALPHA.medium);
export const WARNING_BORDER = withAlpha(WARNING, ALPHA.strong);
export const INFO_TINT = withAlpha(INFO, ALPHA.medium);
export const INFO_BORDER = withAlpha(INFO, ALPHA.strong);

/* ------------------------------------------------------------------ *
 * Elevation
 *
 * Three presets, replacing roughly fifteen ad-hoc shadow combinations.
 * ------------------------------------------------------------------ */

export const shadow = {
  /** Resting card. */
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  /** Lifted surface: tab bar, FAB, bottom sheet, action bar. */
  floating: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 14,
  },
} as const;

/** Colored glow for a primary call to action. */
export function glow(color: string) {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  };
}

/* ------------------------------------------------------------------ *
 * Icons
 * ------------------------------------------------------------------ */

export const icon = {
  /** Inline with caption text. */
  xs: 14,
  /** Inline with body text, list row leading icons. */
  sm: 18,
  /** Header buttons, tab bar, standard actions. */
  md: 22,
  /** Empty-state and feature icons. */
  lg: 32,
} as const;

/** Diameter of a circular icon button (header, toolbar, overlay). */
export const ICON_BUTTON_SIZE = 44;

/* ------------------------------------------------------------------ *
 * Motion
 * ------------------------------------------------------------------ */

export const duration = {
  fast: 150,
  base: 250,
  slow: 400,
} as const;
