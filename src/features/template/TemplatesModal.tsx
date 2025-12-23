/**
 * @file TemplatesModal.tsx
 * @description 템플릿 관리 전체 화면 모달 컴포넌트 (UX v1 개선)
 *
 * @role 반복 작업 템플릿 목록 조회, 검색, 필터링, CRUD 및 작업 생성 제공
 * @responsibilities
 *   - 템플릿 목록 표시 (카드 그리드 레이아웃)
 *   - 검색 및 필터링 (카테고리, 즐겨찾기, 매일, 7일 이내)
 *   - 템플릿 추가/편집/삭제/복제 기능
 *   - 템플릿에서 오늘 할 일 생성
 *   - 다음 생성일 표시 및 정렬
 *   - 정렬 기본값 systemState 저장
 *   - 자동생성 미리보기 패널
 *   - 오늘 집중 하이라이트
 * @dependencies
 *   - useTemplateStore: 템플릿 상태 관리 스토어
 *   - TemplateModal: 템플릿 추가/편집 모달
 *   - templateTaskService: 통합 파이프라인
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { RESISTANCE_LABELS, TIME_BLOCKS, type Template } from '@/shared/types/domain';
import { useTemplateStore } from '@/shared/stores/templateStore';
import { TemplateModal } from './TemplateModal';
import { calculateTaskXP, getLocalDate } from '@/shared/lib/utils';
import { useModalEscapeClose } from '@/shared/hooks';
import {
  createTodayTaskFromTemplate,
  loadTemplateUiPrefs,
  saveTemplateUiPrefs,
  loadAutoGenerateState,
  isUxV1Enabled,
  type TemplateAutoGenerateState,
} from '@/shared/services/template/templateTaskService';
import { TEMPLATE_DEFAULTS } from '@/shared/constants/defaults';
import { toast } from 'react-hot-toast';

type SortBy = 'nextOccurrence' | 'name' | 'baseDuration' | 'createdAt';
type SortOrder = 'asc' | 'desc';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreate: (template: Template) => void;
}

/**
 * 템플릿 관리 전체 화면 모달 컴포넌트
 */
export default function TemplatesModal({ isOpen, onClose, onTaskCreate }: TemplatesModalProps) {
  // Store Hooks
  const { templates, categories, loadData, loadCategories, deleteTemplate, addTemplate } = useTemplateStore();

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showDailyOnly, setShowDailyOnly] = useState(false);
  const [showUpcomingOnly, setShowUpcomingOnly] = useState(false);

  // 정렬 상태 (systemState에서 로드)
  const [sortBy, setSortBy] = useState<SortBy>(TEMPLATE_DEFAULTS.defaultSortBy);
  const [sortOrder, setSortOrder] = useState<SortOrder>(TEMPLATE_DEFAULTS.defaultSortOrder);

  // 자동생성 미리보기 상태
  const [showAutoGenPreview, setShowAutoGenPreview] = useState(false);
  const [autoGenState, setAutoGenState] = useState<TemplateAutoGenerateState | null>(null);

  // Feature flag: UX v1 활성화 여부
  const [uxV1Enabled, setUxV1Enabled] = useState(true);

  // 오늘 날짜
  const today = getLocalDate();

  useModalEscapeClose(isOpen && !isTemplateModalOpen, onClose);

  // UI 환경설정 로드
  useEffect(() => {
    if (isOpen) {
      loadData();
      loadCategories();
      // Feature flag 로드
      isUxV1Enabled().then(setUxV1Enabled);
      // UX v1 활성화 시에만 환경설정 로드
      loadTemplateUiPrefs().then((prefs) => {
        setSortBy(prefs.sortBy);
        setSortOrder(prefs.sortOrder);
        if (prefs.lastCategory) setSelectedCategory(prefs.lastCategory);
        if (prefs.showFavoritesOnly) setShowFavoritesOnly(prefs.showFavoritesOnly);
      });
      loadAutoGenerateState().then(setAutoGenState);
    }
  }, [isOpen, loadData, loadCategories]);

  // 정렬 변경 시 저장
  const handleSortChange = useCallback(async (newSortBy: SortBy) => {
    const newOrder: SortOrder = sortBy === newSortBy && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(newSortBy);
    setSortOrder(newOrder);
    await saveTemplateUiPrefs({ sortBy: newSortBy, sortOrder: newOrder });
  }, [sortBy, sortOrder]);

  // 카테고리 변경 시 저장
  const handleCategoryChange = useCallback(async (category: string) => {
    setSelectedCategory(category);
    await saveTemplateUiPrefs({ lastCategory: category === 'all' ? undefined : category });
  }, []);

  /**
   * 다음 주기까지의 일수 계산 (필터링용)
   */
  const getDaysUntilNextOccurrence = useCallback((template: Template): number | null => {
    if (!template.autoGenerate || template.recurrenceType === 'none') return null;

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const lastGenerated = template.lastGeneratedDate
      ? new Date(template.lastGeneratedDate)
      : new Date(todayDate);
    lastGenerated.setHours(0, 0, 0, 0);

    let nextDate: Date;

    switch (template.recurrenceType) {
      case 'daily':
        nextDate = new Date(lastGenerated);
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly': {
        if (!template.weeklyDays || template.weeklyDays.length === 0) return null;
        const currentDay = todayDate.getDay();
        const sortedDays = [...template.weeklyDays].sort((a, b) => a - b);
        const nextDay = sortedDays.find(day => day > currentDay);
        const daysUntil = nextDay !== undefined ? nextDay - currentDay : (7 - currentDay + sortedDays[0]);
        nextDate = new Date(todayDate);
        nextDate.setDate(nextDate.getDate() + daysUntil);

        if (template.lastGeneratedDate) {
          const lastGen = new Date(template.lastGeneratedDate);
          lastGen.setHours(0, 0, 0, 0);
          if (lastGen.getTime() >= todayDate.getTime()) {
            nextDate.setDate(nextDate.getDate() + 7);
          }
        }
        break;
      }
      case 'interval':
        if (!template.intervalDays) return null;
        nextDate = new Date(lastGenerated);
        nextDate.setDate(nextDate.getDate() + template.intervalDays);
        break;
      default:
        return null;
    }

    const diffTime = nextDate.getTime() - todayDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, []);

  /**
   * 다음 주기 날짜 표시 문자열 생성
   */
  const getNextOccurrenceLabel = useCallback((template: Template): string | null => {
    const days = getDaysUntilNextOccurrence(template);
    if (days === null) return null;

    if (days <= 0) return '오늘';
    if (days === 1) return '내일';
    if (days === 2) return '모레';
    if (days < 7) return `${days}일 후`;

    const todayDate = new Date();
    const targetDate = new Date(todayDate);
    targetDate.setDate(todayDate.getDate() + days);

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const date = targetDate.getDate();
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][targetDate.getDay()];

    return `${year}년 ${month}월 ${date}일 (${weekday})`;
  }, [getDaysUntilNextOccurrence]);

  // 자동생성 대상 템플릿 (미리보기용)
  const autoGenTemplates = useMemo(() => {
    return templates.filter(template => {
      if (!template.autoGenerate) return false;
      const days = getDaysUntilNextOccurrence(template);
      return days !== null && days <= 0;
    });
  }, [templates, getDaysUntilNextOccurrence]);

  // 필터링 및 정렬 로직
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

    // 정렬
    return filtered.sort((a, b) => {
      const multiplier = sortOrder === 'asc' ? 1 : -1;

      switch (sortBy) {
        case 'nextOccurrence': {
          const daysA = getDaysUntilNextOccurrence(a);
          const daysB = getDaysUntilNextOccurrence(b);

          // 둘 다 주기가 있는 경우: 남은 일수가 적은 순서로 정렬
          if (daysA !== null && daysB !== null) {
            return (daysA - daysB) * multiplier;
          }

          // A만 주기가 있는 경우: A를 위로
          if (daysA !== null) return -1 * multiplier;

          // B만 주기가 있는 경우: B를 위로
          if (daysB !== null) return 1 * multiplier;

          // 둘 다 주기가 없는 경우: 이름순 정렬
          return a.name.localeCompare(b.name) * multiplier;
        }
        case 'name':
          return a.name.localeCompare(b.name) * multiplier;
        case 'baseDuration':
          return (a.baseDuration - b.baseDuration) * multiplier;
        case 'createdAt':
          return a.id.localeCompare(b.id) * multiplier;
        default:
          return 0;
      }
    });
  }, [templates, searchQuery, selectedCategory, showFavoritesOnly, showDailyOnly, showUpcomingOnly, sortBy, sortOrder, getDaysUntilNextOccurrence]);

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
      await deleteTemplate(id);
      toast.success('템플릿이 삭제되었습니다.');
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast.error('템플릿 삭제에 실패했습니다.');
    }
  };

  const handleTemplateModalClose = async (saved: boolean) => {
    setIsTemplateModalOpen(false);
    setEditingTemplate(null);
    if (saved) {
      await loadData();
    }
  };

  const handleAddToToday = async (template: Template) => {
    const result = await createTodayTaskFromTemplate(template, 'manual');
    if (result.success) {
      toast.success(`"${template.name}" 작업이 추가되었습니다!`);
      // 기존 콜백도 호출 (퀘스트 진행 등)
      onTaskCreate(template);
    } else {
      toast.error(result.error ?? '작업 추가에 실패했습니다.');
    }
  };

  const handleCloneTemplate = async (template: Template) => {
    try {
      await addTemplate(
        `${template.name} (복사)`,
        template.text,
        template.memo,
        template.baseDuration,
        template.resistance,
        template.timeBlock,
        template.autoGenerate ?? false,
        template.preparation1 || '',
        template.preparation2 || '',
        template.preparation3 || '',
        template.recurrenceType || 'none',
        template.weeklyDays || [],
        template.intervalDays || 1,
        template.category || '',
        false,
        template.imageUrl
      );
      toast.success('템플릿이 복제되었습니다.');
    } catch (error) {
      console.error('Failed to clone template:', error);
      toast.error('템플릿 복제에 실패했습니다.');
    }
  };

  const getTimeBlockLabel = (blockId: string | null): string => {
    if (!blockId) return '인박스';
    const block = TIME_BLOCKS.find(b => b.id === blockId);
    return block ? block.label : '인박스';
  };

  const getEstimatedXP = (template: Template) => {
    return calculateTaskXP({
      adjustedDuration: template.baseDuration,
      actualDuration: 0,
      resistance: template.resistance,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8">
      <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-base)] shadow-2xl" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text)]">📝 템플릿 관리</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">자주 사용하는 작업을 템플릿으로 저장하세요</p>
          </div>
          <div className="flex gap-2">
            {/* 자동생성 미리보기 토글 (UX v1 only) */}
            {uxV1Enabled && autoGenTemplates.length > 0 && (
              <button
                className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${showAutoGenPreview
                  ? 'border-[var(--color-success)] bg-[var(--color-success)]/10 text-[var(--color-success)]'
                  : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                  }`}
                onClick={() => setShowAutoGenPreview(!showAutoGenPreview)}
              >
                🤖 오늘 자동생성 ({autoGenTemplates.length})
              </button>
            )}
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

        {/* 자동생성 미리보기 패널 (UX v1 only) */}
        {uxV1Enabled && showAutoGenPreview && autoGenTemplates.length > 0 && (
          <div className="border-b border-[var(--color-border)] bg-[var(--color-success)]/5 px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🤖</span>
                <h3 className="text-sm font-bold text-[var(--color-text)]">오늘 자동 생성 예정</h3>
                {autoGenState?.lastRunDate === today && (
                  <span className="rounded bg-[var(--color-success)]/20 px-2 py-0.5 text-xs font-bold text-[var(--color-success)]">
                    ✓ 실행 완료
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">
                마지막 실행: {autoGenState?.lastRunAt ? new Date(autoGenState.lastRunAt).toLocaleString() : '없음'}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {autoGenTemplates.map(template => (
                <div
                  key={template.id}
                  className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2"
                >
                  <span className="text-sm font-medium text-[var(--color-text)]">{template.name}</span>
                  <span className="text-xs text-[var(--color-text-tertiary)]">⏱️ {template.baseDuration}분</span>
                  <button
                    className="rounded px-2 py-0.5 text-xs font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
                    onClick={() => handleAddToToday(template)}
                  >
                    지금 추가
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              <option value="all">모든 카테고리</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* 정렬 드롭다운 (UX v1 only) */}
            {uxV1Enabled && (
              <>
                <select
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value as SortBy)}
                >
                  <option value="nextOccurrence">다음 생성일순</option>
                  <option value="name">이름순</option>
                  <option value="baseDuration">소요시간순</option>
                  <option value="createdAt">생성일순</option>
                </select>
                <button
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]"
                  onClick={() => handleSortChange(sortBy)}
                  title={`정렬 방향: ${sortOrder === 'asc' ? '오름차순' : '내림차순'}`}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </>
            )}
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
                const isGeneratedToday = template.lastGeneratedDate === today;
                const isTodayTarget = getDaysUntilNextOccurrence(template) === 0;
                return (
                  <div
                    key={template.id}
                    className={`group relative flex flex-col overflow-hidden rounded-xl border bg-[var(--color-bg-surface)] transition-all hover:-translate-y-1 hover:shadow-lg ${
                      uxV1Enabled && isTodayTarget
                        ? 'border-[var(--color-success)] ring-2 ring-[var(--color-success)]/30'
                        : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                    }`}
                    onDoubleClick={() => handleEditTemplate(template)}
                  >
                    {/* 오늘 집중 하이라이트 배지 (UX v1 only) */}
                    {uxV1Enabled && isTodayTarget && (
                      <div className="absolute -right-8 top-3 z-10 rotate-45 bg-[var(--color-success)] px-10 py-0.5 text-[10px] font-bold text-white shadow-sm">
                        오늘
                      </div>
                    )}
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
                        {isGeneratedToday && (
                          <span className="rounded bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-[2px]">
                            ✅ 오늘 추가됨
                          </span>
                        )}
                        {nextOccurrence && (
                          <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-[2px]">
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
        <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 py-3 text-xs text-[var(--color-text-tertiary)]">
          <span>총 {templates.length}개의 템플릿</span>
          {uxV1Enabled && (
            <span>정렬: {sortBy === 'nextOccurrence' ? '다음 생성일' : sortBy === 'name' ? '이름' : sortBy === 'baseDuration' ? '소요시간' : '생성일'} ({sortOrder === 'asc' ? '오름차순' : '내림차순'})</span>
          )}
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
