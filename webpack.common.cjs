const webpack = require("webpack");
const webpackNodeExternals = require("webpack-node-externals");

module.exports = {
  target: 'node',
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  externals: {
    'usb': 'commonjs usb', 
    'node-hid': 'node-hid',
    '@ledgerhq/hw-transport-node-hid': 'commonjs @ledgerhq/hw-transport-node-hid',
    'bufferutil': 'bufferutil',
    'utf-8-validate': 'utf-8-validate',
    ...webpackNodeExternals(),
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    extensionAlias: {
      '.js': ['.js', '.ts'],
    },
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: "#!/usr/bin/env -S node --no-deprecation",
      raw: true,
    }),
  ],
};