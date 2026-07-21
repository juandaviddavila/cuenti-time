import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        paper: "#fafaf8",
        sun: "#f9c626",
        moss: "#14532d",
      },
      boxShadow: {
        soft: "0 24px 70px -30px rgba(15, 23, 42, 0.32)",
      },
    },
  },
  plugins: [],
};

export default config;
