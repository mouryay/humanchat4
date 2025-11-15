import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        midnight: '#040615',
        indigoGlow: '#5B67F2',
        aqua: '#5EF0FF',
        peach: '#FBC5AC'
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif']
      },
      backgroundImage: {
        'radial-fade': 'radial-gradient(circle at top, rgba(91, 103, 242, 0.25), rgba(4, 6, 21, 0.9))'
      }
    }
  },
  plugins: []
};

export default config;
