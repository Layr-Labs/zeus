const webpack = require("webpack");
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  target: 'node',
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true, // Faster builds
          }
        },
        exclude: [/node_modules/, /site\//],
      },
    ],
  },
  node: {
    __dirname: false
  },
  // Only externalize native modules and modules with native dependencies
  externals: {
    // Native modules that can't be bundled
    'usb': 'commonjs usb', 
    'node-hid': 'commonjs node-hid',
    '@ledgerhq/hw-transport-node-hid': 'commonjs @ledgerhq/hw-transport-node-hid',
    '@ethers-ext/signer-ledger': 'commonjs @ethers-ext/signer-ledger',
    '@ledgerhq/errors': 'commonjs @ledgerhq/errors',
    '@ledgerhq/hw-app-eth': 'commonjs @ledgerhq/hw-app-eth',
    'bufferutil': 'commonjs bufferutil',
    'utf-8-validate': 'commonjs utf-8-validate',
    // Foundry anvil (native binaries)
    '@foundry-rs/hardhat-anvil': 'commonjs @foundry-rs/hardhat-anvil',
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
    new CopyPlugin({
      patterns: [
        { 
          from: path.resolve(__dirname, "site/dist"), 
          to: "site-dist" 
        },
      ],
    }),
  ],
};