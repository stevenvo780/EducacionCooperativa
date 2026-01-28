import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Mandy-inspired dark palette
        mandy: {
          50: '#fef2f4',
          100: '#fde6ea',
          200: '#fad1da',
          300: '#f6abbb',
          400: '#f07a93',
          500: '#e94560', // Primary accent
          600: '#d5254a',
          700: '#b31a3c',
          800: '#961938',
          900: '#801935',
        },
        surface: {
          DEFAULT: '#12121a',
          50: '#f5f5f8',
          100: '#e8e8ef',
          200: '#c8c8d8',
          300: '#a0a0b8',
          400: '#6e6e8a',
          500: '#4a4a62',
          600: '#2a2a3e',
          700: '#1e1e2e',
          800: '#16161f',
          900: '#0a0a0f',
          950: '#050508',
        },
        accent: {
          purple: '#533483',
          'purple-light': '#7b5ea7',
          indigo: '#16213e',
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "gradient-mandy": "linear-gradient(135deg, #e94560 0%, #533483 100%)",
        "gradient-dark": "linear-gradient(180deg, #0a0a0f 0%, #12121a 50%, #0a0a0f 100%)",
        "gradient-surface": "linear-gradient(180deg, #16161f 0%, #12121a 100%)",
        "gradient-glow": "radial-gradient(ellipse at center, rgba(233,69,96,0.15) 0%, transparent 70%)",
      },
    },
  },
  plugins: [],
};
export default config;
