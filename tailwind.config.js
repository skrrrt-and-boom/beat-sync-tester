/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'theme-black': '#0a0a0a',
        'theme-dark': '#1a1a1a',
        'theme-mid': '#2a2a2a',
        'theme-text': '#ffffff',
        'theme-white': '#ffffff',
      },
      fontFamily: {
        'raleway': ['Raleway', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
