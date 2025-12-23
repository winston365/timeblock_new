/**
 * @file TemplateModal.tsx
 * @description 템플릿 추가/편집 3페이지 모달 컴포넌트 (UX v1 개선)
 *
 * @role 반복 작업 템플릿의 생성 및 수정을 위한 다단계 입력 폼 제공
 * @responsibilities
 *   - 템플릿 기본 정보 입력 (이름, 메모, 소요시간, 저항감, 시간대, 카테고리)
 *   - 방해물 대처 전략 설정 (preparation 필드)
 *   - 반복 주기 설정 (daily, weekly, interval)
 *   - 템플릿 저장 및 업데이트 처리
 *   - Zod 기반 폼 유효성 검증 + 즉시 에러 피드백
 *   - 빠른 생성 (1단계 즉시 저장)
 * @dependencies
 *   - createTemplate, updateTemplate: 템플릿 Repository
 *   - getTemplateCategories, addTemplateCategory: 설정 Repository
 *   - templateSchemas: Zod 스키마
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { TIME_BLOCKS, type Template, type Resistance, type TimeBlockId, type RecurrenceType } from '@/shared/types/domain';
import { createTemplate, updateTemplate } from '@/data/repositories';
import { getTemplateCategories, addTemplateCategory } from '@/data/repositories/settingsRepository';
import { useModalHotkeys } from '@/shared/hooks';
import {
  validateBasicStep,
  validatePreparationStep,
  validateRecurrenceStep,
} from '@/shared/schemas/templateSchemas';
import { toast } from 'react-hot-toast';

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

  // 에러 상태
  const [errors, setErrors] = useState<Record<string, string>>({});

  const formRef = useRef<HTMLFormElement>(null);

  const handleEscapeClose = useCallback(() => {
    if (isSaving) return;
    onClose(false);
  }, [isSaving, onClose]);

  const handlePrimaryAction = useCallback(() => {
    if (isSaving) return;
    if (currentPage !== 3) return;
    formRef.current?.requestSubmit();
  }, [currentPage, isSaving]);

  useModalHotkeys({
    isOpen: true,
    onEscapeClose: handleEscapeClose,
    primaryAction: {
      enabled: !isSaving && currentPage === 3,
      onPrimary: handlePrimaryAction,
    },
  });

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
      
      // Legacy fallback: recurrenceType이 'none'이 아니면 autoGenerate를 true로 설정
      const hasRecurrence = template.recurrenceType && template.recurrenceType !== 'none';
      setAutoGenerate(template.autoGenerate ?? hasRecurrence ?? false);
      
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

  /**
   * 단계별 유효성 검사
   */
  const validateCurrentStep = useCallback((): boolean => {
    let result;
    switch (currentPage) {
      case 1:
        result = validateBasicStep({
          text: text.trim(),
          memo: memo.trim(),
          baseDuration,
          resistance,
          timeBlock,
          category: category.trim(),
          imageUrl: imageUrl.trim(),
          isFavorite,
        });
        break;
      case 2:
        result = validatePreparationStep({
          preparation1: preparation1.trim(),
          preparation2: preparation2.trim(),
          preparation3: preparation3.trim(),
        });
        break;
      case 3:
        result = validateRecurrenceStep({
          autoGenerate,
          recurrenceType,
          weeklyDays,
          intervalDays,
        });
        break;
      default:
        return true;
    }

    if (result.success) {
      setErrors({});
      return true;
    } else {
      setErrors(result.errors ?? {});
      return false;
    }
  }, [currentPage, text, memo, baseDuration, resistance, timeBlock, category, imageUrl, isFavorite, preparation1, preparation2, preparation3, autoGenerate, recurrenceType, weeklyDays, intervalDays]);

  /**
   * 다음 단계로 이동 (유효성 검사 후)
   */
  const handleNextPage = useCallback(() => {
    if (validateCurrentStep()) {
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, validateCurrentStep]);

  /**
   * 빠른 저장 (1단계에서 즉시 저장)
   */
  const handleQuickSave = async () => {
    if (!validateCurrentStep()) return;

    setIsSaving(true);
    try {
      await createTemplate(
        text.trim(),
        text.trim(),
        memo.trim(),
        baseDuration,
        resistance,
        timeBlock,
        false, // autoGenerate
        '', '', '', // preparations
        'none', // recurrenceType
        [], // weeklyDays
        1, // intervalDays
        category.trim(),
        isFavorite,
        imageUrl.trim()
      );
      toast.success('템플릿이 빠르게 저장되었습니다! 상세 설정은 나중에 편집하세요.');
      onClose(true);
    } catch (error) {
      console.error('Failed to quick save template:', error);
      toast.error('템플릿 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPage !== 3) return;
    
    if (!validateCurrentStep()) {
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
      toast.error('템플릿 저장에 실패했습니다.');
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
  const inputErrorClass = "w-full rounded-lg border border-[var(--color-danger)] bg-[var(--color-bg-base)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-danger)] focus:ring-1 focus:ring-[var(--color-danger)]";
  const labelClass = "text-xs font-bold text-[var(--color-text-secondary)] mb-1 block";
  const errorClass = "text-xs text-[var(--color-danger)] mt-1";

  /**
   * 에러 있는 필드의 input 클래스 반환
   */
  const getInputClass = (field: string) => errors[field] ? inputErrorClass : inputClass;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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

        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col">
          <div className="h-[400px] overflow-y-auto p-5">

            {/* Page 1: Basic Info */}
            {currentPage === 1 && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className={labelClass}>할 일 이름 <span className="text-[var(--color-danger)]">*</span></label>
                  <input
                    type="text"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="예: 아침 운동, 독서"
                    className={getInputClass('text')}
                    autoFocus
                  />
                  {errors.text && <p className={errorClass}>{errors.text}</p>}
                </div>

                <div>
                  <label className={labelClass}>메모</label>
                  <textarea
                    value={memo}
                    onChange={e => setMemo(e.target.value)}
                    placeholder="상세 내용을 입력하세요..."
                    className={`${getInputClass('memo')} min-h-[80px] resize-none`}
                  />
                  {errors.memo && <p className={errorClass}>{errors.memo}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>소요 시간 (분) <span className="text-[var(--color-danger)]">*</span></label>
                    <input
                      type="number"
                      value={baseDuration}
                      onChange={e => {
                        const val = Number(e.target.value);
                        setBaseDuration(Number.isNaN(val) ? 1 : val);
                      }}
                      className={getInputClass('baseDuration')}
                      min={1}
                      max={480}
                    />
                    {errors.baseDuration && <p className={errorClass}>{errors.baseDuration}</p>}
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
                    className={getInputClass('imageUrl')}
                  />
                  {errors.imageUrl && <p className={errorClass}>{errors.imageUrl}</p>}
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
                    className={getInputClass('preparation1')}
                  />
                  {errors.preparation1 && <p className={errorClass}>{errors.preparation1}</p>}
                </div>
                <div>
                  <label className={labelClass}>⚠️ 예상 방해물 2</label>
                  <input
                    type="text"
                    value={preparation2}
                    onChange={e => setPreparation2(e.target.value)}
                    placeholder="예: 배고픔"
                    className={getInputClass('preparation2')}
                  />
                  {errors.preparation2 && <p className={errorClass}>{errors.preparation2}</p>}
                </div>
                <div>
                  <label className={labelClass}>✅ 대처 전략</label>
                  <input
                    type="text"
                    value={preparation3}
                    onChange={e => setPreparation3(e.target.value)}
                    placeholder="예: 폰을 다른 방에 두기"
                    className={getInputClass('preparation3')}
                  />
                  {errors.preparation3 && <p className={errorClass}>{errors.preparation3}</p>}
                </div>
              </div>
            )}

            {/* Page 3: Recurrence */}
            {currentPage === 3 && (
              <div className="flex flex-col gap-4">
                {/* 전역 에러 메시지 */}
                {Object.keys(errors).length > 0 && (
                  <div className="rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 p-3">
                    <p className="text-xs font-bold text-[var(--color-danger)]">⚠️ 설정을 확인해주세요</p>
                    {Object.values(errors).map((err, idx) => (
                      <p key={idx} className="text-xs text-[var(--color-danger)] mt-1">• {err}</p>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-4">
                  <input
                    type="checkbox"
                    checked={autoGenerate}
                    onChange={e => {
                      setAutoGenerate(e.target.checked);
                      if (e.target.checked) setRecurrenceType('daily');
                      else setRecurrenceType('none');
                      setErrors({}); // 에러 초기화
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
                      <label className={labelClass}>반복 주기 <span className="text-[var(--color-danger)]">*</span></label>
                      <select
                        value={recurrenceType}
                        onChange={e => {
                          setRecurrenceType(e.target.value as RecurrenceType);
                          setErrors({});
                        }}
                        className={inputClass}
                      >
                        <option value="daily">매일</option>
                        <option value="weekly">매주 특정 요일</option>
                        <option value="interval">N일 간격</option>
                      </select>
                    </div>

                    {recurrenceType === 'weekly' && (
                      <div>
                        <label className={labelClass}>요일 선택 <span className="text-[var(--color-danger)]">*</span></label>
                        <div className="flex justify-between gap-1 mt-2">
                          {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                if (weeklyDays.includes(idx)) setWeeklyDays(weeklyDays.filter(d => d !== idx));
                                else setWeeklyDays([...weeklyDays, idx]);
                                setErrors({});
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
                        {weeklyDays.length === 0 && (
                          <p className="text-xs text-[var(--color-text-tertiary)] mt-2">최소 1개 요일을 선택해주세요</p>
                        )}
                      </div>
                    )}

                    {recurrenceType === 'interval' && (
                      <div>
                        <label className={labelClass}>간격 (일)</label>
                        <input
                          type="number"
                          value={intervalDays}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setIntervalDays(Number.isNaN(val) ? 1 : val);
                          }}
                          min={1}
                          max={365}
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

            <div className="flex gap-2">
              {/* 빠른 저장 버튼 (1단계에서만, 신규 생성 시에만) */}
              {currentPage === 1 && !template && (
                <button
                  type="button"
                  onClick={handleQuickSave}
                  disabled={isSaving || !text.trim()}
                  className="rounded-lg border border-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 disabled:opacity-50"
                  title="기본 설정으로 빠르게 저장하고 나중에 상세 설정"
                >
                  ⚡ 빠른 저장
                </button>
              )}

              {currentPage < 3 ? (
                <button
                  type="button"
                  onClick={handleNextPage}
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
          </div>
        </form>
      </div>
    </div>
  );
}
