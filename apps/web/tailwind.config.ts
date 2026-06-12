import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "#d7dde5",
        panel: "#f7f9fb",
        ink: "#172033",
        muted: "#637083",
        accent: "#0f766e",
        warn: "#b45309",
        danger: "#b91c1c"
      }
    }
  },
  plugins: []
} satisfies Config;
