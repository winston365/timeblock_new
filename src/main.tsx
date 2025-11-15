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
import './styles/globals.css'
import './styles/layout.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
