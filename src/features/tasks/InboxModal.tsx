/**
 * @file InboxModal.tsx
 * 
 * Role: 인박스 작업을 모달 형태로 표시하는 컴포넌트
 * 
 * Responsibilities:
 * - 시간 블록에 배치되지 않은 작업들을 모달에서 관리
 * - InboxTab의 기능을 모달 형태로 래핑
 * 
 * Key Dependencies:
 * - InboxTab: 실제 인박스 UI 컴포넌트
 */

import InboxTab from './InboxTab';

interface InboxModalProps {
  /** 모달 열림 상태 */
  open: boolean;
  /** 모달 닫기 콜백 */
  onClose: () => void;
}

/**
 * 인박스 모달 컴포넌트
 * 인박스 탭의 내용을 전체 화면 모달 형태로 표시합니다.
 * 
 * @param {InboxModalProps} props - 모달 속성
 * @returns {JSX.Element | null} 인박스 모달 UI 또는 null
 */
export function InboxModal({ open, onClose }: InboxModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-[var(--color-bg-secondary)] text-[var(--color-text)] shadow-2xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div>
            <div className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Task Management</div>
            <h2 className="text-xl font-bold">📥 인박스</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">시간 블록에 배치되지 않은 작업들을 관리하세요.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[var(--color-bg-tertiary)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] transition"
            aria-label="닫기"
          >
            닫기
          </button>
        </header>

        {/* Content - InboxTab을 모달 내부에 렌더링 */}
        <div className="flex-1 overflow-hidden">
          <InboxTab />
        </div>
      </div>
    </div>
  );
}

export default InboxModal;
