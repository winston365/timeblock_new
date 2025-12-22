/**
 * @file modalStackRegistry.ts
 *
 * @role 전역 모달 스택 레지스트리 (공유)
 *
 * @responsibilities
 *   - 중첩 모달의 스택 순서 관리
 *   - top-of-stack 판정 제공
 *   - useModalEscapeClose와 useModalHotkeys 간 스택 공유
 *
 * @note
 *   이 모듈은 useModalEscapeClose와 useModalHotkeys가 동일한 스택을 공유하여
 *   중첩 모달에서 top-of-stack만 반응하도록 보장합니다.
 */

/**
 * 전역 모달 스택
 * Set의 삽입 순서를 사용하여 스택을 구현
 * 가장 마지막에 추가된 항목이 top-of-stack
 */
const modalStack: Set<symbol> = new Set();

/**
 * 모달 스택 레지스트리
 * 
 * 중첩 모달 관리를 위한 공유 스택입니다.
 * useModalEscapeClose와 useModalHotkeys 모두 이 레지스트리를 사용합니다.
 */
export const modalStackRegistry = {
  /**
   * 모달을 스택에 추가
   * @param modalId - 모달 고유 식별자 (Symbol)
   */
  add(modalId: symbol): void {
    modalStack.add(modalId);
  },

  /**
   * 모달을 스택에서 제거
   * @param modalId - 모달 고유 식별자 (Symbol)
   */
  remove(modalId: symbol): void {
    modalStack.delete(modalId);
  },

  /**
   * 모달이 스택의 최상위인지 확인
   * @param modalId - 모달 고유 식별자 (Symbol)
   * @returns 해당 모달이 top-of-stack이면 true
   */
  isTop(modalId: symbol): boolean {
    const stackArray = Array.from(modalStack);
    return stackArray[stackArray.length - 1] === modalId;
  },

  /**
   * 스택 크기 반환 (테스트용)
   * @returns 현재 스택에 등록된 모달 수
   */
  size(): number {
    return modalStack.size;
  },

  /**
   * 스택 초기화 (테스트용)
   */
  clear(): void {
    modalStack.clear();
  },
};
