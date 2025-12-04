import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useBattleStore } from '@/features/battle/stores/battleStore';
import type { BattleMission } from '@/shared/types/domain';
import {
  sectionClass,
  sectionDescriptionClass,
  inputClass,
  primaryButtonClass,
} from '../styles';

/** 쿨다운 프리셋 옵션 */
const COOLDOWN_PRESETS = [
  { value: 0, label: '하루 1회' },
  { value: 30, label: '30분' },
  { value: 60, label: '1시간' },
  { value: 120, label: '2시간' },
  { value: 180, label: '3시간' },
  { value: 240, label: '4시간' },
  { value: 360, label: '6시간' },
];

export function BattleMissionsSection() {
  // 개별 selector 사용으로 getSnapshot 캐싱 경고 방지
  const missions = useBattleStore(state => state.missions);
  const settings = useBattleStore(state => state.settings);
  const addMission = useBattleStore(state => state.addMission);
  const updateMission = useBattleStore(state => state.updateMission);
  const deleteMission = useBattleStore(state => state.deleteMission);
  const reorderMissions = useBattleStore(state => state.reorderMissions);

  const [newMissionText, setNewMissionText] = useState('');
  const [newMissionDamage, setNewMissionDamage] = useState(15);
  const [editingMissionId, setEditingMissionId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'text' | 'damage' | 'cooldown' | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [orderedMissions, setOrderedMissions] = useState<BattleMission[]>([]);
  const orderedMissionsRef = useRef<BattleMission[]>([]);

  const sortedMissions = useMemo(
    () => [...missions].sort((a, b) => a.order - b.order),
    [missions],
  );

  useEffect(() => {
    if (!editingMissionId) {
      setOrderedMissions(sortedMissions);
      orderedMissionsRef.current = sortedMissions;
    }
  }, [sortedMissions, editingMissionId]);

  const handleAddMission = async () => {
    if (!newMissionText.trim()) return;
    await addMission(newMissionText.trim(), newMissionDamage);
    setNewMissionText('');
    setNewMissionDamage(settings.defaultMissionDamage);
  };

  const startEditing = (mission: BattleMission, field: 'text' | 'damage' | 'cooldown') => {
    setEditingMissionId(mission.id);
    setEditingField(field);
    if (field === 'text') {
      setEditingValue(mission.text);
    } else if (field === 'damage') {
      setEditingValue(String(mission.damage));
    } else {
      setEditingValue(String(mission.cooldownMinutes ?? 0));
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMissionId || !editingField) return;
    
    let updates: Partial<BattleMission>;
    if (editingField === 'text') {
      updates = { text: editingValue.trim() || '미션' };
    } else if (editingField === 'damage') {
      updates = { damage: Math.max(5, Math.min(120, Number(editingValue) || 15)) };
    } else {
      updates = { cooldownMinutes: Math.max(0, Number(editingValue) || 0) };
    }
    
    await updateMission(editingMissionId, updates);
    setEditingMissionId(null);
    setEditingField(null);
    setEditingValue('');
  };

  const handleCancelEdit = () => {
    setEditingMissionId(null);
    setEditingField(null);
    setEditingValue('');
  };

  const handleDeleteMission = async (missionId: string) => {
    if (!confirm('이 미션을 삭제하시겠습니까?')) return;
    await deleteMission(missionId);
  };

  const handleToggleMission = async (mission: BattleMission) => {
    await updateMission(mission.id, { enabled: !mission.enabled });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setOrderedMissions(prev => {
      const updated = [...prev];
      const [dragged] = updated.splice(draggedIndex, 1);
      updated.splice(index, 0, dragged);
      orderedMissionsRef.current = updated;
      return updated;
    });
    setDraggedIndex(index);
  };

  const handleDrop = async () => {
    if (draggedIndex === null) return;
    await reorderMissions(orderedMissionsRef.current);
    setDraggedIndex(null);
  };

  // 쿨다운 표시 포맷
  const formatCooldown = (minutes: number) => {
    if (!minutes || minutes <= 0) return '1회';
    if (minutes < 60) return `${minutes}분`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  };

  // 통계 계산
  const stats = useMemo(() => {
    const enabled = missions.filter(m => m.enabled);
    const totalDamage = enabled.reduce((sum, m) => sum + m.damage, 0);
    const withCooldown = enabled.filter(m => m.cooldownMinutes && m.cooldownMinutes > 0).length;
    return { enabled: enabled.length, total: missions.length, totalDamage, withCooldown };
  }, [missions]);

  return (
    <section className={sectionClass}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3>📋 미션 관리</h3>
          <p className={sectionDescriptionClass}>
            매일 반복할 미션을 등록합니다. 미션 완료 시 보스에게 데미지를 줍니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-green-500/20 px-2 py-1 text-xs font-semibold text-green-400">
            활성 {stats.enabled}개
          </span>
          <span className="rounded-full bg-red-500/20 px-2 py-1 text-xs font-semibold text-red-400">
            총 {stats.totalDamage}분
          </span>
          {stats.withCooldown > 0 && (
            <span className="rounded-full bg-cyan-500/20 px-2 py-1 text-xs font-semibold text-cyan-400">
              🔄 {stats.withCooldown}
            </span>
          )}
        </div>
      </div>

      {/* 새 미션 추가 */}
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
          max={120}
          value={newMissionDamage}
          onChange={(e) => setNewMissionDamage(Number(e.target.value))}
          className={`${inputClass} w-16 text-center`}
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

      {/* 미션 리스트 - 컴팩트 테이블 스타일 */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] overflow-hidden">
        {missions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-8 text-center">
            <span className="text-2xl">📝</span>
            <p className="text-sm text-[var(--color-text-secondary)]">등록된 미션이 없습니다</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">위에서 미션을 추가해보세요!</p>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            {/* 테이블 헤더 */}
            <div className="sticky top-0 z-10 flex items-center gap-2 bg-[var(--color-bg-elevated)] border-b border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-text-tertiary)]">
              <span className="w-6"></span>
              <span className="w-6"></span>
              <span className="flex-1">미션 내용</span>
              <span className="w-14 text-center">데미지</span>
              <span className="w-16 text-center">쿨다운</span>
              <span className="w-8"></span>
            </div>
            
            {/* 미션 행들 */}
            {orderedMissions.map((mission, index) => (
              <div
                key={mission.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={handleDrop}
                className={`flex items-center gap-2 px-3 py-1.5 border-b border-[var(--color-border)]/50 transition-all hover:bg-[var(--color-bg-hover)] ${
                  draggedIndex === index ? 'opacity-50 bg-[var(--color-primary)]/10' : ''
                } ${!mission.enabled ? 'opacity-50' : ''}`}
              >
                {/* 드래그 핸들 */}
                <span className="w-6 cursor-grab text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] text-center">
                  ⋮⋮
                </span>

                {/* 활성화 체크박스 */}
                <input
                  type="checkbox"
                  checked={mission.enabled}
                  onChange={() => handleToggleMission(mission)}
                  className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] cursor-pointer"
                />

                {/* 미션 텍스트 */}
                {editingMissionId === mission.id && editingField === 'text' ? (
                  <input
                    type="text"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={handleSaveEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className="flex-1 bg-[var(--color-bg)] border border-[var(--color-primary)] rounded px-2 py-0.5 text-sm outline-none"
                    autoFocus
                  />
                ) : (
                  <span
                    className={`flex-1 text-sm cursor-pointer truncate hover:text-[var(--color-primary)] ${
                      mission.enabled ? 'text-[var(--color-text)]' : 'text-[var(--color-text-tertiary)] line-through'
                    }`}
                    onClick={() => startEditing(mission, 'text')}
                    title={mission.text}
                  >
                    {mission.text}
                  </span>
                )}

                {/* 데미지 */}
                {editingMissionId === mission.id && editingField === 'damage' ? (
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={handleSaveEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className="w-14 bg-[var(--color-bg)] border border-[var(--color-primary)] rounded px-1 py-0.5 text-xs text-center outline-none"
                    autoFocus
                  />
                ) : (
                  <span 
                    className="w-14 text-center rounded bg-red-500/20 px-1.5 py-0.5 text-xs font-semibold text-red-400 cursor-pointer hover:bg-red-500/30 transition"
                    onClick={() => startEditing(mission, 'damage')}
                    title="클릭하여 수정"
                  >
                    {mission.damage}분
                  </span>
                )}

                {/* 쿨다운 */}
                {editingMissionId === mission.id && editingField === 'cooldown' ? (
                  <select
                    value={editingValue}
                    onChange={(e) => {
                      setEditingValue(e.target.value);
                    }}
                    onBlur={handleSaveEdit}
                    className="w-16 bg-[var(--color-bg)] border border-[var(--color-primary)] rounded px-1 py-0.5 text-xs text-center outline-none"
                    autoFocus
                  >
                    {COOLDOWN_PRESETS.map(preset => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span 
                    className={`w-16 text-center rounded px-1.5 py-0.5 text-xs font-semibold cursor-pointer transition ${
                      mission.cooldownMinutes && mission.cooldownMinutes > 0
                        ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                        : 'bg-slate-500/20 text-slate-400 hover:bg-slate-500/30'
                    }`}
                    onClick={() => startEditing(mission, 'cooldown')}
                    title="클릭하여 쿨다운 설정"
                  >
                    {formatCooldown(mission.cooldownMinutes ?? 0)}
                  </span>
                )}

                {/* 삭제 버튼 */}
                <button
                  onClick={() => handleDeleteMission(mission.id)}
                  className="w-8 text-center text-[var(--color-text-tertiary)] hover:text-red-400 transition text-sm"
                  title="삭제"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 도움말 */}
      <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
        <span>💡 드래그로 순서 변경 • 클릭하여 수정 • 쿨다운 0 = 하루 1회</span>
        <span>ESC로 취소</span>
      </div>
    </section>
  );
}
