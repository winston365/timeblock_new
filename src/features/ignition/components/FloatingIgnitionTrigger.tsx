import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useSpring, useMotionValue } from 'framer-motion';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { useGameStateStore } from '@/shared/stores/gameStateStore';
import { useIgnitionStore } from '../stores/useIgnitionStore';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { SETTING_DEFAULTS } from '@/shared/constants/defaults';
import { Flame } from 'lucide-react';

// 세션 시작 시간 키 (sessionStorage)
const SESSION_START_KEY = 'ignition_session_start';

// 세션 시작 시간 가져오기 (새로고침해도 유지)
function getSessionStartTime(): number {
    const stored = sessionStorage.getItem(SESSION_START_KEY);
    if (stored) {
        return parseInt(stored, 10);
    }
    const now = Date.now();
    sessionStorage.setItem(SESSION_START_KEY, now.toString());
    return now;
}

export default function FloatingIgnitionTrigger() {
    const { dailyData } = useDailyDataStore();
    const { gameState } = useGameStateStore();
    const { openIgnitionWithCheck, isOpen } = useIgnitionStore();
    const { settings } = useSettingsStore();
    const [isVisible, setIsVisible] = useState(false);
    
    // 세션 시작 시점을 기록 (비활동 기준점으로 사용, 새로고침해도 유지)
    const sessionStartTimeRef = useRef<number>(getSessionStartTime());

    // Mouse position tracking
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    // Smooth spring physics for following (slower for easier clicking)
    const springConfig = { damping: 30, stiffness: 80, mass: 0.8 };
    const x = useSpring(mouseX, springConfig);
    const y = useSpring(mouseY, springConfig);

    // 설정값 추출 - 중앙화된 기본값 사용
    const justDoItCooldownMinutes = settings?.justDoItCooldownMinutes ?? SETTING_DEFAULTS.justDoItCooldownMinutes;
    const ignitionInactivityMinutes = settings?.ignitionInactivityMinutes ?? SETTING_DEFAULTS.ignitionInactivityMinutes;

    // 비활동 체크 로직
    // gameState에서 직접 최신 값을 읽어 closure 문제 방지
    const checkInactivity = useCallback(() => {
        // 최신 gameState를 store에서 직접 가져옴 (closure 문제 방지)
        const currentGameState = useGameStateStore.getState().gameState;
        
        if (!dailyData || !currentGameState) {
            console.log('[FloatingIgnition] No dailyData or gameState - waiting for load');
            setIsVisible(false);
            return;
        }

        // 점화 오버레이가 열려있으면 숨김
        if (isOpen) {
            setIsVisible(false);
            return;
        }

        // 보너스 전용 독립 쿨다운 체크 (gameState 기반)
        const bonusCooldownMs = justDoItCooldownMinutes * 60 * 1000;
        // lastBonusIgnitionTime이 null이면 한 번도 사용 안 한 것 → 쿨다운 없음
        const lastBonusTime = currentGameState.lastBonusIgnitionTime ?? 0;
        const bonusElapsed = Date.now() - lastBonusTime;

        console.log('[FloatingIgnition] Cooldown check:', {
            lastBonusIgnitionTime: lastBonusTime ? new Date(lastBonusTime).toLocaleTimeString() : 'never',
            justDoItCooldownMinutes,
            bonusCooldownMs,
            bonusElapsed,
            isInCooldown: lastBonusTime > 0 && bonusElapsed < bonusCooldownMs,
        });

        if (lastBonusTime > 0 && bonusElapsed < bonusCooldownMs) {
            const remainingMins = Math.ceil((bonusCooldownMs - bonusElapsed) / 60000);
            console.log('[FloatingIgnition] Bonus cooldown active:', remainingMins, 'mins remaining');
            setIsVisible(false);
            return;
        }

        const now = Date.now();
        
        // 비활동 기준 시간 결정 (우선순위):
        // 1. 오늘 완료한 마지막 작업 시간
        // 2. 마지막 보너스 점화 시간 (있으면)
        // 3. 세션 시작 시간 (fallback - 새로고침해도 바로 뜨지 않음)
        const lastCompletedTask = dailyData.tasks
            .filter(t => t.completed && t.completedAt)
            .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())[0];

        let lastActiveTime = sessionStartTimeRef.current; // 기본값: 세션 시작 시간

        if (lastCompletedTask && lastCompletedTask.completedAt) {
            lastActiveTime = new Date(lastCompletedTask.completedAt).getTime();
        } else if (lastBonusTime > 0) {
            // 완료한 작업이 없으면 마지막 보너스 점화 시간 사용
            lastActiveTime = lastBonusTime;
        }
        // 그 외에는 세션 시작 시간 사용 (새로고침해도 바로 뜨지 않음)

        const diffMinutes = (now - lastActiveTime) / (1000 * 60);

        console.log('[FloatingIgnition] Check:', {
            diffMinutes: diffMinutes.toFixed(1),
            threshold: ignitionInactivityMinutes,
            isOpen,
            lastActiveTime: new Date(lastActiveTime).toLocaleTimeString(),
            source: lastCompletedTask ? 'lastTask' : (lastBonusTime > 0 ? 'lastBonus' : 'sessionStart'),
        });

        // Show if > threshold mins inactive
        if (diffMinutes > ignitionInactivityMinutes) {
            console.log('[FloatingIgnition] ✅ Showing trigger!');
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [dailyData, gameState, isOpen, justDoItCooldownMinutes, ignitionInactivityMinutes]);

    useEffect(() => {
        // 초기 체크
        checkInactivity();

        // 1분마다 체크
        const interval = setInterval(checkInactivity, 60000);

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
    }, [checkInactivity, mouseX, mouseY]);

    // gameState가 변경되면 즉시 재체크 (점화 완료 후 lastBonusIgnitionTime 변경 감지)
    useEffect(() => {
        checkInactivity();
    }, [gameState, checkInactivity]);

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
                        const success = await openIgnitionWithCheck(true); // 보너스 = true
                        if (success) {
                            setIsVisible(false);
                            // gameState.lastBonusIgnitionTime은 useIgnitionStore에서 자동 업데이트됨
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
