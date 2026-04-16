/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic design tokens. Components should reference these instead of
        // raw slate-*/sky-* so we can retheme in one place.
        bg: "#0b1020",
        panel: "#0f172a",
        elevated: "#131b2e",
        border: "#1f2a44",
        borderSoft: "#1a243b",
        ink: "#e6ecf5",
        muted: "#94a3b8",
        faint: "#64748b",
        accent: "#38bdf8",
        accentMuted: "#0ea5e9",
        success: "#34d399",
        warn: "#fbbf24",
        danger: "#f87171",
        violet: "#c084fc",
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        glow: "0 0 0 1px rgb(56 189 248 / 0.35), 0 0 20px -4px rgb(56 189 248 / 0.35)",
        soft: "0 1px 0 0 rgb(255 255 255 / 0.03) inset, 0 1px 2px 0 rgb(0 0 0 / 0.4)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        shimmer: "shimmer 2.2s linear infinite",
        pulseDot: "pulseDot 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
