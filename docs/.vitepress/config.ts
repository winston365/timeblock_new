import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'TimeBlock Planner Wiki',
  description: '게이미피케이션과 AI 동반자를 결합한 타임블로킹 플래너',
  base: '/timeblock_new/',
  lang: 'ko-KR',

  head: [
    ['link', { rel: 'icon', href: '/timeblock_new/favicon.ico' }]
  ],

  themeConfig: {
    logo: '/logo.png',
    
    nav: [
      { text: '홈', link: '/' },
      { text: '가이드', link: '/guide/getting-started' },
      { text: '아키텍처', link: '/architecture/overview' },
      { text: '기능', link: '/features/time-blocking' },
      { text: '레퍼런스', link: '/reference/database-schema' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: '시작하기',
          items: [
            { text: '소개', link: '/guide/introduction' },
            { text: '빠른 시작', link: '/guide/getting-started' },
            { text: '개발 환경 설정', link: '/guide/development-setup' },
            { text: '프로젝트 구조', link: '/guide/project-structure' }
          ]
        }
      ],
      '/architecture/': [
        {
          text: '아키텍처',
          items: [
            { text: '전체 개요', link: '/architecture/overview' },
            { text: '데이터 계층', link: '/architecture/data-layer' },
            { text: 'Firebase 동기화', link: '/architecture/firebase-sync' },
            { text: 'Handler 패턴', link: '/architecture/handler-pattern' },
            { text: 'Repository 패턴', link: '/architecture/repository-pattern' }
          ]
        }
      ],
      '/features/': [
        {
          text: '핵심 기능',
          items: [
            { text: '타임블로킹', link: '/features/time-blocking' },
            { text: '게이미피케이션', link: '/features/gamification' },
            { text: 'AI 동반자 (Waifu)', link: '/features/waifu-companion' },
            { text: 'Gemini AI & RAG', link: '/features/gemini-rag' },
            { text: 'Google Calendar 연동', link: '/features/google-calendar' }
          ]
        }
      ],
      '/reference/': [
        {
          text: '레퍼런스',
          items: [
            { text: 'DB 스키마', link: '/reference/database-schema' },
            { text: 'Zustand 스토어', link: '/reference/zustand-stores' },
            { text: 'EventBus', link: '/reference/event-bus' },
            { text: '코딩 가이드라인', link: '/reference/coding-guidelines' },
            { text: '상수 & 기본값', link: '/reference/constants-defaults' }
          ]
        }
      ]
    },

    search: {
      provider: 'local'
    },

    outline: {
      level: [2, 3],
      label: '목차'
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/winston365/timeblock_new' }
    ],

    footer: {
      message: 'Made with ❤️ by winston365',
      copyright: 'Private Project - All Rights Reserved'
    },

    editLink: {
      pattern: 'https://github.com/winston365/timeblock_new/edit/main/docs/:path',
      text: '이 페이지 수정하기'
    },

    lastUpdated: {
      text: '최종 수정',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'short'
      }
    }
  }
})
