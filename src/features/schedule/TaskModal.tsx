/**
 * src/features/schedule/TaskModal.tsx
 * 작업 추가/수정 모달
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

export default function TaskModal({ task, initialBlockId, onSave, onClose }: TaskModalProps) {
  const [text, setText] = useState('');
  const [memo, setMemo] = useState('');
  const [baseDuration, setBaseDuration] = useState(30);
  const [resistance, setResistance] = useState<Resistance>('low');

  // 기존 작업 데이터로 초기화
  useEffect(() => {
    if (task) {
      setText(task.text);
      setMemo(task.memo);
      setBaseDuration(task.baseDuration);
      setResistance(task.resistance);
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
    });
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>{task ? '작업 수정' : '새 작업 추가'}</h3>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
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

          <div className="modal-actions">
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
