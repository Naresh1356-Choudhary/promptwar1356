/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Material You Palette
        primary: {
          DEFAULT: "#76D1FF",
          container: "#004D6B",
        },
        "on-primary": {
          DEFAULT: "#00354B",
          container: "#C3E8FF",
        },
        surface: {
          DEFAULT: "#111417",
          container: "#191D21",
          high: "#24292E",
          highest: "#2E353B",
        },
        "on-surface": {
          DEFAULT: "#E1E2E6",
          variant: "#A6ADB5",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
