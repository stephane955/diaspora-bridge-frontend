// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Align with tsconfig: Deno edge functions use https://esm.sh URL imports
    // and are outside the Expo app lint/typecheck graph.
    ignores: ['dist/*', 'supabase/functions/**'],
  },
]);
