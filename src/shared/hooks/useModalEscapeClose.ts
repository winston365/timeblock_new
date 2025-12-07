import { useEffect, useRef } from 'react';

/**
 * 전역 모달 스택 (중첩 모달 관리용)
 * 가장 최근에 열린 모달만 ESC에 반응하도록 함
 */
const modalStack: Set<symbol> = new Set();

/**
 * Close modal when Escape is pressed while open.
 * 중첩 모달 지원: 가장 위에 있는 모달만 ESC에 반응
 */
export function useModalEscapeClose(isOpen: boolean, onClose: () => void) {
  const modalIdRef = useRef<symbol | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // 모달이 닫히면 스택에서 제거
      if (modalIdRef.current) {
        modalStack.delete(modalIdRef.current);
        modalIdRef.current = null;
      }
      return;
    }

    // 모달이 열리면 고유 ID 생성 후 스택에 추가
    const modalId = Symbol('modal');
    modalIdRef.current = modalId;
    modalStack.add(modalId);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      // 스택의 마지막 요소(가장 위 모달)만 반응
      const stackArray = Array.from(modalStack);
      const topModal = stackArray[stackArray.length - 1];
      
      if (topModal === modalId) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      modalStack.delete(modalId);
      modalIdRef.current = null;
    };
  }, [isOpen, onClose]);
}
