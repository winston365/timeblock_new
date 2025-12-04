/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file TemplatePanel.tsx
 * @description 사이드바용 템플릿 관리 패널 컴포넌트
 *
 * @role 반복 작업 템플릿 목록 조회 및 오늘 할 일 추가 기능 제공
 * @responsibilities
 *   - 템플릿 목록 표시 (카테고리별 탭 필터링)
 *   - 템플릿 추가/편집/삭제 기능
 *   - 템플릿에서 오늘 할 일 생성
 *   - 예상 XP 표시
 * @dependencies
 *   - loadTemplates, deleteTemplate: 템플릿 Repository
 *   - TemplateModal: 템플릿 추가/편집 모달
 *   - calculateTaskXP: XP 계산 유틸리티
 */

import { useState, useEffect, useMemo } from 'react';
import type { Template } from '@/shared/types/domain';
import { loadTemplates, deleteTemplate as deleteTemplateRepo } from '@/data/repositories';
import { TemplateModal } from './TemplateModal';
import { RESISTANCE_LABELS, TIME_BLOCKS } from '@/shared/types/domain';
import { calculateTaskXP } from '@/shared/lib/utils';

interface TemplatePanelProps {
  onTaskCreate: (template: Template) => void;
}

/**
 * 사이드바용 템플릿 관리 패널 컴포넌트
 *
 * @param props - 컴포넌트 속성
 * @param props.onTaskCreate - 템플릿에서 작업 생성 시 콜백
 * @returns 템플릿 목록 및 카테고리 탭이 포함된 패널 UI
 */
export default function TemplatePanel({ onTaskCreate }: TemplatePanelProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('전체');

  // 템플릿 로드
  useEffect(() => {
    loadTemplatesData();
  }, []);

  const loadTemplatesData = async () => {
    const data = await loadTemplates();
    setTemplates(data);
  };

  // 카테고리 목록 추출 (중복 제거 + '전체' 포함)
  const categories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category || '기타').filter(Boolean));
    return ['전체', ...Array.from(cats).sort()];
  }, [templates]);

  // 필터링된 템플릿 목록
  const filteredTemplates = useMemo(() => {
    if (activeCategory === '전체') return templates;
    return templates.filter(t => (t.category || '기타') === activeCategory);
  }, [templates, activeCategory]);

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setIsModalOpen(true);
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setIsModalOpen(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('이 템플릿을 삭제하시겠습니까?')) return;

    try {
      setTemplates(prevTemplates => prevTemplates.filter(t => t.id !== id));
      await deleteTemplateRepo(id);
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('템플릿 삭제에 실패했습니다.');
      await loadTemplatesData();
    }
  };

  const handleModalClose = async (saved: boolean) => {
    setIsModalOpen(false);
    setEditingTemplate(null);
    if (saved) {
      await loadTemplatesData();
    }
  };

  const handleAddToToday = (template: Template) => {
    onTaskCreate(template);
  };

  const getTimeBlockLabel = (blockId: string | null): string => {
    if (!blockId) return '인박스';
    const block = TIME_BLOCKS.find(b => b.id === blockId);
    return block ? block.label : '인박스';
  };

  // 예상 XP 계산 (Task로 변환하여 계산)
  const getEstimatedXP = (template: Template) => {
    return calculateTaskXP({
      adjustedDuration: template.baseDuration,
      actualDuration: 0,
      resistance: template.resistance,
    });
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-4 text-[var(--color-text)]">
      {/* Header & Add Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">📝 템플릿</h3>
        <button
          className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--color-primary-dark)] active:scale-95"
          onClick={handleAddTemplate}
        >
          + 추가
        </button>
      </div>

      {/* Category Tabs */}
      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${activeCategory === cat
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                }`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Template List */}
      {filteredTemplates.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-surface)]/50 px-6 py-10 text-center text-xs text-[var(--color-text-secondary)]">
          <p className="font-medium text-[var(--color-text)]">템플릿이 없습니다</p>
          <p>자주 하는 작업을 템플릿으로 등록해보세요!</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {filteredTemplates.map(template => (
            <div
              key={template.id}
              className="group relative flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 transition-all hover:border-[var(--color-primary)]/50 hover:shadow-sm"
            >
              {/* Header: Name & Auto Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <strong className="text-sm font-bold text-[var(--color-text)]">{template.name}</strong>
                  {template.autoGenerate && (
                    <span className="rounded-md bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-primary)]">
                      매일 반복
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    className="rounded p-1 text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)]"
                    onClick={() => handleEditTemplate(template)}
                    title="수정"
                  >
                    ✏️
                  </button>
                  <button
                    className="rounded p-1 text-[var(--color-text-tertiary)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
                    onClick={() => handleDeleteTemplate(template.id)}
                    title="삭제"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Thumbnail Image */}
              {template.imageUrl && (
                <div className="relative h-32 w-full overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)]">
                  <img
                    src={template.imageUrl}
                    alt={template.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Content: Text & Memo */}
              <div className="flex flex-col gap-1">
                <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">{template.text}</p>
                {template.memo && (
                  <p className="text-[10px] text-[var(--color-text-tertiary)] line-clamp-1">💭 {template.memo}</p>
                )}
              </div>

              {/* Metadata Badges */}
              <div className="flex flex-wrap gap-2 text-[10px] font-medium text-[var(--color-text-secondary)]">
                <span className="flex items-center gap-1 rounded bg-[var(--color-bg-elevated)] px-1.5 py-0.5">
                  ⏱️ {template.baseDuration}분
                </span>
                <span className="flex items-center gap-1 rounded bg-[var(--color-bg-elevated)] px-1.5 py-0.5">
                  ⚡ {RESISTANCE_LABELS[template.resistance]}
                </span>
                <span className="flex items-center gap-1 rounded bg-[var(--color-bg-elevated)] px-1.5 py-0.5">
                  📍 {getTimeBlockLabel(template.timeBlock)}
                </span>
                <span className="flex items-center gap-1 rounded bg-[var(--color-bg-elevated)] px-1.5 py-0.5 text-[var(--color-reward)]">
                  💎 {getEstimatedXP(template)} XP
                </span>
              </div>

              {/* Action Button */}
              <button
                className="mt-1 w-full rounded-lg bg-[var(--color-bg-elevated)] py-2 text-xs font-bold text-[var(--color-primary)] transition hover:bg-[var(--color-primary)] hover:text-white active:scale-[0.98]"
                onClick={() => handleAddToToday(template)}
              >
                오늘 할 일에 추가
              </button>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <TemplateModal
          template={editingTemplate}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
