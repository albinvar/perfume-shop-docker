const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function(env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Fix entry point for Expo Router
  if (!config.entry || (Array.isArray(config.entry) && config.entry.length === 0)) {
    config.entry = [
      path.resolve(__dirname, 'node_modules/expo-router/entry.js')
    ];
  }

  return config;
};