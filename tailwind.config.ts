import type { Config } from "tailwindcss";

const config: Config = {
  // Dark mode via class strategy for manual toggle
  darkMode: "class",

  content: [
    "./src/**/*.{ts,tsx}",
    "./src/content/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/popup/**/*.{ts,tsx}",
  ],

  // Prefix all classes to avoid collisions with host page styles
  // Disabled — Shadow DOM provides sufficient isolation
  // prefix: "bt-",

  theme: {
    extend: {
      // bTab Sync design tokens — shadcn-inspired palette
      colors: {
        // Primary brand color
        teal: {
          DEFAULT: "#1dd9b4",
          50:  "#effefa",
          100: "#c7fff2",
          200: "#90ffe5",
          300: "#51f7d6",
          400: "#1dd9b4",
          500: "#05c9a5",
          600: "#00a388",
          700: "#05826f",
          800: "#0a675a",
          900: "#0d554b",
          950: "#003430",
          dark:   "rgba(29, 217, 180, 0.12)",
          border: "rgba(29, 217, 180, 0.28)",
          hover:  "rgba(29, 217, 180, 0.20)",
        },

        // Panel/surface colors (dark theme defaults)
        panel: {
          bg:    "rgba(8, 10, 22, 0.97)",
          surf:  "rgba(16, 20, 36, 0.98)",
          hover: "rgba(255, 255, 255, 0.05)",
          sel:   "rgba(29, 217, 180, 0.09)",
          bdr:   "rgba(255, 255, 255, 0.07)",
          bdr2:  "rgba(255, 255, 255, 0.12)",
        },

        // Light theme surfaces (applied via .light class)
        "panel-light": {
          bg:    "rgba(255, 255, 255, 0.98)",
          surf:  "rgba(248, 250, 252, 0.98)",
          hover: "rgba(0, 0, 0, 0.04)",
          sel:   "rgba(29, 217, 180, 0.12)",
          bdr:   "rgba(0, 0, 0, 0.08)",
          bdr2:  "rgba(0, 0, 0, 0.12)",
        },

        // Text colors
        ink: {
          DEFAULT: "#edf0ff",
          2: "#8b94b2",
          3: "#4e5578",
        },

        // Light theme text
        "ink-light": {
          DEFAULT: "#0f172a",
          2: "#475569",
          3: "#94a3b8",
        },

        // Status/semantic colors
        status: {
          red:    "#f7768e",
          green:  "#9ece6a",
          orange: "#ff9e64",
          blue:   "#7aa2f7",
          gold:   "#f9e2af",
          purple: "#bb9af7",
        },

        // shadcn-style CSS variable references
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },

      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },

      fontSize: {
        "2xs": ["9px",    { lineHeight: "1.3" }],
        "xs":  ["10.5px", { lineHeight: "1.4" }],
        "sm":  ["11.5px", { lineHeight: "1.5" }],
        "base":["12.5px", { lineHeight: "1.5" }],
        "lg":  ["14px",   { lineHeight: "1.4" }],
        "xl":  ["18px",   { lineHeight: "1.2" }],
        "2xl": ["24px",   { lineHeight: "1.2" }],
      },

      borderRadius: {
        panel:  "16px",
        card:   "9px",
        badge:  "20px",
        btn:    "7px",
        input:  "9px",
        // shadcn-style radius
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      spacing: {
        "panel-x": "14px",
        "panel-y": "12px",
      },

      width: {
        panel: "480px",
      },

      maxHeight: {
        list: "370px",
        panel: "calc(100vh - 4%)",
      },

      boxShadow: {
        panel: "0 24px 64px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.06) inset",
        "panel-light": "0 12px 40px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.07)",
        card: "0 2px 8px rgba(0,0,0,.08)",
        "card-hover": "0 4px 16px rgba(0,0,0,.12)",
      },

      keyframes: {
        "btab-in": {
          from: { opacity: "0", transform: "translateY(-10px) scale(0.97)" },
          to:   { opacity: "1", transform: "none" },
        },
        "btab-out": {
          from: { opacity: "1", transform: "none" },
          to:   { opacity: "0", transform: "translateY(-10px) scale(0.97)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%":      { opacity: "0.3", transform: "scale(0.6)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateX(-50%) translateY(4px)" },
          to:   { opacity: "1", transform: "translateX(-50%) translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(10px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
      },

      animation: {
        "btab-in":   "btab-in 0.2s cubic-bezier(0.22, 1, 0.36, 1) both",
        "btab-out":  "btab-out 0.15s cubic-bezier(0.22, 1, 0.36, 1) both",
        "pulse-dot": "pulse-dot 1.8s ease-in-out infinite",
        "fade-in":   "fade-in 0.2s ease",
        "slide-in":  "slide-in-right 0.2s ease",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
      },

      transitionTimingFunction: {
        spring: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },

  plugins: [],
};

export default config;
