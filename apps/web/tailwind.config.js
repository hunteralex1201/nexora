/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'navy-dark': '#0f1419',
        'navy-base': '#1a1f2e',
        'violet-accent': '#8b5cf6',
        'blue-accent': '#3b82f6',
        'cyan-accent': '#06b6d4',
        'green-accent': '#10b981',
      },
    },
  },
  plugins: [],
};
