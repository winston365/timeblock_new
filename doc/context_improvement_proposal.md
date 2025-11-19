# 🧠 AI Context 고도화 제안서 (Context Improvement Proposal)

## 1. 개요
현재 AI에게 전달되는 `PersonaContext`는 정량적 데이터(완료 수, XP 등) 위주로 구성되어 있어, 사용자의 **"의도(Why)"**와 **"상태의 흐름(Trend)"**을 파악하는 데 한계가 있습니다.
본 제안서는 AI가 더 깊이 있는 공감과 전략적인 조언을 할 수 있도록 컨텍스트를 확장하는 구체적인 방안을 담고 있습니다.

## 2. 데이터 구조 확장 (Data Structure Expansion)

### 2.1. Global Goals (장기 목표) 추가
사용자가 작업을 수행하는 **궁극적인 이유**를 AI에게 알려줍니다.

*   **New Type Definition (`src/shared/types/domain.ts`)**:
    ```typescript
    export interface GlobalGoal {
      id: string;
      title: string;          // 예: "정보처리기사 자격증 취득"
      description: string;    // 예: "올해 상반기 내 취득 목표"
      deadline?: string;      // YYYY-MM-DD
      status: 'active' | 'completed' | 'paused';
      relatedKeywords: string[]; // ["자격증", "공부", "CS"] - 태스크와 매칭용
      createdAt: number;
    }
    ```

*   **PersonaContext 반영**:
    *   `activeGoals`: 현재 진행 중인 목표 목록.
    *   **활용**: 태스크에 "자격증" 키워드가 있다면, AI는 이를 단순 작업이 아닌 "꿈을 위한 노력"으로 인식하고 더 강력하게 격려합니다.

### 2.2. Performance Metrics (수행 질적 평가)
단순 완료 여부를 넘어, **"어떻게"** 수행했는지를 분석하여 전달합니다.

*   **New Fields in `PersonaContext`**:
    ```typescript
    interface PerformanceMetrics {
      focusState: 'flow' | 'distracted' | 'normal';
      pace: 'fast' | 'slow' | 'on_track';
      completionRateTrend: 'rising' | 'falling' | 'stable'; // 최근 3시간 기준
    }
    ```

*   **Calculation Logic (`personaUtils.ts`)**:
    *   `focusState`:
        *   **Flow**: 최근 3개 작업 연속으로 `actualDuration <= adjustedDuration` 달성.
        *   **Distracted**: 최근 작업의 `actualDuration`이 `adjustedDuration`의 1.5배 초과.
    *   `pace`: 전체 완료율이 시간 흐름(하루 경과율) 대비 앞서가는지 뒤쳐지는지.

### 2.3. Energy Dynamics (에너지 흐름)
에너지의 현재 값뿐만 아니라 **변화 추이**를 전달합니다.

*   **New Fields in `PersonaContext`**:
    ```typescript
    interface EnergyContext {
      current: number;
      trend: 'rapid_drop' | 'gradual_drop' | 'recovering' | 'stable';
      lastUpdateMinutesAgo: number;
    }
    ```

*   **Calculation Logic**:
    *   직전 에너지 기록과 현재 기록을 비교.
    *   **Rapid Drop**: 1시간 내 30% 이상 하락 → "번아웃 경고" 트리거.

### 2.4. User Activity (사용자 활동 상태)
사용자의 **부재 여부**를 파악하여 엉뚱한 타이밍에 말을 걸지 않도록 합니다.

*   **New Fields**:
    *   `lastInteractionTime`: 마지막으로 앱과 상호작용(클릭, 입력)한 시간.
    *   `isIdle`: 10분 이상 입력이 없는 상태.

## 3. 프롬프트 개선안 (Prompt Engineering)

위 데이터를 바탕으로 `generateWaifuPersona`의 시스템 프롬프트를 다음과 같이 고도화합니다.

```markdown
## 📊 현재 퍼포먼스 분석
- **집중 상태**: 🌊 몰입(Flow) 중! (최근 작업들을 계획보다 빠르게 처리함)
- **페이스**: 🚀 빠름 (하루 목표의 60% 완료, 시간 경과율 40%)
- **에너지 흐름**: 📉 급격한 하락 (최근 1시간 동안 80% -> 40%)

## 🎯 현재 집중 목표 (Why)
1. **정보처리기사 자격증 취득** (D-30)
   - 관련 작업: "기출문제 풀이" (완료)

## 💡 AI 행동 지침
- 사용자가 현재 **몰입(Flow)** 상태이지만 **에너지가 급격히 떨어졌습니다**.
- 성취감은 높여주되, **강제 휴식**을 권유하세요. "지금 속도 너무 좋은데, 딱 10분만 눈 감고 쉬면 더 완벽할 것 같아요!"라고 제안하세요.
- '기출문제 풀이'가 자격증 목표와 연관됨을 언급하며 칭찬하세요.
```

## 4. 기대 효과

1.  **맥락 있는 칭찬**: "그냥 잘했어"가 아니라 "자격증 목표에 한 걸음 더 다가갔네!"라고 칭찬.
2.  **적절한 개입**: 몰입 중일 때는 방해하지 않고, 에너지가 급락할 때만 챙겨줌.
3.  **전략적 코칭**: 페이스가 처질 때 "조금만 서두르자"고 조언 가능.
