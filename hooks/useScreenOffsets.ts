import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HEADER_OFFSET,
  SCREEN_H_PADDING,
  SCROLL_BOTTOM_INSET,
  SCROLL_BOTTOM_INSET_PLAIN,
} from '@/constants/design';

type Options = {
  /**
   * Whether the screen sits inside a tab navigator and must clear the floating
   * glass tab bar. Every route under `app/diaspora/` and `app/provider/` does,
   * including pushed screens, because the tab bar stays visible.
   * Screens outside those groups (chat, workroom, auth, admin, supplier) do not.
   */
  tabBar?: boolean;
  /** Set false on screens with no PremiumHeader (camera overlays, auth). */
  header?: boolean;
};

export type ScreenOffsets = {
  /** Top padding that clears the absolute PremiumHeader. */
  top: number;
  /** Bottom padding that clears the tab bar or the home indicator. */
  bottom: number;
  /** The single horizontal page gutter. */
  horizontal: number;
  /** Ready-made `contentContainerStyle` for a ScrollView / FlatList / FlashList. */
  content: {
    paddingTop: number;
    paddingBottom: number;
    paddingHorizontal: number;
  };
  /** Same as `content` but without the horizontal gutter, for edge-to-edge rows. */
  contentFlush: { paddingTop: number; paddingBottom: number };
};

/**
 * The one place screen padding is calculated.
 *
 * Replaces the previous mix of `insets.top + 72`, `+ 88`, `+ 96`, hardcoded
 * `paddingTop: 60`, and horizontal gutters of 16 / 20 / 24.
 */
export function useScreenOffsets({ tabBar = true, header = true }: Options = {}): ScreenOffsets {
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    const top = header ? insets.top + HEADER_OFFSET : insets.top;
    const bottom = tabBar
      ? SCROLL_BOTTOM_INSET
      : insets.bottom + SCROLL_BOTTOM_INSET_PLAIN;

    return {
      top,
      bottom,
      horizontal: SCREEN_H_PADDING,
      content: {
        paddingTop: top,
        paddingBottom: bottom,
        paddingHorizontal: SCREEN_H_PADDING,
      },
      contentFlush: { paddingTop: top, paddingBottom: bottom },
    };
  }, [insets.top, insets.bottom, tabBar, header]);
}
