function App() {
  return (
    <div className="app-container">
      <header className="top-toolbar">
        <h1>⏰ 타임블럭 플래너</h1>
        <div className="toolbar-stats">
          <div className="stat-item">
            <span>⚡ 에너지:</span>
            <span>80</span>
          </div>
          <div className="stat-item">
            <span>💎 오늘 XP:</span>
            <span>0</span>
          </div>
          <div className="stat-item">
            <span>🏆 보유 XP:</span>
            <span>0</span>
          </div>
        </div>
      </header>

      <main className="main-layout">
        <aside className="left-sidebar">
          <div className="sidebar-tabs">
            <button className="sidebar-tab active">
              <span>🎯</span>
              <span>오늘</span>
            </button>
            <button className="sidebar-tab">
              <span>📊</span>
              <span>통계</span>
            </button>
            <button className="sidebar-tab">
              <span>⚡</span>
              <span>에너지</span>
            </button>
            <button className="sidebar-tab">
              <span>✅</span>
              <span>완료</span>
            </button>
            <button className="sidebar-tab">
              <span>📥</span>
              <span>인박스</span>
            </button>
          </div>
          <div className="sidebar-content">
            <p>사이드바 컨텐츠</p>
          </div>
        </aside>

        <section className="center-content">
          <div className="timeline-section">
            <h2>타임블럭 스케줄러</h2>
            <p>프로젝트 초기화 완료!</p>
          </div>
        </section>

        <aside className="right-panel">
          <div className="right-panel-tabs">
            <button className="right-panel-tab active">와이푸</button>
            <button className="right-panel-tab">템플릿</button>
            <button className="right-panel-tab">상점</button>
          </div>
          <div className="right-panel-content">
            <p>오른쪽 패널 컨텐츠</p>
          </div>
        </aside>
      </main>
    </div>
  )
}

export default App
