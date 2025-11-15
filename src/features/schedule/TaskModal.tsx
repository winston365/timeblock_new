/**
 * TaskModal
 *
 * @role 작업 추가/수정을 위한 모달 폼 컴포넌트. 제목, 메모, 예상 시간, 난이도 입력 제공
 * @input task (수정할 작업 또는 null), initialBlockId (초기 블록 ID), onSave (저장 핸들러), onClose (닫기 핸들러)
 * @output 작업 입력 폼 모달
 * @external_dependencies
 *   - utils: 조정된 시간 계산 함수
 */

import { useState, useEffect } from 'react';
import type { Task, Resistance, TimeBlockId } from '@/shared/types/domain';
import { calculateAdjustedDuration } from '@/shared/lib/utils';

interface TaskModalProps {
  task: Task | null;
  initialBlockId: TimeBlockId;
  onSave: (taskData: Partial<Task>) => void;
  onClose: () => void;
}

/**
 * 작업 추가/수정 모달
 *
 * @param {TaskModalProps} props - 컴포넌트 props
 * @returns {JSX.Element} 모달 폼
 * @sideEffects
 *   - 작업 저장 시 onSave 콜백 호출
 *   - ESC 키로 모달 닫기
 */
export default function TaskModal({ task, initialBlockId, onSave, onClose }: TaskModalProps) {
  const [text, setText] = useState('');
  const [memo, setMemo] = useState('');
  const [baseDuration, setBaseDuration] = useState(15);  // 30분 -> 15분으로 변경
  const [resistance, setResistance] = useState<Resistance>('low');
  const [preparation1, setPreparation1] = useState('');
  const [preparation2, setPreparation2] = useState('');
  const [preparation3, setPreparation3] = useState('');

  // 기존 작업 데이터로 초기화
  useEffect(() => {
    if (task) {
      setText(task.text);
      setMemo(task.memo);
      setBaseDuration(task.baseDuration);
      setResistance(task.resistance);
      setPreparation1(task.preparation1 || '');
      setPreparation2(task.preparation2 || '');
      setPreparation3(task.preparation3 || '');
    }
  }, [task]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!text.trim()) {
      alert('작업 제목을 입력해주세요.');
      return;
    }

    const adjustedDuration = calculateAdjustedDuration(baseDuration, resistance);

    onSave({
      text: text.trim(),
      memo: memo.trim(),
      baseDuration,
      resistance,
      adjustedDuration,
      timeBlock: initialBlockId,
      preparation1: preparation1.trim(),
      preparation2: preparation2.trim(),
      preparation3: preparation3.trim(),
    });
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content modal-content-wide">
        <div className="modal-header">
          <h3>{task ? '작업 수정' : '새 작업 추가'}</h3>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="modal-form modal-form-two-column" onSubmit={handleSubmit}>
          {/* 왼쪽 컬럼: 기존 작업 정보 */}
          <div className="form-column form-column-left">
            <div className="form-group">
              <label htmlFor="task-text">작업 제목 *</label>
              <input
                id="task-text"
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="무엇을 할까요?"
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="task-memo">메모</label>
              <textarea
                id="task-memo"
                value={memo}
                onChange={e => setMemo(e.target.value)}
                placeholder="추가 메모 (선택사항)"
                rows={2}
              />
            </div>

            <div className="form-group">
              <label htmlFor="task-duration">예상 시간</label>
              <div className="duration-buttons">
                {[5, 10, 15, 30, 45, 60, 90, 120].map(duration => (
                  <button
                    key={duration}
                    type="button"
                    className={`duration-btn ${baseDuration === duration ? 'active' : ''}`}
                    onClick={() => setBaseDuration(duration)}
                  >
                    {duration < 60 ? `${duration}분` : duration === 60 ? '1시간' : duration === 90 ? '1시간 30분' : '2시간'}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="task-resistance">난이도</label>
              <select
                id="task-resistance"
                value={resistance}
                onChange={e => setResistance(e.target.value as Resistance)}
              >
                <option value="low">🟢 쉬움 (x1.0)</option>
                <option value="medium">🟡 보통 (x1.3)</option>
                <option value="high">🔴 어려움 (x1.6)</option>
              </select>
            </div>

            <div className="adjusted-duration-info">
              조정된 예상 시간: <strong>{calculateAdjustedDuration(baseDuration, resistance)}분</strong>
            </div>
          </div>

          {/* 오른쪽 컬럼: 준비 사항 입력 */}
          <div className="form-column form-column-right">
            <div className="preparation-section">
              <div className="preparation-header">
                <h4 className="preparation-title">💡 작업 준비하기</h4>
                <p className="preparation-description">
                  방해물을 예상하고 대처 환경을 준비하면<br />
                  작업 성공률이 높아집니다
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
                  ⭐ 완벽하게 준비된 작업입니다!
                </div>
              )}
            </div>
          </div>

          {/* 하단 액션 버튼 (전체 너비) */}
          <div className="modal-actions modal-actions-full">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn btn-primary">
              {task ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
