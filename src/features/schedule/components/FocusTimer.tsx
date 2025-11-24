import { motion } from 'framer-motion';

interface FocusTimerProps {
    remainingMinutes: number;
    totalMinutes: number;
}

export function FocusTimer({ remainingMinutes, totalMinutes }: FocusTimerProps) {
    const percentage = Math.min(100, Math.max(0, (remainingMinutes / totalMinutes) * 100));
    const circumference = 2 * Math.PI * 120; // Radius 120
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    // Color interpolation based on percentage
    const getColor = (p: number) => {
        if (p > 60) return '#3b82f6'; // Blue-500
        if (p > 30) return '#8b5cf6'; // Violet-500
        return '#ef4444'; // Red-500
    };

    const color = getColor(percentage);

    return (
        <div className="relative flex items-center justify-center">
            {/* Background Circle */}
            <svg className="h-64 w-64 -rotate-90 transform">
                <circle
                    cx="128"
                    cy="128"
                    r="120"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    className="text-white/5"
                />
                {/* Progress Circle */}
                <motion.circle
                    cx="128"
                    cy="128"
                    r="120"
                    stroke={color}
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray={circumference}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 1, ease: "easeInOut" }}
                    strokeLinecap="round"
                />
            </svg>

            {/* Text Content */}
            <div className="absolute flex flex-col items-center text-center">
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
            </div>
        </div>
    );
}
