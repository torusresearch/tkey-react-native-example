const { getDefaultConfig } = require("@expo/metro-config");
const config = getDefaultConfig(__dirname);
config.resolver.sourceExts = [...config.resolver.sourceExts, "cjs"];
config.resolver.extraNodeModules = {
    stream: require.resolve('readable-stream'),
    http: require.resolve('@tradle/react-native-http'),
    https: require.resolve('https-browserify'),
    url: require.resolve('url')
};
module.exports = config;
