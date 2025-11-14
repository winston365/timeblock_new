/**
 * CenterContent - 중앙 메인 컨텐츠 영역
 */

import type { DailyData } from '@/shared/types/domain';

interface CenterContentProps {
  activeTab: string;
  dailyData: DailyData | null;
}

export default function CenterContent({ activeTab: _activeTab, dailyData }: CenterContentProps) {
  return (
    <section className="center-content">
      <div className="timeline-section">
        <h2>타임블럭 스케줄러</h2>

        {!dailyData ? (
          <div>데이터 로딩 중...</div>
        ) : (
          <div>
            <p>작업 개수: {dailyData.tasks.length}</p>
            <p>완료된 작업: {dailyData.tasks.filter(t => t.completed).length}</p>
            <p>인박스 작업: {dailyData.tasks.filter(t => !t.timeBlock).length}</p>

            <div style={{ marginTop: '2rem' }}>
              <h3>타임블럭 (추후 구현)</h3>
              <p>- 6개 타임블럭 그리드</p>
              <p>- 작업 카드</p>
              <p>- 드래그 앤 드롭</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
