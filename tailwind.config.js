/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // 색상 시스템 - globals.css :root 변수 매핑
      colors: {
        primary: {
          DEFAULT: '#6366f1',
          dark: '#4f46e5',
        },
        secondary: '#ec4899',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        reward: '#ffd700',

        // 배경 색상 (다크모드)
        bg: {
          base: '#0a0e1a',
          surface: '#1a2030',
          elevated: '#2d3950',
          interactive: '#3d4960',
          // 하위 호환성
          DEFAULT: '#0a0e1a',
          secondary: '#1a2030',
          tertiary: '#2d3950',
        },

        // 텍스트 색상
        text: {
          DEFAULT: '#f1f5f9',
          secondary: '#cbd5e1',
          tertiary: '#94a3b8',
        },

        // 경계선
        border: {
          DEFAULT: '#334155',
          light: '#475569',
        },

        // 저항도 색상
        resistance: {
          low: '#10b981',
          medium: '#f59e0b',
          high: '#ef4444',
        },
      },

      // 간격 시스템 - 8px base unit
      spacing: {
        'xs': '0.25rem',  // 4px
        'sm': '0.5rem',   // 8px
        'md': '1rem',     // 16px
        'lg': '1.5rem',   // 24px
        'xl': '2rem',     // 32px
        '2xl': '3rem',    // 48px
      },

      // 타이포그래피 스케일
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1' }],      // 11px
        'xs': ['0.75rem', { lineHeight: '1' }],         // 12px
        'sm': ['0.8125rem', { lineHeight: '1.25' }],    // 13px
        'base': ['0.875rem', { lineHeight: '1.5' }],    // 14px
        'md': ['0.9375rem', { lineHeight: '1.5' }],     // 15px
        'lg': ['1.125rem', { lineHeight: '1.5' }],      // 18px
        'xl': ['1.5rem', { lineHeight: '1.25' }],       // 24px
        '2xl': ['2rem', { lineHeight: '1.25' }],        // 32px
        '3xl': ['2.5rem', { lineHeight: '1.25' }],      // 40px
      },

      // 폰트 패밀리
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },

      // 폰트 무게
      fontWeight: {
        light: 300,
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
        extrabold: 800,
      },

      // 라인 높이
      lineHeight: {
        none: '1',
        tight: '1.25',
        snug: '1.375',
        normal: '1.5',
        relaxed: '1.625',
        loose: '1.75',
      },

      // 글자 간격
      letterSpacing: {
        tighter: '-0.05em',
        tight: '-0.025em',
        normal: '0',
        wide: '0.025em',
        wider: '0.05em',
      },

      // 그림자
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1)',
        'xl': '0 20px 60px rgba(0, 0, 0, 0.3)',
      },

      // 테두리 반경
      borderRadius: {
        'sm': '0.25rem',  // 4px
        'DEFAULT': '0.5rem',  // 8px
        'md': '0.75rem',  // 12px
        'lg': '1rem',     // 16px
        'xl': '1.5rem',   // 24px
        '2xl': '2rem',    // 32px
      },

      // 애니메이션
      animation: {
        'fadeIn': 'fadeIn 0.2s ease-out',
        'scaleIn': 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.9)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
