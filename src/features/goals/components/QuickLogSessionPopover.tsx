/**
 * QuickLogSessionPopover.tsx
 *
 * @file 빠른 세션 기록 팝오버 컴포넌트
 * @description
 *   - Role: 목표에 대한 빠른 진행량 기록 UI
 *   - Responsibilities:
 *     - 프리셋 버튼으로 빠른 입력 (+5, +10, +15, +30, +60)
 *     - 숫자 직접 입력 지원
 *     - Enter=저장, ESC=취소
 *     - NaN/음수 입력 방지, 0은 no-op
 *     - ESC 스택 정리 (팝오버가 열려 있으면 ESC로 먼저 닫음)
 *   - ADHD 친화적: 빠른 입력과 시각적 피드백
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { RefObject, KeyboardEvent } from 'react';
import { modalStackRegistry } from '@/shared/hooks/modalStackRegistry';

interface QuickLogSessionPopoverProps {
  /** 단위 (예: 분, 페이지, 회) */
  unit: string;
  /** 제출 핸들러 */
  onSubmit: (value: number) => void | Promise<void>;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 트리거 요소 ref (위치 계산용) */
  triggerRef: RefObject<HTMLButtonElement | null>;
}

/** 프리셋 버튼 값들 */
const PRESET_VALUES = [5, 10, 15, 30, 60] as const;

/**
 * Quick Log Session 팝오버 컴포넌트
 */
export default function QuickLogSessionPopover({
  unit,
  onSubmit,
  onClose,
  triggerRef,
}: QuickLogSessionPopoverProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverIdRef = useRef<symbol | null>(null);

  // 팝오버 열릴 때 ESC 스택에 추가
  useEffect(() => {
    const popoverId = Symbol('quick-log-popover');
    popoverIdRef.current = popoverId;
    modalStackRegistry.add(popoverId);

    // 입력창에 포커스
    inputRef.current?.focus();

    return () => {
      if (popoverIdRef.current) {
        modalStackRegistry.remove(popoverIdRef.current);
        popoverIdRef.current = null;
      }
    };
  }, []);

  // ESC 키 처리 (ESC 스택 최상위일 때만)
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (popoverIdRef.current && modalStackRegistry.isTop(popoverIdRef.current)) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // 클릭 외부 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, triggerRef]);

  // 입력값 검증 및 제출
  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    
    // 빈 값은 무시
    if (!trimmed) {
      setError('값을 입력해주세요');
      return;
    }

    const value = parseInt(trimmed, 10);

    // NaN 체크
    if (isNaN(value)) {
      setError('숫자만 입력해주세요');
      return;
    }

    // 음수 체크
    if (value < 0) {
      setError('음수는 입력할 수 없어요');
      return;
    }

    // 0은 no-op (아무것도 안 함)
    if (value === 0) {
      onClose();
      return;
    }

    setError(null);
    void onSubmit(value);
  }, [inputValue, onSubmit, onClose]);

  // 프리셋 버튼 클릭
  const handlePresetClick = useCallback((value: number) => {
    void onSubmit(value);
  }, [onSubmit]);

  // 키보드 이벤트 핸들러
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    // ESC는 window 이벤트에서 처리됨
  }, [handleSubmit]);

  // 입력값 변경 (숫자만 허용)
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // 숫자와 빈 문자열만 허용
    if (value === '' || /^\d+$/.test(value)) {
      setInputValue(value);
      setError(null);
    }
  }, []);

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full z-[1060] mt-1 w-56 rounded-xl bg-gray-900/95 p-3 shadow-2xl backdrop-blur-sm border border-white/10"
      role="dialog"
      aria-label="빠른 세션 기록"
      aria-modal="true"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-white">📝 빠른 기록</h4>
        <button
          onClick={onClose}
          className="text-white/50 hover:text-white p-0.5 rounded hover:bg-white/10"
          aria-label="닫기"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* 프리셋 버튼들 */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {PRESET_VALUES.map((value) => (
          <button
            key={value}
            onClick={() => handlePresetClick(value)}
            className="flex-1 min-w-[40px] rounded-lg bg-indigo-500/20 px-2 py-1.5 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/30 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
          >
            +{value}
          </button>
        ))}
      </div>

      {/* 직접 입력 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="직접 입력"
            className={`w-full rounded-lg border bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors ${
              error 
                ? 'border-red-500/50 focus:border-red-400' 
                : 'border-white/10 focus:border-indigo-400/50'
            }`}
            aria-invalid={!!error}
            aria-describedby={error ? 'quick-log-error' : undefined}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">
            {unit}
          </span>
        </div>
        <button
          onClick={handleSubmit}
          className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          aria-label="저장"
        >
          ✓
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <p id="quick-log-error" className="mt-1.5 text-[10px] text-red-400" role="alert">
          {error}
        </p>
      )}

      {/* 도움말 */}
      <p className="mt-2 text-center text-[10px] text-white/40">
        Enter=저장 · ESC=취소 · 0=무시
      </p>
    </div>
  );
}
