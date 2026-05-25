import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          light:   '#EFF6FF',
          border:  '#BFDBFE',
          hover:   '#1D4ED8',
          soft:    '#DBEAFE',
        },
        gray: {
          50:  '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        star: '#FBBF24',
      },
      boxShadow: {
        card:    '0 1px 4px 0 rgb(0 0 0 / .08)',
        'card-md': '0 2px 12px 0 rgb(0 0 0 / .10)',
        modal:   '0 20px 60px -10px rgb(0 0 0 / .20)',
      },
      borderRadius: {
        xl:  '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
