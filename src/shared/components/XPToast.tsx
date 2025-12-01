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
        } pointer-events-auto flex w-full max-w-md rounded-2xl bg-[linear-gradient(135deg,#667eea_0%,#764ba2_100%)] px-5 py-4 text-white shadow-lg ring-1 ring-black/5`}
    >
      <div className="flex items-center gap-3">
        <div className="text-3xl animate-bounce">🎉</div>
        <div className="flex flex-col gap-1">
          <div className="text-base font-semibold">
            {message || '축하합니다!'}
          </div>
          <div className="text-xl font-bold text-[#ffd700] drop-shadow">
            +{xp} XP
          </div>
        </div>
      </div>
      <div className="ml-auto flex border-l border-white/20 pl-4">
        <button
          onClick={() => toast.dismiss(t.id)}
          className="flex w-full items-center justify-center rounded-none rounded-r-lg border-none p-0 text-sm font-medium text-white hover:text-white/80 focus:outline-none focus:ring-0"
        >
          Close
        </button>
      </div>
    </div>
  );
}
