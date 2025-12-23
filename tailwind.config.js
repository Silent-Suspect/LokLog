/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: '#121212',
        card: '#1e1e1e',
        accent: {
          blue: '#3498db',
          orange: '#f39c12',
          green: '#2ecc71',
          purple: '#646cff'
        }
      }
    },
  },
  plugins: [],
}
