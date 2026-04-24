/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ['class'],
	content: [
		'./pages/**/*.{ts,tsx}',
		'./components/**/*.{ts,tsx}',
		'./app/**/*.{ts,tsx}',
		'./src/**/*.{ts,tsx}',
	],
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px',
			},
		},
		extend: {
			fontFamily: {
				sans: ['"IBM Plex Sans Arabic"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
				display: ['"IBM Plex Sans Arabic"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
				mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				surface: {
					DEFAULT: 'hsl(var(--surface))',
					elevated: 'hsl(var(--surface-elevated))',
				},
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					hover: 'hsl(var(--primary-hover))',
					subtle: 'hsl(var(--primary-subtle))',
					foreground: 'hsl(var(--primary-foreground))',
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))',
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))',
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))',
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))',
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))',
				},
				brand: {
					gold: '#FECE14',
					hover: '#EAB308',
					subtle: '#FEF9C3',
				},
				neutral: {
					50: '#FAFAFA',
					100: '#F5F5F5',
					200: '#E5E5E5',
					300: '#D4D4D4',
					500: '#737373',
					700: '#404040',
					900: '#171717',
					950: '#0A0A0A',
				},
				success: {
					DEFAULT: '#10B981',
					foreground: '#065F46',
					subtle: '#ECFDF5',
				},
				warning: {
					DEFAULT: '#F59E0B',
					foreground: '#92400E',
					subtle: '#FFFBEB',
				},
				danger: {
					DEFAULT: '#EF4444',
					foreground: '#991B1B',
					subtle: '#FEF2F2',
				},
				info: {
					DEFAULT: '#3B82F6',
					foreground: '#1D4ED8',
					subtle: '#EFF6FF',
				},
			},
			boxShadow: {
				xs: '0 1px 2px rgba(0, 0, 0, 0.04)',
				sm: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
				md: '0 4px 12px rgba(0, 0, 0, 0.08)',
				lg: '0 12px 32px rgba(0, 0, 0, 0.10)',
				xl: '0 24px 48px rgba(0, 0, 0, 0.14)',
				soft: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
				focus: '0 0 0 3px rgba(254, 206, 20, 0.30)',
			},
			borderRadius: {
				sm: '0.375rem',
				md: '0.5rem',
				lg: '0.75rem',
				xl: '1rem',
			},
			transitionTimingFunction: {
				'app': 'cubic-bezier(0.4, 0, 0.2, 1)',
				'out': 'cubic-bezier(0.16, 1, 0.3, 1)',
				'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
				'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
				'emphasize': 'cubic-bezier(0.2, 0, 0, 1)',
			},
			transitionDuration: {
				80: '80ms',
				150: '150ms',
				220: '220ms',
				200: '200ms',
				300: '300ms',
				320: '320ms',
				480: '480ms',
			},
			keyframes: {
				'accordion-down': {
					from: { height: 0 },
					to: { height: 'var(--radix-accordion-content-height)' },
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: 0 },
				},
				'fade-in': {
					from: { opacity: '0' },
					to: { opacity: '1' },
				},
				'slide-in-right': {
					from: { transform: 'translateX(100%)', opacity: '0' },
					to: { transform: 'translateX(0)', opacity: '1' },
				},
				'scale-in': {
					from: { transform: 'scale(0.95)', opacity: '0' },
					to: { transform: 'scale(1)', opacity: '1' },
				},
				'stagger-up': {
					from: { opacity: '0', transform: 'translateY(8px)' },
					to: { opacity: '1', transform: 'translateY(0)' },
				},
				'shimmer': {
					from: { backgroundPosition: '200% 0' },
					to: { backgroundPosition: '-200% 0' },
				},
				'slide-down-fade': {
					from: { opacity: '0', transform: 'translateY(-6px)' },
					to: { opacity: '1', transform: 'translateY(0)' },
				},
				'shake-soft': {
					'0%, 100%': { transform: 'translateX(0)' },
					'20%': { transform: 'translateX(-4px)' },
					'40%': { transform: 'translateX(4px)' },
					'60%': { transform: 'translateX(-3px)' },
					'80%': { transform: 'translateX(3px)' },
				},
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.2s ease-out',
				'slide-in-right': 'slide-in-right 0.3s ease-out',
				'scale-in': 'scale-in 0.2s ease-out',
				'stagger-up': 'stagger-up 220ms cubic-bezier(0.16, 1, 0.3, 1) both',
				'shimmer': 'shimmer 1.4s linear infinite',
				'slide-down-fade': 'slide-down-fade 180ms cubic-bezier(0.16, 1, 0.3, 1)',
				'shake-soft': 'shake-soft 220ms cubic-bezier(0.65, 0, 0.35, 1) 1',
			},
		},
	},
	plugins: [require('tailwindcss-animate')],
}