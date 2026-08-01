// ============================================
// PostCSS Configuration
// ============================================
// PostCSS = a tool that processes CSS with plugins.
// Tailwind CSS uses PostCSS to transform its directives (@tailwind)
// into actual CSS. Autoprefixer adds browser-specific prefixes
// (like -webkit-) so your styles work across all browsers.
//
// You rarely need to touch this file — it's just "enable Tailwind + Autoprefixer"

export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
