/**
 * BattleTab - 전투 시스템 설정 탭
 *
 * @role 보스 전투 시스템의 설정 및 미션 관리
 * @responsibilities
 *   - 보스/보상 설정 관리
 *   - 미션 CRUD (추가, 수정, 삭제, 순서 변경)
 *   - UI 설정 관리
 *   - 보스 이미지 프리뷰 에디터
 * @dependencies
 *   - battleStore: 전투 상태 및 설정
 *   - bossData: 보스 메타데이터
 */

import { useState, useEffect } from 'react';
import { useBattleStore } from '@/features/battle/stores/battleStore';
import { BOSSES } from '@/features/battle/data/bossData';
import type { BattleMission, Boss } from '@/shared/types/domain';
import {
  sectionClass,
  sectionDescriptionClass,
  formGroupClass,
  inputClass,
  primaryButtonClass,
} from './styles';

/**
 * 보스 이미지 프리뷰 에디터 컴포넌트
 */
function BossImagePreviewEditor() {
  const [selectedBoss, setSelectedBoss] = useState<Boss>(BOSSES[0]);
  const [previewScale, setPreviewScale] = useState(selectedBoss.imageScale || 1);
  // X, Y를 분리하여 더 정밀한 제어
  const [positionX, setPositionX] = useState(50); // 0-100%
  const [positionY, setPositionY] = useState(50); // 0-100%
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const updateBossImageSetting = useBattleStore(state => state.updateBossImageSetting);
  const getBossImageSetting = useBattleStore(state => state.getBossImageSetting);

  // 보스 선택 시 해당 보스의 설정값으로 초기화
  const handleBossChange = (bossId: string) => {
    const boss = BOSSES.find(b => b.id === bossId);
    if (boss) {
      setSelectedBoss(boss);
      setSaveMessage(null);
      
      // 저장된 설정이 있으면 사용, 없으면 bossData의 기본값 사용
      const savedSetting = getBossImageSetting(bossId);
      if (savedSetting) {
        const parsed = parsePosition(savedSetting.imagePosition);
        setPositionX(parsed.x);
        setPositionY(parsed.y);
        setPreviewScale(savedSetting.imageScale);
      } else {
        setPreviewScale(boss.imageScale || 1);
        const pos = boss.imagePosition || 'center';
        const parsed = parsePosition(pos);
        setPositionX(parsed.x);
        setPositionY(parsed.y);
      }
    }
  };

  // position 문자열을 X, Y 값으로 파싱
  const parsePosition = (pos: string): { x: number; y: number } => {
    const parts = pos.toLowerCase().split(' ');
    let x = 50, y = 50;

    for (const part of parts) {
      if (part === 'left') x = 0;
      else if (part === 'right') x = 100;
      else if (part === 'top') y = 0;
      else if (part === 'bottom') y = 100;
      else if (part === 'center') { /* 이미 50 */ }
      else if (part.endsWith('%')) {
        const val = parseInt(part);
        // 두 번째 값이면 Y, 첫 번째면 컨텍스트에 따라
        if (parts.indexOf(part) === 1 || parts[0] === 'center') {
          y = val;
        } else {
          x = val;
        }
      }
    }
    return { x, y };
  };

  // X, Y 값을 position 문자열로 변환
  const getPositionString = (): string => {
    // 특별한 경우 키워드 사용
    if (positionX === 50 && positionY === 50) return 'center';
    if (positionX === 50 && positionY === 0) return 'center top';
    if (positionX === 50 && positionY === 100) return 'center bottom';
    if (positionX === 0 && positionY === 50) return 'left center';
    if (positionX === 100 && positionY === 50) return 'right center';
    
    return `${positionX}% ${positionY}%`;
  };

  // 난이도별 색상
  const getDifficultyColor = (difficulty: Boss['difficulty']) => {
    switch (difficulty) {
      case 'easy': return 'text-green-400';
      case 'normal': return 'text-blue-400';
      case 'hard': return 'text-orange-400';
      case 'epic': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  const positionString = getPositionString();
  const bossImageSrc = `${import.meta.env.BASE_URL}assets/bosses/${selectedBoss.image}`;

  return (
    <div className="flex flex-col gap-4">
      {/* 보스 선택 드롭다운 */}
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

      {/* 프리뷰 영역 */}
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
        
        {/* 위치 가이드 오버레이 */}
        <div className="absolute inset-0 pointer-events-none">
          {/* 중앙 십자선 */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20" />
          {/* 현재 위치 표시 */}
          <div 
            className="absolute w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${positionX}%`, top: `${positionY}%` }}
          />
        </div>
        
        {/* 보스 정보 오버레이 */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3">
          <p className={`text-xs font-bold ${getDifficultyColor(selectedBoss.difficulty)}`}>
            {selectedBoss.difficulty.toUpperCase()}
          </p>
          <p className="text-lg font-black text-white">{selectedBoss.name}</p>
        </div>
      </div>

      {/* 위치 조정 컨트롤 - X, Y 분리 */}
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
            <span className="text-xs font-mono text-[var(--color-text-tertiary)]">{previewScale.toFixed(1)}x</span>
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

      {/* 프리셋 버튼 */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => { setPositionX(50); setPositionY(20); }} className="px-2 py-1 text-xs rounded-lg bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-base)] transition">상단</button>
        <button onClick={() => { setPositionX(50); setPositionY(50); }} className="px-2 py-1 text-xs rounded-lg bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-base)] transition">중앙</button>
        <button onClick={() => { setPositionX(50); setPositionY(80); }} className="px-2 py-1 text-xs rounded-lg bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-base)] transition">하단</button>
        <button onClick={() => { setPositionX(30); setPositionY(50); }} className="px-2 py-1 text-xs rounded-lg bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-base)] transition">좌측</button>
        <button onClick={() => { setPositionX(70); setPositionY(50); }} className="px-2 py-1 text-xs rounded-lg bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-base)] transition">우측</button>
      </div>

      {/* 저장 버튼 */}
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

      {/* 저장 결과 메시지 */}
      {saveMessage && (
        <p className={`text-sm text-center ${saveMessage.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
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

/**
 * 전투 설정 탭 컴포넌트
 */
export function BattleTab() {
  const {
    missions,
    settings,
    loading,
    initialize,
    addMission,
    updateMission,
    deleteMission,
    reorderMissions,
    updateSettings,
  } = useBattleStore();

  // 초기화
  useEffect(() => {
    initialize();
  }, [initialize]);

  // 새 미션 추가 폼
  const [newMissionText, setNewMissionText] = useState('');
  const [newMissionDamage, setNewMissionDamage] = useState(15);
  const [editingMission, setEditingMission] = useState<BattleMission | null>(null);

  // 드래그 상태
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleAddMission = async () => {
    if (!newMissionText.trim()) return;

    await addMission(newMissionText.trim(), newMissionDamage);
    setNewMissionText('');
    setNewMissionDamage(settings.defaultMissionDamage);
  };

  const handleUpdateMission = async () => {
    if (!editingMission) return;

    await updateMission(editingMission.id, {
      text: editingMission.text,
      damage: editingMission.damage,
    });
    setEditingMission(null);
  };

  const handleDeleteMission = async (missionId: string) => {
    if (!confirm('이 미션을 삭제하시겠습니까?')) return;
    await deleteMission(missionId);
  };

  const handleToggleMission = async (mission: BattleMission) => {
    await updateMission(mission.id, { enabled: !mission.enabled });
  };

  // 드래그 앤 드롭 핸들러
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newMissions = [...missions];
    const draggedMission = newMissions[draggedIndex];
    newMissions.splice(draggedIndex, 1);
    newMissions.splice(index, 0, draggedMission);

    // 임시로 UI 업데이트 (실제 저장은 드롭 시)
    setDraggedIndex(index);
  };

  const handleDrop = async () => {
    if (draggedIndex === null) return;
    await reorderMissions(missions);
    setDraggedIndex(null);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[var(--color-text-secondary)]">
        로딩 중...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 보스 설정 */}
      <section className={sectionClass}>
        <h3>⚔️ 보스 설정</h3>
        <p className={sectionDescriptionClass}>
          하루에 등장하는 보스 수와 체력을 설정합니다.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className={formGroupClass}>
            <label>
              하루 보스 수
              <span className="ml-2 text-xs text-[var(--color-text-tertiary)]">(1~23)</span>
            </label>
            <input
              type="number"
              min={1}
              max={23}
              value={settings.dailyBossCount}
              onChange={(e) => updateSettings({ dailyBossCount: Math.min(23, Math.max(1, Number(e.target.value))) })}
              className={inputClass}
            />
          </div>

          <div className={formGroupClass}>
            <label>
              보스 체력 (분)
              <span className="ml-2 text-xs text-[var(--color-text-tertiary)]">(30~120)</span>
            </label>
            <input
              type="number"
              min={30}
              max={120}
              step={5}
              value={settings.bossBaseHP}
              onChange={(e) => updateSettings({ bossBaseHP: Math.min(120, Math.max(30, Number(e.target.value))) })}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* 보상 설정 */}
      <section className={sectionClass}>
        <h3>🏆 보상 설정</h3>
        <p className={sectionDescriptionClass}>
          보스 처치 시 획득하는 XP를 설정합니다.
        </p>

        <div className={formGroupClass}>
          <label>
            보스 처치 XP
            <span className="ml-2 text-xs text-[var(--color-text-tertiary)]">(50~200)</span>
          </label>
          <input
            type="number"
            min={50}
            max={200}
            step={10}
            value={settings.bossDefeatXP}
            onChange={(e) => updateSettings({ bossDefeatXP: Math.min(200, Math.max(50, Number(e.target.value))) })}
            className={inputClass}
          />
        </div>
      </section>

      {/* UI 설정 */}
      <section className={sectionClass}>
        <h3>🎨 UI 설정</h3>

        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={settings.showBattleInSidebar}
              onChange={(e) => updateSettings({ showBattleInSidebar: e.target.checked })}
              className="h-5 w-5 rounded border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-primary)]"
            />
            <span className="text-sm font-medium text-[var(--color-text)]">사이드바에 전투 표시</span>
          </label>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={settings.showBossImage ?? true}
              onChange={(e) => updateSettings({ showBossImage: e.target.checked })}
              className="h-5 w-5 rounded border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-primary)]"
            />
            <span className="text-sm font-medium text-[var(--color-text)]">보스 이미지 표시</span>
            <span className="text-xs text-[var(--color-text-tertiary)]">(끄면 이모지로 대체)</span>
          </label>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={settings.battleSoundEffects}
              onChange={(e) => updateSettings({ battleSoundEffects: e.target.checked })}
              className="h-5 w-5 rounded border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-primary)]"
            />
            <span className="text-sm font-medium text-[var(--color-text)]">효과음 사용</span>
          </label>
        </div>
      </section>

      {/* 보스 이미지 프리뷰 에디터 */}
      <section className={sectionClass}>
        <h3>🖼️ 보스 이미지 프리뷰</h3>
        <p className={sectionDescriptionClass}>
          보스 이미지 위치와 스케일을 미리 확인합니다.
        </p>
        <BossImagePreviewEditor />
      </section>

      {/* 미션 관리 */}
      <section className={sectionClass}>
        <div className="flex items-center justify-between">
          <div>
            <h3>📋 미션 관리</h3>
            <p className={sectionDescriptionClass}>
              매일 반복할 미션을 등록합니다. 미션 완료 시 보스에게 데미지를 줍니다.
            </p>
          </div>
          <span className="rounded-full bg-[var(--color-bg-elevated)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
            {missions.length}개
          </span>
        </div>

        {/* 새 미션 추가 폼 */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="미션 내용 입력..."
            value={newMissionText}
            onChange={(e) => setNewMissionText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddMission()}
            className={`${inputClass} flex-1`}
          />
          <input
            type="number"
            min={5}
            max={60}
            value={newMissionDamage}
            onChange={(e) => setNewMissionDamage(Number(e.target.value))}
            className={`${inputClass} w-20 text-center`}
            title="데미지 (분)"
          />
          <button
            onClick={handleAddMission}
            disabled={!newMissionText.trim()}
            className={primaryButtonClass}
          >
            + 추가
          </button>
        </div>

        {/* 미션 목록 */}
        <div className="flex flex-col gap-2">
          {missions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-6 py-8 text-center">
              <span className="text-2xl">📝</span>
              <p className="text-sm text-[var(--color-text-secondary)]">
                등록된 미션이 없습니다
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                위에서 미션을 추가해보세요!
              </p>
            </div>
          ) : (
            missions
              .sort((a, b) => a.order - b.order)
              .map((mission, index) => (
                <div
                  key={mission.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={handleDrop}
                  className={`flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 transition-all ${draggedIndex === index ? 'opacity-50' : ''
                    } ${!mission.enabled ? 'opacity-60' : ''}`}
                >
                  {/* 드래그 핸들 */}
                  <span className="cursor-grab text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]">
                    ☰
                  </span>

                  {/* 활성화 토글 */}
                  <input
                    type="checkbox"
                    checked={mission.enabled}
                    onChange={() => handleToggleMission(mission)}
                    className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)]"
                  />

                  {/* 미션 내용 */}
                  {editingMission?.id === mission.id ? (
                    <input
                      type="text"
                      value={editingMission.text}
                      onChange={(e) => setEditingMission({ ...editingMission, text: e.target.value })}
                      onBlur={handleUpdateMission}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdateMission()}
                      className={`${inputClass} flex-1 py-1`}
                      autoFocus
                    />
                  ) : (
                    <span
                      className={`flex-1 text-sm ${mission.enabled ? 'text-[var(--color-text)]' : 'text-[var(--color-text-tertiary)] line-through'}`}
                      onClick={() => setEditingMission(mission)}
                    >
                      {mission.text}
                    </span>
                  )}

                  {/* 데미지 */}
                  {editingMission?.id === mission.id ? (
                    <input
                      type="number"
                      min={5}
                      max={60}
                      value={editingMission.damage}
                      onChange={(e) => setEditingMission({ ...editingMission, damage: Number(e.target.value) })}
                      onBlur={handleUpdateMission}
                      className={`${inputClass} w-16 py-1 text-center`}
                    />
                  ) : (
                    <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">
                      💥 {mission.damage}분
                    </span>
                  )}

                  {/* 삭제 버튼 */}
                  <button
                    onClick={() => handleDeleteMission(mission.id)}
                    className="rounded-lg p-1 text-[var(--color-text-tertiary)] transition hover:bg-red-500/20 hover:text-red-400"
                    title="삭제"
                  >
                    🗑️
                  </button>
                </div>
              ))
          )}
        </div>

        <p className="text-xs text-[var(--color-text-tertiary)]">
          💡 드래그하여 순서를 변경할 수 있습니다. 체크 해제 시 전투에서 제외됩니다.
        </p>
      </section>
    </div>
  );
}
