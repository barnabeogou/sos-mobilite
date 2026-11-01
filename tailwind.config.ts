import type { Config } from 'tailwindcss';

/**
 * Charte graphique SOS MOBILITÉ
 *  Bleu nuit       #0B1F33  confiance, sérieux, professionnalisme (fond)
 *  Bleu électrique #1E7BFF  actions, navigation, éléments interactifs
 *  Rouge sécurité  #E30613  SOS, alertes, urgence (touches de couleur)
 *  Gris argent     #A7B0BD  textes secondaires, séparateurs
 *  Blanc           #FFFFFF  clarté, lisibilité
 *  Noir            #0A0A0A  contraste
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: {
          950: '#050E18',
          900: '#0B1F33',
          850: '#0F2740',
          800: '#13304F',
          700: '#1B3E63',
          600: '#26507D',
        },
        electric: {
          300: '#7DB4FF',
          400: '#4C97FF',
          500: '#1E7BFF',
          600: '#0F63E0',
          700: '#0B4FB5',
        },
        alert: {
          400: '#FF4D57',
          500: '#E30613',
          600: '#B8040F',
        },
        silver: {
          100: '#EEF1F5',
          200: '#D9DEE5',
          300: '#C2C9D3',
          400: '#A7B0BD',
          500: '#8792A2',
          600: '#677387',
        },
        ink: '#0A0A0A',
      },
      fontFamily: {
        display: ['Montserrat', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
        sos: '0 0 0 10px rgba(227,6,19,0.12), 0 0 0 22px rgba(227,6,19,0.06), 0 18px 50px -10px rgba(227,6,19,0.65)',
        glow: '0 10px 30px -10px rgba(30,123,255,0.6)',
      },
      keyframes: {
        'sos-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.55' },
          '50%': { transform: 'scale(1.12)', opacity: '0' },
        },
        'radar': {
          '0%': { transform: 'scale(0.6)', opacity: '0.7' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
      },
      animation: {
        'sos-pulse': 'sos-pulse 2.4s ease-in-out infinite',
        radar: 'radar 2.2s ease-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
