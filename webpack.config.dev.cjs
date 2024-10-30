const path = require('path');
const { merge } = require('webpack-merge');
const common = require('./webpack.common.cjs');
const webpack = require("webpack");

module.exports = merge(common, {
    mode: 'development',
    devtool: 'inline-source-map',
    output: {
        filename: 'bundle.cjs',
        path: path.resolve(__dirname, 'dist'),
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env.ZEUS_BUILD': `"dev"`
        }),
    ]
});
