import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#6339b2', dark: '#45248f', soft: '#f3ebfa', light: '#bb76bd' },
        ink: '#0f172a',
        canvas: '#fbf9fd',
        line: '#eae3f4',
      },
      boxShadow: {
        card: '0 12px 38px rgba(35, 18, 70, 0.05)',
        lift: '0 18px 42px rgba(99, 57, 178, 0.16)',
      },
      borderRadius: { '2.5xl': '1.25rem' },
    },
  },
  plugins: [],
};
export default config;
