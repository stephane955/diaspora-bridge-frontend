/**
 * Deterministic helpers for Expo Router `useLocalSearchParams` values
 * (`string | string[] | undefined`).
 */

export function firstRouteParam(
  value: string | string[] | undefined | null,
): string | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) {
    const first = value.find((v) => typeof v === 'string' && v.length > 0);
    return first;
  }
  return value.length > 0 ? value : undefined;
}

/** Required route id — returns undefined when missing/invalid (caller must fail closed). */
export function requiredRouteParam(
  value: string | string[] | undefined | null,
): string | undefined {
  return firstRouteParam(value);
}

export function optionalRouteParam(
  value: string | string[] | undefined | null,
): string | undefined {
  return firstRouteParam(value);
}
