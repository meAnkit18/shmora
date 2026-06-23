/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Editorial serif for display headlines (licensed names take over once added)
        display: ['Copernicus', 'Tiempos Headline', 'Newsreader', 'serif'],
        // Default UI + body
        sans: ['StyreneB', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        // Special accents only
        sketch: ['Excalifont', 'cursive'],
      },
      fontSize: {
        'display-xl': ['64px', { lineHeight: '1.05', letterSpacing: '-1.5px', fontWeight: '400' }],
        'display-lg': ['48px', { lineHeight: '1.1', letterSpacing: '-1px', fontWeight: '400' }],
        'display-md': ['36px', { lineHeight: '1.15', letterSpacing: '-0.5px', fontWeight: '400' }],
        'display-sm': ['28px', { lineHeight: '1.2', letterSpacing: '-0.3px', fontWeight: '400' }],
        'title-lg': ['22px', { lineHeight: '1.3', letterSpacing: '0', fontWeight: '500' }],
        'title-md': ['18px', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '500' }],
        'title-sm': ['16px', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '500' }],
        'body-md': ['16px', { lineHeight: '1.55', letterSpacing: '0', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '1.55', letterSpacing: '0', fontWeight: '400' }],
        caption: ['13px', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '500' }],
        'caption-uppercase': ['12px', { lineHeight: '1.4', letterSpacing: '1.5px', fontWeight: '500' }],
        code: ['14px', { lineHeight: '1.6', letterSpacing: '0', fontWeight: '400' }],
        button: ['14px', { lineHeight: '1', letterSpacing: '0', fontWeight: '500' }],
        'nav-link': ['14px', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '500' }],
      },
      colors: {
        // Brand voltage — your orange replaces Anthropic coral
        brand: {
          DEFAULT: '#FF7A00',
          active: '#E76700',
          light: '#FF922E',
          soft: '#FFB266',
          deep: '#CC5C00',
          disabled: '#E6DFD8',
        },
        // Warm cream surfaces (your palette, kept)
        canvas: '#FFF9F2',
        surface: {
          soft: '#F5F0E8',
          card: '#FFF4E6',
          strong: '#E8E0D2',
        },
        // Dark navy product surfaces (added from the system)
        dark: {
          DEFAULT: '#181715',
          soft: '#1F1E1B',
          elevated: '#252320',
        },
        hairline: {
          DEFAULT: '#EADCC8',
          soft: '#EBE6DF',
        },
        // Text scale
        ink: '#141413',
        body: {
          DEFAULT: '#3D3D3A',
          strong: '#252523',
        },
        fg: {
          muted: '#6C6A64',
          soft: '#8E8B82',
        },
        'on-dark': {
          DEFAULT: '#FAF9F5',
          soft: '#A09D96',
        },
        // Companion + semantic (sparingly)
        teal: '#5DB8A6',
        amber: '#E8A55A',
        success: '#5DB872',
        warning: '#D4A017',
        error: '#C64545',
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        pill: '9999px',
      },
      maxWidth: {
        site: '1200px',
        body: '800px',
      },
    },
  },
  plugins: [],
};
