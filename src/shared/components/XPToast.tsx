/**
 * @file XPToast.tsx
 * 
 * @description
 * Role: XP 획득 시 표시되는 토스트 알림 컴포넌트
 * 
 * Responsibilities:
 * - XP 보상 획득 시 시각적 피드백 제공
 * - 애니메이션과 함께 XP 수치 및 메시지 표시
 * - react-hot-toast와 통합된 커스텀 토스트 UI
 * 
 * Key Dependencies:
 * - react-hot-toast: 토스트 표시 및 dismiss 처리
 */

import { toast, Toast } from 'react-hot-toast';

/** XPToast 컴포넌트의 props 인터페이스 */
interface XPToastProps {
  /** 획득한 XP 수치 */
  xp: number;
  /** 표시할 메시지 (기본값: '축하합니다!') */
  message?: string;
  /** react-hot-toast에서 제공하는 Toast 객체 */
  t: Toast;
}

/**
 * XP 보상 토스트 컴포넌트
 * 
 * react-hot-toast의 커스텀 토스트로 사용되며, XP 획득 시 시각적 피드백을 제공한다.
 * 
 * @param props - XPToast 컴포넌트 props
 * @param props.xp - 획득한 XP 수치
 * @param props.message - 표시할 메시지
 * @param props.t - react-hot-toast의 Toast 객체
 * @returns XP 토스트 React 엘리먼트
 */
export default function XPToast({ xp, message, t }: XPToastProps) {
  return (
    <div
      className={`${t.visible ? 'animate-enter' : 'animate-leave'
        } pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl bg-white/90 p-4 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl dark:bg-gray-900/90 dark:ring-white/10`}
    >
      <div className="flex items-start gap-4">
        {/* Icon Area - App Icon Style */}
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
          <span className="text-lg">✨</span>
        </div>

        {/* Content Area */}
        <div className="flex-1 pt-0.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              XP 획득
            </h3>
            <span className="ml-2 inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600 dark:border-blue-900/30 dark:bg-blue-900/20 dark:text-blue-400">
              +{xp} XP
            </span>
          </div>
          <p className="mt-1 text-sm leading-snug text-gray-500 dark:text-gray-400">
            {message || '목표를 달성했습니다!'}
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={() => toast.dismiss(t.id)}
          className="flex-shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          <span className="sr-only">Close</span>
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
