/**
 * @file FocusTimer.tsx
 * @role 집중 모드 타이머 원형 프로그레스 컴포넌트
 * @responsibilities
 *   - 남은 시간 시각적 표시 (SVG 원형 프로그레스 바)
 *   - 진행률에 따른 색상 변화
 *   - 애니메이션 효과 (framer-motion)
 * @dependencies
 *   - framer-motion: 애니메이션
 */
import { motion } from 'framer-motion';
import { ReactNode } from 'react';

/**
 * FocusTimer 컴포넌트 Props
 * @param remainingMinutes - 남은 시간 (분)
 * @param totalMinutes - 전체 시간 (분)
 * @param progress - 진행률 (0-100), 제공 시 remainingMinutes 대신 사용
 * @param size - 타이머 크기 (px)
 * @param strokeWidth - 프로그레스 바 두께
 * @param isRunning - 타이머 실행 중 여부
 * @param children - 커스텀 내부 콘텐츠
 * @param color - 커스텀 프로그레스 바 색상
 */
interface FocusTimerProps {
    remainingMinutes?: number;
    totalMinutes?: number;
    progress?: number; // 0-100
    size?: number; // pixel size
    strokeWidth?: number;
    isRunning?: boolean;
    children?: ReactNode;
    color?: string;
}

/**
 * 집중 모드 타이머 컴포넌트
 * @param props - FocusTimerProps
 * @returns 원형 프로그레스 타이머 UI
 */
export function FocusTimer({
    remainingMinutes = 0,
    totalMinutes = 60,
    progress,
    size = 256,
    strokeWidth = 12,
    isRunning = false,
    children,
    color
}: FocusTimerProps) {
    // Calculate percentage
    const calculatedPercentage = totalMinutes > 0 ? (remainingMinutes / totalMinutes) * 100 : 0;
    const finalPercentage = progress !== undefined ? progress : Math.min(100, Math.max(0, calculatedPercentage));

    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (finalPercentage / 100) * circumference;

    // Default color logic if not provided
    const getDefaultColor = (percentage: number) => {
        if (percentage > 60) return '#3b82f6'; // Blue-500
        if (percentage > 30) return '#8b5cf6'; // Violet-500
        return '#ef4444'; // Red-500
    };

    const finalColor = color || getDefaultColor(finalPercentage);

    return (
        <motion.div
            className={`relative flex items-center justify-center`}
            animate={isRunning ? {
                scale: [1, 1.02, 1],
            } : {
                scale: 1,
            }}
            transition={isRunning ? {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
            } : { duration: 0.5 }}
        >
            {/* Background Circle */}
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="-rotate-90 transform"
            >
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    className="text-white/5"
                />
                {/* Progress Circle */}
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={finalColor}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 1, ease: "easeInOut" }}
                    strokeLinecap="round"
                    className={isRunning ? 'animate-pulse' : ''}
                />
            </svg>

            {/* Text Content */}
            <div className="absolute flex flex-col items-center text-center">
                {
                    children ? children : (
                        <>
                            <span className="text-sm font-medium text-white/50">남은 시간</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-5xl font-bold text-white tracking-tighter">
                                    {Math.floor(remainingMinutes / 60) > 0 && (
                                        <span className="mr-2">{Math.floor(remainingMinutes / 60)}<span className="text-2xl text-white/50">시간</span></span>
                                    )}
                                    {remainingMinutes % 60}
                                </span>
                                <span className="text-2xl font-medium text-white/50">분</span>
                            </div>
                        </>
                    )
                }
            </div>
        </motion.div>
    );
}
