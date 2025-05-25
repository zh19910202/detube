import type { Config } from 'tailwindcss'

export default {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Web3 Dark Theme Palette
        background: '#0D0D1A', // Deep, dark blue/purple
        foreground: '#E0E0E0', // Light gray for text
        primary: '#1A1A2E', // Slightly lighter dark shade for cards/surfaces
        secondary: '#2A2A4D', // Even lighter dark shade for borders or secondary elements
        accent: '#00FFFF', // Cyan/Aqua for vibrant accents (buttons, links, highlights)
        'accent-hover': '#00E0E0', // Slightly darker cyan for hover states

        // Keeping existing CSS variable placeholders if they are used elsewhere,
        // but the direct palette above will be easier to use for new components.
        css_background: 'var(--background)',
        css_foreground: 'var(--foreground)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Modern, clean sans-serif
        mono: ['Roboto Mono', 'monospace'], // Monospace for a tech feel (optional)
      },
    },
  },
  plugins: [],
} satisfies Config
