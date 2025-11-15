/**
 * App - 루트 컴포넌트
 *
 * @role AppShell을 렌더링하는 루트 컴포넌트
 * @input 없음
 * @output AppShell 컴포넌트
 * @dependencies AppShell
 */

import AppShell from './app/AppShell'

/**
 * 루트 앱 컴포넌트
 * @returns AppShell 컴포넌트
 */
function App() {
  return <AppShell />
}

export default App
