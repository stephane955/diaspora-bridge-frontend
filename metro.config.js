const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix: @tamagui/constants CJS index.native.js requires "./constants.native.js" which may be missing.
// Resolve to constants.js in the same directory so Metro can find it.
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const origin = (context.originModulePath || '').replace(/\\/g, '/');
  if (
    origin.includes('@tamagui/constants') &&
    (moduleName === './constants.native.js' || moduleName === 'constants.native.js')
  ) {
    const dir = path.dirname(context.originModulePath);
    return { type: 'sourceFile', filePath: path.resolve(dir, 'constants.native.js') };
  }
  return defaultResolve
    ? defaultResolve(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
