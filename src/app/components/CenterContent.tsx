/**
 * CenterContent - 중앙 메인 컨텐츠 영역
 *
 * @role 중앙 메인 영역에 타임블록 스케줄러 표시
 * @input activeTab: 현재 활성화된 탭 (미사용), dailyData: 일일 데이터 (미사용)
 * @output 타임블록 스케줄러 UI
 * @dependencies ScheduleView 컴포넌트
 */

import ScheduleView from '@/features/schedule/ScheduleView';

interface CenterContentProps {
  activeTab: string;
  dailyData: unknown; // 더 이상 직접 사용하지 않음
}

/**
 * 중앙 컨텐츠 컴포넌트 - 타임블록 스케줄러 표시
 * @param props - CenterContentProps
 * @returns 중앙 컨텐츠 UI
 */
export default function CenterContent({ activeTab: _activeTab, dailyData: _dailyData }: CenterContentProps) {
  return (
    <section className="center-content" id="main-content" aria-label="타임블록 스케줄러">
      <ScheduleView />
    </section>
  );
}
