/**
 * 앱 엔트리 포인트
 *
 * @role React 앱을 초기화하고 DOM에 마운트
 * @input 없음
 * @output React 앱 렌더링
 * @dependencies React, ReactDOM, App 컴포넌트, 글로벌 스타일
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/design-system.css'
import './styles/globals.css'
import './styles/layout.css'

// 테마 초기화: localStorage에서 테마를 읽어와서 적용
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
  document.documentElement.setAttribute('data-theme', savedTheme);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
