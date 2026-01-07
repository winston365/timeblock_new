/**
 * CenterContent - 중앙 콘텐츠 영역
 *
 * @role 모드에 따라 스케줄 뷰, 목표 뷰, 인박스 뷰를 렌더링
 * @output 현재 모드에 맞는 콘텐츠 UI
 * @dependencies
 *   - ScheduleView: 타임블럭 스케줄 뷰
 *   - GoalsInlineView: 목표 관리 인라인 뷰
 *   - InboxInlineView: 인박스 인라인 뷰
 *   - useScheduleViewModeStore: 모드 상태 스토어
 */

import { useMemo } from 'react';
import ScheduleView from '@/features/schedule/ScheduleView';
import { GoalsInlineView } from '@/features/goals/GoalsInlineView';
import { InboxInlineView } from '@/features/tasks/InboxInlineView';
import { useScheduleViewModeStore } from '@/shared/stores/useScheduleViewModeStore';

/**
 * 중앙 콘텐츠 영역 컴포넌트
 * 스케줄 뷰 모드에 따라 적절한 콘텐츠를 렌더링합니다.
 *
 * @returns 현재 모드에 맞는 콘텐츠 섹션
 */
export default function CenterContent() {
  const mode = useScheduleViewModeStore((state) => state.mode);

  const ariaLabel = useMemo(() => {
    switch (mode) {
      case 'goals':
        return '목표 관리';
      case 'inbox':
        return '인박스';
      default:
        return '타임블록 스케줄러';
    }
  }, [mode]);

  return (
    <section className="flex flex-1 flex-col overflow-hidden" aria-label={ariaLabel}>
      {mode === 'timeblock' && <ScheduleView />}
      {mode === 'goals' && <GoalsInlineView />}
      {mode === 'inbox' && <InboxInlineView />}
    </section>
  );
}
