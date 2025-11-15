/**
 * TemplateModal
 *
 * @role 템플릿을 추가하거나 편집하는 모달 컴포넌트
 * @input template (Template | null), onClose (function)
 * @output 템플릿 이름, 할 일, 메모, 소요시간, 저항도, 시간대, 자동 생성 옵션 입력 필드 및 저장 버튼을 포함한 모달 UI
 * @external_dependencies
 *   - createTemplate, updateTemplate: 템플릿 Repository
 *   - TIME_BLOCKS, RESISTANCE_LABELS: 도메인 타입 및 상수
 */

import { useState, useEffect } from 'react';
import type { Template, Resistance, TimeBlockId } from '@/shared/types/domain';
import { createTemplate, updateTemplate } from '@/data/repositories';
import { TIME_BLOCKS, RESISTANCE_LABELS } from '@/shared/types/domain';

interface TemplateModalProps {
  template: Template | null; // null이면 신규 생성
  onClose: (saved: boolean) => void;
}

/**
 * 템플릿 추가/편집 모달 컴포넌트
 *
 * @param {TemplateModalProps} props - template, onClose를 포함하는 props
 * @returns {JSX.Element} 모달 UI
 * @sideEffects
 *   - ESC 키로 모달 닫기
 *   - 저장 시 Firebase 동기화
 *   - 자동 생성 옵션 체크 시 매일 00시에 자동으로 작업 생성
 */
export function TemplateModal({ template, onClose }: TemplateModalProps) {
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [memo, setMemo] = useState('');
  const [baseDuration, setBaseDuration] = useState(30);
  const [resistance, setResistance] = useState<Resistance>('low');
  const [timeBlock, setTimeBlock] = useState<TimeBlockId>(null);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [preparation1, setPreparation1] = useState('');
  const [preparation2, setPreparation2] = useState('');
  const [preparation3, setPreparation3] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 편집 모드일 경우 초기값 설정
  useEffect(() => {
    if (template) {
      setName(template.name);
      setText(template.text);
      setMemo(template.memo);
      setBaseDuration(template.baseDuration);
      setResistance(template.resistance);
      setTimeBlock(template.timeBlock);
      setAutoGenerate(template.autoGenerate);
      setPreparation1(template.preparation1 || '');
      setPreparation2(template.preparation2 || '');
      setPreparation3(template.preparation3 || '');
    }
  }, [template]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !text.trim()) {
      alert('템플릿 이름과 할 일을 입력해주세요.');
      return;
    }

    setIsSaving(true);

    try {
      if (template) {
        // 수정
        await updateTemplate(template.id, {
          name: name.trim(),
          text: text.trim(),
          memo: memo.trim(),
          baseDuration,
          resistance,
          timeBlock,
          autoGenerate,
          preparation1: preparation1.trim(),
          preparation2: preparation2.trim(),
          preparation3: preparation3.trim(),
        });
      } else {
        // 신규 생성
        await createTemplate(
          name.trim(),
          text.trim(),
          memo.trim(),
          baseDuration,
          resistance,
          timeBlock,
          autoGenerate,
          preparation1.trim(),
          preparation2.trim(),
          preparation3.trim()
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

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content modal-content-wide" onClick={e => e.stopPropagation()}>
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

        <form onSubmit={handleSubmit} className="modal-body modal-form-two-column">
          {/* 왼쪽 컬럼: 템플릿 정보 */}
          <div className="form-column form-column-left">
            {/* 템플릿 이름 */}
            <div className="form-group">
              <label htmlFor="template-name">
                템플릿 이름 <span className="required">*</span>
              </label>
              <input
                id="template-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="예: 아침 운동"
                required
                autoFocus
              />
            </div>

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
              />
            </div>

            {/* 메모 */}
            <div className="form-group">
              <label htmlFor="template-memo">메모 (선택)</label>
              <textarea
                id="template-memo"
                value={memo}
                onChange={e => setMemo(e.target.value)}
                placeholder="추가 메모..."
                rows={2}
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

            {/* 자동 생성 */}
            <div className="form-group form-group-checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={autoGenerate}
                  onChange={e => setAutoGenerate(e.target.checked)}
                />
                <span>매일 자동으로 생성 🔄</span>
              </label>
              <p className="form-hint">
                체크하면 매일 00시에 이 템플릿에서 자동으로 할 일이 생성됩니다.
              </p>
            </div>
          </div>

          {/* 오른쪽 컬럼: 준비 사항 입력 */}
          <div className="form-column form-column-right">
            <div className="preparation-section">
              <div className="preparation-header">
                <h4 className="preparation-title">💡 템플릿 준비하기</h4>
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

          {/* 하단 액션 버튼 (전체 너비) */}
          <div className="modal-actions modal-actions-full">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCancel}
              disabled={isSaving}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSaving}
            >
              {isSaving ? '저장 중...' : template ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
