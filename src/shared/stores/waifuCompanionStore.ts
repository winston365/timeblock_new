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

interface WaifuCompanionState {
  /** 현재 와이푸 표시 상태 */
  visibility: WaifuVisibility;

  /** 현재 표시할 메시지 (작업 완료, 레벨업 등) */
  message: string;

  /** 자동 숨김 타이머 ID */
  autoHideTimer: number | null;

  /** 와이푸를 화면에 완전히 표시 (3초 후 자동으로 peeking 상태로 전환) */
  show: (message?: string) => void;

  /** 와이푸를 엿보기 상태로 전환 */
  peek: () => void;

  /** 와이푸를 완전히 숨김 */
  hide: () => void;

  /** 메시지 설정 */
  setMessage: (message: string) => void;

  /** 자동 숨김 타이머 클리어 */
  clearAutoHideTimer: () => void;
}

/**
 * 와이푸 컴패니언 상태 관리 스토어
 *
 * @returns {WaifuCompanionState} 와이푸 컴패니언 상태 및 액션
 * @throws 없음
 * @sideEffects
 *   - show() 호출 시 3초 후 자동으로 peeking 상태로 전환하는 타이머 설정
 *   - 타이머는 새로운 show() 호출 시 초기화됨
 */
export const useWaifuCompanionStore = create<WaifuCompanionState>((set, get) => ({
  visibility: 'peeking',
  message: '',
  autoHideTimer: null,

  show: (message = '') => {
    const state = get();

    // 기존 타이머가 있으면 클리어
    if (state.autoHideTimer !== null) {
      clearTimeout(state.autoHideTimer);
    }

    // 3초 후 자동으로 peeking 상태로 전환
    const timer = window.setTimeout(() => {
      set({ visibility: 'peeking', autoHideTimer: null });
    }, 3000);

    set({
      visibility: 'visible',
      message,
      autoHideTimer: timer,
    });
  },

  peek: () => {
    const state = get();

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
}));
