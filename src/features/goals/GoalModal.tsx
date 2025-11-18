/**
 * GoalModal - 전역 목표 추가/수정 모달
 *
 * @role 날짜와 무관한 전역 목표 생성 및 수정을 위한 폼 제공
 * @input goal (수정 모드) 또는 undefined (생성 모드)
 * @output 목표 생성/수정 완료 시 콜백 실행
 * @dependencies globalGoalRepository
 */

import { useState, useEffect } from 'react';
import { addGlobalGoal, updateGlobalGoal } from '@/data/repositories/globalGoalRepository';
import type { DailyGoal } from '@/shared/types/domain';
import './goals.css';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal?: DailyGoal; // undefined면 생성 모드, 있으면 수정 모드
  onSaved?: () => void; // 저장 완료 후 콜백
}

// 자주 사용하는 목표 아이콘
const GOAL_ICONS = [
  '📚', '💪', '🎯', '✏️', '🏃', '🎨', '💼', '🎵',
  '🌱', '🔬', '🎓', '💡', '🔥', '⚡', '🌟', '🎪'
];

// 자주 사용하는 목표 색상
const GOAL_COLORS = [
  '#6366f1', // indigo (primary)
  '#22c55e', // green (success)
  '#f59e0b', // amber (warning)
  '#ef4444', // red (danger)
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

/**
 * 목표 추가/수정 모달
 */
export default function GoalModal({ isOpen, onClose, goal, onSaved }: GoalModalProps) {
  const isEditMode = !!goal;

  // 폼 상태
  const [title, setTitle] = useState('');
  const [targetHours, setTargetHours] = useState(0);
  const [targetMinutes, setTargetMinutes] = useState(0);
  const [selectedIcon, setSelectedIcon] = useState('🎯');
  const [selectedColor, setSelectedColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);

  // 수정 모드일 때 기존 데이터 로드
  useEffect(() => {
    if (goal) {
      setTitle(goal.title);
      const hours = Math.floor(goal.targetMinutes / 60);
      const mins = goal.targetMinutes % 60;
      setTargetHours(hours);
      setTargetMinutes(mins);
      setSelectedIcon(goal.icon || '🎯');
      setSelectedColor(goal.color || '#6366f1');
    } else {
      // 생성 모드 - 초기화
      setTitle('');
      setTargetHours(0);
      setTargetMinutes(0);
      setSelectedIcon('🎯');
      setSelectedColor('#6366f1');
    }
  }, [goal, isOpen]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, saving]);

  // 모달 닫기
  const handleClose = () => {
    if (!saving) {
      onClose();
    }
  };

  // 저장 핸들러
  const handleSave = async () => {
    // 유효성 검사
    if (!title.trim()) {
      alert('목표 이름을 입력해주세요.');
      return;
    }

    const totalMinutes = targetHours * 60 + targetMinutes;
    if (totalMinutes <= 0) {
      alert('목표 시간을 1분 이상 설정해주세요.');
      return;
    }

    try {
      setSaving(true);

      if (isEditMode) {
        // 수정 모드
        await updateGlobalGoal(goal.id, {
          title: title.trim(),
          targetMinutes: totalMinutes,
          icon: selectedIcon,
          color: selectedColor,
        });
      } else {
        // 생성 모드
        await addGlobalGoal({
          title: title.trim(),
          targetMinutes: totalMinutes,
          icon: selectedIcon,
          color: selectedColor,
        });
      }

      // 목표 변경 이벤트 발생 (GoalPanel에서 새로고침)
      window.dispatchEvent(new Event('goal-changed'));

      // 성공 시 콜백 실행 및 모달 닫기
      if (onSaved) {
        onSaved();
      }
      onClose();
    } catch (error) {
      console.error('[GoalModal] Failed to save goal:', error);
      alert('목표 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // Enter 키 핸들러
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content goal-modal" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="modal-header">
          <h2 className="modal-title">
            {isEditMode ? '목표 수정' : '새 목표 추가'}
          </h2>
          <button
            className="modal-close-btn"
            onClick={handleClose}
            disabled={saving}
            aria-label="모달 닫기"
          >
            ✕
          </button>
        </div>

        {/* 바디 */}
        <div className="modal-body">
          {/* 목표 이름 */}
          <div className="form-group">
            <label className="form-label" htmlFor="goal-title">
              목표 이름 *
            </label>
            <input
              id="goal-title"
              type="text"
              className="form-input"
              placeholder="예: 영어 공부, 운동, 독서"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              disabled={saving}
            />
          </div>

          {/* 목표 시간 */}
          <div className="form-group">
            <label className="form-label">목표 시간 *</label>
            <div className="time-input-group">
              <div className="time-input-item">
                <input
                  type="number"
                  className="form-input time-input"
                  placeholder="0"
                  min="0"
                  max="23"
                  value={targetHours || ''}
                  onChange={(e) => setTargetHours(Math.max(0, parseInt(e.target.value) || 0))}
                  disabled={saving}
                />
                <span className="time-input-label">시간</span>
              </div>
              <div className="time-input-item">
                <input
                  type="number"
                  className="form-input time-input"
                  placeholder="0"
                  min="0"
                  max="59"
                  value={targetMinutes || ''}
                  onChange={(e) => setTargetMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  disabled={saving}
                />
                <span className="time-input-label">분</span>
              </div>
            </div>
          </div>

          {/* 아이콘 선택 */}
          <div className="form-group">
            <label className="form-label">아이콘</label>
            <div className="icon-selector">
              {GOAL_ICONS.map(icon => (
                <button
                  key={icon}
                  className={`icon-option ${selectedIcon === icon ? 'selected' : ''}`}
                  onClick={() => setSelectedIcon(icon)}
                  disabled={saving}
                  aria-label={`아이콘 ${icon} 선택`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* 색상 선택 */}
          <div className="form-group">
            <label className="form-label">색상</label>
            <div className="color-selector">
              {GOAL_COLORS.map(color => (
                <button
                  key={color}
                  className={`color-option ${selectedColor === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                  disabled={saving}
                  aria-label={`색상 ${color} 선택`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={handleClose}
            disabled={saving}
          >
            취소
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '저장 중...' : isEditMode ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}
