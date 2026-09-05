import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        ink: {
          950: "#101418",
          900: "#1a2027",
          700: "#33404d",
          500: "#5b6b7c",
          400: "#8595a6",
        },
        paper: "#fafafa",
        accent: {
          700: "#1d4ed8",
          600: "#2563eb",
          500: "#3b82f6",
          100: "#dbeafe",
          50: "#eff6ff",
        },
      },
    },
  },
  plugins: [],
};

export default config;
