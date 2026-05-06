/** @type {import('tailwindcss').Config} */
const oklch = (token) => `oklch(var(--${token}) / <alpha-value>)`;

module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      // Semantic colors backed by OKLCH variables. Keeping shadcn names so
      // existing components keep working, but routing them to the new tokens.
      colors: {
        // Raw palette (preferred for new code)
        bg:           oklch("bg"),
        surface:      oklch("surface"),
        "surface-2":  oklch("surface-2"),
        "surface-sunk": oklch("surface-sunk"),
        ink:          oklch("ink"),
        "ink-soft":   oklch("ink-soft"),
        "ink-faint":  oklch("ink-faint"),
        "ink-mute":   oklch("ink-mute"),
        rule:         oklch("rule"),
        "rule-strong": oklch("rule-strong"),
        accent: {
          DEFAULT: oklch("accent"),
          hi:      oklch("accent-hi"),
          deep:    oklch("accent-deep"),
          ink:     oklch("accent-ink"),
          soft:    oklch("accent-soft"),
          glow:    oklch("accent-glow"),
          foreground: oklch("accent-ink"),
        },
        good:   { DEFAULT: oklch("good"), soft: oklch("good-soft") },
        warn:   { DEFAULT: oklch("warn"), soft: oklch("warn-soft") },
        bad:    { DEFAULT: oklch("bad"),  soft: oklch("bad-soft")  },

        // shadcn-compatible aliases (point at the new palette)
        border:     oklch("rule"),
        input:      oklch("rule-strong"),
        ring:       oklch("accent"),
        background: oklch("bg"),
        foreground: oklch("ink"),
        primary:    { DEFAULT: oklch("accent"), foreground: oklch("accent-ink") },
        secondary:  { DEFAULT: oklch("surface-2"), foreground: oklch("ink") },
        destructive:{ DEFAULT: oklch("bad"), foreground: oklch("bg") },
        muted:      { DEFAULT: oklch("surface-2"), foreground: oklch("ink-soft") },
        popover:    { DEFAULT: oklch("surface"), foreground: oklch("ink") },
        card:       { DEFAULT: oklch("surface"), foreground: oklch("ink") },
      },

      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "Times New Roman", "serif"],
        sans:    ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono:    ["var(--font-mono)", "ui-monospace", "JetBrains Mono", "Menlo", "monospace"],
      },

      // Generous, deliberate type scale. >=1.25 ratio between display steps.
      fontSize: {
        "2xs":   ["0.6875rem", { lineHeight: "1.45", letterSpacing: "0.01em" }],
        xs:      ["0.75rem",  { lineHeight: "1.5" }],
        sm:      ["0.875rem", { lineHeight: "1.55" }],
        base:    ["1rem",     { lineHeight: "1.6" }],
        lg:      ["1.125rem", { lineHeight: "1.55" }],
        xl:      ["1.375rem", { lineHeight: "1.4", letterSpacing: "-0.012em" }],
        "2xl":   ["1.75rem",  { lineHeight: "1.25", letterSpacing: "-0.018em" }],
        "3xl":   ["2.25rem",  { lineHeight: "1.15", letterSpacing: "-0.022em" }],
        "4xl":   ["3rem",     { lineHeight: "1.05", letterSpacing: "-0.026em" }],
        "5xl":   ["4rem",     { lineHeight: "1.0",  letterSpacing: "-0.03em" }],
        "6xl":   ["5.25rem",  { lineHeight: "0.95", letterSpacing: "-0.034em" }],
        display: ["6.5rem",   { lineHeight: "0.94", letterSpacing: "-0.04em" }],
      },

      borderRadius: {
        DEFAULT: "var(--radius)",
        sm:  "var(--radius-sm)",
        md:  "calc(var(--radius) - 2px)",
        lg:  "var(--radius)",
        xl:  "var(--radius-lg)",
      },

      boxShadow: {
        // Softer, warmer shadows than Tailwind defaults
        sheet:  "0 1px 0 oklch(var(--rule)), 0 6px 24px -12px oklch(var(--ink) / 0.10)",
        lift:   "0 1px 0 oklch(var(--rule)), 0 12px 36px -16px oklch(var(--ink) / 0.18)",
        focus:  "0 0 0 3px oklch(var(--accent) / 0.18)",
      },

      transitionTimingFunction: {
        "out-expo":  "cubic-bezier(0.16, 1, 0.3, 1)",
        "out-quart": "cubic-bezier(0.25, 1, 0.5, 1)",
      },

      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up":   { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "fade-in-up":     { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "rule-in":        { from: { transform: "scaleX(0)" }, to: { transform: "scaleX(1)" } },
      },
      animation: {
        "accordion-down": "accordion-down 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        "accordion-up":   "accordion-up 180ms cubic-bezier(0.25, 1, 0.5, 1)",
        "fade-in-up":     "fade-in-up 320ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "rule-in":        "rule-in 380ms cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};
