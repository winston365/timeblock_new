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
import './template.css';

interface TemplateModalProps {
  template: Template | null; // null이면 신규 생성
  onClose: (saved: boolean) => void;
}

/**
 * 템플릿 추가/편집 모달 컴포넌트 (3페이지 구조)
 *
 * @param {TemplateModalProps} props - template, onClose를 포함하는 props
 * @returns {JSX.Element} 모달 UI
 * @sideEffects
 *   - ESC 키로 모달 닫기
 *   - 저장 시 Firebase 동기화
 *   - 자동 생성 옵션 체크 시 매일 00시에 자동으로 작업 생성
 */
export function TemplateModal({ template, onClose }: TemplateModalProps) {
  const [currentPage, setCurrentPage] = useState(1); // 페이지 상태
  const [text, setText] = useState(''); // 템플릿 이름 제거, 할일만 사용
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
      setText(template.text); // name 대신 text만 사용
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

  // ESC 키로 모달 닫기, Ctrl+Enter로 저장 (3페이지에서만)
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      // 메모 모달이 열려 있으면 부모 모달의 키보드 이벤트 무시
      if (showMemoModal) return;

      if (e.key === 'Escape') {
        onClose(false);
      }
      if (e.key === 'Enter' && e.ctrlKey && currentPage === 3) {
        e.preventDefault();
        // 폼 제출 트리거
        const form = document.querySelector('.modal-body') as HTMLFormElement;
        if (form) {
          form.requestSubmit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [onClose, currentPage, showMemoModal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 3페이지가 아니면 저장하지 않음 (Enter 키로 인한 오작동 방지)
    if (currentPage !== 3) {
      return;
    }

    if (!text.trim()) {
      alert('할 일을 입력해주세요.');
      return;
    }

    // 주기 검증
    if (autoGenerate) {
      if (recurrenceType === 'weekly' && weeklyDays.length === 0) {
        alert('매주 반복을 선택했다면 요일을 최소 1개 이상 선택해주세요.');
        return;
      }
      if (recurrenceType === 'interval' && intervalDays < 1) {
        alert('주기는 1일 이상이어야 합니다.');
        return;
      }
    }

    setIsSaving(true);

    try {
      if (template) {
        // 수정
        await updateTemplate(template.id, {
          name: text.trim(), // text를 name으로 저장
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
        });
      } else {
        // 신규 생성
        await createTemplate(
          text.trim(), // text를 name으로 저장
          text.trim(),
          memo.trim(),
          baseDuration,
          resistance,
          timeBlock,
          autoGenerate,
          preparation1.trim(),
          preparation2.trim(),
          preparation3.trim(),
          recurrenceType,
          weeklyDays,
          intervalDays,
          category.trim(),
          isFavorite,
          imageUrl.trim()
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

  const handleCancel = () => {
    onClose(false);
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.preventDefault(); // form submit 방지
    if (currentPage < 3) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevious = (e?: React.MouseEvent) => {
    e?.preventDefault(); // form submit 방지
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
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
      alert('카테고리 추가에 실패했습니다.');
    }
  };

  // 메모 모달 핸들러
  const handleMemoDoubleClick = () => {
    setShowMemoModal(true);
  };

  const handleMemoModalSave = (newMemo: string) => {
    setMemo(newMemo);
  };

  const handleMemoModalClose = () => {
    setShowMemoModal(false);
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content modal-content-3page" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{template ? '템플릿 편집' : '템플릿 추가'}</h2>
          <button
            className="modal-close"
            onClick={handleCancel}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 페이지 인디케이터 */}
        <div className="page-indicator">
          <button
            type="button"
            className={`page-dot ${currentPage === 1 ? 'active' : ''}`}
            onClick={() => setCurrentPage(1)}
            aria-label="1페이지 - 기본 정보"
          >
            1
          </button>
          <span className="page-separator">·</span>
          <button
            type="button"
            className={`page-dot ${currentPage === 2 ? 'active' : ''}`}
            onClick={() => setCurrentPage(2)}
            aria-label="2페이지 - 준비하기"
          >
            2
          </button>
          <span className="page-separator">·</span>
          <button
            type="button"
            className={`page-dot ${currentPage === 3 ? 'active' : ''}`}
            onClick={() => setCurrentPage(3)}
            aria-label="3페이지 - 반복 설정"
          >
            3
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="modal-body"
          onKeyDown={(e) => {
            // Enter 키가 눌렸을 때 (Ctrl+Enter, Shift+Enter 제외) currentPage가 3이 아니면 submit 방지
            if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && currentPage !== 3) {
              e.preventDefault();
            }
          }}
        >
          <div className="modal-form-scroll-area modal-form-single-page">
            {/* 1페이지: 기본 정보 */}
            {currentPage === 1 && (
              <div className="form-page">
                {/* 할 일 */}
                <div className="form-group">
                  <label htmlFor="template-text">
                    할 일 <span className="required">*</span>
                  </label>
                  <input
                    id="template-text"
                    type="text"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="예: 스쿼트 30회, 플랭크 1분"
                    required
                    autoFocus
                  />
                </div>

                {/* 메모 */}
                <div className="form-group">
                  <label htmlFor="template-memo">메모 (선택)</label>
                  <textarea
                    id="template-memo"
                    value={memo}
                    onChange={e => setMemo(e.target.value)}
                    onDoubleClick={handleMemoDoubleClick}
                    placeholder="추가 메모... (더블클릭하면 큰 창으로 편집)"
                    rows={3}
                    title="더블클릭하면 큰 창에서 편집할 수 있습니다"
                  />
                </div>

                {/* 소요시간 */}
                <div className="form-group">
                  <label htmlFor="template-duration">소요시간 (분)</label>
                  <input
                    id="template-duration"
                    type="number"
                    value={baseDuration}
                    onChange={e => setBaseDuration(Number(e.target.value))}
                    min={1}
                    max={480}
                    required
                  />
                </div>

                {/* 저항도 */}
                <div className="form-group">
                  <label htmlFor="template-resistance">심리적 거부감</label>
                  <select
                    id="template-resistance"
                    value={resistance}
                    onChange={e => setResistance(e.target.value as Resistance)}
                  >
                    <option value="low">{RESISTANCE_LABELS.low}</option>
                    <option value="medium">{RESISTANCE_LABELS.medium}</option>
                    <option value="high">{RESISTANCE_LABELS.high}</option>
                  </select>
                </div>

                {/* 시간대 배치 */}
                <div className="form-group">
                  <label htmlFor="template-timeblock">시간대 배치</label>
                  <select
                    id="template-timeblock"
                    value={timeBlock || 'null'}
                    onChange={e => {
                      const value = e.target.value;
                      setTimeBlock(value === 'null' ? null : (value as TimeBlockId));
                    }}
                  >
                    <option value="null">나중에 (인박스)</option>
                    {TIME_BLOCKS.map(block => (
                      <option key={block.id} value={block.id}>
                        {block.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 카테고리 */}
                <div className="form-group">
                  <label htmlFor="template-category">카테고리 (선택)</label>
                  <select
                    id="template-category"
                    value={category}
                    onChange={e => {
                      const value = e.target.value;
                      if (value === '__new__') {
                        setShowNewCategoryInput(true);
                      } else {
                        setCategory(value);
                      }
                    }}
                  >
                    <option value="">카테고리 없음</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__new__">+ 새 카테고리 추가</option>
                  </select>
                </div>

                {/* 새 카테고리 입력 */}
                {showNewCategoryInput && (
                  <div className="form-group new-category-group">
                    <label htmlFor="new-category">새 카테고리 이름</label>
                    <div className="new-category-input-wrapper">
                      <input
                        id="new-category"
                        type="text"
                        value={newCategory}
                        onChange={e => setNewCategory(e.target.value)}
                        placeholder="예: 운동, 독서, 업무..."
                        autoFocus
                      />
                      <button
                        type="button"
                        className="btn-add-category"
                        onClick={handleAddNewCategory}
                      >
                        추가
                      </button>
                      <button
                        type="button"
                        className="btn-cancel-category"
                        onClick={() => {
                          setShowNewCategoryInput(false);
                          setNewCategory('');
                        }}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}

                {/* 이미지 URL */}
                <div className="form-group">
                  <label htmlFor="template-image-url">이미지 URL (선택)</label>
                  <input
                    id="template-image-url"
                    type="url"
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                  />
                  <p className="form-hint">
                    템플릿 카드에 표시할 썸네일 이미지 URL을 입력하세요.
                  </p>
                  {imageUrl && (
                    <div className="image-preview">
                      <img src={imageUrl} alt="미리보기" onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }} />
                    </div>
                  )}
                </div>

                {/* 즐겨찾기 */}
                <div className="form-group form-group-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={isFavorite}
                      onChange={e => setIsFavorite(e.target.checked)}
                    />
                    <span>⭐ 즐겨찾기에 추가</span>
                  </label>
                  <p className="form-hint">
                    즐겨찾는 템플릿을 빠르게 찾을 수 있습니다.
                  </p>
                </div>
              </div>
            )}

            {/* 2페이지: 템플릿 준비하기 */}
            {currentPage === 2 && (
              <div className="form-page">
                <div className="form-section preparation-section">
                  <div className="preparation-header">
                    <h3 className="preparation-title">💡 템플릿 준비하기</h3>
                    <p className="preparation-description">
                      반복되는 작업의 방해물과 대처법을<br />
                      템플릿에 미리 저장하세요
                    </p>
                  </div>

                  <div className="form-group">
                    <label htmlFor="preparation-1" className="preparation-label">
                      ⚠️ 예상되는 방해물 #1
                    </label>
                    <input
                      id="preparation-1"
                      type="text"
                      value={preparation1}
                      onChange={e => setPreparation1(e.target.value)}
                      placeholder="예: 스마트폰 알림, 배고픔, 피로..."
                      className="preparation-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="preparation-2" className="preparation-label">
                      ⚠️ 예상되는 방해물 #2
                    </label>
                    <input
                      id="preparation-2"
                      type="text"
                      value={preparation2}
                      onChange={e => setPreparation2(e.target.value)}
                      placeholder="예: 불편한 자세, 소음, 다른 업무..."
                      className="preparation-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="preparation-3" className="preparation-label">
                      ✅ 대처 환경/전략
                    </label>
                    <input
                      id="preparation-3"
                      type="text"
                      value={preparation3}
                      onChange={e => setPreparation3(e.target.value)}
                      placeholder="예: 집중 모드 켜기, 간식 준비, 휴식 계획..."
                      className="preparation-input"
                    />
                  </div>

                  {preparation1 && preparation2 && preparation3 && (
                    <div className="preparation-complete-badge">
                      ⭐ 완벽하게 준비된 템플릿입니다!
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3페이지: 반복 주기 설정 */}
            {currentPage === 3 && (
              <div className="form-page">
                {/* 자동 생성 */}
                <div className="form-group form-group-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={autoGenerate}
                      onChange={e => {
                        setAutoGenerate(e.target.checked);
                        if (!e.target.checked) {
                          setRecurrenceType('none');
                        } else {
                          // 자동 생성 체크 시 기본값을 'daily'로 설정
                          setRecurrenceType('daily');
                        }
                      }}
                    />
                    <span>자동으로 생성 🔄</span>
                  </label>
                  <p className="form-hint">
                    체크하면 설정한 주기에 따라 자동으로 할 일이 생성됩니다.
                  </p>
                </div>

                {/* 주기 설정 (자동 생성 활성화 시에만 표시) */}
                {autoGenerate && (
                  <div className="form-group recurrence-settings">
                    <label htmlFor="template-recurrence">반복 주기</label>
                    <select
                      id="template-recurrence"
                      value={recurrenceType}
                      onChange={e => setRecurrenceType(e.target.value as RecurrenceType)}
                      className="recurrence-type-select"
                    >
                      <option value="daily">매일</option>
                      <option value="weekly">매주 특정 요일</option>
                      <option value="interval">N일마다</option>
                    </select>

                    {/* 매주 요일 선택 */}
                    {recurrenceType === 'weekly' && (
                      <div className="weekly-days-selector">
                        <label className="weekly-days-label">반복할 요일 선택</label>
                        <div className="weekly-days-grid">
                          {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
                            <label key={index} className={`day-checkbox ${weeklyDays.includes(index) ? 'checked' : ''}`}>
                              <input
                                type="checkbox"
                                checked={weeklyDays.includes(index)}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setWeeklyDays([...weeklyDays, index].sort());
                                  } else {
                                    setWeeklyDays(weeklyDays.filter(d => d !== index));
                                  }
                                }}
                              />
                              <span className="day-label">{day}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* N일 주기 입력 */}
                    {recurrenceType === 'interval' && (
                      <div className="interval-input-group">
                        <label htmlFor="interval-days">반복 주기 (일)</label>
                        <div className="interval-input-wrapper">
                          <input
                            id="interval-days"
                            type="number"
                            min="1"
                            max="365"
                            value={intervalDays}
                            onChange={e => setIntervalDays(Number(e.target.value))}
                            className="interval-input"
                          />
                          <span className="interval-unit">일마다 반복</span>
                        </div>
                        <p className="form-hint">
                          예: 3일마다 반복 → 오늘 생성되면 3일 후 다시 생성됩니다.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 하단 버튼 */}
          <div className="modal-actions modal-actions-full">
            <button
              type="button"
              className="btn-secondary"
              onClick={currentPage === 1 ? handleCancel : handlePrevious}
              disabled={isSaving}
            >
              {currentPage === 1 ? '취소' : '이전'}
            </button>
            {currentPage < 3 ? (
              <button
                type="button"
                className="btn-primary"
                onClick={handleNext}
              >
                다음
              </button>
            ) : (
              <button
                type="submit"
                className="btn-primary"
                disabled={isSaving}
              >
                {isSaving ? '저장 중...' : template ? '수정' : '추가'}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* 메모 전용 모달 */}
      {showMemoModal && (
        <MemoModal
          memo={memo}
          onSave={handleMemoModalSave}
          onClose={handleMemoModalClose}
        />
      )}
    </div>
  );
}
