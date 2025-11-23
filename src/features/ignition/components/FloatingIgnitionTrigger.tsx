import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useSpring, useMotionValue } from 'framer-motion';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { useIgnitionStore } from '../stores/useIgnitionStore';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { Flame } from 'lucide-react';

export default function FloatingIgnitionTrigger() {
    const { dailyData } = useDailyDataStore();
    const { openIgnitionWithCheck, startSpin, isOpen } = useIgnitionStore();
    const { settings } = useSettingsStore();
    const [isVisible, setIsVisible] = useState(false);

    // Mouse position tracking
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    // Smooth spring physics for following
    const springConfig = { damping: 25, stiffness: 150, mass: 0.5 };
    const x = useSpring(mouseX, springConfig);
    const y = useSpring(mouseY, springConfig);

    useEffect(() => {
        // Check inactivity logic
        const checkInactivity = () => {
            if (!dailyData) {
                console.log('[FloatingIgnition] No dailyData');
                return;
            }

            const now = Date.now();
            const lastCompletedTask = dailyData.tasks
                .filter(t => t.completed && t.completedAt)
                .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())[0];

            let lastActiveTime = 0;

            if (lastCompletedTask && lastCompletedTask.completedAt) {
                lastActiveTime = new Date(lastCompletedTask.completedAt).getTime();
            } else {
                // If no tasks completed today, use midnight (start of day)
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                lastActiveTime = today.getTime();
            }

            const diffMinutes = (now - lastActiveTime) / (1000 * 60);
            const inactivityThreshold = settings?.ignitionInactivityMinutes ?? 45;

            console.log('[FloatingIgnition] Check:', {
                diffMinutes: diffMinutes.toFixed(1),
                threshold: inactivityThreshold,
                isOpen,
                lastCompletedTask: lastCompletedTask?.text,
                lastActiveTime: new Date(lastActiveTime).toLocaleTimeString(),
            });

            // Show if > threshold mins inactive AND ignition is not already open
            if (diffMinutes > inactivityThreshold && !isOpen) {
                console.log('[FloatingIgnition] ✅ Showing trigger!');
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        const interval = setInterval(checkInactivity, 60000); // Check every minute
        checkInactivity(); // Initial check

        // Mouse move listener
        const handleMouseMove = (e: MouseEvent) => {
            // Offset slightly to bottom-right of cursor
            mouseX.set(e.clientX + 20);
            mouseY.set(e.clientY + 20);
        };

        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            clearInterval(interval);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [dailyData, isOpen, mouseX, mouseY, settings]);

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.button
                    style={{ x, y, position: 'fixed', top: 0, left: 0, zIndex: 9999 }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={async () => {
                        const success = await openIgnitionWithCheck(true); // 보너스 = true (제한 무시)
                        if (success) {
                            startSpin();
                            setIsVisible(false);
                        }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full shadow-lg cursor-pointer pointer-events-auto"
                >
                    <Flame className="w-4 h-4 animate-pulse" />
                    <span className="text-sm font-bold whitespace-nowrap">뭐라도 하자!</span>
                </motion.button>
            )}
        </AnimatePresence>
    );
}
