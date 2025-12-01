/**
 * @file waifuCompanionStore.ts
 *
 * @description 와이푸 컴패니언 레이어 상태 관리
 *
 * @role 와이푸 캐릭터의 화면 등장/엿보기/숨김 상태 및 애니메이션 관리
 *
 * @responsibilities
 *   - 와이푸 표시 상태 관리 (hidden/peeking/visible)
 *   - 메시지 및 오디오 경로 관리
 *   - 자동 숨김 타이머 관리
 *   - 패널 고정 상태 관리
 *   - 표정 오버라이드 관리
 *   - 현재 이미지 경로 유지 (리마운트 시에도 보존)
 *
 * @dependencies
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

/**
 * 와이푸 표정 오버라이드 인터페이스
 */
interface WaifuExpressionOverride {
  /** 오버라이드할 이미지 경로 */
  imagePath: string;
}

/**
 * show() 액션 옵션 인터페이스
 */
interface WaifuShowOptions {
  /** 재생할 오디오 경로 */
  audioPath?: string;
  /** 표정 오버라이드 설정 */
  expression?: {
    /** 표정 이미지 경로 */
    imagePath: string;
    /** 표정 유지 시간 (ms) */
    durationMs?: number;
  };
}

interface WaifuCompanionState {
  /** 현재 와이푸 표시 상태 */
  visibility: WaifuVisibility;

  /** 현재 표시할 메시지 (작업 완료 등) */
  message: string;

  /** 현재 재생할 오디오 경로 */
  audioPath?: string;

  /** 고정 상태 (true면 자동 숨김 비활성화) */
  isPinned: boolean;

  /** 자동 숨김 타이머 ID */
  autoHideTimer: number | null;

  /** 현재 표시 중인 이미지 경로 (리마운트 시에도 유지) */
  currentImagePath: string | null;

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

  /** 현재 이미지 경로 설정 (리마운트 시에도 유지) */
  setCurrentImagePath: (path: string) => void;
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
  currentImagePath: null,
  expressionOverride: null,
  expressionTimer: null,

  show: (message = '', options) => {

    const currentState = get();

    const opts = typeof options === 'string' ? { audioPath: options } : options;

    const audioPath = opts?.audioPath;

    const expressionOption = opts?.expression;



    currentState.clearAutoHideTimer();



    let autoHideTimerId = null;



    if (!currentState.isPinned) {

      autoHideTimerId = window.setTimeout(() => {

        set({ visibility: 'peeking', autoHideTimer: null });

      }, 3000);

    }



    if (expressionOption?.imagePath) {

      currentState.setExpressionOverride(expressionOption.imagePath, expressionOption.durationMs);

    } else {

      currentState.setExpressionOverride();

    }



    set({

      visibility: 'visible',

      message,

      audioPath,

      autoHideTimer: autoHideTimerId,

    });

  },





  peek: () => {
    const currentState = get();

    // 고정 상태면 무시 (항상 visible 유지)
    if (currentState.isPinned) return;

    // 기존 타이머가 있으면 클리어
    if (currentState.autoHideTimer !== null) {
      clearTimeout(currentState.autoHideTimer);
    }

    set({
      visibility: 'peeking',
      autoHideTimer: null,
    });
  },

  hide: () => {
    const currentState = get();

    // 기존 타이머가 있으면 클리어
    if (currentState.autoHideTimer !== null) {
      clearTimeout(currentState.autoHideTimer);
    }

    set({
      visibility: 'hidden',
      autoHideTimer: null,
    });
  },

  togglePin: () => {
    const currentState = get();
    const newPinned = !currentState.isPinned;

    if (newPinned) {
      // 고정 활성화: 타이머 제거하고 visible로 설정
      if (currentState.autoHideTimer !== null) {
        clearTimeout(currentState.autoHideTimer);
      }
      set({ isPinned: true, visibility: 'visible', autoHideTimer: null });
    } else {
      // 고정 해제 시 즉시 peeking 상태로 복귀
      if (currentState.autoHideTimer !== null) {
        clearTimeout(currentState.autoHideTimer);
      }
      set({ isPinned: false, visibility: 'peeking', autoHideTimer: null });
    }
  },

  setMessage: (message: string) => {
    set({ message });
  },

  clearAutoHideTimer: () => {
    const currentState = get();
    if (currentState.autoHideTimer !== null) {
      clearTimeout(currentState.autoHideTimer);
      set({ autoHideTimer: null });
    }
  },

  setExpressionOverride: (imagePath?: string, durationMs = 6000) => {
    const currentState = get();

    if (currentState.expressionTimer !== null) {
      clearTimeout(currentState.expressionTimer);
    }

    if (!imagePath) {
      set({ expressionOverride: null, expressionTimer: null });
      return;
    }

    let expressionTimerId: number | null = null;
    if (typeof window !== 'undefined') {
      expressionTimerId = window.setTimeout(() => {
        set({ expressionOverride: null, expressionTimer: null });
      }, durationMs);
    }

    set({
      expressionOverride: { imagePath },
      expressionTimer: expressionTimerId,
    });
  },

  setCurrentImagePath: (path: string) => {
    set({ currentImagePath: path });
  },
}));
