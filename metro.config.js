const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow Metro to bundle .geojson files as assets
config.resolver.assetExts.push('geojson');

module.exports = config;