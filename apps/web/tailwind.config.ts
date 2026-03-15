import type { Config } from 'tailwindcss';

// Premium design system inspired by Linear, Vercel, Stripe
const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: {
          primary: 'var(--background-primary)',
          secondary: 'var(--background-secondary)',
          tertiary: 'var(--background-tertiary)',
          elevated: 'var(--background-elevated)',
          hover: 'var(--background-hover)'
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          muted: 'var(--text-muted)'
        },
        accent: {
          primary: 'var(--accent-primary)',
          hover: 'var(--accent-hover)',
          light: 'var(--accent-light)',
          glow: 'var(--accent-glow)',
          muted: 'var(--accent-muted)'
        },
        border: {
          subtle: 'var(--border-subtle)',
          medium: 'var(--border-medium)',
          strong: 'var(--border-strong)',
          glow: 'var(--border-glow)'
        },
        status: {
          online: 'var(--status-online)',
          idle: 'var(--status-idle)',
          error: 'var(--status-error)'
        },
        // Keep existing aliases for compatibility
        midnight: 'var(--background-primary)',
        indigoGlow: 'var(--accent-primary)',
        aqua: 'var(--accent-light)',
        peach: 'var(--accent-muted)'
      },
      fontFamily: {
        sans: [
          'var(--font-body)',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'system-ui',
          'sans-serif'
        ],
        display: ['var(--font-display)', '"Lora"', 'Georgia', 'serif'],
        body: ['var(--font-body)', '"DM Sans"', 'system-ui', 'sans-serif']
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
        glow: '0 0 20px var(--accent-glow)',
        'glow-lg': '0 0 40px color-mix(in srgb, var(--accent-primary) 40%, transparent)',
        'glow-blue': '0 0 20px var(--accent-glow), 0 0 40px color-mix(in srgb, var(--accent-primary) 25%, transparent)',
        // Colored shadows
        'blue-sm': '0 2px 8px color-mix(in srgb, var(--accent-primary) 28%, transparent)',
        'blue-md': '0 4px 16px color-mix(in srgb, var(--accent-primary) 34%, transparent)',
        'blue-lg': '0 8px 32px color-mix(in srgb, var(--accent-primary) 40%, transparent)'
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
        'radial-fade': 'radial-gradient(circle at top, color-mix(in srgb, var(--accent-primary) 25%, transparent), color-mix(in srgb, var(--background-primary) 90%, black))',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'glass': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
      },
    }
  },
  plugins: []
};

export default config;
