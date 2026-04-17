const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const { EnvironmentPlugin } = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: ['./src/index.tsx'],
  output: {
    path: path.join(__dirname, '/dist'),
    filename: 'bundle-[contenthash].min.js',
    publicPath: '/',
    clean: true,
  },

  devtool: 'source-map',
  devServer: {
    port: 8081,
    historyApiFallback: true,
    static: [
      {
        directory: path.join(__dirname, 'data'),
        publicPath: '/data',
      },
    ],
  },

  resolve: {
    extensions: ['.ts', '.tsx', '...'],
  },

  module: {
    rules: [
      {
        test: /\.ts(x?)$/,
        include: [path.join(__dirname, './src/')],
        use: ['babel-loader'],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        enforce: 'pre',
        test: /\.js$/,
        loader: 'source-map-loader',
      },
    ],
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin({
      typescript: {
        diagnosticOptions: {
          semantic: true,
          syntactic: true,
        },
        mode: 'readonly',
      },
    }),
    new EnvironmentPlugin({
      NODE_ENV: 'development',
    }),
    new HtmlWebpackPlugin({
      template: './index.html',
    }),
    new CopyPlugin({
      patterns: [{ from: 'data', to: 'data' }],
    }),
  ],
};
