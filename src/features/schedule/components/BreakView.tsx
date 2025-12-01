/**
 * @file BreakView.tsx
 * @role 집중 세션 사이의 휴식 시간을 관리하는 뷰 컴포넌트
 * @responsibilities
 *   - 휴식 타이머 카운트다운 표시
 *   - 원형 프로그레스 애니메이션 렌더링
 *   - 휴식 건너뛰기 기능 제공
 * @dependencies react, framer-motion
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface BreakViewProps {
    duration?: number; // seconds, default 60
    onFinish: () => void;
}

/**
 * 집중 세션 사이의 휴식 시간을 관리하는 뷰 컴포넌트
 * @param props - 뷰 프로퍼티
 * @param props.duration - 휴식 시간(초), 기본값 60초
 * @param props.onFinish - 휴식 완료 시 호출되는 콜백 함수
 * @returns 휴식 타이머 UI
 */
export function BreakView({ duration = 60, onFinish }: BreakViewProps) {
    const [timeLeft, setTimeLeft] = useState(duration);

    useEffect(() => {
        if (timeLeft <= 0) {
            onFinish();
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, onFinish]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center justify-center rounded-3xl border border-emerald-500/30 bg-emerald-900/20 p-12 backdrop-blur-xl"
        >
            <div className="text-6xl mb-6">☕</div>
            <h2 className="text-3xl font-bold text-emerald-100 mb-2">잠시 휴식!</h2>
            <p className="text-emerald-200/70 mb-8 text-center">
                수고하셨어요. 다음 작업 전에 잠시 숨을 고르세요.
            </p>

            <div className="relative h-48 w-48 flex items-center justify-center mb-8">
                {/* Circular Progress Background */}
                <svg className="absolute inset-0 h-full w-full -rotate-90 transform">
                    <circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="transparent"
                        className="text-emerald-900/50"
                    />
                    <motion.circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="transparent"
                        className="text-emerald-500"
                        strokeDasharray={2 * Math.PI * 88}
                        strokeDashoffset={2 * Math.PI * 88 * (1 - timeLeft / duration)}
                        strokeLinecap="round"
                        animate={{ strokeDashoffset: 2 * Math.PI * 88 * (timeLeft / duration) }} // Reverse logic for countdown feel
                        transition={{ duration: 1, ease: "linear" }}
                    />
                </svg>
                <div className="text-4xl font-bold text-emerald-100">
                    {timeLeft}
                    <span className="text-lg font-normal text-emerald-200/50 ml-1">초</span>
                </div>
            </div>

            <button
                onClick={onFinish}
                className="rounded-full bg-emerald-500/20 px-8 py-3 text-emerald-200 hover:bg-emerald-500/30 transition-colors"
            >
                휴식 건너뛰기
            </button>
        </motion.div>
    );
}
