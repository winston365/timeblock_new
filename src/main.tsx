/**
 * 앱 엔트리 포인트
 *
 * @role React 앱을 초기화하고 DOM에 마운트
 * @input 없음
 * @output React 앱 렌더링 (일반 모드, QuickAdd 모드, PiP 모드)
 * @dependencies React, ReactDOM, App 컴포넌트, QuickAddTask 컴포넌트, PipTimer 컴포넌트, 글로벌 스타일
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import QuickAddTask from './features/quickadd/QuickAddTask.tsx'
import PipTimer from './features/pip/PipTimer.tsx'
import './styles/tailwind.css'
import './styles/design-system.css'
import './styles/globals.css'
// 테마 초기화: localStorage에서 테마를 읽어와서 적용
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
  document.documentElement.setAttribute('data-theme', savedTheme);
}

// URL 쿼리 파라미터 확인 (mode에 따라 다른 컴포넌트 렌더링)
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get('mode');

const renderApp = () => {
  if (mode === 'quickadd') return <QuickAddTask />;
  if (mode === 'pip') return <PipTimer />;
  return <App />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {renderApp()}
  </React.StrictMode>,
)
