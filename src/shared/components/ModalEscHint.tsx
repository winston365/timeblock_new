/**
 * @file ModalEscHint.tsx
 * @description 모달에서 ESC 키로 닫을 수 있음을 안내하는 힌트 컴포넌트
 *
 * @role ADHD 친화적 UX - 모달 닫기 방법을 명확하게 안내
 * @usage 모달 header 또는 footer에 배치
 *
 * @example
 * <ModalEscHint />
 * <ModalEscHint variant="footer" />
 */

interface ModalEscHintProps {
  /** 표시 위치에 따른 스타일 변형 */
  variant?: 'header' | 'footer' | 'inline';
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * ESC 키 힌트 컴포넌트
 * 사용자에게 ESC 키로 모달을 닫을 수 있음을 알려줍니다.
 */
export function ModalEscHint({ variant = 'inline', className = '' }: ModalEscHintProps) {
  const baseClasses = 'inline-flex items-center gap-1.5 text-[var(--color-text-tertiary)]';

  const variantClasses = {
    header: 'text-[10px]',
    footer: 'text-[10px] justify-center',
    inline: 'text-xs',
  };

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      <kbd className="rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 text-[10px] font-mono font-medium text-[var(--color-text-secondary)] shadow-sm">
        ESC
      </kbd>
      <span>로 닫기</span>
    </span>
  );
}

export default ModalEscHint;
