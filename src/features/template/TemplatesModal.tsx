/**
 * TemplatesModal - 템플릿 관리 전체 화면 모달
 *
 * @role 반복 작업 템플릿을 관리하고 오늘 할 일로 추가하는 전체 화면 모달 컴포넌트
 * @input isOpen (모달 표시 여부), onClose (모달 닫기 핸들러), onTaskCreate (템플릿에서 작업 생성 시 콜백)
 * @output 템플릿 목록, 검색, 복제, 자동 생성 배지, 추가/편집/삭제 버튼을 포함한 모달 UI
 * @external_dependencies
 *   - loadTemplates, deleteTemplate, createTemplate: 템플릿 Repository
 *   - TemplateModal: 템플릿 추가/편집 모달 컴포넌트
 *   - utils: XP 계산 함수
 */

import { useState, useEffect, useMemo } from 'react';
import type { Template } from '@/shared/types/domain';
import { loadTemplates, deleteTemplate as deleteTemplateRepo, createTemplate } from '@/data/repositories';
import { getTemplateCategories } from '@/data/repositories/settingsRepository';
import { TemplateModal } from './TemplateModal';
import { RESISTANCE_LABELS, TIME_BLOCKS } from '@/shared/types/domain';
import { calculateTaskXP } from '@/shared/lib/utils';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreate: (template: Template) => void;
}

export default function TemplatesModal({ isOpen, onClose, onTaskCreate }: TemplatesModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showDailyOnly, setShowDailyOnly] = useState(false);
  const [showUpcomingOnly, setShowUpcomingOnly] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isTemplateModalOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, isTemplateModalOpen, onClose]);

  // 템플릿 및 카테고리 로드
  useEffect(() => {
    if (isOpen) {
      loadTemplatesData();
      loadCategoriesData();
    }
  }, [isOpen]);

  const loadTemplatesData = async () => {
    const data = await loadTemplates();
    setTemplates(data);
  };

  const loadCategoriesData = async () => {
    const cats = await getTemplateCategories();
    setCategories(cats);
  };

  /**
   * 다음 주기까지의 일수 계산 (필터링용)
   */
  const getDaysUntilNextOccurrence = (template: Template): number | null => {
    if (!template.autoGenerate || template.recurrenceType === 'none') return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastGenerated = template.lastGeneratedDate
      ? new Date(template.lastGeneratedDate)
      : new Date(today);
    lastGenerated.setHours(0, 0, 0, 0);

    let nextDate: Date;

    switch (template.recurrenceType) {
      case 'daily':
        nextDate = new Date(lastGenerated);
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        if (!template.weeklyDays || template.weeklyDays.length === 0) return null;
        const currentDay = today.getDay();
        const sortedDays = [...template.weeklyDays].sort((a, b) => a - b);
        let nextDay = sortedDays.find(day => day > currentDay);
        let daysUntil = nextDay !== undefined ? nextDay - currentDay : (7 - currentDay + sortedDays[0]);
        nextDate = new Date(today);
        nextDate.setDate(nextDate.getDate() + daysUntil);

        if (template.lastGeneratedDate) {
          const lastGen = new Date(template.lastGeneratedDate);
          lastGen.setHours(0, 0, 0, 0);
          if (lastGen.getTime() >= today.getTime()) {
            nextDate.setDate(nextDate.getDate() + 7);
          }
        }
        break;
      case 'interval':
        if (!template.intervalDays) return null;
        nextDate = new Date(lastGenerated);
        nextDate.setDate(nextDate.getDate() + template.intervalDays);
        break;
      default:
        return null;
    }

    const diffTime = nextDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  /**
   * 다음 주기 날짜 표시 문자열 생성
   */
  const getNextOccurrenceLabel = (template: Template): string | null => {
    const days = getDaysUntilNextOccurrence(template);
    if (days === null) return null;

    if (days <= 0) return '오늘';
    if (days === 1) return '내일';
    if (days === 2) return '모레';
    if (days < 7) return `${days}일 후`;

    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + days);

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const date = targetDate.getDate();
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][targetDate.getDay()];

    if (year !== today.getFullYear()) {
      return `${year}년 ${month}월 ${date}일 (${weekday})`;
    }

    return `${month}월 ${date}일 (${weekday})`;
  };

  // 필터링 로직
  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(template => template.category === selectedCategory);
    }

    if (showFavoritesOnly) {
      filtered = filtered.filter(template => template.isFavorite);
    }

    if (showDailyOnly) {
      filtered = filtered.filter(template => template.autoGenerate && template.recurrenceType === 'daily');
    }

    if (showUpcomingOnly) {
      filtered = filtered.filter(template => {
        const days = getDaysUntilNextOccurrence(template);
        return days !== null && days <= 7;
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(query) ||
        template.text.toLowerCase().includes(query) ||
        template.memo.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [templates, searchQuery, selectedCategory, showFavoritesOnly, showDailyOnly, showUpcomingOnly]);

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setIsTemplateModalOpen(true);
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setIsTemplateModalOpen(true);
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

  const handleTemplateModalClose = async (saved: boolean) => {
    setIsTemplateModalOpen(false);
    setEditingTemplate(null);
    if (saved) {
      await loadTemplatesData();
    }
  };

  const handleAddToToday = (template: Template) => {
    onTaskCreate(template);
  };

  const handleCloneTemplate = async (template: Template) => {
    try {
      const clonedTemplate = await createTemplate(
        `${template.name} (복사)`,
        template.text,
        template.memo,
        template.baseDuration,
        template.resistance,
        template.timeBlock,
        false,
        template.preparation1,
        template.preparation2,
        template.preparation3,
        'none',
        [],
        1,
        template.category,
        false,
        template.imageUrl
      );
      setTemplates(prevTemplates => [...prevTemplates, clonedTemplate]);
      alert('✅ 템플릿이 복제되었습니다.');
    } catch (error) {
      console.error('Failed to clone template:', error);
      alert('템플릿 복제에 실패했습니다.');
    }
  };

  const getTimeBlockLabel = (blockId: string | null): string => {
    if (!blockId) return '인박스';
    const block = TIME_BLOCKS.find(b => b.id === blockId);
    return block ? block.label : '인박스';
  };

  const getEstimatedXP = (template: Template) => {
    const tempTask: any = {
      baseDuration: template.baseDuration,
      adjustedDuration: template.baseDuration,
      actualDuration: 0,
      resistance: template.resistance,
      preparation1: template.preparation1,
      preparation2: template.preparation2,
      preparation3: template.preparation3,
    };
    return calculateTaskXP(tempTask);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8" onClick={onClose}>
      <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-base)] shadow-2xl" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text)]">📝 템플릿 관리</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">자주 사용하는 작업을 템플릿으로 저장하세요</p>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-primary-dark)] active:scale-95"
              onClick={handleAddTemplate}
            >
              + 추가
            </button>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]/50 px-6 py-3 md:flex-row md:items-center">
          {/* Search */}
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 focus-within:border-[var(--color-primary)] focus-within:ring-1 focus-within:ring-[var(--color-primary)]">
            <span className="text-[var(--color-text-tertiary)]">🔍</span>
            <input
              type="text"
              className="flex-1 bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-tertiary)]"
              placeholder="검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]">✕</button>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <button
              className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${showDailyOnly
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                }`}
              onClick={() => setShowDailyOnly(!showDailyOnly)}
            >
              🔄 매일
            </button>
            <button
              className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${showUpcomingOnly
                ? 'border-[var(--color-success)] bg-[var(--color-success)]/10 text-[var(--color-success)]'
                : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                }`}
              onClick={() => setShowUpcomingOnly(!showUpcomingOnly)}
            >
              📅 7일 이내
            </button>
            <button
              className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${showFavoritesOnly
                ? 'border-[var(--color-warning)] bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
                : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                }`}
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            >
              ⭐ 즐겨찾기
            </button>

            <select
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">모든 카테고리</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-[var(--color-bg-base)] p-6">
          {filteredTemplates.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-[var(--color-text-tertiary)]">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-bg-surface)] text-3xl">
                {searchQuery ? '🔍' : '📝'}
              </div>
              <p className="text-base font-medium">
                {searchQuery ? '검색 결과가 없습니다' : '등록된 템플릿이 없습니다'}
              </p>
              {!searchQuery && (
                <button
                  className="text-sm text-[var(--color-primary)] hover:underline"
                  onClick={handleAddTemplate}
                >
                  첫 번째 템플릿을 만들어보세요!
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredTemplates.map(template => {
                const nextOccurrence = getNextOccurrenceLabel(template);
                return (
                  <div
                    key={template.id}
                    className="group relative flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] transition-all hover:-translate-y-1 hover:border-[var(--color-primary)]/50 hover:shadow-lg"
                    onDoubleClick={() => handleEditTemplate(template)}
                  >
                    {/* Thumbnail - Reduced Height */}
                    <div className="relative h-32 w-full overflow-hidden bg-[var(--color-bg-tertiary)]">
                      {template.imageUrl ? (
                        <img
                          src={template.imageUrl}
                          alt={template.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-3xl opacity-20">
                          📝
                        </div>
                      )}

                      {/* Badges overlay */}
                      <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                        {template.isFavorite && (
                          <span className="rounded bg-yellow-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                            ⭐
                          </span>
                        )}
                        {template.autoGenerate && (
                          <span className="rounded bg-[var(--color-primary)]/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                            🔄 자동
                          </span>
                        )}
                        {nextOccurrence && (
                          <span className="rounded bg-[var(--color-bg-elevated)]/90 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-text)] shadow-sm ring-1 ring-[var(--color-border)]">
                            📅 {nextOccurrence}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content - Reduced Padding */}
                    <div className="flex flex-1 flex-col gap-2 p-3 pb-4"> {/* Added pb-4 for better spacing */}
                      <div className="flex items-start justify-between gap-2">
                        {/* Allowed 2 lines for title */}
                        <h3 className="text-sm font-bold text-[var(--color-text)] line-clamp-2 leading-tight" title={template.name}>
                          {template.name}
                        </h3>
                        <span className="shrink-0 rounded bg-[var(--color-bg-elevated)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-reward)]">
                          💎 {getEstimatedXP(template)}
                        </span>
                      </div>

                      {/* Compact Badges */}
                      <div className="flex flex-wrap gap-1 text-[10px] font-medium text-[var(--color-text-tertiary)]">
                        <span className="rounded bg-[var(--color-bg-elevated)] px-1.5 py-0.5">
                          ⏱️ {template.baseDuration}분
                        </span>
                        <span className="rounded bg-[var(--color-bg-elevated)] px-1.5 py-0.5">
                          ⚡ {RESISTANCE_LABELS[template.resistance]}
                        </span>
                        <span className="rounded bg-[var(--color-bg-elevated)] px-1.5 py-0.5">
                          📍 {getTimeBlockLabel(template.timeBlock)}
                        </span>
                      </div>
                    </div>

                    {/* Actions (Hover only) - Absolute Positioned to remove layout space */}
                    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-bg-base)]/95 px-3 py-2 backdrop-blur-sm transition-transform duration-300 translate-y-full group-hover:translate-y-0">
                      <div className="flex gap-1">
                        <button
                          className="rounded p-1 text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]"
                          onClick={() => handleEditTemplate(template)}
                          title="수정"
                        >
                          ✏️
                        </button>
                        <button
                          className="rounded p-1 text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]"
                          onClick={() => handleCloneTemplate(template)}
                          title="복제"
                        >
                          📋
                        </button>
                        <button
                          className="rounded p-1 text-[var(--color-text-tertiary)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
                          onClick={() => handleDeleteTemplate(template.id)}
                          title="삭제"
                        >
                          🗑️
                        </button>
                      </div>
                      <button
                        className="rounded bg-[var(--color-primary)] px-2 py-1 text-xs font-bold text-white shadow-sm hover:bg-[var(--color-primary-dark)]"
                        onClick={() => handleAddToToday(template)}
                      >
                        추가
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 py-3 text-xs text-[var(--color-text-tertiary)]">
          총 {templates.length}개의 템플릿
        </div>
      </div>

      {/* 템플릿 추가/편집 모달 */}
      {isTemplateModalOpen && (
        <TemplateModal
          template={editingTemplate}
          onClose={handleTemplateModalClose}
        />
      )}
    </div>
  );
}
