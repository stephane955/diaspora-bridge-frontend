module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        '@tamagui/babel-plugin',
        {
          components: ['tamagui'],
          config: './tamagui.config.ts',
          logSourceRange: false,
        },
      ],
      'react-native-reanimated/plugin', // must be last per Tamagui/Reanimated docs
    ],
  };
};