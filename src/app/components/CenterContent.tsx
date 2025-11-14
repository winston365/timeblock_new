/**
 * CenterContent - 중앙 메인 컨텐츠 영역
 */

import ScheduleView from '@/features/schedule/ScheduleView';

interface CenterContentProps {
  activeTab: string;
  dailyData: unknown; // 더 이상 직접 사용하지 않음
}

export default function CenterContent({ activeTab: _activeTab, dailyData: _dailyData }: CenterContentProps) {
  return (
    <section className="center-content" id="main-content" aria-label="타임블록 스케줄러">
      <ScheduleView />
    </section>
  );
}
