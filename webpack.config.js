// webpack.config.js
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = (_env, argv) => {
  const isProd = argv.mode === "production";

  return {
    mode: isProd ? "production" : "development",
    entry: {
      background: "./src/background/background.js",
      popup: "./src/popup/main.js",
      index: "./src/index.js", // -> js/injex.js
      content: "./src/content/content.js",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: (pathData) =>
        pathData.chunk.name === "index" ? "js/injex.js" : "js/[name].bundle.js",
      clean: true,
    },
    devtool: false,
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              // keep ESM for tree shaking
              presets: [
                [
                  "@babel/preset-env",
                  { modules: false, targets: { esmodules: true } },
                ],
              ],
              // strip consoles in prod
              plugins: [
                isProd && [
                  "transform-remove-console",
                  { exclude: ["warn", "error"] },
                ],
              ].filter(Boolean),
              babelrc: false,
              configFile: false,
            },
          },
        },
      ],
    },
    optimization: {
      usedExports: true,
      sideEffects: true,
      concatenateModules: true,
      splitChunks: false,
      runtimeChunk: false,

      // let Terser do DCE but keep output readable and unmangled
      minimize: isProd,
      minimizer: isProd
        ? [
            new TerserPlugin({
              extractComments: false,
              terserOptions: {
                mangle: true, // no obfuscation
                format: {
                  beautify: false, // pretty output
                  comments: false,
                },
                compress: {
                  dead_code: true, // remove unused code
                  unused: true,
                  passes: 2,
                  drop_console: true, // belt + suspenders
                  // ensure pure calls (helps DCE on IIFEs)
                  pure_funcs: ["console.log", "console.debug"],
                },
              },
            }),
          ]
        : [],
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: "manifest.json", to: "manifest.json" },
          { from: "src/popup/popup.html", to: "popup/popup.html" },
          { from: "src/popup/popup.css", to: "popup/popup.css" },
          { from: "src/styles", to: "styles" },
          {
            from: "src/js/confetti.browser.min.js",
            to: "js/confetti.browser.min.js",
          },
          { from: "icons", to: "icons" },
        ],
      }),
    ],
    stats: "minimal",
    infrastructureLogging: { level: "warn" },
    performance: { hints: false },
  };
};
