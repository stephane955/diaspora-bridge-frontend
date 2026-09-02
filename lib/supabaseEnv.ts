import {
  PRODUCTION_SUPABASE_REF as PROD_REF,
  STAGING_SUPABASE_REF as STAGING_REF,
} from './supabaseEnv.constants.js';

/** Production project ref — must never be used as a dev fallback. */
export const PRODUCTION_SUPABASE_REF = PROD_REF;

/** Staging project ref — required target for local development. */
export const STAGING_SUPABASE_REF = STAGING_REF;

export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

function extractProjectRef(supabaseUrl: string): string | null {
  try {
    const host = new URL(supabaseUrl).hostname;
    const ref = host.split('.')[0];
    return ref || null;
  } catch {
    return null;
  }
}

/**
 * Resolve public Supabase client config from EXPO_PUBLIC_* only.
 * Fail closed: no hardcoded URLs, no production fallback.
 */
export function resolveSupabasePublicConfig(): SupabasePublicConfig {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Copy .env.example to .env and set staging credentials for development.',
    );
  }

  const ref = extractProjectRef(url);

  if (__DEV__ && ref === PRODUCTION_SUPABASE_REF) {
    throw new Error(
      `Development builds must not connect to production Supabase (${PRODUCTION_SUPABASE_REF}). ` +
        `Set EXPO_PUBLIC_SUPABASE_URL to staging (${STAGING_SUPABASE_REF}).`,
    );
  }

  if (process.env.EAS_BUILD_PROFILE === 'production') {
    if (ref !== PRODUCTION_SUPABASE_REF) {
      throw new Error(
        `Production EAS build must target production Supabase (${PRODUCTION_SUPABASE_REF}). ` +
          'Do not point production builds at staging.',
      );
    }
  }

  return { url, anonKey };
}
