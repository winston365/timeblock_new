import { motion } from 'framer-motion';
import { ReactNode } from 'react';

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
    const getDefaultColor = (p: number) => {
        if (p > 60) return '#3b82f6'; // Blue-500
        if (p > 30) return '#8b5cf6'; // Violet-500
        return '#ef4444'; // Red-500
    };

    const finalColor = color || getDefaultColor(finalPercentage);

    return (
        <motion.div
            className={`relative flex items-center justify-center transition-all duration-700`}
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
                {children ? children : (
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
                )}
            </div>
        </motion.div>
    );
}
