// @ts-check
const path = require('path');

/**
 * @param {import('webpack').Configuration} config
 * @returns {import('webpack').Configuration}
 */
module.exports = (config) => {
  return {
    ...config,
    resolve: {
      ...config.resolve,
      extensions: ['.ts', '.js', '.json'],
    },
    externals: [
      '@lancedb/lancedb',
      '@xenova/transformers',
      'uuid',
      'node-pty',
      'bufferutil',
      'utf-8-validate'
    ],
    module: {
      ...config.module,
      rules: [
        ...(config.module?.rules || []),
        {
          test: /\.node$/,
          loader: 'node-loader',
        }
      ]
    }
  };
}; 