/** @type {import('postcss-load-config').Config} */
module.exports = {
  plugins: {
    // Tailwind CSS processor
    tailwindcss: {},

    // Autoprefixer for cross-browser support
    // Targets derived from browserslist in package.json or defaults
    autoprefixer: {},
  },
};
