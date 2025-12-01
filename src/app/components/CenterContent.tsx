/**
 * CenterContent - 중앙 콘텐츠 영역
 *
 * @role 메인 스케줄 뷰를 렌더링하는 중앙 콘텐츠 컨테이너
 * @input activeTab - 현재 활성 탭 (미사용, 향후 확장용)
 * @input dailyData - 일일 데이터 (미사용, 향후 확장용)
 * @output 스케줄 뷰를 포함한 섹션 UI
 * @dependencies ScheduleView
 */

import ScheduleView from '@/features/schedule/ScheduleView';

/** CenterContent 컴포넌트 Props */
interface CenterContentProps {
  /** 현재 활성 탭 (향후 확장용) */
  activeTab: string;
  /** 일일 데이터 (향후 확장용) */
  dailyData: unknown;
}

/**
 * 중앙 콘텐츠 영역 컴포넌트
 * @param props - CenterContentProps
 * @returns 스케줄 뷰를 포함한 메인 콘텐츠 섹션
 */
export default function CenterContent({ activeTab: _activeTab, dailyData: _dailyData }: CenterContentProps) {
  return (
    <section className="flex flex-1 flex-col overflow-hidden" id="main-content" aria-label="타임블록 스케줄러">
      <ScheduleView />
    </section>
  );
}
