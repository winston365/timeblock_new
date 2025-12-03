import { useState } from 'react';
import { BOSSES } from '@/features/battle/data/bossData';
import { useBattleStore } from '@/features/battle/stores/battleStore';
import { getBossImageSrc } from '@/features/battle/utils/assets';
import type { Boss } from '@/shared/types/domain';
import { formGroupClass, inputClass, primaryButtonClass } from '../styles';

function parsePosition(pos: string): { x: number; y: number } {
  const parts = pos.toLowerCase().split(' ');
  let x = 50;
  let y = 50;

  for (const part of parts) {
    if (part === 'left') x = 0;
    else if (part === 'right') x = 100;
    else if (part === 'top') y = 0;
    else if (part === 'bottom') y = 100;
    else if (part === 'center') {
      // center is already 50/50
    } else if (part.endsWith('%')) {
      const val = parseInt(part, 10);
      if (parts.indexOf(part) === 1 || parts[0] === 'center') {
        y = val;
      } else {
        x = val;
      }
    }
  }

  return { x, y };
}

function getPositionString(positionX: number, positionY: number): string {
  if (positionX === 50 && positionY === 50) return 'center';
  if (positionX === 50 && positionY === 0) return 'center top';
  if (positionX === 50 && positionY === 100) return 'center bottom';
  if (positionX === 0 && positionY === 50) return 'left center';
  if (positionX === 100 && positionY === 50) return 'right center';

  return `${positionX}% ${positionY}%`;
}

function getDifficultyColor(difficulty: Boss['difficulty']) {
  switch (difficulty) {
    case 'easy':
      return 'text-green-400';
    case 'normal':
      return 'text-blue-400';
    case 'hard':
      return 'text-orange-400';
    case 'epic':
      return 'text-purple-400';
    default:
      return 'text-gray-400';
  }
}

export function BossImagePreviewEditor() {
  const [selectedBoss, setSelectedBoss] = useState<Boss>(BOSSES[0]);
  const [previewScale, setPreviewScale] = useState(selectedBoss.imageScale || 1);
  const [positionX, setPositionX] = useState(50);
  const [positionY, setPositionY] = useState(50);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const updateBossImageSetting = useBattleStore(state => state.updateBossImageSetting);
  const getBossImageSetting = useBattleStore(state => state.getBossImageSetting);

  const handleBossChange = (bossId: string) => {
    const boss = BOSSES.find(b => b.id === bossId);
    if (!boss) return;

    setSelectedBoss(boss);
    setSaveMessage(null);

    const savedSetting = getBossImageSetting(bossId);
    if (savedSetting) {
      const parsed = parsePosition(savedSetting.imagePosition);
      setPositionX(parsed.x);
      setPositionY(parsed.y);
      setPreviewScale(savedSetting.imageScale);
      return;
    }

    const parsed = parsePosition(boss.imagePosition || 'center');
    setPreviewScale(boss.imageScale || 1);
    setPositionX(parsed.x);
    setPositionY(parsed.y);
  };

  const positionString = getPositionString(positionX, positionY);
  const bossImageSrc = getBossImageSrc(selectedBoss.image);

  return (
    <div className="flex flex-col gap-4">
      <div className={formGroupClass}>
        <label>보스 선택</label>
        <select
          value={selectedBoss.id}
          onChange={(e) => handleBossChange(e.target.value)}
          className={inputClass}
        >
          {BOSSES.map(boss => (
            <option key={boss.id} value={boss.id}>
              {boss.name} ({boss.difficulty})
            </option>
          ))}
        </select>
      </div>

      <div className="relative aspect-[3/4] w-full max-w-[280px] mx-auto overflow-hidden rounded-xl border border-[var(--color-border)] bg-gradient-to-b from-gray-900 to-black">
        <img
          src={bossImageSrc}
          alt={selectedBoss.name}
          className="h-full w-full object-cover transition-all duration-300"
          style={{
            objectPosition: positionString,
            transform: `scale(${previewScale})`,
            transformOrigin: 'center',
          }}
        />

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20" />
          <div
            className="absolute w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${positionX}%`, top: `${positionY}%` }}
          />
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3">
          <p className={`text-xs font-bold ${getDifficultyColor(selectedBoss.difficulty)}`}>
            {selectedBoss.difficulty.toUpperCase()}
          </p>
          <p className="text-lg font-black text-white">{selectedBoss.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className={formGroupClass}>
          <label className="flex items-center justify-between">
            <span>가로 위치 (X)</span>
            <span className="text-xs font-mono text-[var(--color-text-tertiary)]">{positionX}%</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-tertiary)]">←</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={positionX}
              onChange={(e) => setPositionX(Number(e.target.value))}
              className="flex-1 accent-[var(--color-primary)]"
            />
            <span className="text-xs text-[var(--color-text-tertiary)]">→</span>
          </div>
        </div>

        <div className={formGroupClass}>
          <label className="flex items-center justify-between">
            <span>세로 위치 (Y)</span>
            <span className="text-xs font-mono text-[var(--color-text-tertiary)]">{positionY}%</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-tertiary)]">↑</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={positionY}
              onChange={(e) => setPositionY(Number(e.target.value))}
              className="flex-1 accent-[var(--color-primary)]"
            />
            <span className="text-xs text-[var(--color-text-tertiary)]">↓</span>
          </div>
        </div>

        <div className={formGroupClass}>
          <label className="flex items-center justify-between">
            <span>이미지 스케일</span>
            <span className="text-xs font-mono text-[var(--color-text-tertiary)]">
              {previewScale.toFixed(1)}x
            </span>
          </label>
          <input
            type="range"
            min="0.8"
            max="1.5"
            step="0.05"
            value={previewScale}
            onChange={(e) => setPreviewScale(Number(e.target.value))}
            className="w-full accent-[var(--color-primary)]"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setPositionX(50);
            setPositionY(20);
          }}
          className="px-2 py-1 text-xs rounded-lg bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-base)] transition"
        >
          상단
        </button>
        <button
          onClick={() => {
            setPositionX(50);
            setPositionY(50);
          }}
          className="px-2 py-1 text-xs rounded-lg bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-base)] transition"
        >
          중앙
        </button>
        <button
          onClick={() => {
            setPositionX(50);
            setPositionY(80);
          }}
          className="px-2 py-1 text-xs rounded-lg bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-base)] transition"
        >
          하단
        </button>
        <button
          onClick={() => {
            setPositionX(30);
            setPositionY(50);
          }}
          className="px-2 py-1 text-xs rounded-lg bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-base)] transition"
        >
          좌측
        </button>
        <button
          onClick={() => {
            setPositionX(70);
            setPositionY(50);
          }}
          className="px-2 py-1 text-xs rounded-lg bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-base)] transition"
        >
          우측
        </button>
      </div>

      <button
        onClick={async () => {
          setIsSaving(true);
          setSaveMessage(null);
          try {
            await updateBossImageSetting(selectedBoss.id, positionString, previewScale);
            setSaveMessage(`✅ ${selectedBoss.name} 이미지 설정 저장됨!`);
          } catch (error) {
            setSaveMessage('❌ 저장 실패');
          } finally {
            setIsSaving(false);
          }
        }}
        disabled={isSaving}
        className={`${primaryButtonClass} w-full flex items-center justify-center gap-2`}
      >
        {isSaving ? (
          <>
            <span className="animate-spin">⏳</span>
            저장 중...
          </>
        ) : (
          <>
            <span>💾</span>
            이 보스 설정 저장
          </>
        )}
      </button>

      {saveMessage && (
        <p
          className={`text-sm text-center ${
            saveMessage.startsWith('✅') ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {saveMessage}
        </p>
      )}

      <p className="text-xs text-[var(--color-text-tertiary)]">
        💡 <strong>저장하면</strong> 사이드바의 보스 이미지에 즉시 반영됩니다.
        설정은 Dexie와 Firebase에 동기화됩니다.
      </p>
    </div>
  );
}
