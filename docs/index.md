---
layout: home
hero:
  name: TimeBlock Planner
  text: 게이미피케이션 타임블로킹 플래너
  tagline: AI 동반자와 함께하는 생산성 여정
  image:
    src: /hero-image.png
    alt: TimeBlock Planner
  actions:
    - theme: brand
      text: 시작하기
      link: /guide/getting-started
    - theme: alt
      text: 아키텍처 보기
      link: /architecture/overview

features:
  - icon: 📅
    title: 지능형 타임블로킹
    details: 하루를 6개 블록으로 나누고, 심리적 저항도(Resistance)를 기반으로 시간을 자동 보정합니다.
  - icon: 🎮
    title: RPG 게이미피케이션
    details: XP, 레벨, 보스 레이드, 일일 퀘스트로 지루한 작업을 게임처럼 즐기세요.
  - icon: 🤖
    title: AI 동반자 시스템
    details: 호감도에 따라 반응이 변하는 Waifu 동반자가 정서적 지지를 제공합니다.
  - icon: 🧠
    title: Gemini AI & RAG
    details: 하이브리드 RAG로 과거 데이터를 기억하고, 맥락을 이해하는 AI 비서입니다.
  - icon: 🌩️
    title: 3-Tier 데이터 동기화
    details: IndexedDB + Firebase로 오프라인 완벽 지원 및 클라우드 백업을 제공합니다.
  - icon: ⚡
    title: Local-First 아키텍처
    details: 네트워크 없이도 완전한 기능을 제공하는 Electron 데스크톱 앱입니다.
---

## 빠른 링크

<div class="quick-links">

| 섹션 | 설명 |
|:---|:---|
| [🚀 빠른 시작](/guide/getting-started) | 5분 안에 개발 환경 설정하기 |
| [🏗️ 아키텍처 개요](/architecture/overview) | 전체 시스템 구조 이해하기 |
| [📊 DB 스키마](/reference/database-schema) | Dexie v17 테이블 레퍼런스 |
| [📝 코딩 가이드라인](/reference/coding-guidelines) | 컨벤션과 정책 확인하기 |

</div>

## 기술 스택

| 분류 | 기술 |
|:---|:---|
| **Runtime** | Electron 39.2.1 |
| **Framework** | React 19.2.1 |
| **Language** | TypeScript 5.5+ |
| **State** | Zustand 5.0.8 |
| **Local DB** | Dexie.js 4.0 (IndexedDB) |
| **Cloud** | Firebase Realtime Database |
| **Search** | Orama 3.1 (Vector Search) |
| **Styling** | Tailwind CSS 3.4 |
