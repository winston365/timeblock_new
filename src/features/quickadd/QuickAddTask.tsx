/**
 * QuickAddTask
 *
 * @role 글로벌 단축키로 호출되는 빠른 작업 추가 컴포넌트
 * @input 없음 (독립 실행)
 * @output 작업 추가 폼 및 인박스 저장
 * @external_dependencies
 *   - inboxRepository: 인박스 작업 추가
 *   - electronAPI: 윈도우 닫기, 알림 표시
 */

import { useState, useEffect } from 'react';
import type { Task, Resistance } from '@/shared/types/domain';
import { calculateAdjustedDuration, generateId } from '@/shared/lib/utils';
import { addInboxTask } from '@/data/repositories/inboxRepository';
import { useGameState } from '@/shared/hooks/useGameState';
import './quickadd.css';

/**
 * 글로벌 단축키용 빠른 작업 추가 컴포넌트
 *
 * @returns {JSX.Element} 빠른 작업 추가 폼
 * @sideEffects
 *   - 작업 저장 시 인박스에 추가
 *   - 저장 완료 시 데스크탑 알림
 *   - 저장 완료 시 윈도우 닫기
 */
export default function QuickAddTask() {
  const { updateQuestProgress } = useGameState();
  const [text, setText] = useState('');
  const [memo, setMemo] = useState('');
  const [baseDuration, setBaseDuration] = useState(15);
  const [resistance, setResistance] = useState<Resistance>('low');
  const [preparation1, setPreparation1] = useState('');
  const [preparation2, setPreparation2] = useState('');
  const [preparation3, setPreparation3] = useState('');
  const [saving, setSaving] = useState(false);

  // 자동 태그 파싱 함수 (스페이스 입력 시에만 실행)
  const parseAndApplyTags = (inputText: string) => {
    let updatedText = inputText;
    let hasChanges = false;

    // 시간 태그 감지 및 적용 (T5, T10, T15, T30, T60, T90)
    const timeTagMatch = inputText.match(/\b(T5|T10|T15|T30|T60|T90)\b/i);
    if (timeTagMatch) {
      const timeTag = timeTagMatch[1].toUpperCase();
      const durationMap: { [key: string]: number } = {
        'T5': 5,
        'T10': 10,
        'T15': 15,
        'T30': 30,
        'T60': 60,
        'T90': 90,
      };
      const duration = durationMap[timeTag];
      if (duration !== undefined) {
        setBaseDuration(duration);
        updatedText = updatedText.replace(/\b(T5|T10|T15|T30|T60|T90)\b/gi, '');
        hasChanges = true;
      }
    }

    // 난이도 태그 감지 및 적용 (D1, D2, D3)
    const difficultyTagMatch = inputText.match(/\b(D1|D2|D3)\b/i);
    if (difficultyTagMatch) {
      const difficultyTag = difficultyTagMatch[1].toUpperCase();
      const difficultyMap: { [key: string]: Resistance } = {
        'D1': 'low',
        'D2': 'medium',
        'D3': 'high',
      };
      const difficulty = difficultyMap[difficultyTag];
      if (difficulty !== undefined) {
        setResistance(difficulty);
        updatedText = updatedText.replace(/\b(D1|D2|D3)\b/gi, '');
        hasChanges = true;
      }
    }

    // 태그가 제거된 경우에만 공백 정리
    if (hasChanges) {
      updatedText = updatedText.replace(/\s+/g, ' ').trim();
    }

    return updatedText;
  };

  // 텍스트 변경 핸들러 (스페이스 입력 시 태그 파싱)
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputText = e.target.value;

    // 스페이스를 입력했는지 확인
    const isSpaceInput = inputText.length > text.length && inputText.endsWith(' ');

    if (isSpaceInput) {
      const parsedText = parseAndApplyTags(inputText);
      setText(parsedText);
    } else {
      setText(inputText);
    }
  };

  // Ctrl+Enter로 저장, ESC로 닫기
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        const form = document.querySelector('.quickadd-form') as HTMLFormElement;
        if (form) {
          form.requestSubmit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!text.trim()) {
      alert('작업 제목을 입력해주세요.');
      return;
    }

    setSaving(true);

    try {
      const adjustedDuration = calculateAdjustedDuration(baseDuration, resistance);

      const newTask: Task = {
        id: generateId('task'),
        text: text.trim(),
        memo: memo.trim(),
        baseDuration,
        resistance,
        adjustedDuration,
        timeBlock: null, // 인박스는 항상 null
        completed: false,
        actualDuration: 0,
        createdAt: new Date().toISOString(),
        completedAt: null,
        preparation1: preparation1.trim(),
        preparation2: preparation2.trim(),
        preparation3: preparation3.trim(),
      };

      await addInboxTask(newTask);

      // 준비된 작업이면 퀘스트 진행
      const isPrepared = !!(preparation1.trim() && preparation2.trim() && preparation3.trim());
      if (isPrepared) {
        await updateQuestProgress('prepare_tasks', 1);
      }

      // 데스크탑 알림 (Electron API 사용)
      if (window.electronAPI) {
        await window.electronAPI.showNotification(
          '작업 추가 완료',
          `"${text.trim()}" 작업이 인박스에 추가되었습니다.`
        );
      }

      // 윈도우 닫기 (Electron API 사용)
      if (window.electronAPI) {
        await window.electronAPI.closeQuickAddWindow();
      }
    } catch (error) {
      console.error('Failed to add task:', error);
      alert('작업 추가에 실패했습니다.');
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.closeQuickAddWindow();
    }
  };

  return (
    <div className="quickadd-container">
      <div className="quickadd-header">
        <h2>⚡ 빠른 작업 추가</h2>
        <p className="quickadd-subtitle">인박스에 작업을 추가합니다</p>
      </div>

      <form className="quickadd-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="task-text">작업 제목 *</label>
          <input
            id="task-text"
            type="text"
            value={text}
            onChange={handleTextChange}
            placeholder="무엇을 할까요? (예: T30 D2 보고서 작성)"
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
            rows={3}
            style={{ resize: 'vertical' }}
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

        <div className="preparation-section">
          <div className="preparation-header">
            <h4 className="preparation-title">💡 작업 준비하기 (선택)</h4>
          </div>

          <div className="form-group">
            <label htmlFor="preparation-1">⚠️ 예상되는 방해물 #1</label>
            <input
              id="preparation-1"
              type="text"
              value={preparation1}
              onChange={e => setPreparation1(e.target.value)}
              placeholder="예: 스마트폰 알림, 배고픔, 피로..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="preparation-2">⚠️ 예상되는 방해물 #2</label>
            <input
              id="preparation-2"
              type="text"
              value={preparation2}
              onChange={e => setPreparation2(e.target.value)}
              placeholder="예: 불편한 자세, 소음, 다른 업무..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="preparation-3">✅ 대처 환경/전략</label>
            <input
              id="preparation-3"
              type="text"
              value={preparation3}
              onChange={e => setPreparation3(e.target.value)}
              placeholder="예: 집중 모드 켜기, 간식 준비, 휴식 계획..."
            />
          </div>

          {preparation1 && preparation2 && preparation3 && (
            <div className="preparation-complete-badge">
              ⭐ 완벽하게 준비된 작업입니다!
            </div>
          )}
        </div>

        <div className="quickadd-actions">
          <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={saving}>
            취소 (ESC)
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? '저장 중...' : '추가 (Ctrl+Enter)'}
          </button>
        </div>
      </form>

      <div className="quickadd-hint">
        💡 <strong>팁:</strong> T30 (30분), D2 (보통 난이도)와 같은 태그를 제목에 입력하면 자동으로 적용됩니다
      </div>
    </div>
  );
}
