import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary
        'aubergine': {
          DEFAULT: '#280f49',
          light: '#3d1a6e',
          dark: '#1a0930',
        },
        'terracota': {
          DEFAULT: '#d85623',
          light: '#e6784d',
          dark: '#b5461b',
        },
        // Secondary (Womenkind)
        'violet': {
          DEFAULT: '#944fed',
          light: '#b07bf3',
          dark: '#7a35d9',
        },
        // Secondary (Menkind - available but not primary)
        'sky': {
          DEFAULT: '#5d9ed5',
          light: '#82b5e0',
          dark: '#4585bc',
        },
        // Tertiary / Neutrals
        'natural': {
          DEFAULT: '#ffd4b0',
          light: '#ffe8d6',
          dark: '#f0b888',
        },
        'airborne': '#d9eaf9',
        'human': '#f2f2f2',
        'beige': {
          DEFAULT: '#422a1f',
          light: '#5c3d2e',
          dark: '#2e1d15',
        },
        'mint': '#c2e7d9',
        'cream': '#f7f3ee',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        serif: ['Vogun', 'Playfair Display', 'Georgia', 'serif'],
      },
      borderRadius: {
        'brand': '8px',
        'pill': '9999px',
        'card': '20px',
      },
      backdropBlur: {
        'nav': '20px',
      },
    },
  },
  plugins: [],
}
export default config
