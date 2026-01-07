/**
 * InboxInlineView - 인라인 인박스 뷰 (모달 아님)
 *
 * @file InboxInlineView.tsx
 * @role 중앙 영역에서 직접 표시되는 인박스 뷰
 * @responsibilities
 *   - InboxTab 렌더링 (모달 wrapper 없이)
 *   - 모달과 동일한 기능 제공
 * @dependencies
 *   - InboxTab: 인박스 UI 컴포넌트
 */

import InboxTab from './InboxTab';

/**
 * 인라인 인박스 뷰 컴포넌트
 * CenterContent에서 모드 전환 시 표시됩니다.
 *
 * @returns {JSX.Element} 인박스 관리 UI
 */
export function InboxInlineView() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--color-bg-secondary)] text-[var(--color-text)]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
        <div>
          <div className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Task Management</div>
          <h2 className="text-xl font-bold">📥 인박스</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">시간 블록에 배치되지 않은 작업들을 관리하세요.</p>
        </div>
      </header>

      {/* Content - InboxTab 렌더링 */}
      <div className="flex-1 overflow-hidden">
        <InboxTab />
      </div>
    </div>
  );
}

export default InboxInlineView;
