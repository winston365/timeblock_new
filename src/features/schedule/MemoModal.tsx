/**
 * MemoModal
 *
 * @role 메모 내용을 크게 보고 편집할 수 있는 전용 모달
 * @input memo (string) - 현재 메모 내용
 * @input onSave (function) - 메모 저장 콜백 (새 메모 내용 전달)
 * @input onClose (function) - 모달 닫기 콜백
 * @output 큰 텍스트 영역을 가진 모달 UI
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './schedule.css';

interface MemoModalProps {
  memo: string;
  onSave: (newMemo: string) => void;
  onClose: () => void;
}

/**
 * 메모 전용 모달 컴포넌트
 *
 * @param {MemoModalProps} props - memo, onSave, onClose
 * @returns {JSX.Element} 메모 모달 UI
 */
export function MemoModal({ memo, onSave, onClose }: MemoModalProps) {
  const [editedMemo, setEditedMemo] = useState(memo);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 모달 열릴 때 textarea에 포커스
  useEffect(() => {
    textareaRef.current?.focus();
    // 커서를 끝으로 이동
    const length = editedMemo.length;
    textareaRef.current?.setSelectionRange(length, length);
  }, []);

  // ESC로 닫기, Ctrl+Enter로 저장
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [editedMemo, onClose]);

  const handleSave = () => {
    onSave(editedMemo);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const modalContent = (
    <div className="modal-overlay memo-modal-overlay" onClick={handleCancel}>
      <div className="modal-content memo-modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📝 메모 편집</h2>
          <button
            className="modal-close"
            onClick={handleCancel}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="modal-body memo-modal-body">
          <textarea
            ref={textareaRef}
            className="memo-modal-textarea"
            value={editedMemo}
            onChange={(e) => setEditedMemo(e.target.value)}
            placeholder="메모를 입력하세요..."
            rows={15}
          />
          <p className="form-hint memo-hint">
            💡 Ctrl+Enter로 저장 | ESC로 닫기
          </p>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCancel}
          >
            취소
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
