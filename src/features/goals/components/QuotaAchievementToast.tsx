/**
 * QuotaAchievementToast.tsx
 *
 * @file 오늘의 할당량 달성 시 표시되는 축하 토스트
 * @description
 *   - Role: 오늘까지의 목표량 달성 시 시각적 피드백 제공
 *   - Responsibilities:
 *     - 작은 성취에 대한 축하 메시지 표시
 *     - react-hot-toast와 통합된 커스텀 토스트 UI
 *   - Key Dependencies:
 *     - react-hot-toast: 토스트 표시 및 dismiss 처리
 */

import { toast, Toast } from 'react-hot-toast';

/** QuotaAchievementToast 컴포넌트의 props 인터페이스 */
interface QuotaAchievementToastProps {
  /** 목표 제목 */
  goalTitle: string;
  /** 목표 아이콘 */
  goalIcon?: string;
  /** react-hot-toast에서 제공하는 Toast 객체 */
  t: Toast;
}

/**
 * 오늘의 할당량 달성 축하 토스트 컴포넌트
 *
 * react-hot-toast의 커스텀 토스트로 사용되며, 오늘 목표 달성 시 축하 피드백을 제공한다.
 *
 * @param props - QuotaAchievementToast 컴포넌트 props
 * @param props.goalTitle - 목표 제목
 * @param props.goalIcon - 목표 아이콘 (이모지)
 * @param props.t - react-hot-toast의 Toast 객체
 * @returns 축하 토스트 React 엘리먼트
 */
export default function QuotaAchievementToast({ goalTitle, goalIcon, t }: QuotaAchievementToastProps) {
  return (
    <div
      className={`${
        t.visible ? 'animate-enter' : 'animate-leave'
      } pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500/90 to-teal-500/90 p-4 shadow-2xl ring-1 ring-white/20 backdrop-blur-xl`}
    >
      <div className="flex items-start gap-4">
        {/* Icon Area */}
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-lg">
          <span className="text-lg">{goalIcon || '🎯'}</span>
        </div>

        {/* Content Area */}
        <div className="flex-1 pt-0.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              오늘 목표 달성! 🎉
            </h3>
            <span className="ml-2 inline-flex items-center rounded-full border border-white/30 bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white">
              ✨ 순조로워요
            </span>
          </div>
          <p className="mt-1 text-sm leading-snug text-white/80">
            {goalTitle}
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={() => toast.dismiss(t.id)}
          className="flex-shrink-0 rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-emerald-500"
        >
          <span className="sr-only">닫기</span>
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
