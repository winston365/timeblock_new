/**
 * 템플릿 관리 모달
 *
 * @role 스케줄 템플릿 저장/불러오기/삭제/고정
 * @dependencies useTempScheduleStore
 */

import { memo, useState, useCallback, useMemo } from 'react';
import { useTempScheduleStore } from '../stores/tempScheduleStore';
import type { TempScheduleTemplate } from '@/shared/types/tempSchedule';
import { useModalHotkeys } from '@/shared/hooks';
import { Pin, PinOff } from 'lucide-react';

// ============================================================================
// Sub Components
// ============================================================================

interface TemplateItemProps {
  template: TempScheduleTemplate;
  isPinned: boolean;
  onApply: (template: TempScheduleTemplate) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
}

const TemplateItem = memo(function TemplateItem({ 
  template, 
  isPinned,
  onApply, 
  onDelete,
  onTogglePin,
}: TemplateItemProps) {
  const dateObj = new Date(template.createdAt);
  const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

  return (
    <div className={`group flex items-center gap-3 rounded-xl border p-3 transition-all ${
      isPinned 
        ? 'border-amber-500/50 bg-amber-500/10' 
        : 'border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[var(--color-primary)]/50'
    }`}>
      {/* 아이콘 */}
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
        isPinned ? 'bg-amber-500/20 text-amber-400' : 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
      }`}>
        {isPinned ? '📌' : '📋'}
      </div>

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isPinned && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold">
              고정됨
            </span>
          )}
          <span className="font-semibold text-sm text-[var(--color-text)] truncate">
            {template.name}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
          <span>{template.tasks.length}개 스케줄</span>
          <span>•</span>
          <span>{formattedDate} 저장</span>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center gap-1">
        {/* 고정/해제 버튼 */}
        <button
          className={`p-1.5 rounded-lg transition-colors ${
            isPinned 
              ? 'text-amber-400 hover:bg-amber-500/20' 
              : 'text-[var(--color-text-tertiary)] hover:text-amber-400 hover:bg-amber-500/10'
          }`}
          onClick={() => onTogglePin(template.id)}
          title={isPinned ? '고정 해제' : '상단 고정'}
        >
          {isPinned ? <Pin size={16} className="fill-current" /> : <PinOff size={16} />}
        </button>
        
        <button
          className="px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-xs font-semibold hover:bg-[var(--color-primary-dark)] transition-colors"
          onClick={() => onApply(template)}
        >
          적용
        </button>
        <button
          className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
          onClick={() => {
            if (confirm('이 템플릿을 삭제하시겠습니까?')) {
              onDelete(template.id);
            }
          }}
          title="삭제"
        >
          🗑️
        </button>
      </div>
    </div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

function TemplateModalComponent() {
  const {
    isTemplateModalOpen,
    closeTemplateModal,
    templates,
    pinnedTemplateIds,
    toggleTemplatePin,
    saveAsTemplate,
    removeTemplate,
    applyTemplateToDate,
    selectedDate,
    getTasksForDate,
    loadData,
  } = useTempScheduleStore();

  const [newTemplateName, setNewTemplateName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tasksForDate = getTasksForDate(selectedDate);
  const canSave = tasksForDate.length > 0 && newTemplateName.trim().length > 0;

  // 템플릿을 핀된 것 먼저, 그 다음 최신순으로 정렬
  const sortedTemplates = useMemo(() => {
    return [...templates].sort((a, b) => {
      const aPinned = pinnedTemplateIds.includes(a.id);
      const bPinned = pinnedTemplateIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      // 같은 그룹 내에서는 최신순
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [templates, pinnedTemplateIds]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;

    setIsSaving(true);
    setError(null);

    try {
      await saveAsTemplate(newTemplateName.trim());
      setNewTemplateName('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  }, [canSave, newTemplateName, saveAsTemplate]);

  useModalHotkeys({
    isOpen: isTemplateModalOpen,
    onEscapeClose: closeTemplateModal,
    primaryAction: {
      enabled: canSave && !isSaving,
      onPrimary: handleSave,
      allowInInput: true,
    },
  });

  const handleApply = useCallback(async (template: TempScheduleTemplate) => {
    try {
      await applyTemplateToDate(template);
      await loadData();
      closeTemplateModal();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [applyTemplateToDate, loadData, closeTemplateModal]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await removeTemplate(id);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [removeTemplate]);

  if (!isTemplateModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-base)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text)]">📋 템플릿 관리</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              자주 쓰는 스케줄 패턴을 저장하고 불러오세요
            </p>
          </div>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
            onClick={closeTemplateModal}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* 에러 메시지 */}
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* 새 템플릿 저장 */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)]">
              현재 날짜 스케줄을 템플릿으로 저장
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="템플릿 이름 (예: 평일 루틴)"
                className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSave) {
                    handleSave();
                  }
                }}
              />
              <button
                className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSave}
                disabled={!canSave || isSaving}
              >
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>
            {tasksForDate.length === 0 && (
              <p className="text-[10px] text-[var(--color-text-tertiary)]">
                ⚠️ 현재 날짜에 스케줄이 없어 저장할 수 없습니다
              </p>
            )}
            {tasksForDate.length > 0 && (
              <p className="text-[10px] text-[var(--color-text-tertiary)]">
                {selectedDate} 날짜의 {tasksForDate.length}개 스케줄이 저장됩니다
              </p>
            )}
          </div>

          {/* 구분선 */}
          <div className="border-t border-[var(--color-border)]" />

          {/* 저장된 템플릿 목록 */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)]">
              저장된 템플릿 ({templates.length})
            </label>

            {templates.length === 0 ? (
              <div className="text-center py-8 text-[var(--color-text-tertiary)]">
                <div className="text-3xl mb-2">📋</div>
                <p className="text-sm">저장된 템플릿이 없습니다</p>
                <p className="text-xs mt-1">위에서 현재 스케줄을 템플릿으로 저장해보세요</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedTemplates.map(template => (
                  <TemplateItem
                    key={template.id}
                    template={template}
                    isPinned={pinnedTemplateIds.includes(template.id)}
                    onApply={handleApply}
                    onDelete={handleDelete}
                    onTogglePin={toggleTemplatePin}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] px-5 py-3 text-xs text-[var(--color-text-tertiary)]">
          💡 템플릿을 적용하면 현재 날짜에 스케줄이 추가됩니다
        </div>
      </div>
    </div>
  );
}

export const TemplateModal = memo(TemplateModalComponent);
export default TemplateModal;
