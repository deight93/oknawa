module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {
      // Preserve the previous iOS CSS coverage as browser usage data advances.
      overrideBrowserslist: ['defaults', 'iOS >= 16.6'],
    },
  },
};
