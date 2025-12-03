import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useBattleStore } from '@/features/battle/stores/battleStore';
import type { BattleMission } from '@/shared/types/domain';
import {
  sectionClass,
  sectionDescriptionClass,
  formGroupClass,
  inputClass,
  primaryButtonClass,
} from '../styles';

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
  const [editingMission, setEditingMission] = useState<BattleMission | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [orderedMissions, setOrderedMissions] = useState<BattleMission[]>([]);
  const orderedMissionsRef = useRef<BattleMission[]>([]);

  const sortedMissions = useMemo(
    () => [...missions].sort((a, b) => a.order - b.order),
    [missions],
  );

  useEffect(() => {
    setOrderedMissions(sortedMissions);
    orderedMissionsRef.current = sortedMissions;
  }, [sortedMissions]);

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

  return (
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

      <div className="flex flex-col gap-2">
        {missions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-6 py-8 text-center">
            <span className="text-2xl">📝</span>
            <p className="text-sm text-[var(--color-text-secondary)]">등록된 미션이 없습니다</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">위에서 미션을 추가해보세요!</p>
          </div>
        ) : (
          orderedMissions.map((mission, index) => (
              <div
                key={mission.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={handleDrop}
                className={`flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 transition-all ${
                  draggedIndex === index ? 'opacity-50' : ''
                } ${!mission.enabled ? 'opacity-60' : ''}`}
              >
                <span className="cursor-grab text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]">
                  ☰
                </span>

                <input
                  type="checkbox"
                  checked={mission.enabled}
                  onChange={() => handleToggleMission(mission)}
                  className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)]"
                />

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
                    className={`flex-1 text-sm ${
                      mission.enabled
                        ? 'text-[var(--color-text)]'
                        : 'text-[var(--color-text-tertiary)] line-through'
                    }`}
                    onClick={() => setEditingMission(mission)}
                  >
                    {mission.text}
                  </span>
                )}

                {editingMission?.id === mission.id ? (
                  <input
                    type="number"
                    min={5}
                    max={60}
                    value={editingMission.damage}
                    onChange={(e) =>
                      setEditingMission({ ...editingMission, damage: Number(e.target.value) })
                    }
                    onBlur={handleUpdateMission}
                    className={`${inputClass} w-16 py-1 text-center`}
                  />
                ) : (
                  <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">
                    💥 {mission.damage}분
                  </span>
                )}

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
  );
}
