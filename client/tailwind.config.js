// ============================================
// Tailwind CSS Configuration
// ============================================
// Tailwind = a "utility-first" CSS framework.
// Instead of writing CSS in a separate file, you add classes directly:
//   <div class="bg-blue-500 text-white p-4 rounded">Hello</div>
//
// This creates: blue background, white text, padding, rounded corners.
// No need to name CSS classes or switch between files!

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // ^ Tell Tailwind WHERE to look for class names.
    // It scans these files and only generates CSS for classes you actually use.
    // This keeps the final CSS file tiny (only what's needed).
  ],
  theme: {
    extend: {
      // Custom colors for our medical theme
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',   // Main brand color (blue)
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Blue is commonly used in healthcare/medical apps
        // It conveys trust, professionalism, and calmness
      }
    },
  },
  plugins: [],
};
