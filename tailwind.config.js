/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'deep-burgundy': '#581D35',
        'burgundy-dark': '#421427',
        'burgundy-light': '#7E2A4C',
        'emerald-green': '#10B981',
        'forest-green': '#059669',
        'deep-green': '#047857',
        'crimson-red': '#EF4444',
        'space-black': '#04060a',
        'panel': '#0a0d13',
        'panel-light': '#10141c',
        'blood-red': '#8B1A2B',
        'nasa-blue': '#38BDF8',
        'deep-blue': '#0EA5E9',
      },
      fontFamily: {
        sans: ['Aptos', 'Plus Jakarta Sans', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        heading: ['Aptos Display', 'Aptos', 'Space Grotesk', 'sans-serif'],
        mono: ['Aptos Mono', 'JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
