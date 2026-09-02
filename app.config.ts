import type { ConfigContext, ExpoConfig } from 'expo/config';
import appJson from './app.json';
import { PRODUCTION_SUPABASE_REF } from './lib/supabaseEnv.constants.js';

export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (profile === 'production') {
    if (!url || !anonKey) {
      throw new Error(
        'Production EAS build requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
      );
    }
    if (!url.includes(PRODUCTION_SUPABASE_REF)) {
      throw new Error(
        `Production EAS build must use production Supabase ref ${PRODUCTION_SUPABASE_REF}.`,
      );
    }
  }

  return {
    ...config,
    ...appJson.expo,
  } as ExpoConfig;
};
