import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Base width for design (e.g. iPhone 14). Scale from this. */
const BASE_WIDTH = 390;

/**
 * Scale a value by screen width. Use for margins, padding, font sizes, and icon sizes
 * so the UI fits from iPhone SE to large devices.
 */
export function scale(size: number): number {
    const ratio = SCREEN_WIDTH / BASE_WIDTH;
    const newSize = size * ratio;
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

/**
 * Scale with a cap so very large screens don't blow up the layout.
 */
export function scaleModerate(size: number, factor: number = 0.5): number {
    const ratio = SCREEN_WIDTH / BASE_WIDTH;
    const newSize = size + (ratio - 1) * size * factor;
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

export const s = scale;
export const sm = scaleModerate;
