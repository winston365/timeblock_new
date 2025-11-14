/**
 * src/features/energy/EnergyTab.tsx
 * 에너지 탭 - 에너지 수준 관리
 */

import { useState } from 'react';
import { useEnergyState } from '@/shared/hooks';
import './energy.css';

const ACTIVITY_OPTIONS = [
  { value: '', label: '선택 안함' },
  { value: '💼 업무', label: '💼 업무' },
  { value: '👥 회의', label: '👥 회의' },
  { value: '🏃 운동', label: '🏃 운동' },
  { value: '🍽️ 식사', label: '🍽️ 식사' },
  { value: '☕ 휴식', label: '☕ 휴식' },
  { value: '📚 학습', label: '📚 학습' },
  { value: '🎨 창의적 작업', label: '🎨 창의적 작업' },
  { value: '🚗 출퇴근', label: '🚗 출퇴근' },
  { value: '😴 수면', label: '😴 수면' },
];

export default function EnergyTab() {
  const {
    energyLevels,
    loading,
    currentEnergy,
    todayAverage,
    overallAverage,
    timeBlockAverages,
    addEnergyLevel,
    deleteEnergyLevel,
  } = useEnergyState();

  const [showInput, setShowInput] = useState(false);
  const [energy, setEnergy] = useState(50);
  const [context, setContext] = useState('');
  const [activity, setActivity] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addEnergyLevel(energy, context || undefined, activity || undefined);
    setEnergy(50);
    setContext('');
    setActivity('');
    setShowInput(false);
  };

  if (loading) {
    return (
      <div className="energy-tab">
        <div className="tab-content">
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="energy-tab">
      <div className="tab-header">
        <h3>⚡ 에너지</h3>
        <button
          className="btn-primary"
          onClick={() => setShowInput(!showInput)}
          aria-label={showInput ? '입력 폼 닫기' : '에너지 입력'}
        >
          {showInput ? '취소' : '➕ 입력'}
        </button>
      </div>

      <div className="tab-content">
        {/* 에너지 입력 폼 */}
        {showInput && (
          <form className="energy-input-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="energy-level">에너지 수준: {energy}%</label>
              <input
                id="energy-level"
                type="range"
                min="0"
                max="100"
                step="5"
                value={energy}
                onChange={(e) => setEnergy(Number(e.target.value))}
                className="energy-slider"
              />
            </div>

            <div className="form-group">
              <label htmlFor="energy-activity">활동</label>
              <select
                id="energy-activity"
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                className="form-select"
              >
                {ACTIVITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="energy-context">상황/맥락 (선택)</label>
              <input
                id="energy-context"
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="예: 점심 먹고 졸림, 운동 후 상쾌함"
                className="form-input"
              />
            </div>

            <button type="submit" className="btn-primary btn-full">
              ✅ 기록하기
            </button>
          </form>
        )}

        {/* 통계 */}
        <div className="energy-stats">
          <div className="stat-card">
            <div className="stat-label">현재 에너지</div>
            <div className="stat-value" style={{ color: getEnergyColor(currentEnergy) }}>
              {currentEnergy}%
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">오늘 평균</div>
            <div className="stat-value">{todayAverage}%</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">전체 평균</div>
            <div className="stat-value">{overallAverage}%</div>
          </div>
        </div>

        {/* 시간대별 평균 */}
        {Object.keys(timeBlockAverages).length > 0 && (
          <div className="energy-section">
            <h4>시간대별 평균 에너지</h4>
            <div className="timeblock-energy-list">
              {Object.entries(timeBlockAverages).map(([blockId, avg]) => (
                <div key={blockId} className="timeblock-energy-item">
                  <span className="timeblock-label">{getBlockLabel(blockId)}</span>
                  <div className="energy-bar-container">
                    <div
                      className="energy-bar-fill"
                      style={{
                        width: `${avg}%`,
                        background: getEnergyColor(avg),
                      }}
                    />
                  </div>
                  <span className="energy-value">{avg}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 오늘 기록된 에너지 */}
        {energyLevels.length > 0 && (
          <div className="energy-section">
            <h4>오늘 기록 ({energyLevels.length}개)</h4>
            <div className="energy-records-list">
              {[...energyLevels].reverse().map((level) => (
                <div key={level.timestamp} className="energy-record-item">
                  <div className="record-time">
                    {new Date(level.timestamp).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="record-energy" style={{ color: getEnergyColor(level.energy) }}>
                    {level.energy}%
                  </div>
                  {level.activity && <div className="record-activity">{level.activity}</div>}
                  {level.context && <div className="record-context">{level.context}</div>}
                  <button
                    className="btn-delete"
                    onClick={() => deleteEnergyLevel(level.timestamp)}
                    aria-label="삭제"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {energyLevels.length === 0 && !showInput && (
          <div className="energy-empty">
            <p>오늘 기록된 에너지가 없습니다.</p>
            <p>➕ 버튼을 눌러 에너지를 기록해보세요!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function getBlockLabel(blockId: string): string {
  const labels: Record<string, string> = {
    '5-8': '05:00-08:00',
    '8-11': '08:00-11:00',
    '11-14': '11:00-14:00',
    '14-17': '14:00-17:00',
    '17-19': '17:00-19:00',
    '19-24': '19:00-24:00',
  };
  return labels[blockId] || blockId;
}

function getEnergyColor(energy: number): string {
  if (energy >= 80) return '#10b981'; // Green
  if (energy >= 60) return '#3b82f6'; // Blue
  if (energy >= 40) return '#f59e0b'; // Amber
  if (energy >= 20) return '#f97316'; // Orange
  return '#ef4444'; // Red
}
