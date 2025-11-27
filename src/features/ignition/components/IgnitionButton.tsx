/**
 * IgnitionButton - 우측 상단 툴바용 점화 버튼
 * 
 * @role 수동 점화 트리거, 남은 횟수 및 쿨다운 표시
 */

import { useState, useEffect } from 'react';
import { useIgnitionStore } from '../stores/useIgnitionStore';
import { useGameStateStore } from '@/shared/stores/gameStateStore';
import { checkIgnitionAvailability, formatCooldownTime } from '../utils/ignitionLimits';
import { useSettingsStore } from '@/shared/stores/settingsStore';

export default function IgnitionButton() {
    const { openIgnitionWithCheck } = useIgnitionStore();
    const { gameState } = useGameStateStore();
    const { settings } = useSettingsStore();
    const [cooldown, setCooldown] = useState(0);
    const [forceUpdate, setForceUpdate] = useState(0);

    const check = checkIgnitionAvailability(gameState, false, {
        cooldownMinutes: settings?.ignitionCooldownMinutes,
        xpCost: settings?.ignitionXPCost,
    });

    // 쿨다운 타이머
    useEffect(() => {
        if (check.cooldownRemaining && check.cooldownRemaining > 0) {
            setCooldown(check.cooldownRemaining);

            const interval = setInterval(() => {
                setCooldown(prev => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        // 타이머가 끝나면 forceUpdate를 증가시켜 컴포넌트 재렌더링 → check 재계산
                        setForceUpdate(f => f + 1);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(interval);
        } else {
            setCooldown(0);
        }
    }, [check.cooldownRemaining]);

    const handleClick = async () => {
        await openIgnitionWithCheck(false);
    };

    const isDisabled = !check.canIgnite && check.reason === 'cooldown';

    return (
        <button
            onClick={handleClick}
            disabled={isDisabled}
            className={`
        relative flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold
        transition-all duration-200
        ${isDisabled
                    ? 'cursor-not-allowed bg-gray-700 text-gray-400'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 hover:shadow-lg'
                }
      `}
            title={
                check.reason === 'cooldown'
                    ? `${Math.ceil(cooldown / 60)}분 후 사용 가능`
                    : check.requiresXP
                        ? `${check.requiresXP} XP로 구매`
                        : `점화 (남은 무료 횟수: ${check.freeSpinsRemaining})`
            }
        >
            <span className="text-sm">🔥</span>
            <span>점화</span>

            {/* 남은 무료 횟수 배지 */}
            {check.freeSpinsRemaining !== undefined && check.freeSpinsRemaining > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white">
                    {check.freeSpinsRemaining}
                </span>
            )}

            {/* 쿨다운 타이머 */}
            {cooldown > 0 && (
                <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {formatCooldownTime(cooldown)}
                </span>
            )}

            {/* XP 구매 표시 */}
            {check.requiresXP && !isDisabled && (
                <span className="text-xs opacity-75">
                    {check.requiresXP} XP
                </span>
            )}
        </button>
    );
}
