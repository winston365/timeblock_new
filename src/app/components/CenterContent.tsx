import ScheduleView from '@/features/schedule/ScheduleView';

interface CenterContentProps {
  activeTab: string;
  dailyData: unknown;
}

export default function CenterContent({ activeTab: _activeTab, dailyData: _dailyData }: CenterContentProps) {
  return (
    <section className="flex flex-1 flex-col overflow-hidden" id="main-content" aria-label="타임블록 스케줄러">
      <ScheduleView />
    </section>
  );
}
