/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        gigante: {
          navy: "#0E1E42",
          navyDark: "#091530",
          navyLight: "#16295A",
          red: "#C41230",
          redDark: "#A00E27",
          bg: "#F4F5F7",
          card: "#FFFFFF",
          border: "#E3E6EC",
          muted: "#6B7280",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
