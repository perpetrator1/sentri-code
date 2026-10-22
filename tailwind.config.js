/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0', transform: 'scale(0.97)' }, to: { opacity: '1', transform: 'scale(1)' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
      },
    },
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      // ── warm light theme ──────────────────────────────────────
      {
        cozy: {
          "primary":         "#e07b39",  // warm amber-orange
          "primary-content": "#ffffff",
          "secondary":       "#8b5cf6",  // soft violet
          "secondary-content": "#ffffff",
          "accent":          "#10b981",  // friendly emerald
          "accent-content":  "#ffffff",
          "neutral":         "#44403c",  // warm stone
          "neutral-content": "#fafaf9",
          "base-100":        "#fffbf7",  // warm cream
          "base-200":        "#fef3e2",  // light apricot
          "base-300":        "#fde9c9",  // warm sand
          "base-content":    "#3d3020",  // warm brown-dark
          "info":            "#3b82f6",
          "info-content":    "#ffffff",
          "success":         "#22c55e",
          "success-content": "#ffffff",
          "warning":         "#f59e0b",
          "warning-content": "#1a1a1a",
          "error":           "#ef4444",
          "error-content":   "#ffffff",
        },
      },
      // ── warm dark theme ───────────────────────────────────────
      {
        ember: {
          "primary":         "#f59e0b",  // warm golden
          "primary-content": "#1c1208",
          "secondary":       "#a78bfa",  // soft lavender
          "secondary-content": "#1a0a2e",
          "accent":          "#34d399",  // mint green
          "accent-content":  "#022c22",
          "neutral":         "#292524",  // warm stone-dark
          "neutral-content": "#fef3c7",
          "base-100":        "#1c1917",  // warm stone-900
          "base-200":        "#292524",  // warm stone-800
          "base-300":        "#44403c",  // warm stone-700
          "base-content":    "#fef3c7",  // warm cream
          "info":            "#60a5fa",
          "info-content":    "#0a1628",
          "success":         "#4ade80",
          "success-content": "#052e16",
          "warning":         "#fbbf24",
          "warning-content": "#1c0a00",
          "error":           "#f87171",
          "error-content":   "#3b0000",
        },
      },
    ],
    darkTheme: "ember",
  },
}
