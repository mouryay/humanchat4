import type { Config } from 'tailwindcss';

// Premium design system inspired by Linear, Vercel, Stripe
const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Premium dark theme palette
        background: {
          primary: '#0A0A0A',      // Deep black (Linear style)
          secondary: '#111111',    // Slightly lighter
          tertiary: '#1A1A1A',     // Card backgrounds
          elevated: '#1F1F1F',      // Elevated cards
          hover: '#1F1F1F',        // Hover states
        },
        text: {
          primary: '#FFFFFF',      // Pure white
          secondary: '#A1A1AA',    // Subtle gray (zinc-400)
          tertiary: '#71717A',     // Muted (zinc-500)
          muted: '#52525B',        // Very muted (zinc-600)
        },
        accent: {
          primary: '#3B82F6',      // Blue-500 (Vercel blue)
          hover: '#2563EB',        // Blue-600
          light: '#60A5FA',        // Blue-400
          glow: 'rgba(59, 130, 246, 0.3)',
        },
        border: {
          subtle: 'rgba(255, 255, 255, 0.05)',
          medium: 'rgba(255, 255, 255, 0.1)',
          strong: 'rgba(255, 255, 255, 0.15)',
          glow: 'rgba(59, 130, 246, 0.3)',
        },
        // Keep existing for backward compatibility
        midnight: '#0A0A0A',
        indigoGlow: '#3B82F6',
        aqua: '#5EF0FF',
        peach: '#FBC5AC'
      },
      fontFamily: {
        // Geist/Inter system stack
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Inter"',
          'system-ui',
          'sans-serif',
        ],
        display: ['"Inter"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['11px', { lineHeight: '16px', letterSpacing: '0.01em' }],
        sm: ['13px', { lineHeight: '18px', letterSpacing: '0.01em' }],
        base: ['15px', { lineHeight: '22px', letterSpacing: '0' }],
        lg: ['17px', { lineHeight: '24px', letterSpacing: '-0.01em' }],
        xl: ['20px', { lineHeight: '28px', letterSpacing: '-0.01em' }],
        '2xl': ['24px', { lineHeight: '32px', letterSpacing: '-0.02em' }],
        '3xl': ['30px', { lineHeight: '38px', letterSpacing: '-0.02em' }],
        '4xl': ['36px', { lineHeight: '44px', letterSpacing: '-0.02em' }],
      },
      boxShadow: {
        // Premium shadow system
        sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
        base: '0 4px 6px rgba(0, 0, 0, 0.4)',
        md: '0 10px 15px rgba(0, 0, 0, 0.5)',
        lg: '0 20px 25px rgba(0, 0, 0, 0.6)',
        xl: '0 25px 50px rgba(0, 0, 0, 0.7)',
        '2xl': '0 30px 60px rgba(0, 0, 0, 0.8)',
        // Glow effects
        glow: '0 0 20px rgba(59, 130, 246, 0.2)',
        'glow-lg': '0 0 40px rgba(59, 130, 246, 0.3)',
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.2), 0 0 40px rgba(59, 130, 246, 0.1)',
        // Colored shadows
        'blue-sm': '0 2px 8px rgba(59, 130, 246, 0.15)',
        'blue-md': '0 4px 16px rgba(59, 130, 246, 0.2)',
        'blue-lg': '0 8px 32px rgba(59, 130, 246, 0.25)',
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
        '3xl': '40px',
      },
      borderRadius: {
        sm: '6px',
        base: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
      },
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
      },
      transitionTimingFunction: {
        'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
        'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      backgroundImage: {
        'radial-fade': 'radial-gradient(circle at top, rgba(91, 103, 242, 0.25), rgba(4, 6, 21, 0.9))',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'glass': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
      },
    }
  },
  plugins: []
};

export default config;
