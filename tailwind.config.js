/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/views/**/*.ejs"],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#0B1220",
          800: "#111B2E",
          700: "#16223A"
        }
      }
    }
  },
  plugins: []
};

