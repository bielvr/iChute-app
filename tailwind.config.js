/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ichute-green': '#1a8245', // Verde do seu design
        'ichute-yellow': '#ffcc00', // Amarelo do seu design
      },
    },
  },
  plugins: [],
}