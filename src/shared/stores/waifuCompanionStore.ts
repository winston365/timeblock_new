/**
 * WaifuCompanionStore - 와이푸 컴패니언 레이어 상태 관리
 *
 * @role 와이푸 캐릭터의 화면 등장/엿보기/숨김 상태 및 애니메이션을 관리하는 Zustand 스토어
 * @input 액션 호출 (show, peek, hide, setMessage)
 * @output 현재 상태(visibility), 메시지, 타이머 ID
 * @external_dependencies
 *   - zustand: 상태 관리 라이브러리
 */

import { create } from 'zustand';

/**
 * 와이푸 표시 상태
 * - 'hidden': 완전히 숨김
 * - 'peeking': 화면 우측 하단에서 살짝 엿보기 (10%)
 * - 'visible': 화면에 등장 (70%)
 */
export type WaifuVisibility = 'hidden' | 'peeking' | 'visible';

interface WaifuExpressionOverride {
  imagePath: string;
}

interface WaifuShowOptions {
  audioPath?: string;
  expression?: {
    imagePath: string;
    durationMs?: number;
  };
}

interface WaifuCompanionState {
  /** 현재 와이푸 표시 상태 */
  visibility: WaifuVisibility;

  /** 현재 표시할 메시지 (작업 완료, 레벨업 등) */
  message: string;

  /** 현재 재생할 오디오 경로 */
  audioPath?: string;

  /** 고정 상태 (true면 자동 숨김 비활성화) */
  isPinned: boolean;

  /** 자동 숨김 타이머 ID */
  autoHideTimer: number | null;


  /** 와이푸 표정 오버라이드 */
  expressionOverride: WaifuExpressionOverride | null;

  /** 표정 오버라이드 타이머 */
  expressionTimer: number | null;

  /** 와이푸를 화면에 완전히 표시 (3초 후 자동으로 peeking 상태로 전환, 고정 시 제외) */
  show: (message?: string, options?: string | WaifuShowOptions) => void;

  /** 와이푸를 엿보기 상태로 전환 */
  peek: () => void;

  /** 와이푸를 완전히 숨김 */
  hide: () => void;

  /** 고정 상태 토글 */
  togglePin: () => void;

  /** 메시지 설정 */
  setMessage: (message: string) => void;

  /** 자동 숨김 타이머 클리어 */
  clearAutoHideTimer: () => void;

  /** 와이푸 표정 오버라이드 설정 */
  setExpressionOverride: (imagePath?: string, durationMs?: number) => void;
}

/**
 * 와이푸 컴패니언 상태 관리 스토어
 *
 * @returns {WaifuCompanionState} 와이푸 컴패니언 상태 및 액션
 * @throws 없음
 * @sideEffects
 *   - show() 호출 시 3초 후 자동으로 peeking 상태로 전환하는 타이머 설정 (고정 시 제외)
 *   - 타이머는 새로운 show() 호출 시 초기화됨
 */
export const useWaifuCompanionStore = create<WaifuCompanionState>((set, get) => ({
  visibility: 'peeking',
  message: '',
  audioPath: undefined,
  isPinned: false,
  autoHideTimer: null,
  expressionOverride: null,
  expressionTimer: null,

  show: (message = '', options) => {

    const state = get();

    const opts = typeof options === 'string' ? { audioPath: options } : options;

    const audioPath = opts?.audioPath;

    const expressionOption = opts?.expression;



    state.clearAutoHideTimer();



    let timer = null;



    if (!state.isPinned) {

      timer = window.setTimeout(() => {

        set({ visibility: 'peeking', autoHideTimer: null });

      }, 3000);

    }



    if (expressionOption?.imagePath) {

      state.setExpressionOverride(expressionOption.imagePath, expressionOption.durationMs);

    } else {

      state.setExpressionOverride();

    }



    set({

      visibility: 'visible',

      message,

      audioPath,

      autoHideTimer: timer,

    });

  },





  peek: () => {
    const state = get();

    // 고정 상태면 무시 (항상 visible 유지)
    if (state.isPinned) return;

    // 기존 타이머가 있으면 클리어
    if (state.autoHideTimer !== null) {
      clearTimeout(state.autoHideTimer);
    }

    set({
      visibility: 'peeking',
      autoHideTimer: null,
    });
  },

  hide: () => {
    const state = get();

    // 기존 타이머가 있으면 클리어
    if (state.autoHideTimer !== null) {
      clearTimeout(state.autoHideTimer);
    }

    set({
      visibility: 'hidden',
      autoHideTimer: null,
    });
  },

  togglePin: () => {
    const state = get();
    const newPinned = !state.isPinned;

    if (newPinned) {
      // 고정 활성화: 타이머 제거하고 visible로 설정
      if (state.autoHideTimer !== null) {
        clearTimeout(state.autoHideTimer);
      }
      set({ isPinned: true, visibility: 'visible', autoHideTimer: null });
    } else {
      // 고정 해제 시 즉시 peeking 상태로 복귀
      if (state.autoHideTimer !== null) {
        clearTimeout(state.autoHideTimer);
      }
      set({ isPinned: false, visibility: 'peeking', autoHideTimer: null });
    }
  },

  setMessage: (message: string) => {
    set({ message });
  },

  clearAutoHideTimer: () => {
    const state = get();
    if (state.autoHideTimer !== null) {
      clearTimeout(state.autoHideTimer);
      set({ autoHideTimer: null });
    }
  },

  setExpressionOverride: (imagePath?: string, durationMs = 6000) => {
    const state = get();

    if (state.expressionTimer !== null) {
      clearTimeout(state.expressionTimer);
    }

    if (!imagePath) {
      set({ expressionOverride: null, expressionTimer: null });
      return;
    }

    let timer: number | null = null;
    if (typeof window !== 'undefined') {
      timer = window.setTimeout(() => {
        set({ expressionOverride: null, expressionTimer: null });
      }, durationMs);
    }

    set({
      expressionOverride: { imagePath },
      expressionTimer: timer,
    });
  },
}));
