/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Eski CSS'den çıkarılan renkler (css/style.css :root değişkenleri)
        'ana-renk': '#2E3237',
        'ikincil-renk': '#282C5B',
        'mavi-renk': '#004cff', 
        'mor-primary': '#6D28D9',
        'primary-pink': 'rgba(246, 71, 152, 1)',
        'accent-pink': '#C22C71',
        'highlight-button-pink': '#eb5e91',
        'white': '#ffffff',
        'full-black': '#000000',
        'border-renk': '#f1f3f7',
        'placeholder': '#9e9e9e',
        'light-gray': '#e0e0e0',
        'ultralight-gray': '#f1f1f1',
        'mid-gray': '#d8d8d8',
        'dark-gray': '#384047',
        'gray-border': '#d8d8d8',
        'input-border-gray': '#e5e5e5',
        'border-color': '#c8c8c8',
        'subtle-gray': '#A7A7A7',
        'gray-soft-dark': '#8A8B8B',
        'gray-subtle-dark': '#959595',
        'gray-ultra-light': '#dbdbdb',
        'pink-soft-bg': '#FAE3ED',
        'success-green': '#33BE5C',
        'danger-pink': '#ff004c',
        'action-blue': '#004aca',
        'light-bg': '#e4e6e9',
        'extra-light-gray': '#f3fbff',
        'extra-light-bg': '#f9f9f9',
        'form-dark-bg': '#f5f5f5',
        'soft-blue-bg': '#ccecf1',
        'lavender-bg': '#F6F3FA',
        'panel-bg-light': '#F2F5FC',
        'box-bg-light': '#F2F5FC',
        'text-gray-muted': '#929598',
        'accent-green-bold': '#00bc45',
        'accent-red': '#ff0000',
        'blue-dark': '#060F8D',
        // Tailwind primary renkleri (eski sistemle uyumlu)
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
      fontFamily: {
        // Google Fonts Inter - Varsayılan font
        'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', 'sans-serif'],
        // Eski CSS'den font aileleri (gerekirse kullanılabilir)
        'euclid': ['Euclid Circular B', 'sans-serif'],
        'courgette': ['Courgette-Regular', 'cursive'],
      },
      spacing: {
        // Eski CSS'den çıkarılan spacing değerleri (gerekirse eklenebilir)
      },
      borderRadius: {
        // Eski CSS'den çıkarılan radius değerleri
        'custom': '0.5rem',
        'card': '8px',
        'modal': '12px',
      },
      boxShadow: {
        // Eski CSS'den çıkarılan shadow değerleri
        'custom': '0 2px 4px rgba(0,0,0,0.1)',
        'card': '0 1px 3px rgba(0,0,0,0.1)',
        'modal': '0 24px 60px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
}

