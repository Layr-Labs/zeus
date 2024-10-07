const path = require('path');
const webpack = require("webpack");

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
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    extensionAlias: {
      '.js': ['.js', '.ts'],
    },
  },
  mode: 'production',
  output: {
    filename: 'bundle.cjs',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: "#!/usr/bin/env node",
      raw: true,
    }),
  ],
};