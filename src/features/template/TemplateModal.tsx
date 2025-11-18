/**
 * TemplateModal
 *
 * @role 템플릿을 추가하거나 편집하는 모달 컴포넌트 (3페이지 구조)
 * @input template (Template | null), onClose (function)
 * @output 템플릿 정보 입력 필드 및 저장 버튼을 포함한 3페이지 모달 UI
 * @external_dependencies
 *   - createTemplate, updateTemplate: 템플릿 Repository
 *   - TIME_BLOCKS, RESISTANCE_LABELS: 도메인 타입 및 상수
 */

import { useState, useEffect } from 'react';
import type { Template, Resistance, TimeBlockId, RecurrenceType } from '@/shared/types/domain';
import { createTemplate, updateTemplate } from '@/data/repositories';
import { TIME_BLOCKS, RESISTANCE_LABELS } from '@/shared/types/domain';
import { getTemplateCategories, addTemplateCategory } from '@/data/repositories/settingsRepository';
import { MemoModal } from '@/features/schedule/MemoModal';

interface TemplateModalProps {
  template: Template | null; // null이면 신규 생성
  onClose: (saved: boolean) => void;
}

/**
 * 템플릿 추가/편집 모달 컴포넌트 (3페이지 구조)
 */
export function TemplateModal({ template, onClose }: TemplateModalProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [text, setText] = useState('');
  const [memo, setMemo] = useState('');
  const [baseDuration, setBaseDuration] = useState(30);
  const [resistance, setResistance] = useState<Resistance>('low');
  const [timeBlock, setTimeBlock] = useState<TimeBlockId>(null);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('none');
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  const [intervalDays, setIntervalDays] = useState(1);
  const [preparation1, setPreparation1] = useState('');
  const [preparation2, setPreparation2] = useState('');
  const [preparation3, setPreparation3] = useState('');
  const [category, setCategory] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showMemoModal, setShowMemoModal] = useState(false);

  // 카테고리 목록 로드
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const cats = await getTemplateCategories();
    setCategories(cats);
  };

  // 편집 모드일 경우 초기값 설정
  useEffect(() => {
    if (template) {
      setText(template.text);
      setMemo(template.memo);
      setBaseDuration(template.baseDuration);
      setResistance(template.resistance);
      setTimeBlock(template.timeBlock);
      setAutoGenerate(template.autoGenerate);
      setRecurrenceType(template.recurrenceType || 'none');
      setWeeklyDays(template.weeklyDays || []);
      setIntervalDays(template.intervalDays || 1);
      setPreparation1(template.preparation1 || '');
      setPreparation2(template.preparation2 || '');
      setPreparation3(template.preparation3 || '');
      setCategory(template.category || '');
      setIsFavorite(template.isFavorite || false);
      setImageUrl(template.imageUrl || '');
    }
  }, [template]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (showMemoModal) return;
      if (e.key === 'Escape') onClose(false);
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [onClose, showMemoModal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPage !== 3) return;
    if (!text.trim()) {
      alert('할 일을 입력해주세요.');
      return;
    }

    setIsSaving(true);

    try {
      const templateData = {
        name: text.trim(),
        text: text.trim(),
        memo: memo.trim(),
        baseDuration,
        resistance,
        timeBlock,
        autoGenerate,
        recurrenceType,
        weeklyDays,
        intervalDays,
        preparation1: preparation1.trim(),
        preparation2: preparation2.trim(),
        preparation3: preparation3.trim(),
        category: category.trim(),
        isFavorite,
        imageUrl: imageUrl.trim(),
      };

      if (template) {
        await updateTemplate(template.id, templateData);
      } else {
        await createTemplate(
          templateData.text,
          templateData.text,
          templateData.memo,
          templateData.baseDuration,
          templateData.resistance,
          templateData.timeBlock,
          templateData.autoGenerate,
          templateData.preparation1,
          templateData.preparation2,
          templateData.preparation3,
          templateData.recurrenceType,
          templateData.weeklyDays,
          templateData.intervalDays,
          templateData.category,
          templateData.isFavorite,
          templateData.imageUrl
        );
      }
      onClose(true);
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('템플릿 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNewCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      await addTemplateCategory(newCategory.trim());
      await loadCategories();
      setCategory(newCategory.trim());
      setNewCategory('');
      setShowNewCategoryInput(false);
    } catch (error) {
      console.error('Failed to add category:', error);
    }
  };

  const inputClass = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]";
  const labelClass = "text-xs font-bold text-[var(--color-text-secondary)] mb-1 block";

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => onClose(false)}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="text-lg font-bold text-[var(--color-text)]">{template ? '템플릿 편집' : '템플릿 추가'}</h2>
          <button onClick={() => onClose(false)} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]">✕</button>
        </div>

        {/* Steps */}
        <div className="flex justify-center gap-2 border-b border-[var(--color-border)] py-3">
          {[1, 2, 3].map(step => (
            <div
              key={step}
              className={`h-2 w-8 rounded-full transition-colors ${currentPage >= step ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-bg-tertiary)]'
                }`}
            />
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="h-[400px] overflow-y-auto p-5">

            {/* Page 1: Basic Info */}
            {currentPage === 1 && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className={labelClass}>할 일 이름</label>
                  <input
                    type="text"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="예: 아침 운동, 독서"
                    className={inputClass}
                    autoFocus
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>메모</label>
                  <textarea
                    value={memo}
                    onChange={e => setMemo(e.target.value)}
                    placeholder="상세 내용을 입력하세요..."
                    className={`${inputClass} min-h-[80px] resize-none`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>소요 시간 (분)</label>
                    <input
                      type="number"
                      value={baseDuration}
                      onChange={e => setBaseDuration(Number(e.target.value))}
                      className={inputClass}
                      min={1}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>저항감 (난이도)</label>
                    <select
                      value={resistance}
                      onChange={e => setResistance(e.target.value as Resistance)}
                      className={inputClass}
                    >
                      <option value="low">낮음 (쉬움)</option>
                      <option value="medium">중간 (보통)</option>
                      <option value="high">높음 (어려움)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>시간대</label>
                  <select
                    value={timeBlock || 'null'}
                    onChange={e => setTimeBlock(e.target.value === 'null' ? null : (e.target.value as TimeBlockId))}
                    className={inputClass}
                  >
                    <option value="null">나중에 (인박스)</option>
                    {TIME_BLOCKS.map(block => (
                      <option key={block.id} value={block.id}>{block.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>카테고리</label>
                  <select
                    value={category}
                    onChange={e => {
                      if (e.target.value === '__new__') setShowNewCategoryInput(true);
                      else setCategory(e.target.value);
                    }}
                    className={inputClass}
                  >
                    <option value="">없음</option>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    <option value="__new__">+ 새 카테고리</option>
                  </select>
                </div>

                {showNewCategoryInput && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value)}
                      placeholder="새 카테고리 이름"
                      className={inputClass}
                    />
                    <button type="button" onClick={handleAddNewCategory} className="whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-3 text-xs font-bold text-white">추가</button>
                  </div>
                )}

                <div>
                  <label className={labelClass}>이미지 URL (썸네일)</label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    placeholder="https://..."
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {/* Page 2: Preparation */}
            {currentPage === 2 && (
              <div className="flex flex-col gap-4">
                <div className="rounded-xl bg-[var(--color-bg-elevated)] p-4 text-center">
                  <h3 className="text-sm font-bold text-[var(--color-text)]">💡 준비하기</h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">방해 요소를 미리 파악하고 대처하세요.</p>
                </div>

                <div>
                  <label className={labelClass}>⚠️ 예상 방해물 1</label>
                  <input
                    type="text"
                    value={preparation1}
                    onChange={e => setPreparation1(e.target.value)}
                    placeholder="예: 스마트폰 알림"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>⚠️ 예상 방해물 2</label>
                  <input
                    type="text"
                    value={preparation2}
                    onChange={e => setPreparation2(e.target.value)}
                    placeholder="예: 배고픔"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>✅ 대처 전략</label>
                  <input
                    type="text"
                    value={preparation3}
                    onChange={e => setPreparation3(e.target.value)}
                    placeholder="예: 폰을 다른 방에 두기"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {/* Page 3: Recurrence */}
            {currentPage === 3 && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-4">
                  <input
                    type="checkbox"
                    checked={autoGenerate}
                    onChange={e => {
                      setAutoGenerate(e.target.checked);
                      if (e.target.checked) setRecurrenceType('daily');
                      else setRecurrenceType('none');
                    }}
                    className="h-5 w-5 accent-[var(--color-primary)]"
                  />
                  <div>
                    <strong className="text-sm text-[var(--color-text)]">자동 생성 켜기</strong>
                    <p className="text-xs text-[var(--color-text-secondary)]">설정된 주기에 따라 자동으로 할 일을 만듭니다.</p>
                  </div>
                </div>

                {autoGenerate && (
                  <div className="flex flex-col gap-4 rounded-xl bg-[var(--color-bg-elevated)] p-4">
                    <div>
                      <label className={labelClass}>반복 주기</label>
                      <select
                        value={recurrenceType}
                        onChange={e => setRecurrenceType(e.target.value as RecurrenceType)}
                        className={inputClass}
                      >
                        <option value="daily">매일</option>
                        <option value="weekly">매주 특정 요일</option>
                        <option value="interval">N일 간격</option>
                      </select>
                    </div>

                    {recurrenceType === 'weekly' && (
                      <div className="flex justify-between gap-1">
                        {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              if (weeklyDays.includes(idx)) setWeeklyDays(weeklyDays.filter(d => d !== idx));
                              else setWeeklyDays([...weeklyDays, idx]);
                            }}
                            className={`h-8 w-8 rounded-full text-xs font-bold transition-colors ${weeklyDays.includes(idx)
                                ? 'bg-[var(--color-primary)] text-white'
                                : 'bg-[var(--color-bg-base)] text-[var(--color-text-secondary)] border border-[var(--color-border)]'
                              }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    )}

                    {recurrenceType === 'interval' && (
                      <div>
                        <label className={labelClass}>간격 (일)</label>
                        <input
                          type="number"
                          value={intervalDays}
                          onChange={e => setIntervalDays(Number(e.target.value))}
                          min={1}
                          className={inputClass}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex justify-between border-t border-[var(--color-border)] bg-[var(--color-bg-base)] px-5 py-4">
            <button
              type="button"
              onClick={() => currentPage > 1 ? setCurrentPage(currentPage - 1) : onClose(false)}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]"
            >
              {currentPage === 1 ? '취소' : '이전'}
            </button>

            {currentPage < 3 ? (
              <button
                type="button"
                onClick={() => setCurrentPage(currentPage + 1)}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-primary-dark)]"
              >
                다음
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
              >
                {isSaving ? '저장 중...' : '완료'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
