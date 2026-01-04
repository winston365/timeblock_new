import { useEffect, useRef } from 'react';
import { modalStackRegistry } from './modalStackRegistry';

/**
 * Close modal when Escape is pressed while open.
 * 중첩 모달 지원: 가장 위에 있는 모달만 ESC에 반응
 *
 * @note
 *   - IME 조합 중(isComposing)에는 ESC가 동작하지 않습니다.
 *   - useModalHotkeys와 동일한 스택 레지스트리를 공유합니다.
 *
 * @example
 * ```tsx
 * useModalEscapeClose(isOpen, handleClose);
 * ```
 */
export function useModalEscapeClose(isOpen: boolean, onClose: () => void) {
  const modalIdRef = useRef<symbol | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // 모달이 닫히면 스택에서 제거
      if (modalIdRef.current) {
        modalStackRegistry.remove(modalIdRef.current);
        modalIdRef.current = null;
      }
      return;
    }

    // 모달이 열리면 고유 ID 생성 후 스택에 추가
    const modalId = Symbol('modal');
    modalIdRef.current = modalId;
    modalStackRegistry.add(modalId);

    const handleKeyDown = (e: KeyboardEvent) => {
      // IME 조합 중 무시 (한글 입력 등)
      if (e.isComposing) {
        return;
      }

      if (e.key !== 'Escape') return;

      // 스택의 최상위 모달만 반응
      if (!modalStackRegistry.isTop(modalId)) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      modalStackRegistry.remove(modalId);
      modalIdRef.current = null;
    };
  }, [isOpen, onClose]);
}
