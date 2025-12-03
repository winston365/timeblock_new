/**
 * CenterContent - 중앙 콘텐츠 영역
 *
 * @role 메인 스케줄 뷰를 렌더링하는 중앙 콘텐츠 컨테이너
 * @output 스케줄 뷰를 포함한 섹션 UI
 * @dependencies ScheduleView
 */

import ScheduleView from '@/features/schedule/ScheduleView';

/**
 * 중앙 콘텐츠 영역 컴포넌트
 * @returns 스케줄 뷰를 포함한 메인 콘텐츠 섹션
 */
export default function CenterContent() {
  return (
    <section className="flex flex-1 flex-col overflow-hidden" id="main-content" aria-label="타임블록 스케줄러">
      <ScheduleView />
    </section>
  );
}
