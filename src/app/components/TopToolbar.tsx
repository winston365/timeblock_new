/**
 * TopToolbar - 상단 툴바
 *
 * @role 앱 상단에 위치하여 게임 상태, 에너지, XP 정보, 와이푸 호감도/기분을 표시하고 주요 기능 버튼 제공
 * @input gameState: 게임 상태 데이터, onOpenGeminiChat: AI 대화 열기, onOpenSettings: 설정 열기, onCallWaifu: 와이푸 호출
 * @output 상단 툴바 UI (통계 표시 및 버튼)
 * @dependencies useEnergyState, useWaifuState 훅
 */

import type { GameState } from '@/shared/types/domain';
import { useEnergyState } from '@/shared/hooks';
import { useWaifuState } from '@/shared/hooks';
import { getAffectionColor } from '@/features/waifu/waifuImageUtils';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';
import { getDialogueFromAffection } from '@/data/repositories/waifuRepository';

interface TopToolbarProps {
  gameState: GameState | null;
  onOpenGeminiChat?: () => void;
  onOpenTemplates?: () => void;
}

/**
 * 상단 툴바 컴포넌트 - 게임 상태 표시 및 주요 기능 버튼 제공
 * @param props - TopToolbarProps
 * @returns 상단 툴바 UI
 */
export default function TopToolbar({ gameState, onOpenGeminiChat, onOpenTemplates }: TopToolbarProps) {
  const { currentEnergy } = useEnergyState();
  const { waifuState, currentMood } = useWaifuState();
  const { show } = useWaifuCompanionStore();

  const handleCallWaifu = () => {
    // 호감도에 따른 대사 생성
    if (waifuState) {
      const dialogue = getDialogueFromAffection(waifuState.affection, waifuState.tasksCompletedToday);
      show(dialogue);
    } else {
      show('뭔데~');
    }

    // 10초 후 peeking으로 자동 전환 (show() 내부에서 3초로 설정되어 있으므로 타이머 재설정)
    setTimeout(() => {
      useWaifuCompanionStore.getState().peek();
    }, 10000);
  };

  return (
    <header className="top-toolbar" role="banner">
      <h1>⏰ 타임블럭 플래너</h1>

      <div className="toolbar-stats">
        <div className="stat-item">
          <span>⚡ 에너지:</span>
          <span>{currentEnergy > 0 ? `${currentEnergy}%` : '-'}</span>
        </div>
        <div className="stat-item">
          <span>💎 오늘 XP:</span>
          <span>{gameState?.dailyXP ?? 0}</span>
        </div>
        <div className="stat-item">
          <span>🏆 보유 XP:</span>
          <span>{gameState?.availableXP ?? 0}</span>
        </div>
        <div className="stat-item stat-item-timer">
          <span>⏱️ 오늘 몰입:</span>
          <span className="timer-count">{gameState?.dailyTimerCount ?? 0}회</span>
        </div>

        {/* 와이푸 호감도 */}
        {waifuState && (
          <div className="stat-item stat-item-waifu">
            <span>💖 호감도:</span>
            <div className="toolbar-affection-bar">
              <div
                className="toolbar-affection-fill"
                style={{
                  width: `${waifuState.affection}%`,
                  backgroundColor: getAffectionColor(waifuState.affection)
                }}
              />
            </div>
            <span>{waifuState.affection}%</span>
          </div>
        )}

        {/* 와이푸 기분 */}
        {waifuState && currentMood && (
          <div className="stat-item stat-item-mood">
            <span>기분:</span>
            <span className="toolbar-mood-icon" title={currentMood}>{currentMood}</span>
          </div>
        )}
      </div>

      <div className="toolbar-actions">
        <button className="toolbar-btn" onClick={handleCallWaifu} title="와이푸 호출">
          👋 호출하기
        </button>
        <button className="toolbar-btn" onClick={onOpenTemplates} title="템플릿 관리">
          📝 템플릿
        </button>
        <button className="toolbar-btn" onClick={onOpenGeminiChat} title="AI 대화">
          💬 AI 대화
        </button>
      </div>
    </header>
  );
}
