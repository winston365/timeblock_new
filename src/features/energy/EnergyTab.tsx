/**
 * src/features/energy/EnergyTab.tsx
 * 에너지 탭 - 에너지 수준 관리 (기본 버전)
 */

import './energy.css';

export default function EnergyTab() {
  return (
    <div className="energy-tab">
      <div className="tab-header">
        <h3>⚡ 에너지</h3>
      </div>

      <div className="tab-content">
        <div className="energy-placeholder">
          <div className="placeholder-icon">⚡</div>
          <h4>에너지 관리 기능</h4>
          <p>추후 구현 예정</p>
          <ul className="placeholder-features">
            <li>시간대별 에너지 수준 입력</li>
            <li>오늘/전체 평균 에너지</li>
            <li>시간대별 평균 에너지 차트</li>
            <li>활동/맥락 기록</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
