/**
 * Legacy token names, kept so existing imports keep working.
 * All values now originate in `constants/design.ts` — add new tokens there.
 */
import { GOLD, INFO, NAVY } from './design';

export {
  FLOATING_TAB_BAR_HEIGHT,
  SCROLL_BOTTOM_INSET,
  HEADER_OFFSET,
  HEADER_BLOCK_HEIGHT,
  SCREEN_H_PADDING,
} from './design';

/** Dark-mode canvas. Prefer `usePremiumColors().bg` so light mode works. */
export const PREMIUM_BG = '#0A0F1A';
/** Dark-mode raised surface. Prefer `usePremiumColors().surface`. */
export const PREMIUM_SURFACE = '#111827';

export const PREMIUM_GOLD = GOLD;
export const PREMIUM_BLUE = INFO;
export const PREMIUM_NAVY = NAVY;

/** Prefer `usePremiumColors().muted`. */
export const PREMIUM_MUTED = '#64748B';
/** Dark-mode text tokens. Prefer `usePremiumColors().textPrimary/textSecondary`. */
export const TEXT_PRIMARY = '#F8FAFC';
export const TEXT_SECONDARY = '#94A3B8';
